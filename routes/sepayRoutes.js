const express = require("express");
const Transaction = require("../models/Transaction");
const Queue = require("bull");
const logger = require("../logger");

const router = express.Router();

const emailQueue = new Queue("emailQueue");

// Tạo giao dịch mới
router.post("/create-transaction", async (req, res) => {
    const { transaction_id, amount, description, items, bank_account, customerEmail } = req.body;

    logger.info("Received create-transaction request", { bank_account });

    const transaction = new Transaction({
        transactionId: transaction_id,
        status: "PENDING",
        amount,
        metadata: { description, items, bank_account, customerEmail },
    });
    await transaction.save();

    try {
        let accountNumber = "0326829327"; // Số tài khoản của Trần Công Tình
        if (bank_account) {
            if (typeof bank_account === "object" && bank_account !== null) {
                accountNumber = bank_account.account || bank_account.number || bank_account.id || bank_account.value || "0326829327";
                logger.info(`Converted bank_account object to: ${accountNumber}`);
            } else if (typeof bank_account === "string") {
                accountNumber = bank_account;
            } else {
                logger.warn("Invalid bank_account format, using default", { bank_account });
            }
        }

        const qrCodeUrl = `https://qr.sepay.vn/img?acc=${accountNumber}&bank=MBBank&amount=${amount}&des=${transaction_id}`;
        logger.info(`Generated QR Code URL: ${qrCodeUrl}`);

        transaction.status = "CREATED";
        transaction.qrCodeUrl = qrCodeUrl;
        await transaction.save();

        // Emit sự kiện qua socket
        req.io = req.app.get("socketio"); // Lấy socket từ app
        if (req.io) {
            req.io.emit("transactionUpdate", {
                transactionId: transaction_id,
                status: "CREATED",
                qrCodeUrl: qrCodeUrl,
            });
        } else {
            logger.warn("Socket.IO instance not found in app");
        }

        res.json({
            success: true,
            transactionId: transaction_id,
            qrCodeUrl: qrCodeUrl,
        });
    } catch (error) {
        logger.error("Lỗi tạo giao dịch SePay", {
            message: error.message,
            bank_account: bank_account,
        });

        transaction.status = "FAILED";
        transaction.errorLogs.push({
            timestamp: new Date(),
            error: { message: error.message },
        });
        await transaction.save();

        req.io = req.app.get("socketio");
        if (req.io) {
            req.io.emit("transactionUpdate", {
                transactionId: transaction_id,
                status: "FAILED",
                error: error.message,
            });
        } else {
            logger.warn("Socket.IO instance not found in app");
        }

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

    logger.info(`Checking transaction status for ID: ${transactionId}`);
    try {
        const transaction = await Transaction.findOne({ transactionId });
        if (!transaction) {
            logger.warn(`Transaction not found: ${transactionId}`);
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
        logger.error("Lỗi kiểm tra trạng thái giao dịch", { error: error.message });
        res.status(500).json({ success: false, error: "Lỗi kiểm tra trạng thái giao dịch" });
    }
});

// Webhook nhận thông báo từ SEPay
router.post("/webhook", async (req, res) => {
    logger.info(`Processing webhook for ${req.url}, body: ${JSON.stringify(req.body)}, headers: ${JSON.stringify(req.headers)}`);
    const { transaction_id, status, amount } = req.body;

    try {
        if (!transaction_id || !status) {
            logger.warn("Invalid webhook payload", { body: req.body });
            return res.status(400).json({ success: false, error: "Dữ liệu webhook không hợp lệ" });
        }

        const transaction = await Transaction.findOneAndUpdate(
            { transactionId: transaction_id },
            { status, amount },
            { new: true, upsert: true }
        );

        if (!transaction) {
            logger.warn("Transaction not found for update", { transaction_id });
            return res.status(404).json({ success: false, error: "Không tìm thấy giao dịch" });
        }

        logger.info(`Updated transaction status to ${status} for ${transaction_id}`);

        // Emit sự kiện qua socket
        req.io = req.app.get("socketio");
        if (req.io) {
            req.io.emit("transactionUpdate", { transactionId: transaction_id, status });
        } else {
            logger.warn("Socket.IO instance not found in app");
        }

        if (status === "SUCCESS") {
            const customerEmail = transaction.metadata.customerEmail || "default@example.com";
            const itemsList = transaction.metadata.items
                .map((item) => `${item.name} (x${item.quantity}): ${item.price} VND`)
                .join("\n");

            const mailOptions = {
                from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
                to: customerEmail,
                subject: "Xác nhận thanh toán thành công - THT Store",
                text: `Chào bạn,\n\nGiao dịch #${transaction_id} đã thành công!\n\nChi tiết:\n${itemsList}\nTổng: ${amount} VND\n\nCảm ơn bạn đã mua sắm tại THT Store.`,
            };

            await emailQueue.add(mailOptions);
            logger.info(`Email xác nhận được xếp hàng cho giao dịch ${transaction_id}`);
        }

        res.status(200).json({ success: true, message: "Webhook nhận và xử lý thành công" });
    } catch (error) {
        logger.error("Lỗi xử lý webhook", { error: error.message, body: req.body });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;