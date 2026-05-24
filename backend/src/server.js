require('dotenv').config();
const http = require('http');
const app = require('./app.js');
const connectDB = require('./config/mongodb.js'); // Import hàm kết nối
const httpServer = http.createServer(app);
const io = initSocket(httpServer);
const { connectRedis } = require('./config/redis.js');
app.set('io', io);
const { initSocket } = require('./sockets/index.js');
const { startCronJobs } = require('./jobs/reminder.job');

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
initSocket(httpServer); // Khởi tạo Socket.IO với server HTTP

// Khởi chạy đồng thời cả MongoDB và Redis bằng Promise.all
Promise.all([connectDB(), connectRedis()])
    .then(() => {
        // ĐOẠN MỚI: Đánh thức Trợ lý CronJob
        startCronJobs();

        // Khởi chạy server
        httpServer.listen(PORT, () => {
            console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Không thể khởi động server do lỗi kết nối Database.', err);
        process.exit(1);
    });