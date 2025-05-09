const express = require("express")
const cors = require("cors")
const dotenv = require("dotenv")
const connectDB = require("./config/db")

// Load env vars
dotenv.config()

// Connect to database
connectDB()

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use("/api/auth", require("./routes/authRoutes"))
app.use("/api/products", require("./routes/productRoutes"))
app.use("/api/categories", require("./routes/categoryRoutes"))
app.use("/api/cart", require("./routes/cartRoutes"))
app.use("/api/orders", require("./routes/orderRoutes"))
app.use("/api/users", require("./routes/userRoutes")) // Thêm route mới

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    success: false,
    error: err.message || "Server Error",
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
