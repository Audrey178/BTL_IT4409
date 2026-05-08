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
 * Tác giả: Meeting Team
 * Ngày tạo: 2026-04-08
 */

import logger from '../utils/logger.js';
import { SOCKET_EVENTS } from '../utils/constants.js';

/**
 * Xử lý WebRTC Offer từ Peer A
 * 
 * Offer chứa thông tin định dạng media (codec, resolution, etc.)
 * của người gửi
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { roomCode, targetUserId, offer }
 * @returns {Promise<void>}
 */
export const handleWebRTCOffer = async (socket, data) => {
  try {
    const { roomCode, targetUserId, to, offer } = data;
    // Use JWT-authenticated userId from socket
    const fromUserId = socket.userId;
    const recipientUserId = targetUserId || to;

    logger.debug(`📤 Forwarding WebRTC Offer in room ${roomCode} to user ${recipientUserId}`);

    // Gửi offer tới peer nhận
    socket.to(`user:${recipientUserId}`).emit(SOCKET_EVENTS.WEBRTC_OFFER, {
      from: fromUserId,
      fromUserId,
      targetUserId: recipientUserId,
      offer,
    });
  } catch (error) {
    logger.error('❌ Lỗi trong handleWebRTCOffer:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi gửi WebRTC offer' });
  }
};

/**
 * Xử lý WebRTC Answer từ Peer B
 * 
 * Answer chứa thông tin định dạng media của người nhận
 * để hoàn thành handshake
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { roomCode, targetUserId, answer }
 * @returns {Promise<void>}
 */
export const handleWebRTCAnswer = async (socket, data) => {
  try {
    const { roomCode, targetUserId, to, answer } = data;
    const recipientUserId = targetUserId || to;

    logger.debug(`📥 Forwarding WebRTC Answer in room ${roomCode} to user ${recipientUserId}`);

    // Use JWT-authenticated userId from socket, not unverified query param (SECURITY FIX)
    const fromUserId = socket.userId;
    if (!fromUserId) {
      throw new Error('Unauthorized: User ID not found in socket authentication');
    }

    socket.to(`user:${recipientUserId}`).emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
      from: fromUserId,
      fromUserId,
      targetUserId: recipientUserId,
      answer,
    });
  } catch (error) {
    logger.error('❌ Lỗi trong handleWebRTCAnswer:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi gửi WebRTC answer' });
  }
};

/**
 * Xử lý ICE Candidate
 * 
 * ICE (Interactive Connectivity Establishment) candidates là các
 * thuộc những mạng có thể sử dụng để kết nối các peers
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { roomCode, targetUserId, candidate }
 * @returns {Promise<void>}
 */
export const handleICECandidate = async (socket, data) => {
  try {
    const { roomCode, targetUserId, to, candidate } = data;
    const recipientUserId = targetUserId || to;

    logger.debug(`🧊 Forwarding ICE Candidate in room ${roomCode} to user ${recipientUserId}`);

    // Use JWT-authenticated userId from socket, not unverified query param (SECURITY FIX)
    const fromUserId = socket.userId;
    if (!fromUserId) {
      throw new Error('Unauthorized: User ID not found in socket authentication');
    }

    socket.to(`user:${recipientUserId}`).emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
      from: fromUserId,
      fromUserId,
      targetUserId: recipientUserId,
      candidate,
    });
  } catch (error) {
    logger.error('❌ Lỗi trong handleICECandidate:', error);
    // Không emit lỗi ngay vì ICE candidate thất bại không gây ảnh hưởng lớn
    logger.warn(`⚠️  ICE candidate thất bại nhưng hệ thống tiếp tục`);
  }
};

export default { handleWebRTCOffer, handleWebRTCAnswer, handleICECandidate };
