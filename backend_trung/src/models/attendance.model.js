const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    room_code: { 
        type: String, 
        required: true, 
        index: true 
    },
    user_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', // Liên kết với bảng User để lấy tên, email
        required: true 
    },
    check_in_time: { 
        type: Date, 
        default: Date.now // Tự động lấy giờ hệ thống lúc điểm danh thành công
    },
    confidence_score: { 
        type: Number // Lưu lại chỉ số khoảng cách (distance) để làm bằng chứng (audit log)
    }
});

// Đảm bảo mỗi người chỉ được ghi nhận 1 lần trong 1 phòng (tránh AI quét liên tục sinh ra hàng ngàn dòng rác)
attendanceSchema.index({ room_code: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);