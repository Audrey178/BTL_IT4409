require('dotenv').config();
const http = require('http');
const app = require('./app.js');
const connectDB = require('./config/mongodb.js'); // Import hàm kết nối
const httpServer = http.createServer(app);
const io = initSocket(httpServer);
const { connectRedis } = require('./config/redis.js');
app.set('io', io);
const { initSocket } = require('./sockets/index.js');

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
initSocket(httpServer); // Khởi tạo Socket.IO với server HTTP

// Khởi chạy đồng thời cả MongoDB và Redis bằng Promise.all
Promise.all([connectDB(), connectRedis()])
    .then(() => {
        httpServer.listen(PORT, () => {
            console.log(`🚀 Server realtime đang chạy tại: http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("❌ Khởi động server thất bại:", err);
    });