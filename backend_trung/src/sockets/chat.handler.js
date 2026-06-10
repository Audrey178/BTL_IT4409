const Message = require('../models/message.model');

module.exports = (io, socket) => {
    
    socket.on('room:send_message', async (payload) => {
        try {
            // Nhận thêm các trường thông tin file từ Frontend gửi lên
            const { roomCode, content, file_url, file_name, file_type } = payload;
            const userId = socket.userId;

            // Kiểm tra: Nếu không có cả chữ lẫn file thì báo lỗi
            const hasText = content && content.trim() !== '';
            const hasFile = file_url && file_url.trim() !== '';

            if (!hasText && !hasFile) {
                return socket.emit('error', { message: 'Bạn phải nhập nội dung hoặc đính kèm file!' });
            }

            // 1. Lưu tin nhắn vào MongoDB
            const newMessage = new Message({
                room_code: roomCode,
                sender_id: userId,
                content: hasText ? content.trim() : '',
                file_url: file_url || null,
                file_name: file_name || null,
                file_type: file_type || null
            });
            await newMessage.save();

            // 2. Cầm loa phát tin nhắn cho TẤT CẢ mọi người trong phòng
            io.to(roomCode).emit('room:receive_message', {
                messageId: newMessage._id,
                senderId: userId,
                content: newMessage.content,
                file_url: newMessage.file_url,
                file_name: newMessage.file_name,
                file_type: newMessage.file_type,
                createdAt: newMessage.createdAt
            });

            console.log(`💬 User [${userId}] gửi ${hasFile ? 'FILE' : 'TIN NHẮN'} vào phòng [${roomCode}]`);

        } catch (error) {
            console.error('Lỗi khi gửi tin nhắn:', error);
            socket.emit('error', { message: 'Không thể gửi tin nhắn lúc này' });
        }
    });

};