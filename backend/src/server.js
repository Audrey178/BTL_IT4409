require('dotenv').config();
const app = require('./app.js');
const connectDB = require('./config/mongodb.js'); // Import hàm kết nối

const PORT = process.env.PORT || 5000;

// Khởi chạy Database trước
connectDB().then(() => {
    // Database OK thì mới mở port chạy Server
    app.listen(PORT, () => {
        console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
    });
});