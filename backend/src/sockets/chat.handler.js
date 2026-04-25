/**
 * ============================================================================
 * MEETING PROJECT - BACKEND - XỬ LÝ SỰ KIỆN CHAT REALTIME
 * ============================================================================
 * 
 * Module này xử lý logic Chat realtime:
 * - Nhận tin nhắn từ client
 * - Lưu vào MongoDB
 * - Phát broadcast tới tất cả trong phòng
 * - Quản lý lịch sử chat
 * 
 * Kiến trúc tin nhắn:
 * - Text: Tin nhắn văn bản thông thường
 * - System: Thông báo hệ thống (ai vào, ra, bị kick)
 * - File: Tin nhắn có file đính kèm
 * 
 * Tác giả: Meeting Team
 * Ngày tạo: 2026-04-08
 */

import { Message } from '../models/index.js';
import { MESSAGE_TYPE, SOCKET_EVENTS } from '../utils/constants.js';
import logger from '../utils/logger.js';

/**
 * Xử lý gửi tin nhắn
 * 
 * Quy trình:
 * 1. Validate dữ liệu từ client
 * 2. Lưu tin nhắn vào MongoDB
 * 3. Phát broadcast tới tất cả trong phòng
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { roomCode, content, type, senderName, senderAvatar }
 * @returns {Promise<void>}
 */
export const handleChatSend = async (socket, data) => {
  try {
    const { roomCode, content, type = MESSAGE_TYPE.TEXT } = data;
    // Use JWT-authenticated userId from socket instead of client-provided values
    const userId = socket.userId;
    
    // Fetch actual user data from database to prevent spoofing
    const { User } = await import('../models/index.js');
    const user = await User.findById(userId).lean();
    if (!user) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'User not found' });
      return;
    }
    
    const senderName = user.full_name;
    const senderAvatar = user.avatar || null;

    const { Room, RoomMember } = await import('../models/index.js');
    const room = await Room.findOne({ room_code: roomCode }).lean();
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
      return;
    }

    const isMember = await RoomMember.exists({
      room_id: room._id,
      user_id: userId,
      status: { $in: ['joined', 'pending'] },
    });
    if (!isMember) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Unauthorized to send message to this room' });
      return;
    }

    if (!content || content.trim().length === 0) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Nội dung tin nhắn không được trống' });
      return;
    }

    // Lưu tin nhắn vào MongoDB
    const message = new Message({
      room_id: room._id,
      sender_id: userId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      type,
      content: content.substring(0, 5000), // Giới hạn độ dài
      timestamp: new Date(),
    });

    await message.save();

    logger.debug(`💬 Tin nhắn lưu: ${userId} -> ${roomCode}`);

    // Phát tin nhắn tới tất cả trong phòng
    socket.to(roomCode).emit(SOCKET_EVENTS.CHAT_RECEIVE, {
      messageId: message._id,
      senderId: userId,
      senderName,
      senderAvatar,
      content,
      type,
      timestamp: message.timestamp,
    });

    // Gửi lại cho người gửi để confirm
    socket.emit(SOCKET_EVENTS.CHAT_RECEIVE, {
      messageId: message._id,
      senderId: userId,
      senderName,
      senderAvatar,
      content,
      type,
      timestamp: message.timestamp,
      isOwn: true,
    });
  } catch (error) {
    logger.error('❌ Lỗi trong handleChatSend:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi gửi tin nhắn' });
  }
};

/**
 * Xử lý yêu cầu lấy lịch sử chat
 * 
 * Trả về tin nhắn theo trang (pagination)
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { roomCode, page = 1, limit = 50 }
 * @returns {Promise<void>}
 */
export const handleChatHistory = async (socket, data) => {
  try {
    const { roomCode, page = 1, limit = 50 } = data;
    const { Room } = await import('../models/index.js');
    const room = await Room.findOne({ room_code: roomCode }).lean();
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
      return;
    }

    const skip = (page - 1) * limit;

    // Lấy tin nhắn từ MongoDB
    const messages = await Message.find({ room_id: room._id })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Đảo ngược để gửi theo thứ tự thời gian
    const orderedMessages = messages.reverse();

    socket.emit(SOCKET_EVENTS.CHAT_HISTORY, {
      messages: orderedMessages,
      page,
      hasMore: messages.length === limit,
    });

    logger.debug(`📖 Lịch sử chat gửi: ${roomCode} page ${page}`);
  } catch (error) {
    logger.error('❌ Lỗi trong handleChatHistory:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi lấy lịch sử chat' });
  }
};

export default { handleChatSend, handleChatHistory };
