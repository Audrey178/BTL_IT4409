const express = require('express');
const router = express.Router();
const uploadController = require('../../controllers/upload.controller');
const { upload } = require('../../config/cloudinary');
const { verifyToken } = require('../../middlewares/auth.middleware');

// Tuyến đường nhận 1 file duy nhất qua key tên là 'file'
// Bắt buộc phải check token để biết ai là người đang upload
router.post('/', verifyToken, upload.single('file'), uploadController.uploadFile);

module.exports = router;