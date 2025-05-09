const express = require("express")
const { getUserOrders, getOrderById, createOrder, cancelOrder } = require("../controllers/orderController")

const router = express.Router()

const { protect } = require("../middleware/authMiddleware")

router.route("/").get(protect, getUserOrders).post(protect, createOrder)
router.route("/:id").get(protect, getOrderById)
router.route("/:id/cancel").put(protect, cancelOrder)

module.exports = router
