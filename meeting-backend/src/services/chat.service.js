/**
 * ============================================================================
 * SERVICE: CHAT - Quản lý tin nhắn & Chat history
 * ============================================================================
 * 
 * Mục đích: Xử lý business logic liên quan đến chat:
 * - Lưu tin nhắn
 * - Lấy lịch sử chat
 * - Xóa tin nhắn
 * 
 * Tác giả: Meeting Team
 */

import { Message, Room } from '../models/index.js';
import { HTTP_STATUS, ERROR_MESSAGES, MESSAGE_TYPE } from '../utils/constants.js';
import logger from '../utils/logger.js';

class ChatService {
  /**
   * Save message to database
   * @param {String} roomCode
   * @param {String} senderId
   * @param {String} senderName
   * @param {Object} data - { content, type, senderAvatar }
   * @returns {Object} Saved message
   */
  async saveMessage(roomCode, senderId, senderName, data) {
    try {
      const { content, type = MESSAGE_TYPE.TEXT, senderAvatar = null } = data;

      // Find room
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Create message (denormalization for performance)
      const message = new Message({
        room_id: room._id,
        sender_id: senderId,
        sender_name: senderName,
        sender_avatar: senderAvatar,
        type,
        content,
        timestamp: new Date(),
      });

      await message.save();

      logger.debug(`✓ Message saved to room ${roomCode}`);

      return {
        success: true,
        message: message.toJSON(),
      };
    } catch (error) {
      logger.error('Save message error:', error);
      throw error;
    }
  }

  /**
   * Get chat history for a room
   * @param {String} roomCode
   * @param {Object} pagination - { page, limit }
   * @returns {Object} Messages
   */
  async getChatHistory(roomCode, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      const skip = (page - 1) * limit;

      // Find room
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Get messages (sorted newest first, but return oldest first for display)
      const messages = await Message.find({ room_id: room._id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Message.countDocuments({ room_id: room._id });

      return {
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        messages: messages.reverse(), // Reverse for chronological order in response
      };
    } catch (error) {
      logger.error('Get chat history error:', error);
      throw error;
    }
  }

  /**
   * Create system message
   * @param {String} roomCode
   * @param {String} description
   * @returns {Object} System message
   */
  async createSystemMessage(roomCode, description) {
    try {
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const message = new Message({
        room_id: room._id,
        sender_id: null,
        sender_name: 'System',
        sender_avatar: null,
        type: MESSAGE_TYPE.SYSTEM,
        content: description,
        timestamp: new Date(),
      });

      await message.save();

      logger.debug(`✓ System message created in room ${roomCode}`);

      return message.toJSON();
    } catch (error) {
      logger.error('Create system message error:', error);
      throw error;
    }
  }

  /**
   * Delete message (owned by sender or host)
   * @param {String} messageId
   * @param {String} userId
   * @param {String} hostId
   * @returns {Object} Deleted message
   */
  async deleteMessage(messageId, userId, hostId) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        const error = new Error('Message not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Only sender or host can delete
      if (message.sender_id !== userId && userId !== hostId) {
        const error = new Error('Unauthorized to delete this message');
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      await Message.findByIdAndDelete(messageId);

      logger.info(`✓ Message ${messageId} deleted`);

      return { success: true, message: 'Message deleted' };
    } catch (error) {
      logger.error('Delete message error:', error);
      throw error;
    }
  }

  /**
   * Clear all messages in a room (host only)
   * @param {String} roomCode
   * @param {String} hostId
   * @returns {Object} Result
   */
  async clearRoomMessages(roomCode, hostId) {
    try {
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      if (room.host_id.toString() !== hostId.toString()) {
        const error = new Error(ERROR_MESSAGES.NOT_HOST);
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      const result = await Message.deleteMany({ room_id: room._id });

      logger.info(`✓ Cleared ${result.deletedCount} messages from room ${roomCode}`);

      return {
        success: true,
        message: `${result.deletedCount} messages cleared`,
      };
    } catch (error) {
      logger.error('Clear room messages error:', error);
      throw error;
    }
  }
}

export default new ChatService();
