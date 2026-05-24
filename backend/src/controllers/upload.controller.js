// ==========================================
// API: TẢI TÀI LIỆU LÊN ĐÁM MÂY (FILE UPLOAD)
// ==========================================
const uploadFile = async (req, res) => {
    try {
        // Biến req.file do middleware Multer sinh ra sau khi upload thành công lên Cloudinary
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn file hợp lệ để tải lên!' });
        }

        // Trả về toàn bộ siêu dữ liệu (metadata) và đường link URL của file
        res.status(200).json({
            message: 'Tải file lên đám mây thành công!',
            file_name: req.file.originalname,   // Tên gốc của file (VD: tailieu.pdf)
            file_url: req.file.path,            // Đường dẫn URL trực tiếp từ Cloudinary
            file_type: req.file.mimetype,       // Định dạng file (VD: application/pdf)
            file_size: req.file.size            // Dung lượng file (tính bằng byte)
        });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi hệ thống khi xử lý tải file', error: error.message });
    }
};

module.exports = { uploadFile };