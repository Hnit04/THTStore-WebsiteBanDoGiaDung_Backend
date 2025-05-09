const mongoose = require("mongoose")

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Vui lòng nhập tên sản phẩm"],
    trim: true,
    maxlength: [100, "Tên sản phẩm không được vượt quá 100 ký tự"],
  },
  price: {
    type: Number,
    required: [true, "Vui lòng nhập giá sản phẩm"],
    min: [0, "Giá sản phẩm không được âm"],
  },
  oldPrice: {
    type: Number,
    default: null,
  },
  description: {
    type: String,
    required: [true, "Vui lòng nhập mô tả sản phẩm"],
  },
  imageUrl: {
    type: String,
    default: "/placeholder.svg",
  },
  category: {
    type: mongoose.Schema.ObjectId,
    ref: "Category",
    required: true,
  },
  stock: {
    type: Number,
    required: [true, "Vui lòng nhập số lượng tồn kho"],
    min: [0, "Số lượng tồn kho không được âm"],
    default: 0,
  },
  rating: {
    type: Number,
    default: 0,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  isNewProduct: {
    type: Boolean,
    default: false,
  },
  discount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model("Product", ProductSchema)
