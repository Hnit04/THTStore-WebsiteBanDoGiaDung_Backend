const express = require("express");
const Queue = require("bull");
const logger = require("../logger");
require("dotenv").config();

// Import model Transaction
const Transaction = require("../models/transaction");

const router = express.Router();

// Middleware CORS và log chi tiết cho /webhook
router.use("/webhook", (req, res, next) => {
    logger.info(`[WEBHOOK] Middleware triggered for ${req.method} ${req.url}, origin: ${req.headers.origin}, headers: ${JSON.stringify(req.headers)}`);
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-SEPay-Signature");
    if (req.method === "OPTIONS") {
        logger.info(`[WEBHOOK] Responding to OPTIONS preflight for ${req.url}`);
        return res.status(200).end();
    }
    next();
});

const emailQueue = new Queue("emailQueue");

// Tạo giao dịch mới
router.post("/create-transaction", async (req, res) => {
    logger.info(`[CREATE] Received create-transaction request for ${req.url}, body: ${JSON.stringify(req.body)}`);
    const { transaction_id, amount, description, items, bank_account, customerEmail } = req.body;

    try {
        const transaction = new Transaction({
            transactionId: transaction_id,
            status: "PENDING",
            amount,
            metadata: { description, items, bank_account, customerEmail },
        });
        await transaction.save();

        let accountNumber = "0326829327";
        if (bank_account) {
            if (typeof bank_account === "object" && bank_account !== null) {
                accountNumber = bank_account.account || bank_account.number || bank_account.id || bank_account.value || "0326829327";
                logger.info(`[CREATE] Converted bank_account object to: ${accountNumber}`);
            } else if (typeof bank_account === "string") {
                accountNumber = bank_account;
            } else {
                logger.warn("[CREATE] Invalid bank_account format, using default", { bank_account });
            }
        }

        const qrCodeUrl = `https://qr.sepay.vn/img?acc=${accountNumber}&bank=MBBank&amount=${amount}&des=${transaction_id}`;
        logger.info(`[CREATE] Generated QR Code URL: ${qrCodeUrl}`);

        transaction.status = "CREATED";
        transaction.qrCodeUrl = qrCodeUrl;
        await transaction.save();

        req.io = req.app.get("socketio");
        if (req.io) {
            logger.info(`[CREATE] Emitting transactionUpdate for ${transaction_id}, status: CREATED`);
            req.io.emit("transactionUpdate", {
                transactionId: transaction.transactionId,
                status: "CREATED",
                qrCodeUrl: qrCodeUrl,
            });
        } else {
            logger.warn("[CREATE] Socket.IO instance not found in app");
        }

        res.json({
            success: true,
            transactionId: transaction_id,
            qrCodeUrl: qrCodeUrl,
        });
    } catch (error) {
        logger.error("[CREATE] Lỗi tạo giao dịch SePay", {
            message: error.message,
            stack: error.stack,
            bank_account: bank_account,
        });

        const transaction = new Transaction({
            transactionId: transaction_id,
            status: "FAILED",
            amount,
            metadata: { description, items, bank_account, customerEmail },
        });
        transaction.errorLogs.push({
            timestamp: new Date(),
            error: { message: error.message },
        });
        await transaction.save();

        res.status(500).json({
            success: false,
            error: `Không thể tạo giao dịch: ${error.message}`,
            transactionId: transaction_id,
        });
    }
});

// Kiểm tra trạng thái giao dịch
router.get("/transaction/:transactionId", async (req, res) => {
    const { transactionId } = req.params;

    logger.info(`[CHECK] Checking transaction status for ID: ${transactionId}`);
    try {
        const transaction = await Transaction.findOne({ transactionId });
        if (!transaction) {
            logger.warn(`[CHECK] Transaction not found: ${transactionId}`);
            return res.status(404).json({ success: false, error: "Không tìm thấy giao dịch" });
        }

        res.json({
            success: true,
            transaction: {
                id: transaction.transactionId,
                status: transaction.status,
                amount: transaction.amount,
                createdAt: transaction.createdAt,
            },
        });
    } catch (error) {
        logger.error("[CHECK] Lỗi kiểm tra trạng thái giao dịch", { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, error: "Lỗi kiểm tra trạng thái giao dịch" });
    }
});

// Webhook nhận thông báo từ SEPay
router.post("/webhook", async (req, res) => {
    logger.info(`[WEBHOOK] Processing webhook for ${req.url}, body: ${JSON.stringify(req.body)}, headers: ${JSON.stringify(req.headers)}`);

    const { id: sepayId, transferAmount: amount, transferType, description, content } = req.body;

    try {
        if (!sepayId || !transferType) {
            logger.warn("[WEBHOOK] Invalid webhook payload", { body: req.body });
            return res.status(400).json({ success: false, error: "Dữ liệu webhook không hợp lệ" });
        }

        const status = transferType === "in" ? "SUCCESS" : "PENDING";

        // Trích xuất transactionId từ description hoặc content
        let transactionId = null;
        const textToSearch = description || content || "";
        if (textToSearch) {
            const match = textToSearch.match(/THT\d+/);
            if (match) {
                transactionId = match[0];
                logger.info(`[WEBHOOK] Extracted transactionId from ${description ? "description" : "content"}: ${transactionId}`);
            }
        }

        // Tìm giao dịch dựa trên transactionId hoặc sepayId
        let transaction;
        if (transactionId) {
            const query = { transactionId };
            logger.info(`[WEBHOOK] Finding transaction with query: ${JSON.stringify(query)}`);
            transaction = await Transaction.findOneAndUpdate(
                query,
                { status, amount },
                { new: true }
            );
        }

        // Nếu không tìm thấy bằng transactionId, thử tìm bằng sepayId
        if (!transaction) {
            const query = { "metadata.referenceCode": sepayId };
            logger.info(`[WEBHOOK] Finding transaction with fallback query: ${JSON.stringify(query)}`);
            transaction = await Transaction.findOneAndUpdate(
                query,
                { status, amount },
                { new: true }
            );
        }

        if (!transaction) {
            logger.warn(`[WEBHOOK] Transaction not found for sepayId: ${sepayId}`);
            return res.status(404).json({ success: false, error: "Không tìm thấy giao dịch" });
        }

        logger.info(`[WEBHOOK] Updated transaction status to ${status} for ${transaction.transactionId}`);

        req.io = req.app.get("socketio");
        if (req.io) {
            const updateData = { transactionId: transaction.transactionId, status };
            logger.info(`[WEBHOOK] Emitting transactionUpdate with data: ${JSON.stringify(updateData)}`);
            req.io.emit("transactionUpdate", updateData);
        } else {
            logger.warn("[WEBHOOK] Socket.IO instance not found in app");
        }

        res.status(200).json({ success: true, message: "Webhook nhận và xử lý thành công" });
    } catch (error) {
        logger.error("[WEBHOOK] Lỗi xử lý webhook", { error: error.message, body: req.body, stack: error.stack });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;