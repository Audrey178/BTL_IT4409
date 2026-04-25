/**
 * ============================================================================
 * MEETING PROJECT - BACKEND - XỬ LÝ SIGNALING WEBRTC
 * ============================================================================
 * 
 * Module này xử lý WebRTC Signaling:
 * - Trao đổi SDP Offer/Answer giữa các peers
 * - Gửi ICE candidates để tìm đường kết nối tối ưu
 * - Quản lý peer connection metadata
 * 
 * Quy trình:
 * 1. Peer A gửi offer -> Server chuyển tiếp tới Peer B
 * 2. Peer B gửi answer -> Server chuyển tiếp tới Peer A
 * 3. Cả 2 gửi ICE candidates -> Server chuyển tiếp
 * 
 * QUAN TRỌNG: Tất cả signaling đều là UNICAST (1-to-1), KHÔNG broadcast.
 * Lookup socketId từ Redis bằng userId, gửi trực tiếp.
 * 
 * Tác giả: Meeting Team
 * Ngày tạo: 2026-04-08
 */

import logger from '../utils/logger.js';
import { SOCKET_EVENTS } from '../utils/constants.js';
import { getRedisClient } from '../config/redis.js';

/**
 * Tìm socketId từ userId qua Redis
 */
async function getSocketIdForUser(userId) {
  const redis = getRedisClient();
  return await redis.get(`user:${userId}:socket`);
}

/**
 * Xử lý WebRTC Offer từ Peer A → chuyển tiếp tới Peer B
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { to (targetUserId), offer, roomCode? }
 * @returns {Promise<void>}
 */
export const handleWebRTCOffer = async (socket, data) => {
  try {
    const { to, offer, roomCode } = data;
    // userId lưu trong socket.data khi connect
    const fromUserId = socket.data.userId || socket.handshake.query.userId || socket.id;

    logger.debug(`📤 WebRTC Offer: ${fromUserId} → ${to}`);

    // Unicast: tìm socketId của target user, gửi trực tiếp
    const targetSocketId = await getSocketIdForUser(to);
    if (targetSocketId) {
      socket.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
        from: fromUserId,
        offer,
      });
    } else {
      logger.warn(`⚠️  WebRTC Offer: Không tìm thấy socket của user ${to}`);
    }
  } catch (error) {
    logger.error('❌ Lỗi trong handleWebRTCOffer:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi gửi WebRTC offer' });
  }
};

/**
 * Xử lý WebRTC Answer từ Peer B → chuyển tiếp tới Peer A
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { to (targetUserId), answer, roomCode? }
 * @returns {Promise<void>}
 */
export const handleWebRTCAnswer = async (socket, data) => {
  try {
    const { to, answer, roomCode } = data;
    const fromUserId = socket.data.userId || socket.handshake.query.userId || socket.id;

    logger.debug(`📥 WebRTC Answer: ${fromUserId} → ${to}`);

    const targetSocketId = await getSocketIdForUser(to);
    if (targetSocketId) {
      socket.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
        from: fromUserId,
        answer,
      });
    } else {
      logger.warn(`⚠️  WebRTC Answer: Không tìm thấy socket của user ${to}`);
    }
  } catch (error) {
    logger.error('❌ Lỗi trong handleWebRTCAnswer:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi gửi WebRTC answer' });
  }
};

/**
 * Xử lý ICE Candidate → chuyển tiếp tới peer
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { to (targetUserId), candidate, roomCode? }
 * @returns {Promise<void>}
 */
export const handleICECandidate = async (socket, data) => {
  try {
    const { to, candidate, roomCode } = data;
    const fromUserId = socket.data.userId || socket.handshake.query.userId || socket.id;

    logger.debug(`🧊 ICE Candidate: ${fromUserId} → ${to}`);

    const targetSocketId = await getSocketIdForUser(to);
    if (targetSocketId) {
      socket.to(targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
        from: fromUserId,
        candidate,
      });
    } else {
      // ICE candidate thất bại không nghiêm trọng — connection vẫn có thể hoạt động
      logger.debug(`⚠️  ICE: Không tìm thấy socket của user ${to}`);
    }
  } catch (error) {
    logger.error('❌ Lỗi trong handleICECandidate:', error);
  }
};

export default { handleWebRTCOffer, handleWebRTCAnswer, handleICECandidate };
