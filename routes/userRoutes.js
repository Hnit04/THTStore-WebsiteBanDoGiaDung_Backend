const express = require("express");
const { getUserProfile, updateUserProfile, changePassword, getAllUsers, getAllOrders, createProduct, updateProduct, getAllOrdersById } = require("../controllers/userController");
const mongoose = require("mongoose");
const logger = require("../logger");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const Transaction = mongoose.model(
    "Transaction",
    new mongoose.Schema({}, { strict: false }),
    "transactions"
);

router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.put("/change-password", protect, changePassword);
router.get("/customer", protect, getAllUsers);
router.get("/orders", protect, getAllOrders);
router.post("/product", protect, createProduct);
router.put("/updateProduct/:id", protect, updateProduct);
router.get("/myorders/:email", protect, getAllOrdersById);

// Thêm endpoint để lấy danh sách transactions
router.get("/mytransactions/:email", protect, async (req, res) => {
    const { email } = req.params;

    logger.info(`[USER] Fetching transactions for email: ${email}`);
    try {
        const transactions = await Transaction.find({
            "metadata.customerEmail": email,
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: transactions,
        });
    } catch (error) {
        logger.error("[USER] Lỗi lấy danh sách giao dịch", { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, error: "Lỗi lấy danh sách giao dịch" });
    }
});

module.exports = router;