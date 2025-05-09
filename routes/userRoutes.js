const express = require("express")
const { getUserProfile, updateUserProfile, changePassword, getAllUsers, getAllOrders, createProduct, updateProduct, getAllOrdersById } = require("../controllers/userController")

const router = express.Router()

const { protect } = require("../middleware/authMiddleware")

router.get("/profile", protect, getUserProfile)
router.put("/profile", protect, updateUserProfile)
router.put("/change-password", protect, changePassword)
router.get("/customer", protect, getAllUsers)
router.get("/orders", protect, getAllOrders) // Thêm route mới để lấy danh sách đơn hàng của người dùng
router.post("/product",protect, createProduct)
router.put("/updateProduct/:id",protect, updateProduct)
router.get("/myorders/:email", protect, getAllOrdersById) 

module.exports = router
