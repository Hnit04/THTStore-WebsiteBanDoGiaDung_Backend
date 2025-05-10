const mongoose = require("mongoose");
const connectDB = require("./config/db");
const logger = require("./logger");

connectDB();

const Transaction = mongoose.model(
    "Transaction",
    new mongoose.Schema({}, { strict: false }),
    "transactions"
);

const Order = mongoose.model(
    "Order",
    new mongoose.Schema({}, { strict: false }),
    "orders"
);

const migrateTransactionToOrder = async () => {
    try {
        // Tìm giao dịch THT1746861191435
        const transaction = await Transaction.findOne({ transactionId: "THT1746861191435" });
        if (!transaction) {
            logger.error("Không tìm thấy giao dịch THT1746861191435");
            return;
        }

        logger.info(`Tìm thấy giao dịch: ${JSON.stringify(transaction.toObject(), null, 2)}`);

        // Kiểm tra xem đã có order tương ứng chưa
        const existingOrder = await Order.findOne({ transactionId: "THT1746861191435" });
        if (existingOrder) {
            logger.info("Đã tồn tại order cho giao dịch THT1746861191435");
            return;
        }

        // Tạo order mới
        const orderCount = await Order.countDocuments();
        const orderId = `ORD-${String(orderCount + 1).padStart(3, "0")}`; // Tạo mã đơn hàng: ORD-005, ...

        const metadata = transaction.metadata || {};
        const items = metadata.items || [];
        const formattedItems = items.map((item) => ({
            product_id: item.name, // Không có product_id, tạm dùng name
            product_name: item.name,
            quantity: item.quantity,
            product_price: item.price,
        }));

        const order = new Order({
            id: orderId,
            transactionId: "THT1746861191435",
            user_id: "unknown", // Không có user_id trong transaction, để mặc định
            email: metadata.customerEmail || "default@example.com",
            user_fullName: "Unknown User",
            user_phone: "0326829327", // Số điện thoại từ webhook
            name: "Unknown Receiver", // Không có thông tin người nhận
            phone: "0326829327",
            status: "processing",
            total_amount: transaction.amount || 30001,
            shipping_address: "Chưa có địa chỉ",
            shipping_city: "Chưa có thành phố",
            shipping_postal_code: "700000",
            shipping_country: "Vietnam",
            payment_method: "banking",
            payment_status: "completed",
            items: formattedItems,
            created_at: new Date(transaction.createdAt || "2025-05-10T07:13:11.845Z"),
            updated_at: new Date(),
        });

        await order.save();
        logger.info(`Đã tạo order ${orderId} cho giao dịch THT1746861191435`);
    } catch (error) {
        logger.error("Lỗi khi chuyển giao dịch thành order", { error: error.message, stack: error.stack });
    } finally {
        mongoose.connection.close();
    }
};

migrateTransactionToOrder();