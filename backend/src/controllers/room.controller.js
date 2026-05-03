const Room = require('../models/room.model');
const Message = require('../models/message.model');
const { deleteRoomData } = require('../services/redis.service'); 

// Hàm tạo chuỗi ngẫu nhiên (VD: abc-def-ghi)
const generateRoomCode = () => {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}-${s4()}-${s4()}`;
};

const createRoom = async (req, res) => {
    try {
        // Lấy ID của người tạo từ cái thẻ tên mà Middleware vừa gắn vào lúc nãy
        const hostId = req.user.id;
        const { require_approval, allow_chat } = req.body;

        const newRoom = new Room({
            room_code: generateRoomCode(),
            host_id: hostId,
            settings: {
                require_approval: require_approval || false,
                allow_chat: allow_chat !== undefined ? allow_chat : true
            }
        });

        await newRoom.save();

        res.status(201).json({
            message: 'Tạo phòng thành công!',
            room_code: newRoom.room_code,
            room: newRoom
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi tạo phòng', error: error.message });
    }
};

// ==========================================
// API: KẾT THÚC PHÒNG HỌP
// ==========================================
const endRoom = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const userId = req.user.id; // Lấy từ verifyToken

        // 1. Kiểm tra phòng và quyền Chủ phòng
        const room = await Room.findOne({ room_code: roomCode });
        if (!room) {
            return res.status(404).json({ message: 'Không tìm thấy phòng!' });
        }
        if (room.host_id.toString() !== userId) {
            return res.status(403).json({ message: 'Chỉ chủ phòng mới có quyền kết thúc cuộc họp!' });
        }
        if (room.status === 'ended') {
            return res.status(400).json({ message: 'Phòng này đã kết thúc từ trước rồi.' });
        }

        // 2. Đổi trạng thái trong MongoDB
        room.status = 'ended';
        await room.save();

        // 3. Dọn rác trong Redis
        await deleteRoomData(roomCode);

        // 4. Lấy cái 'io' mà ta đã bơm vào app ở Thao tác 1
        const io = req.app.get('io');

        // Báo tử cho cả phòng biết
        io.to(roomCode).emit('room:ended', { 
            message: 'Cuộc họp đã bị kết thúc bởi chủ phòng.' 
        });

        // Tuyệt chiêu cuối: Rút phích cắm tất cả mọi người đang ở trong phòng này
        io.in(roomCode).disconnectSockets();

        res.status(200).json({ message: 'Đã kết thúc cuộc họp và giải tán tất cả thành viên!' });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi kết thúc phòng', error: error.message });
    }
};

// ==========================================
// API: LẤY LỊCH SỬ TIN NHẮN CỦA PHÒNG
// ==========================================
const getChatHistory = async (req, res) => {
    try {
        const { roomCode } = req.params;

        // Tìm tất cả tin nhắn thuộc về roomCode này
        // .sort({ createdAt: 1 }) nghĩa là sắp xếp theo thời gian: Cũ nhất xếp trước, mới nhất xếp sau
        const messages = await Message.find({ room_code: roomCode })
            .sort({ createdAt: 1 });

        res.status(200).json({
            message: 'Lấy lịch sử tin nhắn thành công!',
            total_messages: messages.length,
            data: messages
        });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy lịch sử chat', error: error.message });
    }
};

module.exports = { createRoom, endRoom, getChatHistory };