const Room = require('../models/room.model');
const { addUserToRoom, updateSocketRoom } = require('../services/redis.service');
const { removeUserFromRoom } = require('../services/redis.service');

module.exports = (io, socket) => {
    
    // Lắng nghe sự kiện khách hàng xin vào phòng
    socket.on('room:join', async (payload) => {
        try {
            const { roomCode } = payload;
            const userId = socket.userId;

            // 1. Kiểm tra phòng tồn tại và trạng thái
            const room = await Room.findOne({ room_code: roomCode });
            if (!room) return socket.emit('error', { message: 'Phòng không tồn tại!' });
            if (room.status === 'ended') return socket.emit('error', { message: 'Cuộc họp này đã kết thúc!' });

            // 2. LOGIC MỚI: Kiểm tra xem có phải bật chế độ Phòng chờ không?
            const isHost = (room.host_id.toString() === userId); // Kiểm tra xem người đang xin vào có phải Chủ phòng không
            
            // Nếu phòng yêu cầu duyệt VÀ người xin vào KHÔNG phải là chủ phòng
            if (room.settings.require_approval && !isHost) {
                
                // 2.1 Báo cho người xin vào là: "Cứ ở ngoài phòng chờ nhé"
                socket.emit('room:pending', { 
                    message: 'Vui lòng chờ chủ phòng duyệt...',
                    roomCode: roomCode
                });

                // 2.2 Gửi trát yêu cầu duyệt tới Kênh cá nhân của Chủ phòng
                // (Chính là cái kênh ta vừa setup ở Thao tác 1)
                io.to(room.host_id.toString()).emit('room:request_approve', {
                    userId: userId,
                    roomCode: roomCode,
                    message: `Có người dùng ${userId} đang xin vào phòng`
                });

                console.log(`⏳ User [${userId}] đang ở phòng chờ của phòng [${roomCode}]`);
                return; // Dừng lại ở đây, KHÔNG chạy xuống code cho vào phòng bên dưới
            }

            // ==========================================
            // 3. DÀNH CHO: Phòng không cần duyệt HOẶC Chủ phòng tự vào HOẶC đã được duyệt
            // ==========================================
            socket.join(roomCode); // Vào kênh chung của phòng
            
            // Lưu vào Redis
            await addUserToRoom(roomCode, userId);
            await updateSocketRoom(socket.id, userId, roomCode);

            // Bắn loa thông báo
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

    // ==========================================
    // LỆNH 1: HOST CHẤP NHẬN YÊU CẦU (APPROVE)
    // ==========================================
    socket.on('room:approve_user', async (payload) => {
        try {
            const { roomCode, targetUserId } = payload; // Lấy mã phòng và ID của người đang đứng chờ
            
            // 1. Kiểm tra bảo mật: Ông vừa gửi sự kiện này có đúng là Host của phòng không?
            const room = await Room.findOne({ room_code: roomCode });
            if (!room || room.host_id.toString() !== socket.userId) {
                return socket.emit('error', { message: 'Bạn không có quyền duyệt người!' });
            }

            // 2. Lệnh ma thuật: Ép tất cả các thiết bị của người được duyệt join vào kênh phòng
            io.in(targetUserId).socketsJoin(roomCode);

            // 3. Cập nhật dữ liệu vào sổ tay Redis
            await addUserToRoom(roomCode, targetUserId);
            // Lấy danh sách socket của người đó để cập nhật phòng
            const targetSockets = await io.in(targetUserId).fetchSockets();
            for (const tSocket of targetSockets) {
                await updateSocketRoom(tSocket.id, targetUserId, roomCode);
            }

            // 4. Bắn loa thông báo
            // 4.1 Báo tin vui cho riêng người đó
            io.to(targetUserId).emit('room:approved', { 
                message: 'Bạn đã được chủ phòng duyệt!' 
            });
            
            // 4.2 Báo cho cả phòng biết có thành viên mới gia nhập
            io.to(roomCode).emit('room:user_joined', {
                userId: targetUserId,
                message: `Người dùng ${targetUserId} đã gia nhập phòng.`
            });

            console.log(`✅ Host [${socket.userId}] đã duyệt User [${targetUserId}] vào phòng [${roomCode}]`);

        } catch (error) {
            console.error('Lỗi khi duyệt user:', error);
        }
    });

    // ==========================================
    // LỆNH 2: HOST TỪ CHỐI YÊU CẦU (REJECT)
    // ==========================================
    socket.on('room:reject_user', async (payload) => {
        try {
            const { roomCode, targetUserId } = payload;
            
            // Vẫn phải kiểm tra bảo mật
            const room = await Room.findOne({ room_code: roomCode });
            if (!room || room.host_id.toString() !== socket.userId) {
                return socket.emit('error', { message: 'Bạn không có quyền từ chối!' });
            }

            // Báo tin buồn cho riêng người bị từ chối
            io.to(targetUserId).emit('room:rejected', { 
                message: 'Chủ phòng đã từ chối yêu cầu tham gia của bạn.' 
            });
            
            // Quyền lực tối thượng: Cắt luôn kết nối Socket của người đó để ép họ văng ra ngoài
            io.in(targetUserId).disconnectSockets();
            
            console.log(`❌ Host [${socket.userId}] đã TỪ CHỐI User [${targetUserId}]`);

        } catch (error) {
            console.error('Lỗi khi từ chối user:', error);
        }
    });

    // ==========================================
    // LỆNH 3: HOST ĐUỔI NGƯỜI DÙNG (KICK)
    // ==========================================
    socket.on('room:kick_user', async (payload) => {
        try {
            const { roomCode, targetUserId } = payload;

            // 1. Kiểm tra bảo mật: Chỉ có Chủ phòng mới có quyền bóp cò
            const room = await Room.findOne({ room_code: roomCode });
            if (!room || room.host_id.toString() !== socket.userId) {
                return socket.emit('error', { message: 'Bạn không có quyền đuổi người khác!' });
            }

            // 2. Báo "tin dữ" thẳng vào mặt người bị đuổi
            io.to(targetUserId).emit('room:kicked', { 
                message: 'Bạn đã bị chủ phòng mời ra khỏi cuộc họp.' 
            });

            // 3. Thực thi quyền lực: Rút phích cắm của người đó khỏi phòng
            // Lệnh socketsLeave sẽ lôi tất cả thiết bị của targetUserId ra khỏi roomCode
            io.in(targetUserId).socketsLeave(roomCode);

            // 4. Xóa tên khỏi "sổ tay" Redis
            await removeUserFromRoom(roomCode, targetUserId);

            // 5. Loa báo cáo cho những người còn lại trong phòng yên tâm
            io.to(roomCode).emit('room:user_left', {
                userId: targetUserId,
                message: `Người dùng ${targetUserId} đã bị mời ra khỏi phòng.`
            });

            console.log(`👢 Host [${socket.userId}] đã KICK User [${targetUserId}] khỏi phòng [${roomCode}]`);

        } catch (error) {
            console.error('Lỗi khi kick user:', error);
        }
    });
};