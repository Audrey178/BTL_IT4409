const express = require('express');
const router = express.Router();
const roomController = require('../../controllers/room.controller');
const { verifyToken } = require('../../middlewares/auth.middleware');

// Tuyến đường có trạm gác verifyToken. Không có token là bị đuổi ngay!
router.post('/', verifyToken, roomController.createRoom);
router.put('/:roomCode/end', verifyToken, roomController.endRoom);
router.get('/:roomCode/messages', verifyToken, roomController.getChatHistory);
router.get('/:roomCode/attendance', verifyToken, roomController.getAttendanceReport);
// API Lên lịch cuộc họp (Yêu cầu phải đăng nhập)
router.post('/schedule', verifyToken, roomController.scheduleRoom);
// API Gửi thư mời qua Email (Chỉ Host mới gọi được)
router.post('/:roomCode/invite', verifyToken, roomController.sendInvites);

module.exports = router;