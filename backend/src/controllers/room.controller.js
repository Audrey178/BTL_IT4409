const Room = require('../models/room.model');

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

module.exports = { createRoom };