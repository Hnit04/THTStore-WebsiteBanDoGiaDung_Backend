const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
} = require('../controllers/cartController');

const router = express.Router();

const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getCart);

router.post('/', protect, addToCart);

router.put('/:_id', protect, updateCartItem);

router.delete('/:_id', protect, removeFromCart);

module.exports = router;