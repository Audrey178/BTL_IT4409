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

import { Message, Room, RoomMember } from '../models/index.js';
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

  async sendRoomMessage(roomCode, user, data) {
    try {
      const room = await this.getAccessibleRoom(roomCode, user._id, {
        requireChatEnabled: true,
        requireJoined: true,
      });

      const content = data.content?.trim();
      const message = new Message({
        room_id: room._id,
        sender_id: user._id,
        sender_name: user.full_name,
        sender_avatar: user.avatar || null,
        type: data.type || MESSAGE_TYPE.TEXT,
        content: content.substring(0, 5000),
        timestamp: new Date(),
      });

      await message.save();

      return {
        success: true,
        message: this.mapMessage(message),
      };
    } catch (error) {
      logger.error('Send room message error:', error);
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

  async getRoomMessages(roomCode, userId, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      const skip = (page - 1) * limit;
      const room = await this.getAccessibleRoom(roomCode, userId);

      const messages = await Message.find({ room_id: room._id })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Message.countDocuments({ room_id: room._id });

      return {
        success: true,
        room: {
          roomCode: room.room_code,
          title: room.title,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        messages: messages.reverse().map((message) => this.mapMessage(message)),
      };
    } catch (error) {
      logger.error('Get room messages error:', error);
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
      if (message.sender_id?.toString() !== userId.toString() && userId.toString() !== hostId.toString()) {
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

  async deleteRoomMessage(roomCode, messageId, userId) {
    try {
      const room = await this.getAccessibleRoom(roomCode, userId);
      const message = await Message.findOne({ _id: messageId, room_id: room._id });

      if (!message) {
        const error = new Error('Message not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const isHost = room.host_id.toString() === userId.toString();
      const isSender = message.sender_id?.toString() === userId.toString();
      if (!isHost && !isSender) {
        const error = new Error('Unauthorized to delete this message');
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      await Message.deleteOne({ _id: message._id });

      return {
        success: true,
        message: 'Message deleted',
        deletedMessageId: message._id.toString(),
      };
    } catch (error) {
      logger.error('Delete room message error:', error);
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

  async getAccessibleRoom(roomCode, userId, options = {}) {
    const normalizedCode = roomCode ? roomCode.toUpperCase() : '';
    const room = await Room.findOne({ room_code: normalizedCode });
    if (!room) {
      const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    if (options.requireChatEnabled && room.settings?.allow_chat === false) {
      const error = new Error('Chat is disabled for this room');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }

    const isHost = room.host_id.toString() === userId.toString();
    const allowedStatuses = options.requireJoined ? ['joined'] : ['joined', 'left', 'pending'];
    const isMember = await RoomMember.exists({
      room_id: room._id,
      user_id: userId,
      status: { $in: allowedStatuses },
    });

    if (!isHost && !isMember) {
      const error = new Error('Unauthorized to access room chat');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }

    return room;
  }

  mapMessage(message) {
    const raw = typeof message.toJSON === 'function' ? message.toJSON() : message;
    return {
      ...raw,
      messageId: raw._id?.toString(),
      senderId: raw.sender_id?.toString(),
      senderName: raw.sender_name,
      senderAvatar: raw.sender_avatar,
    };
  }
}

export default new ChatService();
