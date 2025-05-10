const express = require("express");
const { getUserProfile, updateUserProfile, changePassword, getAllUsers, getAllOrders, createProduct, updateProduct, getAllOrdersById } = require("../controllers/userController");
const logger = require("../logger");

// Import model Transaction
const Transaction = require("../models/transaction");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.put("/change-password", protect, changePassword);
router.get("/customer", protect, getAllUsers);
router.get("/orders", protect, getAllOrders);
router.post("/product", protect, createProduct);
router.put("/updateProduct/:id", protect, updateProduct);
router.get("/myorders/:email", protect, getAllOrdersById);

// Endpoint để lấy danh sách transactions
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