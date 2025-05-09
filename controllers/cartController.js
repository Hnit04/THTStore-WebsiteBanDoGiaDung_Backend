// server/controllers/cartController.js
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Lấy giỏ hàng của người dùng hiện tại
const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart) {
      return res.json({ success: true, data: { user: req.user.id, items: [] } });
    }
    res.json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

// Thêm sản phẩm vào giỏ hàng
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    // Kiểm tra sản phẩm có tồn tại không
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Kiểm tra số lượng tồn kho
    if (quantity > product.stock) {
      return res.status(400).json({ success: false, error: 'Not enough stock' });
    }

    // Tìm giỏ hàng của người dùng
    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      // Nếu chưa có giỏ hàng, tạo mới
      cart = await Cart.create({
        user: req.user.id,
        items: [{ product: productId, quantity }],
      });
    } else {
      // Nếu đã có giỏ hàng, kiểm tra sản phẩm đã tồn tại trong giỏ chưa
      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
      if (itemIndex > -1) {
        // Nếu sản phẩm đã có, tăng số lượng
        cart.items[itemIndex].quantity += quantity;
        if (cart.items[itemIndex].quantity > product.stock) {
          return res.status(400).json({ success: false, error: 'Not enough stock' });
        }
      } else {
        // Nếu sản phẩm chưa có, thêm mới vào items
        cart.items.push({ product: productId, quantity });
      }
      await cart.save();
    }

    // Populate để trả về thông tin sản phẩm
    await cart.populate('items.product');
    res.status(201).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

// Cập nhật số lượng sản phẩm trong giỏ hàng
const updateCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }

    // Tìm item trong giỏ hàng
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: 'Item not found in cart' });
    }

    // Kiểm tra số lượng tồn kho
    const product = await Product.findById(cart.items[itemIndex].product);
    if (quantity > product.stock) {
      return res.status(400).json({ success: false, error: 'Not enough stock' });
    }

    // Cập nhật số lượng
    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1); // Xóa item nếu quantity <= 0
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    await cart.populate('items.product');
    res.json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

// Xóa sản phẩm khỏi giỏ hàng
const removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }

    // Tìm và xóa item
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: 'Item not found in cart' });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();
    await cart.populate('items.product');
    res.json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart };