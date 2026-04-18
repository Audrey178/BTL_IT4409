const Room = require('../models/room.model');
const { addUserToRoom, updateSocketRoom } = require('../services/redis.service');

module.exports = (io, socket) => {
    
    // Lắng nghe sự kiện khách hàng xin vào phòng
    socket.on('room:join', async (payload) => {
        try {
            const { roomCode } = payload;
            const userId = socket.userId;

            // 1. Kiểm tra xem phòng có tồn tại thật không?
            const room = await Room.findOne({ room_code: roomCode });
            if (!room) {
                // Gửi lỗi riêng cho người vừa gọi
                return socket.emit('error', { message: 'Phòng không tồn tại!' });
            }

            // 2. Kiểm tra trạng thái phòng (Nếu đã kết thúc thì không cho vào)
            if (room.status === 'ended') {
                return socket.emit('error', { message: 'Cuộc họp này đã kết thúc!' });
            }

            // (Logic duyệt người (require_approval) sẽ được thêm vào sau. 
            // Tạm thời ta cho phép vào thẳng để test luồng cơ bản).

            // 3. Chính thức cho Socket gia nhập "Kênh" (Room) của thư viện
            socket.join(roomCode);

            // 4. Cập nhật dữ liệu vào Redis
            await addUserToRoom(roomCode, userId);
            await updateSocketRoom(socket.id, userId, roomCode);

            // 5. Phát loa thông báo cho TẤT CẢ mọi người TRONG PHÒNG ĐÓ
            // .to(roomCode) đảm bảo tin nhắn không bị lọt sang phòng khác
            io.to(roomCode).emit('room:user_joined', {
                userId: userId,
                message: `Người dùng ${userId} vừa tham gia phòng.`
            });

            console.log(`✅ User [${userId}] đã join phòng [${roomCode}]`);

        } catch (error) {
            console.error(error);
            socket.emit('error', { message: 'Lỗi hệ thống khi tham gia phòng' });
        }
    });

};