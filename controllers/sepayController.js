const axios = require("axios");
const Transaction = require("../models/Transaction");
const Queue = require("bull");
const crypto = require("crypto");
const logger = require("../logger");

const CLIENT_KEY = process.env.SEPAY_CLIENT_KEY;
const SEPAY_API_URL = process.env.SEPAY_API_URL;

const emailQueue = new Queue("emailQueue");

const getAccessToken = async () => {
    try {
        const response = await axios.post(`${SEPAY_API_URL}/oauth/token`, {
            client_id: process.env.SEPAY_CLIENT_ID,
            client_secret: process.env.SEPAY_CLIENT_SECRET,
            grant_type: "client_credentials",
        });
        return response.data.access_token;
    } catch (error) {
        logger.error("Lỗi lấy access token OAuth2", { error: error.message });
        throw error;
    }
};

exports.createTransaction = async (req, res) => {
    const { transaction_id, amount, description, items, bank_account, customerEmail } = req.body;

    if (!CLIENT_KEY) {
        logger.error("Thiếu SEPay Client Key");
        return res.status(500).json({ success: false, error: "Thiếu SEPay Client Key" });
    }

    const transaction = new Transaction({
        transactionId: transaction_id,
        status: "PENDING",
        amount,
        metadata: { description, items, bank_account, customerEmail },
    });
    await transaction.save();

    const payload = {
        client_key: CLIENT_KEY,
        transaction_id,
        amount,
        description,
        items,
        bank_account,
        currency: "VND",
        return_url: `${process.env.CLIENT_URL}/order-confirmation`,
        callback_url: `${process.env.CLIENT_URL}/api/sepay/webhook`,
    };

    try {
        // Uncomment nếu SEPay yêu cầu OAuth2
        // const accessToken = await getAccessToken();
        const response = await axios.post(`${SEPAY_API_URL}/transactions/create`, payload, {
            headers: {
                Authorization: `Bearer ${CLIENT_KEY}`, // Thay bằng accessToken nếu dùng OAuth2
                "Content-Type": "application/json",
            },
            timeout: 10000,
        });

        logger.info(`Gọi API SEPay thành công: ${SEPAY_API_URL}/transactions/create`, { transaction_id });
        console.log("SEPay API response:", JSON.stringify(response.data, null, 2));

        if (!response.data.success) {
            throw new Error(response.data.message || "Lỗi không xác định từ SEPay");
        }

        if (!response.data.qr_code_url) {
            throw new Error("Không nhận được qr_code_url từ SEPay");
        }

        transaction.status = "CREATED";
        transaction.qrCodeUrl = response.data.qr_code_url;
        transaction.checkoutUrl = response.data.checkout_url;
        await transaction.save();

        req.io.emit("transactionUpdate", {
            transactionId: transaction_id,
            status: "CREATED",
            qrCodeUrl: response.data.qr_code_url,
            checkoutUrl: response.data.checkout_url,
        });

        res.json({
            success: true,
            transactionId: transaction_id,
            qrCodeUrl: response.data.qr_code_url,
            checkoutUrl: response.data.checkout_url,
        });
    } catch (error) {
        logger.error(`Lỗi gọi API SEPay: ${SEPAY_API_URL}/transactions/create`, {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });

        transaction.status = "FAILED";
        transaction.errorLogs.push({
            timestamp: new Date(),
            error: { message: error.message, status: error.response?.status },
        });
        await transaction.save();

        req.io.emit("transactionUpdate", {
            transactionId: transaction_id,
            status: "FAILED",
            error: error.message,
        });

        let errorMessage = `Không thể kết nối SEPay: ${error.message}`;
        if (error.code === "ENOTFOUND") {
            errorMessage = "Không thể kết nối đến máy chủ SEPay. Vui lòng kiểm tra URL API.";
        } else if (error.response?.status === 401) {
            errorMessage = "Lỗi xác thực với SEPay. Vui lòng kiểm tra CLIENT_KEY.";
        }

        res.status(500).json({ success: false, error: errorMessage });
    }
};

exports.handleWebhook = async (req, res) => {
    const signature = req.headers["x-sepay-signature"];
    const secret = process.env.SEPAY_WEBHOOK_SECRET;
    const computedSignature = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(req.body))
        .digest("hex");

    if (signature !== computedSignature) {
        logger.error("Webhook chữ ký không hợp lệ", { signature, computedSignature });
        return res.status(401).json({ success: false, error: "Chữ ký không hợp lệ" });
    }

    logger.info("Nhận webhook từ SEPay", { body: req.body });
    const { transaction_id, status, amount } = req.body;

    try {
        const transaction = await Transaction.findOneAndUpdate(
            { transactionId: transaction_id },
            { status, amount },
            { new: true, upsert: true },
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