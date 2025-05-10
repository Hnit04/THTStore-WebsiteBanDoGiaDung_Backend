const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        transactionId: String,
        status: String,
        amount: Number,
        qrCodeUrl: String,
        checkoutUrl: String,
        createdAt: { type: Date, default: Date.now },
        metadata: { type: Object, default: {} },
        errorLogs: [Object],
    },
    { collection: "transactions" } // Đảm bảo collection là "transactions"
);

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;