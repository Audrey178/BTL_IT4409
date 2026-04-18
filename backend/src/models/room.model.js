const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    room_code: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true // Đánh index để tìm kiếm siêu tốc
    },
    host_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', // Nối với bảng User để biết ai là chủ
        required: true 
    },
    status: { 
        type: String, 
        enum: ['waiting', 'active', 'ended'], 
        default: 'waiting' // Vừa tạo xong thì ở trạng thái chờ
    },
    settings: {
        require_approval: { type: Boolean, default: false }, // Có cần duyệt mới được vào không?
        allow_chat: { type: Boolean, default: true }
    }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);