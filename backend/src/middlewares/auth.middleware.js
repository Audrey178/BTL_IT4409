const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // 1. Lấy token từ header (Postman sẽ tự động gửi kèm dòng 'Bearer [token]')
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1]; // Tách bỏ chữ 'Bearer '

    if (!token) {
        return res.status(401).json({ message: 'Từ chối truy cập: Không tìm thấy Token!' });
    }

    try {
        // 2. Kiểm tra vé có phải do server mình phát ra không
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        
        // 3. Nếu vé chuẩn, gắn ID của người dùng vào request để các bước sau dùng
        req.user = decoded; 
        next(); // Mở cửa cho đi tiếp vào Controller
    } catch (error) {
        return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
};

module.exports = { verifyToken };