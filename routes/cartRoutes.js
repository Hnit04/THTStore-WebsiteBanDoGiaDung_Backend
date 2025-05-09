// server/routes/cartRoutes.js
const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
} = require('../controllers/cartController');

const router = express.Router();

const { protect } = require('../middleware/authMiddleware');

// Lấy giỏ hàng của người dùng hiện tại
router.get('/', protect, getCart);

// Thêm sản phẩm vào giỏ hàng
router.post('/', protect, addToCart);

// Cập nhật số lượng sản phẩm trong giỏ hàng
router.put('/:itemId', protect, updateCartItem);

// Xóa sản phẩm khỏi giỏ hàng
router.delete('/:itemId', protect, removeFromCart);

module.exports = router;