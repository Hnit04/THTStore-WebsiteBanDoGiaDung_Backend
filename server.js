const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const axios = require("axios");
const crypto = require("crypto");
const { Server } = require("socket.io");
const http = require("http");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Queue = require("bull");
const logger = require("./logger");

dotenv.config();
connectDB();

// Cấu hình allowedOrigins với loại bỏ / thừa
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, "")) // Loại bỏ / ở cuối
    : ["https://tht-store.vercel.app"];
// Thêm kiểm tra cứng để đảm bảo origin chính xác
if (!allowedOrigins.includes("https://tht-store.vercel.app")) {
  allowedOrigins.push("https://tht-store.vercel.app");
}
logger.info(`CLIENT_URL: ${process.env.CLIENT_URL}`);
logger.info(`Allowed origins: ${JSON.stringify(allowedOrigins)}`);

// Cấu hình CORS chi tiết
const corsOptions = {
  origin: (origin, callback) => {
    logger.info(`Checking origin: ${origin}`);
    if (!origin || allowedOrigins.includes(origin)) {
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
const io = new Server(server, {
  cors: corsOptions,
});

// Áp dụng CORS middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Xử lý preflight cho tất cả route
app.use(express.json());

// Log để debug yêu cầu
app.use((req, res, next) => {
  logger.info(`Received request: ${req.method} ${req.url} from origin: ${req.headers.origin}`);
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

const CLIENT_KEY = process.env.SEPAY_CLIENT_KEY;
const SEPAY_API_URL = process.env.SEPAY_API_URL;

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

app.post("/api/sepay/create-transaction", async (req, res) => {
  const { transaction_id, amount, description, items, bank_account, customerEmail } = req.body;

  if (!CLIENT_KEY) {
    logger.error("Thiếu SEPay Client Key");
    return res.status(500).json({ success: false, error: "Thiếu SEPay Client Key" });
  }

  const transaction = new Transaction({
    transactionId: transaction_id,
    status: "PENDING",
    amount,
    metadata: { description, items, bank_account, customerEmail },
  });
  await transaction.save();

  const payload = {
    client_key: CLIENT_KEY,
    transaction_id,
    amount,
    description,
    items,
    bank_account,
    currency: "VND",
    return_url: `${process.env.CLIENT_URL}/order-confirmation`,
    callback_url: `${process.env.CLIENT_URL}/api/sepay/webhook`,
  };

  try {
    const response = await axios.post(`${SEPAY_API_URL}/transactions/create`, payload, {
      headers: {
        Authorization: `Bearer ${CLIENT_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    logger.info(`Gọi API SEPay thành công: ${SEPAY_API_URL}/transactions/create`, { transaction_id });

    if (!response.data.success) {
      throw new Error(response.data.message || "Lỗi không xác định từ SEPay");
    }

    transaction.status = "CREATED";
    transaction.qrCodeUrl = response.data.qr_code_url;
    transaction.checkoutUrl = response.data.checkout_url;
    await transaction.save();

    io.emit("transactionUpdate", {
      transactionId: transaction_id,
      status: "CREATED",
      qrCodeUrl: response.data.qr_code_url,
      checkoutUrl: response.data.checkout_url,
    });

    res.json({
      success: true,
      transactionId: transaction_id,
      qrCodeUrl: response.data.qr_code_url,
      checkoutUrl: response.data.checkout_url,
    });
  } catch (error) {
    logger.error(`Lỗi gọi API SEPay: ${SEPAY_API_URL}/transactions/create`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    transaction.status = "FAILED";
    transaction.errorLogs.push({
      timestamp: new Date(),
      error: { message: error.message, status: error.response?.status },
    });
    await transaction.save();

    io.emit("transactionUpdate", {
      transactionId: transaction_id,
      status: "FAILED",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: `Không thể kết nối SEPay: ${error.message}`,
      transactionId: transaction_id,
    });
  }
});

app.get("/api/sepay/transaction/:transactionId", async (req, res) => {
  const { transactionId } = req.params;

  try {
    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      return res.status(404).json({ success: false, error: "Không tìm thấy giao dịch" });
    }

    res.json({
      success: true,
      transaction: {
        id: transaction.transactionId,
        status: transaction.status,
        amount: transaction.amount,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    logger.error("Lỗi kiểm tra trạng thái giao dịch", { error: error.message });
    res.status(500).json({ success: false, error: "Lỗi kiểm tra trạng thái giao dịch" });
  }
});

app.post("/api/sepay/webhook", async (req, res) => {
  const signature = req.headers["x-sepay-signature"];
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  const computedSignature = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");

  if (signature !== computedSignature) {
    logger.error("Webhook chữ ký không hợp lệ", { signature, computedSignature });
    return res.status(401).json({ success: false, error: "Chữ ký không hợp lệ" });
  }

  logger.info("Nhận webhook từ SEPay", { body: req.body });
  const { transaction_id, status, amount } = req.body;

  try {
    const transaction = await Transaction.findOneAndUpdate(
        { transactionId: transaction_id },
        { status, amount },
        { new: true, upsert: true },
    );

    io.emit("transactionUpdate", { transactionId: transaction_id, status });

    if (status === "SUCCESS") {
      const customerEmail = transaction.metadata.customerEmail || "default@example.com";
      const itemsList = transaction.metadata.items
          .map((item) => `${item.name} (x${item.quantity}): ${item.price} VND`)
          .join("\n");

      const mailOptions = {
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: customerEmail,
        subject: "Xác nhận thanh toán thành công - THT Store",
        text: `Chào bạn,\n\nGiao dịch #${transaction_id} đã thành công!\n\nChi tiết:\n${itemsList}\nTổng: ${amount} VND\n\nCảm ơn bạn đã mua sắm tại THT Store.`,
      };

      await emailQueue.add(mailOptions);
      logger.info(`Email xác nhận được xếp hàng cho giao dịch ${transaction_id}`);
    }

    res.status(200).json({ success: true, message: "Webhook nhận thành công" });
  } catch (error) {
    logger.error("Lỗi xử lý webhook", { error: error.message });
    res.status(500).json({ success: false, error: "Lỗi xử lý webhook" });
  }
});

app.get("/api/sepay/check-connection", async (req, res) => {
  if (!CLIENT_KEY) {
    logger.error("Thiếu SEPay Client Key");
    return res.status(500).json({ success: false, error: "Thiếu SEPay Client Key" });
  }

  try {
    const response = await axios.get(`${SEPAY_API_URL}/status`, {
      headers: { Authorization: `Bearer ${CLIENT_KEY}` },
      timeout: 5000,
    });

    logger.info("Kiểm tra kết nối SEPay thành công");
    res.json({ success: true, status: "success", data: response.data });
  } catch (error) {
    logger.error("Lỗi kiểm tra kết nối SEPay", {
      error: error.message,
      status: error.response?.status,
    });
    res.json({
      success: false,
      status: "error",
      error: error.message,
      statusCode: error.response?.status,
    });
  }
});

// Middleware xử lý lỗi
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