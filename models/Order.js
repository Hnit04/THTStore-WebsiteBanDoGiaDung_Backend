const mongoose = require("mongoose")
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas!'))
  .catch(err => console.error('Connection error:', err));

const OrderSchema = new mongoose.Schema({
  id: {
    type: String, 
  },
  email:{
    type: String,
    required: true,
  },
  name: {
    type: String,
  },
  phone: {
    type: String,
  },
  status: {
    type: String,
    required: true,
    enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
    default: "pending",
  },
  total_amount: {
    type: Number,
    required: true,
  },
  shipping_address: {
    type: String,
    required: true,
  },
  shipping_city: {
    type: String,
    required: true,
  },
  shipping_postalCode: {
    type: String,
  },
  shipping_country: {
    type: String,
    default: "Vietnam",
  },
  payment_method: {
    type: String,
    required: true,
    enum: ["cod", "banking", "momo", "zalopay"],
  },
  payment_status: {
    type: String,
    required: true,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: null,
  },
  items: [
    {
      product_id: {
        type: String, 
        ref: 'Product'
      },
      product_name: {
        type: String,
        required: true,
      },
      product_price: {
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
  
})

module.exports = mongoose.model("Order", OrderSchema)
