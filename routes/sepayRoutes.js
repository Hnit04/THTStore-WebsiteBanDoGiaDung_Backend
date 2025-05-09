const express = require("express");
const { createTransaction, handleWebhook, checkTransactionStatus } = require("../controllers/sepayController");

const router = express.Router();

// Tạo giao dịch mới
router.post("/create-transaction", createTransaction);

// Webhook nhận thông báo từ SEPay
router.post("/webhook", handleWebhook);

// Kiểm tra trạng thái giao dịch
router.get("/transaction/:transactionId", checkTransactionStatus);

module.exports = router;