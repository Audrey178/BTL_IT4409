import express from 'express';
import authRoutes from './auth.route.js';
import roomRoutes from './room.route.js';
import historyRoutes from './history.route.js';
import livekitRoutes from './livekit.route.js';
import recordingRoutes from './recording.route.js';
import chatRoutes from './chat.route.js';
import notificationRoutes from './notification.route.js';

const router = express.Router();

// API v1 routes
router.use('/auth', authRoutes);
router.use('/rooms', roomRoutes);
router.use('/history', historyRoutes);
router.use('/livekit', livekitRoutes);
router.use('/recordings', recordingRoutes);
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);

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
