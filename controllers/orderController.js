// controllers/orderController.js
const Order = require('../models/Order');

// @desc    Get all orders
// @route   GET /api/orders/orderCustomer
// @access  Public (tạm thời bỏ kiểm tra admin)
exports.getAllOrders = async (req, res, next) => {
  try {
    console.log('Gọi getAllOrders với query:', req.query);
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start) || isNaN(end)) {
        console.error('Invalid date format:', { startDate, endDate });
        return res.status(400).json({ success: false, error: 'Invalid date format' });
      }
      query.created_at = { $gte: start, $lte: end };
    }

    console.log('MongoDB Query:', query);
    const orders = await Order.find(query).sort({ created_at: -1 });

    console.log('Danh sách đơn hàng:', orders);
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (err) {
    console.error('Lỗi khi gọi getAllOrders:', err);
    next(err);
  }
};
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
        const order = await Order.find({id: req.params.id})

        // if (!order) {
        //   return res.status(404).json({
        //     success: false,
        //     error: "Không tìm thấy đơn hàng",
        //   })
        // }

        // Đảm bảo người dùng chỉ có thể xem đơn hàng của chính họ
        // if (order.user.toString() !== req.user.id && req.user.role !== "admin") {
        //   return res.status(403).json({
        //     success: false,
        //     error: "Không có quyền truy cập đơn hàng này",
        //   })
        // }

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

exports.getAllOrdersAdmin = async (req, res) => {
    try {
      console.log('getAllOrdersAdmin - Request Received:', req.headers);
      console.log('getAllOrdersAdmin - User:', req.user);
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập dữ liệu này' });
      }
  
      const { startDate, endDate } = req.query;
      console.log('getAllOrdersAdmin - Received Query:', { startDate, endDate });
  
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp startDate và endDate' });
      }
  
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
      console.log('getAllOrdersAdmin - Adjusted Dates:', { start: start.toISOString(), end: end.toISOString() });
  
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, message: 'Định dạng ngày không hợp lệ' });
      }
      if (start > end) {
        return res.status(400).json({ success: false, message: 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc' });
      }
  
      const query = { created_at: { $gte: start, $lte: end } };
      console.log('getAllOrdersAdmin - MongoDB Query:', query);
  
      const orders = await Order.find(query).select('id email created_at total_amount items status');
      console.log('getAllOrdersAdmin - Total orders found:', orders.length);
      orders.forEach((order, index) => console.log(`Order ${index + 1}:`, order));
  
      res.status(200).json({ success: true, data: orders });
    } catch (error) {
      console.error('getAllOrdersAdmin - Error:', error.message);
      res.status(500).json({ success: false, message: 'Lỗi server khi lấy đơn hàng', error: error.message });
    }
  };
  
