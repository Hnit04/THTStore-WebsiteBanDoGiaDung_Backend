const nodemailer = require("nodemailer");

// Tạo transporter một lần để tái sử dụng
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // Sử dụng STARTTLS trên cổng 587
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false, // Bỏ qua kiểm tra chứng chỉ tự ký
        },
    });
};

const transporter = createTransporter();

// Tạo template HTML cho email
const generateEmailHTML = (subject, message, code) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
    <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 20px;">
      <h2 style="color: #d32f2f; text-align: center; margin-bottom: 20px;">${subject}</h2>
      <p style="color: #333; font-size: 16px; line-height: 1.5;">${message}</p>
      ${code ? `
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; background-color: #d32f2f; color: #ffffff; font-size: 24px; font-weight: bold; padding: 10px 20px; border-radius: 4px;">${code}</span>
        </div>
      ` : ""}
      <p style="color: #333; font-size: 14px; line-height: 1.5;">Mã này sẽ hết hạn sau 10 phút. Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.</p>
      <hr style="border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #666; font-size: 12px; text-align: center;">
        © ${new Date().getFullYear()} THT Store. All rights reserved.<br>
        <a href="${process.env.WEBSITE_URL || 'https://tht-store.vercel.app/'}" style="color: #d32f2f; text-decoration: none;">Visit our website</a>
      </p>
    </div>
  </div>
`;

// Hàm gửi email
const sendEmail = async (options) => {
    try {
        // Kiểm tra tham số đầu vào
        const { email, subject, message, code } = options;
        if (!email || !subject || !message) {
            throw new Error("Thiếu thông tin email, tiêu đề hoặc nội dung");
        }

        // Cấu hình email
        const mailOptions = {
            from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
            to: email,
            subject,
            text: `${message}\n${code ? `Mã: ${code}\n` : ""}Mã này sẽ hết hạn sau 10 phút.`,
            html: generateEmailHTML(subject, message, code),
        };

        // Gửi email
        console.log(`[sendEmail] Sending email to ${email} with subject: ${subject}`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[sendEmail] Email sent to ${email}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[sendEmail] Failed to send email to ${options.email}:`, error);
        throw new Error(`Không thể gửi email: ${error.message}`);
    }
};

module.exports = sendEmail;