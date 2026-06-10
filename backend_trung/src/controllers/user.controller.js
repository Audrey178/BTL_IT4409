const User = require('../models/user.model'); // Đảm bảo bạn đã trỏ đúng file model user từ Tuần 7

// ==========================================
// API: ĐĂNG KÝ KHUÔN MẶT (FACE REGISTRATION)
// ==========================================
const registerFace = async (req, res) => {
    try {
        // ID này được lấy từ token thông qua middleware verifyToken
        const userId = req.user.id; 
        
        // Mảng các con số (Vector) đại diện cho khuôn mặt do Frontend gửi lên
        const { face_embeddings } = req.body;

        // 1. Kiểm tra dữ liệu đầu vào
        if (!face_embeddings || !Array.isArray(face_embeddings) || face_embeddings.length === 0) {
            return res.status(400).json({ message: 'Dữ liệu khuôn mặt không hợp lệ!' });
        }

        // 2. Tìm người dùng trong Database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng!' });
        }

        // 3. Cập nhật dữ liệu khuôn mặt vào profile
        user.face_embeddings = face_embeddings;
        await user.save();

        res.status(200).json({ 
            message: 'Đăng ký khuôn mặt thành công! Hệ thống đã ghi nhớ bạn.',
            // Trả về một đoạn nhỏ của mảng để Frontend biết đã lưu thành công (không cần trả hết)
            preview: face_embeddings.slice(0, 3) 
        });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi hệ thống khi lưu khuôn mặt', error: error.message });
    }
};

module.exports = { registerFace };