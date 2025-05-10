const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { Server } = require("socket.io");
const http = require("http");
const mongoose = require("mongoose");
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

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// Middleware log toàn cục
app.use((req, res, next) => {
  logger.info(`Received request: ${req.method} ${req.url} from origin: ${req.headers.origin}`);
  next();
});

// Middleware CORS cụ thể cho /api/sepay/webhook
app.use("/api/sepay/webhook", (req, res, next) => {
  logger.info(`Webhook middleware triggered for ${req.method} ${req.url}, origin: ${req.headers.origin}, headers: ${JSON.stringify(req.headers)}`);
  res.header("Access-Control-Allow-Origin", "*"); // Tạm thời cho phép tất cả để debug
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    logger.info(`Responding to OPTIONS preflight for ${req.url}`);
    return res.status(200).end();
  }
  next();
});

const transactionSchema = new mongoose.Schema({
  transactionId: String,
  status: String,
  amount: Number,
  qrCodeUrl: String,
  checkoutUrl: String,
  createdAt: { type: Date, default: Date.now },
  metadata: Object,
  errorLogs: [Object],
});
const Transaction = mongoose.model("Transaction", transactionSchema);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const emailQueue = new Queue("emailQueue");
emailQueue.process(async (job) => {
  await transporter.sendMail(job.data);
});

// Sử dụng các route
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/sepay", require("./routes/sepayRoutes")); // Thêm sepayRoutes

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