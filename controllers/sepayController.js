const Transaction = require("../models/Transaction");
const Queue = require("bull");
const logger = require("../logger");

const emailQueue = new Queue("emailQueue");

exports.createTransaction = async (req, res) => {
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
        // Sử dụng số tài khoản mặc định nếu không có hoặc không hợp lệ
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

        // Tạo QR Code động qua qr.sepay.vn
        const qrCodeUrl = `https://qr.sepay.vn/img?acc=${accountNumber}&bank=MBBank&amount=${amount}&des=${transaction_id}`;
        logger.info(`Generated QR Code URL: ${qrCodeUrl}`);

        transaction.status = "CREATED";
        transaction.qrCodeUrl = qrCodeUrl;
        await transaction.save();

        req.io.emit("transactionUpdate", {
            transactionId: transaction_id,
            status: "CREATED",
            qrCodeUrl: qrCodeUrl,
        });

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

        req.io.emit("transactionUpdate", {
            transactionId: transaction_id,
            status: "FAILED",
            error: error.message,
        });

        res.status(500).json({ success: false, error: `Không thể tạo giao dịch: ${error.message}` });
    }
};

exports.handleWebhook = async (req, res) => {
    logger.info("Nhận webhook từ SePay", { body: req.body });
    const { transaction_id, status, amount } = req.body;

    try {
        const transaction = await Transaction.findOneAndUpdate(
            { transactionId: transaction_id },
            { status, amount },
            { new: true, upsert: true }
        );

        req.io.emit("transactionUpdate", { transactionId: transaction_id, status });

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

        res.status(200).json({ success: true, message: "Webhook nhận thành công" });
    } catch (error) {
        logger.error("Lỗi xử lý webhook", { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.checkTransactionStatus = async (req, res) => {
    const { transactionId } = req.params;

    try {
        const transaction = await Transaction.findOne({ transactionId });

        if (!transaction) {
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
        res.status(500).json({ success: false, error: error.message });
    }
};