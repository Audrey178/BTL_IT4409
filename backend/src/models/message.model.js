const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    room_code: { 
        type: String, 
        required: true, 
        index: true // Đánh index để sau này tìm lịch sử chat của phòng cực nhanh
    },
    sender_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', // Nối với bảng User để biết ai là người gửi
        required: true 
    },
    content: { type: String, default: '' },

    file_url: { type: String, default: null }, 
    file_name: { type: String, default: null },  
    file_type: { type: String, default: null }
}, { 
    timestamps: true // Tự động sinh ra trường createdAt để biết thời gian gửi
});

module.exports = mongoose.model('Message', messageSchema);