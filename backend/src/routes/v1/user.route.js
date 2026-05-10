const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const { verifyToken } = require('../../middlewares/auth.middleware');

// Tuyến đường cập nhật khuôn mặt (Bắt buộc phải có vé Token mới được đổi)
router.post('/face-setup', verifyToken, userController.registerFace);

module.exports = router;