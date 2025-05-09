const mongoose = require("mongoose")

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.ObjectId,
        ref: "Product",
      },
      productName: {
        type: String,
        required: true,
      },
      productPrice: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, "Số lượng không được nhỏ hơn 1"],
      },
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  shippingAddress: {
    type: String,
    required: true,
  },
  shippingCity: {
    type: String,
    required: true,
  },
  shippingPostalCode: {
    type: String,
  },
  shippingCountry: {
    type: String,
    default: "Vietnam",
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["cod", "banking", "momo", "zalopay"],
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  status: {
    type: String,
    required: true,
    enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model("Order", OrderSchema)
