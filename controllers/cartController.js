// Sửa lỗi trong cartController.js
// server/controllers/cartController.js
const Cart = require("../models/Cart")
const Product = require("../models/Product")

// Lấy giỏ hàng của người dùng hiện tại
const getCart = async (req, res, next) => {
  try {
    console.log("Getting cart for user:", req.user.id)
    const cart = await Cart.findOne({ user: req.user.id }).populate("items.product")

    if (!cart) {
      console.log("No cart found, returning empty array")
      return res.json({ success: true, data: [] })
    }

    console.log(`Cart found with ${cart.items.length} items`)
    res.json({ success: true, data: cart.items || [] })
  } catch (error) {
    console.error("Error in getCart:", error)
    next(error)
  }
}

// Thêm sản phẩm vào giỏ hàng
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body
    console.log(`Adding product ${productId} to cart with quantity ${quantity}`)

    if (!productId) {
      return res.status(400).json({ success: false, error: "Thiếu ID sản phẩm" })
    }

    // Kiểm tra sản phẩm có tồn tại không
    const product = await Product.findById(productId)
    if (!product) {
      console.log(`Product ${productId} not found`)
      return res.status(404).json({ success: false, error: "Sản phẩm không tồn tại" })
    }

    console.log(`Product found: ${product.name}, stock: ${product.stock}`)

    // Kiểm tra số lượng tồn kho
    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        error: "Không đủ hàng tồn kho",
        available: product.stock,
      })
    }

    // Tìm giỏ hàng của người dùng
    let cart = await Cart.findOne({ user: req.user.id })
    console.log(`Cart for user ${req.user.id} ${cart ? "found" : "not found"}`)

    if (!cart) {
      // Nếu chưa có giỏ hàng, tạo mới
      console.log("Creating new cart")
      cart = await Cart.create({
        user: req.user.id,
        items: [{ product: productId, quantity }],
      })
    } else {
      // Nếu đã có giỏ hàng, kiểm tra sản phẩm đã tồn tại trong giỏ chưa
      const itemIndex = cart.items.findIndex((item) => item.product.toString() === productId)

      if (itemIndex > -1) {
        // Nếu sản phẩm đã có, tăng số lượng
        console.log(`Product already in cart at index ${itemIndex}, updating quantity`)
        cart.items[itemIndex].quantity += quantity

        if (cart.items[itemIndex].quantity > product.stock) {
          return res.status(400).json({
            success: false,
            error: "Không đủ hàng tồn kho",
            available: product.stock,
          })
        }
      } else {
        // Nếu sản phẩm chưa có, thêm mới vào items
        console.log("Adding new product to cart")
        cart.items.push({ product: productId, quantity })
      }
      await cart.save()
    }

    // Populate để trả về thông tin sản phẩm
    await cart.populate("items.product")
    console.log(`Cart now has ${cart.items.length} items`)

    res.status(201).json({ success: true, data: cart.items || [] })
  } catch (error) {
    console.error("Error in addToCart:", error)
    next(error)
  }
}

// Cập nhật số lượng sản phẩm trong giỏ hàng
const updateCartItem = async (req, res, next) => {
  try {
    const { _id } = req.params
    const { quantity } = req.body
    console.log(`Updating cart item ${_id} to quantity ${quantity}`)

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: req.user.id })
    if (!cart) {
      return res.status(404).json({ success: false, error: "Không tìm thấy giỏ hàng" })
    }

    // Tìm item trong giỏ hàng
    const itemIndex = cart.items.findIndex((item) => item._id.toString() === _id)
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: "Không tìm thấy sản phẩm trong giỏ hàng" })
    }

    // Kiểm tra số lượng tồn kho
    const product = await Product.findById(cart.items[itemIndex].product)
    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        error: "Không đủ hàng tồn kho",
        available: product.stock,
      })
    }

    // Cập nhật số lượng
    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1) // Xóa item nếu quantity <= 0
    } else {
      cart.items[itemIndex].quantity = quantity
    }

    await cart.save()
    await cart.populate("items.product")
    res.json({ success: true, data: cart.items || [] })
  } catch (error) {
    console.error("Error in updateCartItem:", error)
    next(error)
  }
}

// Xóa sản phẩm khỏi giỏ hàng
const removeFromCart = async (req, res, next) => {
  try {
    const { _id } = req.params
    console.log(`Removing item ${_id} from cart`)

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: req.user.id })
    if (!cart) {
      return res.status(404).json({ success: false, error: "Không tìm thấy giỏ hàng" })
    }

    // Tìm và xóa item
    const itemIndex = cart.items.findIndex((item) => item._id.toString() === _id)
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: "Không tìm thấy sản phẩm trong giỏ hàng" })
    }

    cart.items.splice(itemIndex, 1)
    await cart.save()
    await cart.populate("items.product")
    res.json({ success: true, data: cart.items || [] })
  } catch (error) {
    console.error("Error in removeFromCart:", error)
    next(error)
  }
}

module.exports = { getCart, addToCart, updateCartItem, removeFromCart }
