const User = require("../models/User")
const bcrypt = require("bcrypt")
const Order = require("../models/Order")

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.user.email }); // Tìm theo email

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

const Product = require('../models/Product');

exports.getAllOrders = async (req, res, next) => {
  try {
    const statusOrder = ["pending", "processing", "shipped", "delivered"];

    const orders = await Order.find().lean(); // Use lean() for better performance

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        // Lấy thông tin người dùng từ email
        const user = await User.findOne({ email: order.email }).lean();

        // Lấy thông tin sản phẩm kèm hình ảnh
        const itemsWithImages = await Promise.all(
          order.items.map(async (item) => {
            const product = await Product.findOne({ id: item.product_id }).lean();
            return {
              ...item,
              image_url: product?.image_url || null,
              product_name: product?.name || item.product_name || "Unknown Product",
            };
          })
        );

        return {
          ...order,
          items: itemsWithImages,
          user_fullName: user?.fullName || "Unknown User",
          user_phone: user?.phone || "Chưa có số điện thoại",
        };
      })
    );

    ordersWithDetails.sort((a, b) => {
      const aStatusIndex = statusOrder.indexOf(a.status);
      const bStatusIndex = statusOrder.indexOf(b.status);
    
      if (aStatusIndex !== bStatusIndex) {
        return aStatusIndex - bStatusIndex; // Ưu tiên status
      } else {
        return new Date(a.created_at) - new Date(b.created_at); // Ưu tiên ngày đặt sớm hơn
      }
    });
    res.status(200).json({
      success: true,
      count: ordersWithDetails.length,
      data: ordersWithDetails,
    });

    console.log("Danh sách đơn hàng:", ordersWithDetails);
  } catch (err) {
    console.error("Lỗi khi gọi getAllOrders:", err);
    next(err);
  }
};

// backend controller (OrderController.js)
exports.getAllOrdersById = async (req, res, next) => {
  try {
    const email = req.params.email; // Lấy email từ URL
    const statusOrder = ["pending", "processing", "shipped", "delivered"];

    const orders = await Order.find({ email }).lean(); // Lọc đơn hàng theo email

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        // Lấy thông tin người dùng từ email
        const user = await User.findOne({ email: order.email }).lean();

        // Lấy thông tin sản phẩm kèm hình ảnh
        const itemsWithImages = await Promise.all(
          order.items.map(async (item) => {
            const product = await Product.findOne({ id: item.product_id }).lean();
            return {
              ...item,
              image_url: product?.image_url || null,
              product_name: product?.name || item.product_name || "Unknown Product",
            };
          })
        );

        return {
          ...order,
          items: itemsWithImages,

        };
      })
    );

    ordersWithDetails.sort((a, b) => {
      const aStatusIndex = statusOrder.indexOf(a.status);
      const bStatusIndex = statusOrder.indexOf(b.status);
    
      if (aStatusIndex !== bStatusIndex) {
        return aStatusIndex - bStatusIndex; // Ưu tiên status
      } else {
        return new Date(a.created_at) - new Date(b.created_at); // Ưu tiên ngày đặt sớm hơn
      }
    });
    console.log("ordersWithDetails", ordersWithDetails);
    res.status(200).json({
      success: true,
      count: ordersWithDetails.length,
      data: ordersWithDetails,
    });

    console.log("Danh sách đơn hàng:", ordersWithDetails);
  } catch (err) {
    console.error("Lỗi khi gọi getAllOrders:", err);
    next(err);
  }
};








// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res, next) => {
  try {
    const { fullName, phone, address, city, district, ward } = req.body

    // Tìm và cập nhật thông tin người dùng
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        fullName,
        phone,
        address,
        city,
        district,
        ward,
      },
      { new: true, runValidators: true },
    )

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    res.status(200).json({
      success: true,
      data: user,
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    // Kiểm tra xem đã cung cấp đủ thông tin chưa
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới",
      })
    }

    // Lấy thông tin người dùng kèm mật khẩu
    const user = await User.findById(req.user._id).select("+password")

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng",
      })
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.matchPassword(currentPassword)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Mật khẩu hiện tại không đúng",
      })
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword
    await user.save()

    res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công",
    })
  } catch (err) {
    next(err)
  }
}

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: "user" }).select("-password"); // Chỉ lấy user, không lấy password

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};


// @desc    Create new product
// @route   POST /api/products
// @access  Private (hoặc Public tùy yêu cầu)
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      price,
      old_price,
      image_url,
      description,
      category_id,
      rating,
      review_count,
      is_new,
      discount,
      stock,
      created_at,
    } = req.body;

    // Kiểm tra trường bắt buộc
    if (!name || !price || !category_id) {
      return res.status(400).json({
        success: false,
        error: "Thiếu trường bắt buộc (name, price, category_id)",
      });
    }

    // Đếm số lượng sản phẩm hiện tại
    const total = await Product.countDocuments();

    // Sinh id tự động dựa trên số lượng sản phẩm hiện có
    const generatedId = (total + 1).toString();

    // Tạo sản phẩm mới
    const product = await Product.create({
      id: generatedId,
      name,
      price,
      old_price,
      image_url,
      description,
      category_id,
      rating,
      review_count,
      is_new,
      discount,
      stock,
      created_at: created_at || new Date().toISOString(),
    });
    console.log("Product created:", product); // Log the created product
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error("Lỗi createProduct:", err);
    res.status(500).json({ success: false, error: "Lỗi server khi tạo sản phẩm" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const id  = req.params.id; // Lấy mã sản phẩm từ params
    console.log("Mã sản phẩm:", id); // Log mã sản phẩm
    // Kiểm tra trường bắt buộc
    const requiredFields = ['name', 'price', 'category_id'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          error: `Thiếu thông tin bắt buộc (${requiredFields.join(', ')})`,
        });
      }
    }

    // Tìm sản phẩm theo trường id (không phải _id)
    const product = await Product.findOne({ id: req.params.id });
    console.log("Sản phẩm tìm thấy:", product); // Log sản phẩm tìm thấy
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy sản phẩm để cập nhậ1t",
      });
    }

    // Cập nhật sản phẩm
    Object.assign(product, {
      id: id,
      name: req.body.name,
      price: req.body.price,
      old_price: req.body.old_price,
      image_url: req.body.image_url,
      description: req.body.description,
      category_id: req.body.category_id,
      rating: req.body.rating,
      review_count: req.body.review_count,
      is_new: req.body.is_new,
      discount: req.body.discount,
      stock: req.body.stock,
    });

    await product.save();

    console.log("✅ Product updated:", product);
    res.status(200).json({
      success: true,
      data: product,
    });

  } catch (err) {
    console.error("❌ Lỗi updateProduct:", err);
    res.status(500).json({
      success: false,
      error: "Lỗi server khi cập nhật sản phẩm",
    });
  }
};
