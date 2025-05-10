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
// Thêm nguồn gốc của SePay
allowedOrigins.push("https://sepay.vn");
logger.info(`CLIENT_URL: ${process.env.CLIENT_URL}`);
logger.info(`Allowed origins: ${JSON.stringify(allowedOrigins)}`);

const corsOptions = {
  origin: (origin, callback) => {
    logger.info(`Checking origin: ${origin}`);
    if (!origin || allowedOrigins.includes(origin) || origin?.includes("sepay.vn")) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"], // Thêm HEAD để hỗ trợ preflight
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true,
  optionsSuccessStatus: 200,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received request: ${req.method} ${req.url} from origin: ${req.headers.origin}`);
  next();
});

// Middleware xử lý preflight request cho webhook
app.options("/api/sepay/webhook", cors(corsOptions), (req, res) => {
  logger.info("Handling OPTIONS preflight request for webhook", { method: req.method, headers: req.headers });
  res.status(200).end();
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

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

app.post("/api/sepay/create-transaction", async (req, res) => {
  const { transaction_id, amount, description, items, bank_account, customerEmail } = req.body;

  logger.info("Received create-transaction request", { bank_account });

  const transaction = new Transaction({
    transactionId: transaction_id,
    status: "PENDING",
    amount,
    metadata: { description, items, bank_account, customerEmail },
  });
  await transaction.save();

  try {
    let accountNumber = "0326829327"; // Số tài khoản của Trần Công Tính
    if (bank_account) {
      if (typeof bank_account === "object" && bank_account !== null) {
        accountNumber = bank_account.account || bank_account.number || bank_account.id || bank_account.value || "0326829327";
        logger.info(`Converted bank_account object to: ${accountNumber}`);
      } else if (typeof bank_account === "string") {
        accountNumber = bank_account;
      } else {
        logger.warn("Invalid bank_account format, using default", { bank_account });
      }
    }

    const qrCodeUrl = `https://qr.sepay.vn/img?acc=${accountNumber}&bank=MBBank&amount=${amount}&des=${transaction_id}`;
    logger.info(`Generated QR Code URL: ${qrCodeUrl}`);

    transaction.status = "CREATED";
    transaction.qrCodeUrl = qrCodeUrl;
    await transaction.save();

    io.emit("transactionUpdate", {
      transactionId: transaction_id,
      status: "CREATED",
      qrCodeUrl: qrCodeUrl,
    });

    res.json({
      success: true,
      transactionId: transaction_id,
      qrCodeUrl: qrCodeUrl,
    });
  } catch (error) {
    logger.error("Lỗi tạo giao dịch SePay", {
      message: error.message,
      bank_account: bank_account,
    });

    transaction.status = "FAILED";
    transaction.errorLogs.push({
      timestamp: new Date(),
      error: { message: error.message },
    });
    await transaction.save();

    io.emit("transactionUpdate", {
      transactionId: transaction_id,
      status: "FAILED",
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: `Không thể tạo giao dịch: ${error.message}`,
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
  logger.info("Received webhook from SePay", {
    body: req.body,
    headers: req.headers,
    method: req.method,
    url: req.url,
  });

  try {
    const { transaction_id, status, amount } = req.body;

    if (!transaction_id || !status) {
      logger.warn("Invalid webhook payload", { body: req.body });
      return res.status(400).json({ success: false, error: "Dữ liệu webhook không hợp lệ" });
    }

    const transaction = await Transaction.findOneAndUpdate(
        { transactionId: transaction_id },
        { status, amount },
        { new: true, upsert: true }
    );

    if (!transaction) {
      logger.warn("Transaction not found for update", { transaction_id });
      return res.status(404).json({ success: false, error: "Không tìm thấy giao dịch" });
    }

    logger.info(`Updated transaction status to ${status} for ${transaction_id}`);

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

    res.status(200).json({ success: true, message: "Webhook nhận và xử lý thành công" });
  } catch (error) {
    logger.error("Lỗi xử lý webhook", { error: error.message, body: req.body });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use((err, req, res, next) => {
  logger.error("Lỗi server", { error: err.stack, method: req.method, url: req.url });
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Lỗi server",
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server đang chạy trên cổng ${PORT}`);
});