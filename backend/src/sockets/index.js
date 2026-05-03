const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { redisClient } = require('../config/redis.js'); 
const roomHandler = require('./room.handler');
const webrtcHandler = require('./webrtc.handler');
const chatHandler = require('./chat.handler');

const initSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    const { saveSocketState, removeSocketState } = require('../services/redis.service');

    // 1. Cài đặt Redis Adapter (Nếu bạn đã chạy Docker Redis)
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Đã nạp Redis Adapter cho Socket.IO thành công!');
    }).catch(err => {
        console.error('❌ Lỗi kết nối pub/sub Redis:', err);
    });

    // 2. Middleware xác thực (Auth)
    // Theo đặc tả, mọi kết nối phải kiểm tra JWT 
    // 2. Middleware xác thực (Auth) linh hoạt
    io.use((socket, next) => {
        // Tìm token từ 1 trong 3 nơi (Hỗ trợ cả Postman và Frontend)
        let token = socket.handshake.auth?.token 
                 || socket.handshake.query?.token 
                 || socket.handshake.headers['authorization'];

        // Nếu client gửi lên kèm chữ "Bearer " ở đầu (chuẩn HTTP header), ta cắt nó đi
        if (token && token.startsWith('Bearer ')) {
            token = token.slice(7, token.length);
        }
        
        if (!token) {
            return next(new Error('Từ chối truy cập: Không có Token!'));
        }

        try {
            // Giải mã Token bằng chữ ký bí mật trong file .env
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            
            socket.userId = decoded.id; 
            next(); 
        } catch (error) {
            return next(new Error('Từ chối truy cập: Token sai hoặc đã hết hạn!'));
        }
    });

    // 3. Lắng nghe sự kiện kết nối
    io.on('connection', (socket) => {
        console.log(`⚡ Thiết bị [${socket.id}] của User [${socket.userId}] đã kết nối`);

        // Lưu ngay trạng thái "Đang online" vào Redis
        // Lúc này họ mới vào mạng, chưa vào phòng nên roomCode = null
        saveSocketState(socket.id, socket.userId, null);
        socket.join(socket.userId);
        roomHandler(io, socket);
        webrtcHandler(io, socket);
        chatHandler(io, socket);
        
        // Khi ngắt kết nối (Tắt tab, mất mạng...)
        socket.on('disconnect', () => {
            console.log(`❌ Thiết bị [${socket.id}] đã ngắt kết nối`);
            // Dọn dẹp rác trong Redis
            removeSocketState(socket.id);
        });
    });

    return io;
};

module.exports = { initSocket };