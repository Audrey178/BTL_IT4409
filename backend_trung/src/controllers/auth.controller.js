const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model'); // Gọi Khuôn đúc User từ kho ra

// ==========================================
// 1. API ĐĂNG KÝ (REGISTER)
// ==========================================
const register = async (req, res) => {
    try {
        // Lấy dữ liệu khách hàng gửi lên
        const { email, password } = req.body;

        // B1: Kiểm tra xem email này đã có ai đăng ký chưa?
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email này đã được sử dụng!' });
        }

        // B2: Mã hóa mật khẩu (Tuyệt đối không lưu mật khẩu thô)
        // bcrypt sẽ băm mật khẩu "123" thành một chuỗi ngoằn ngoèo không thể dịch ngược
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // B3: Bỏ dữ liệu vào Khuôn đúc và lưu vào Database
        const newUser = new User({
            email: email,
            password_hash: password_hash,
        });
        await newUser.save(); // Lệnh này chính thức ghi vào MongoDB

        res.status(201).json({ message: 'Đăng ký tài khoản thành công!' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// ==========================================
// 2. API ĐĂNG NHẬP (LOGIN)
// ==========================================
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // B1: Tìm xem có ông nào mang email này trong kho không?
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
        }

        // B2: So sánh mật khẩu khách gửi với mật khẩu đã mã hóa trong kho
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng!' });
        }

        // B3: Cấp vé thông hành (Token) vì đã xác thực đúng người
        const access_token = jwt.sign(
            { id: user._id, role: user.role }, // Những thông tin được nhét vào vé
            process.env.JWT_ACCESS_SECRET,     // Chữ ký bảo mật của nhà hàng
            { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN } // Thời hạn của vé
        );

        res.status(200).json({
            message: 'Đăng nhập thành công',
            access_token: access_token
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

// ==========================================
// 3. API ĐĂNG XUẤT (LOGOUT)
// ==========================================
const logout = async (req, res) => {
    // Tạm thời logout làm đơn giản: Frontend chỉ cần xóa Token là xong.
    res.status(200).json({ message: 'Đăng xuất thành công!' });
};

module.exports = { register, login, logout };