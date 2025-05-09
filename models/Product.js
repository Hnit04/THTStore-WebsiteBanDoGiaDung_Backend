const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas!'))
  .catch(err => console.error('Connection error:', err));

const ProductSchema = new mongoose.Schema({
  id: {
    type: String,
    required: false,
    unique: true,
  },
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
  old_price: {
    type: Number,
    default: null,
  },
  image_url: {
    type: String,
    default: "/placeholder.svg",
  },
  images: {
    type: [String],
    default: [],
  },
  description: {
    type: String,
    required: [true, "Vui lòng nhập mô tả sản phẩm"],
  },
  category_id: {
    type: String,
    ref: 'Category',
    required: true,
  },
  rating: {
    type: Number,
    default: 0,
  },
  review_count: {
    type: Number,
    default: 0,
  },
  is_new: {
    type: Boolean,
    default: false,
  },
  discount: {
    type: Number,
    default: 0,
  },
  stock: {
    type: Number,
    required: [true, "Vui lòng nhập số lượng tồn kho"],
    min: [0, "Số lượng tồn kho không được âm"],
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Product", ProductSchema);