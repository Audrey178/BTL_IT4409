const Message = require('../models/message.model');

module.exports = (io, socket) => {
    
    // Lắng nghe sự kiện người dùng bấm gửi tin nhắn
    socket.on('room:send_message', async (payload) => {
        try {
            const { roomCode, content } = payload;
            const userId = socket.userId;

            // Kiểm tra xem tin nhắn có bị trống không
            if (!content || content.trim() === '') {
                return socket.emit('error', { message: 'Tin nhắn không được để trống!' });
            }

            // 1. Lưu tin nhắn vào MongoDB để lưu trữ lịch sử vĩnh viễn
            const newMessage = new Message({
                room_code: roomCode,
                sender_id: userId,
                content: content.trim()
            });
            await newMessage.save();

            // 2. Cầm loa phát tin nhắn cho TẤT CẢ mọi người trong phòng
            // (Bao gồm cả người gửi, để Frontend của họ tự động hiện tin nhắn lên màn hình)
            io.to(roomCode).emit('room:receive_message', {
                messageId: newMessage._id,
                senderId: userId,
                content: newMessage.content,
                createdAt: newMessage.createdAt
            });

            console.log(`💬 User [${userId}] gửi tin nhắn vào phòng [${roomCode}]`);

        } catch (error) {
            console.error('Lỗi khi gửi tin nhắn:', error);
            socket.emit('error', { message: 'Không thể gửi tin nhắn lúc này' });
        }
    });

};