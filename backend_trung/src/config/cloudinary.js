const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Cấu hình thông tin đăng nhập Cloudinary từ file .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Thiết lập "Kho chứa" (Storage) cho Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'meeting_files', // Tên thư mục sẽ tự động được tạo trên Cloudinary
        resource_type: 'auto',   // Tự động nhận diện đây là file ảnh (image) hay tài liệu (raw)
        // Các định dạng file được phép tải lên
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'txt', 'zip']
    }
});

// 3. Đóng gói Multer thành một Middleware (Trạm gác)
// Trạm gác này sẽ kiểm tra file, nếu đạt chuẩn thì cho đi thẳng lên Cloud.
const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };