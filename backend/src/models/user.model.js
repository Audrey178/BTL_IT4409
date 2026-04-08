const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true // Đảm bảo không có 2 người trùng email
    },
    password_hash: { 
        type: String, 
        required: true 
    },
    avatar: { 
        type: String, 
        default: '' // Mặc định chưa có ảnh đại diện
    },
    face_embeddings: { 
        type: Array, 
        default: [] // Mảng trống chờ sau này AI nhét dữ liệu vào
    },
    role: { 
        type: String, 
        enum: ['user', 'admin'], // Chỉ được phép mang 1 trong 2 quyền này
        default: 'user' 
    }
}, {
    // Tự động sinh ra 2 trường created_at và updated_at khi có dữ liệu mới
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } 
});

module.exports = mongoose.model('User', userSchema);