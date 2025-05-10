const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { Server } = require("socket.io");
const http = require("http");
const nodemailer = require("nodemailer");
const Queue = require("bull");
const logger = require("./logger");

dotenv.config();
connectDB();

const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((origin) => origin.trim().replace(/\/+$/, ""))
    : ["https://tht-store.vercel.app"];
if (!allowedOrigins.includes("https://tht-store.vercel.app")) {
  allowedOrigins.push("https://tht-store.vercel.app");
}
allowedOrigins.push("https://sepay.vn");
logger.info(`CLIENT_URL: ${process.env.CLIENT_URL}`);
logger.info(`Allowed origins: ${JSON.stringify(allowedOrigins)}`);

const corsOptions = {
  origin: (origin, callback) => {
    logger.info(`Checking origin for general CORS: ${origin}`);
    if (!origin || allowedOrigins.includes(origin) || origin.includes("sepay.vn")) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// Lưu socket instance vào app
app.set("socketio", io);

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// Middleware log toàn cục
app.use((req, res, next) => {
  logger.info(`Received request: ${req.method} ${req.url} from origin: ${req.headers.origin}`);
  next();
});

// Sử dụng các route (ưu tiên /api/sepay)
app.use("/api/sepay", require("./routes/sepayRoutes")); // Đặt lên đầu để ưu tiên
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

app.use((err, req, res, next) => {
  logger.error("Lỗi server", { error: err.stack });
  res.status(500).json({
    success: false,
    error: err.message || "Lỗi server",
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server đang chạy trên cổng ${PORT}`);
});