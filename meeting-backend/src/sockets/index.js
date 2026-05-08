/**
 * ============================================================================
 * MEETING PROJECT - BACKEND - SOCKET.IO INITIALIZATION
 * ============================================================================
 * 
 * File này là điểm vào chính cho tất cả xử lý Socket.IO (WebSocket).
 * Nơi đây:
 * - Khởi tạo Socket.IO server
 * - Đăng ký toàn bộ event handlers
 * - Quản lý kết nối/ngắt kết nối
 * - Xử lý lỗi realtime
 * 
 * Các handler được tổ chức theo tính năng:
 * - room.handler.js: Quản lý phòng (join, approve, kick, etc.)
 * - webrtc.handler.js: WebRTC Signaling (offer, answer, ICE)
 * - chat.handler.js: Chat realtime
 * 
 * Kiến trúc: Observer Pattern với Socket.IO
 * 
 * Tác giả: Meeting Team
 * Ngày tạo: 2026-04-08
 */

import { SOCKET_EVENTS } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';
import { handleRoomJoin, handleApproveUser, handleRejectUser } from './room.handler.js';
import { handleWebRTCOffer, handleWebRTCAnswer, handleICECandidate } from './webrtc.handler.js';
import { handleChatSend, handleChatHistory } from './chat.handler.js';

/**
 * Khởi tạo tất cả Socket.IO event handlers
 * 
 * @param {Object} io - Socket.IO instance
 * @param {Object} redisClient - Redis client instance
 * @returns {void}
 */
export const initializeSocket = (io, redisClient) => {
  logger.info('🔌 Đang khởi tạo Socket.IO...');

  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    const userId = socket.handshake.query.userId || socket.id;
    logger.info(`✅ Kết nối mới: Socket ${socket.id} | Người dùng: ${userId}`);

    // =========================================================================
    // QUẢN LÝ PHÒNG HỌP
    // =========================================================================
    
    /**
     * Sự kiện: Người dùng yêu cầu vào phòng
     * Dữ liệu: { userId, roomCode }
     */
    socket.on(SOCKET_EVENTS.ROOM_JOIN, (data) => {
      handleRoomJoin(socket, data);
    });

    /**
     * Sự kiện: Host duyệt người tham gia
     * Dữ liệu: { roomCode, memberId }
     */
    socket.on(SOCKET_EVENTS.ROOM_APPROVE_USER, (data) => {
      handleApproveUser(socket, data);
    });

    /**
     * Sự kiện: Host từ chối người tham gia
     * Dữ liệu: { roomCode, memberId }
     */
    socket.on(SOCKET_EVENTS.ROOM_REJECT_USER, (data) => {
      handleRejectUser(socket, data);
    });

    // =========================================================================
    // WEBRTC SIGNALING
    // =========================================================================
    
    /**
     * Sự kiện: WebRTC Offer (Peer A gửi)
     * Dữ liệu: { roomCode, targetUserId, offer (SDP) }
     */
    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, (data) => {
      handleWebRTCOffer(socket, data);
    });

    /**
     * Sự kiện: WebRTC Answer (Peer B gửi)
     * Dữ liệu: { roomCode, targetUserId, answer (SDP) }
     */
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, (data) => {
      handleWebRTCAnswer(socket, data);
    });

    /**
     * Sự kiện: ICE Candidate (cả hai peer gửi)
     * Dữ liệu: { roomCode, targetUserId, candidate }
     */
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, (data) => {
      handleICECandidate(socket, data);
    });

    // =========================================================================
    // CHAT REALTIME
    // =========================================================================
    
    /**
     * Sự kiện: Gửi tin nhắn
     * Dữ liệu: { roomCode, content, type, senderName, senderAvatar }
     */
    socket.on(SOCKET_EVENTS.CHAT_SEND, (data) => {
      handleChatSend(socket, data);
    });

    /**
     * Sự kiện: Yêu cầu lịch sử chat
     * Dữ liệu: { roomCode, page, limit }
     */
    socket.on(SOCKET_EVENTS.CHAT_HISTORY, (data) => {
      handleChatHistory(socket, data);
    });

    // =========================================================================
    // QUẢN LÝ KỾT NỐI
    // =========================================================================
    
    /**
     * Sự kiện: Người dùng ngắt kết nối
     * Cleanup: Xóa Redis keys, cập nhật database
     */
    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      try {
        const redis = getRedisClient();
        
        // Xóa mapping socket -> user
        const socketData = await redis.get(`socket:${socket.id}`);
        if (socketData) {
          const { roomCode, userId } = JSON.parse(socketData);
          
          // Xóa từ Redis
          await redis.del(`socket:${socket.id}`);
          await redis.sRem(`room:${roomCode}:members`, userId);
          
          // Thông báo tới những người còn lại
          socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_LEFT, {
            userId,
            message: 'Một người dùng đã rời khỏi phòng',
          });
          
          logger.info(`👋 Người dùng ${userId} rời khỏi phòng ${roomCode}`);
        }
      } catch (error) {
        logger.error('❌ Lỗi trong DISCONNECT handler:', error);
      }
    });

    /**
     * Sự kiện: Lỗi Socket
     * Dữ liệu: error object
     */
    socket.on(SOCKET_EVENTS.ERROR, (error) => {
      logger.error(`⚠️  Socket error [${socket.id}]:`, error);
    });
  });

  logger.info('✅ Tất cả Socket.IO handlers đã sẵn sàng');
};

export default { initializeSocket };
