const mongoose = require("mongoose")
const slugify = require("slugify")

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Vui lòng nhập tên danh mục"],
    unique: true,
    trim: true,
    maxlength: [50, "Tên danh mục không được vượt quá 50 ký tự"],
  },
  slug: {
    type: String,
    unique: true,
  },
  icon: {
    type: String,
    default: "🏠",
  },
  color: {
    type: String,
    default: "bg-blue-100 text-blue-600",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Create category slug from the name
CategorySchema.pre("save", function (next) {
  this.slug = slugify(this.name, { lower: true })
  next()
})

module.exports = mongoose.model("Category", CategorySchema)
