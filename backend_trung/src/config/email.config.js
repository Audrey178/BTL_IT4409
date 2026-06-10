const nodemailer = require('nodemailer');

// 1. Khởi tạo trạm phát (Transporter) kết nối với Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 2. Kiểm tra kết nối ngay khi khởi động Server
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Lỗi kết nối Trạm phát Email:', error.message);
    } else {
        console.log('📧 Trạm phát Email (Nodemailer) đã sẵn sàng hoạt động!');
    }
});

// 3. Viết hàm tiện ích để gửi thư nhanh gọn
const sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: `"Hệ Thống Họp Trực Tuyến" <${process.env.EMAIL_USER}>`, // Tên người gửi hiển thị
            to: to, // Có thể là 1 email hoặc 1 mảng/chuỗi các email phẩy nhau
            subject: subject,
            html: htmlContent // Hỗ trợ gửi giao diện HTML cho đẹp
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Đã gửi email tới: ${to} (MessageID: ${info.messageId})`);
        return true;
    } catch (error) {
        console.error(`❌ Lỗi khi gửi email tới ${to}:`, error);
        return false;
    }
};

module.exports = { sendEmail };