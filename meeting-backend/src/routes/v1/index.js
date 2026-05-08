import express from 'express';
import authRoutes from './auth.route.js';
import roomRoutes from './room.route.js';
import attendanceRoutes from './attendance.route.js';
import historyRoutes from './history.route.js';

const router = express.Router();

// API v1 routes
router.use('/auth', authRoutes);
router.use('/rooms', roomRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/history', historyRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
