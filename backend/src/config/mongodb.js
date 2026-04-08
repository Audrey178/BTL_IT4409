const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Lấy địa chỉ kho từ file .env
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Đã kết nối thành công tới MongoDB!');
    } catch (error) {
        console.error('❌ Lỗi kết nối MongoDB:', error.message);
        // Không cho chạy server nếu database sập
        process.exit(1); 
    }
};

module.exports = connectDB;