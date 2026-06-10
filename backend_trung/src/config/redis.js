const { createClient } = require('redis');

// Khởi tạo client kết nối với Redis trong Docker (dựa vào file .env)
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('❌ Lỗi Redis Client:', err));
redisClient.on('connect', () => console.log('✅ Đã kết nối thành công tới Redis!'));

// Hàm mở kết nối để gọi ở file server.js
const connectRedis = async () => {
    await redisClient.connect();
};

module.exports = { redisClient, connectRedis };