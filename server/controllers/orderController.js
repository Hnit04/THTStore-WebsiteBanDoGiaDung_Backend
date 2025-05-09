const Order = require("../models/Order")

// @desc    Get orders of current user
// @route   GET /api/orders
// @access  Private
exports.getUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy đơn hàng",
      })
    }

    // Đảm bảo người dùng chỉ có thể xem đơn hàng của chính họ
    if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Không có quyền truy cập đơn hàng này",
      })
    }

    res.status(200).json({
      success: true,
      data: order,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    // Thêm user ID vào req.body
    req.body.user = req.user.id

    const order = await Order.create(req.body)

    res.status(201).json({
      success: true,
      data: order,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy đơn hàng",
      })
    }

    // Đảm bảo người dùng chỉ có thể hủy đơn hàng của chính họ
    if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Không có quyền hủy đơn hàng này",
      })
    }

    // Chỉ có thể hủy đơn hàng ở trạng thái chờ xác nhận hoặc đang xử lý
    if (order.status !== "pending" && order.status !== "processing") {
      return res.status(400).json({
        success: false,
        error: "Không thể hủy đơn hàng ở trạng thái này",
      })
    }

    order.status = "cancelled"
    await order.save()

    res.status(200).json({
      success: true,
      data: order,
    })
  } catch (err) {
    next(err)
  }
}
