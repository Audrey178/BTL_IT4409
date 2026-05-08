import express from 'express';
import attendanceController from '../../controllers/attendance.controller.js';
import { validate } from '../../utils/validators.js';
import { attendanceValidation } from '../../utils/validators.js';
import { authenticate } from '../../middlewares/auth.js';

const router = express.Router();

// Apply authentication to all attendance routes
router.use(authenticate);

/**
 * @swagger
 * /attendance/face-embeddings:
 *   post:
 *     summary: Upload face embeddings for AI recognition
 *     tags: [Attendance]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - descriptor
 *             properties:
 *               descriptor:
 *                 type: array
 *                 items:
 *                   type: number
 *                 minItems: 128
 *                 maxItems: 512
 *     responses:
 *       201:
 *         description: Face embeddings saved successfully
 */
router.post('/face-embeddings', validate(attendanceValidation.faceEmbeddings), attendanceController.uploadFaceEmbeddings.bind(attendanceController));

/**
 * @swagger
 * /attendance/{roomCode}/check-in:
 *   post:
 *     summary: Check in to room (start attendance)
 *     tags: [Attendance]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confidence_score:
 *                 type: number
 *                 min: 0
 *                 max: 1
 *               method:
 *                 type: string
 *                 enum: [face_recognition, manual]
 *     responses:
 *       201:
 *         description: Check-in recorded
 */
router.post('/:roomCode/check-in', validate(attendanceValidation.checkIn), attendanceController.checkIn.bind(attendanceController));

/**
 * @swagger
 * /attendance/{roomCode}/check-out:
 *   post:
 *     summary: Check out from room (end attendance)
 *     tags: [Attendance]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check-out recorded
 */
router.post('/:roomCode/check-out', attendanceController.checkOut.bind(attendanceController));

/**
 * @swagger
 * /attendance/{roomCode}/stats:
 *   get:
 *     summary: Get attendance stats for room (host only)
 *     tags: [Attendance]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attendance statistics
 */
router.get('/:roomCode/stats', attendanceController.getRoomAttendanceStats.bind(attendanceController));

/**
 * @swagger
 * /attendance/history:
 *   get:
 *     summary: Get user's attendance history
 *     tags: [Attendance]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: User's attendance history
 */
// SECURITY FIX: Validate pagination parameters to prevent injection attacks
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 100);
  
  req.query.page = pageNum;
  req.query.limit = limitNum;
  next();
};

router.get('/history', validatePagination, attendanceController.getUserAttendanceHistory.bind(attendanceController));

export default router;
