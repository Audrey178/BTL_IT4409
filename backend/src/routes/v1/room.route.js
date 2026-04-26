const express = require('express');
const router = express.Router();
const roomController = require('../../controllers/room.controller');
const { verifyToken } = require('../../middlewares/auth.middleware');

// Tuyến đường có trạm gác verifyToken. Không có token là bị đuổi ngay!
router.post('/', verifyToken, roomController.createRoom);
router.put('/:roomCode/end', verifyToken, roomController.endRoom);

module.exports = router;