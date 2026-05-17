import { SOCKET_EVENTS } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';
import { handleRoomJoin, handleApproveUser, handleRejectUser } from './room.handler.js';
import { handleWebRTCOffer, handleWebRTCAnswer, handleICECandidate } from './webrtc.handler.js';
import { handleChatSend, handleChatHistory } from './chat.handler.js';

export const initializeSocket = (io, redisClient) => {
  logger.info('Initializing Socket.IO...');

  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    const userId = socket.userId;
    const socketId = socket.id;
    const eventLimits = new Map();

    logger.info(`Socket connected: ${socketId} | User: ${userId}`);
    socket.join(`user:${userId}`);
    redisClient.set(`user:${userId}:socket`, socket.id).catch((error) => {
      logger.warn(`Unable to persist user socket mapping for ${userId}: ${error.message}`);
    });

    socket.use((packet, next) => {
      const [eventName] = packet;
      const now = Date.now();
      const key = `${socket.id}:${eventName}`;
      const times = eventLimits.get(key) || [];
      const recentTimes = times.filter((time) => now - time < 10000);
      recentTimes.push(now);
      eventLimits.set(key, recentTimes);

      if (recentTimes.length > 100) {
        logger.warn(`Rate limit exceeded for ${socket.userId} on event ${eventName}`);
        return next(new Error('Rate limit exceeded'));
      }

      next();
    });

    socket.on(SOCKET_EVENTS.ROOM_JOIN, (data) => {
      handleRoomJoin(socket, data);
    });

    socket.on(SOCKET_EVENTS.ROOM_APPROVE_USER, (data) => {
      handleApproveUser(socket, data);
    });

    socket.on(SOCKET_EVENTS.ROOM_REJECT_USER, (data) => {
      handleRejectUser(socket, data);
    });

    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, (data) => {
      handleWebRTCOffer(socket, data);
    });

    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, (data) => {
      handleWebRTCAnswer(socket, data);
    });

    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, (data) => {
      handleICECandidate(socket, data);
    });

    socket.on(SOCKET_EVENTS.CHAT_SEND, (data) => {
      handleChatSend(socket, data);
    });

    socket.on(SOCKET_EVENTS.CHAT_HISTORY, (data) => {
      handleChatHistory(socket, data);
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      try {
        const redis = getRedisClient();
        const socketData = await redis.get(`socket:${socket.id}`);

        if (socketData) {
          const { roomCode, userId: disconnectedUserId } = JSON.parse(socketData);

          // Emit room leave event FIRST (before cleanup)
          socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_LEFT, {
            userId: disconnectedUserId,
            timestamp: new Date().toISOString(),
            message: 'A user left the room',
          });

          // Then cleanup Redis with error handling
          try {
            await Promise.all([
              redis.del(`socket:${socket.id}`),
              redis.del(`user:${disconnectedUserId}:socket`),
              redis.sRem(`room:${roomCode}:members`, disconnectedUserId),
            ]);
            logger.info(`User ${disconnectedUserId} disconnected from room ${roomCode}`);
          } catch (cleanupError) {
            logger.error(`Cleanup failed for user ${disconnectedUserId}:`, cleanupError.message);
            // Don't re-throw - disconnect already happened
          }
        }
      } catch (error) {
        logger.error('Socket disconnect handler error:', error);
        // Fallback: at least emit disconnect event
        if (socket.userId) {
          socket.broadcast.emit(SOCKET_EVENTS.ERROR, {
            message: 'User disconnected unexpectedly',
            userId: socket.userId,
          });
        }
      }
    });

    socket.on(SOCKET_EVENTS.ERROR, (error) => {
      logger.error(`Socket error [${socket.id}]:`, error);
    });
  });

  logger.info('Socket.IO handlers registered');
};

export default { initializeSocket };
