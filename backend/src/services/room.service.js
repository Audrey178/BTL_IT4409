/**
 * ============================================================================
 * SERVICE: ROOM - Quản lý phòng họp
 * ============================================================================
 * 
 * Mục đích: Xử lý business logic liên quan đến phòng họp:
 * - Tạo phòng
 * - Join phòng
 * - Kết thúc phòng
 * - Quản lý thành viên
 * - Lấy danh sách người tham gia
 * 
 * Tác giả: Meeting Team
 */

import { v4 as uuidv4 } from 'uuid';
import { Room, RoomMember, MeetingEvent } from '../models/index.js';
import { getRedisClient, addToSet, removeFromSet, getSetMembers, deleteRedisKey, setWithExpire } from '../config/redis.js';
import { HTTP_STATUS, ERROR_MESSAGES, ROOM_STATUS, USER_STATUS, EVENT_TYPE } from '../utils/constants.js';
import logger from '../utils/logger.js';

class RoomService {
  /**
   * Tạo phòng họp mới
   * @param {String} hostId - User ID of host
   * @param {Object} data - { title, description, settings }
   * @returns {Object} Created room
   */
  async createRoom(hostId, data) {
    try {
      const {
        title,
        description,
        settings,
        require_approval,
        allow_chat,
        max_participants,
      } = data;
      const normalizedSettings = {
        require_approval: settings?.require_approval ?? require_approval ?? false,
        allow_chat: settings?.allow_chat ?? allow_chat ?? true,
        max_participants: settings?.max_participants ?? max_participants ?? 100,
      };

      // Generate unique room code
      const roomCode = this.generateRoomCode();

      // Create room
      const room = new Room({
        room_code: roomCode,
        host_id: hostId,
        title,
        description: description || '',
        status: ROOM_STATUS.WAITING,
        settings: normalizedSettings,
        started_at: null,
        ended_at: null,
      });

      await room.save();

      // Log event
      await this.logEvent(room._id, hostId, EVENT_TYPE.ROOM_CREATED, `Room created by host`);

      // Store host in Redis
      const redis = getRedisClient();
      await redis.set(`room:${roomCode}:host`, hostId.toString());

      logger.info(`✓ Room created: ${roomCode} by ${hostId}`);

      return {
        success: true,
        room: room.toJSON(),
      };
    } catch (error) {
      logger.error('Create room error:', error);
      throw error;
    }
  }

  /**
   * Lấy thông tin phòng
   * @param {String} roomCode
   * @returns {Object} Room info
   */
  async getRoomInfo(roomCode) {
    try {
      const room = await Room.findOne({ room_code: roomCode }).populate('host_id', '-password_hash');

      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Check if room has ended
      if (room.status === ROOM_STATUS.ENDED) {
        const error = new Error(ERROR_MESSAGES.ROOM_ENDED);
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      return room.toJSON();
    } catch (error) {
      logger.error('Get room info error:', error);
      throw error;
    }
  }

  /**
   * Request to join room
   * @param {String} roomCode
   * @param {String} userId
   * @returns {Object} { roomMember, status }
   */
  async requestJoinRoom(roomCode, userId) {
    try {
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      if (room.status === ROOM_STATUS.ENDED) {
        const error = new Error(ERROR_MESSAGES.ROOM_ENDED);
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      // Check max participants
      const memberCount = await RoomMember.countDocuments({
        room_id: room._id,
        status: { $in: [USER_STATUS.JOINED, USER_STATUS.PENDING] },
      });

      if (memberCount >= room.settings.max_participants) {
        const error = new Error(ERROR_MESSAGES.MAX_PARTICIPANTS);
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      // Check if user already in room
      let roomMember = await RoomMember.findOne({ room_id: room._id, user_id: userId });

      if (roomMember) {
        // If previously left, rejoin
        roomMember.status = room.settings.require_approval ? USER_STATUS.PENDING : USER_STATUS.JOINED;
        roomMember.joined_at = room.settings.require_approval ? null : new Date();
        roomMember.left_at = null;
      } else {
        // Create new room member entry
        roomMember = new RoomMember({
          room_id: room._id,
          user_id: userId,
          status: room.settings.require_approval ? USER_STATUS.PENDING : USER_STATUS.JOINED,
          joined_at: room.settings.require_approval ? null : new Date(),
        });
      }

      await roomMember.save();

      // Store in Redis
      const redis = getRedisClient();
      await addToSet(`room:${roomCode}:members`, userId.toString());

      if (roomMember.status === USER_STATUS.JOINED) {
        if (room.status === ROOM_STATUS.WAITING) {
          room.status = ROOM_STATUS.ACTIVE;
        }
        if (!room.started_at) {
          room.started_at = new Date();
        }
        await room.save();
      }

      logger.info(`✓ User ${userId} requested to join room ${roomCode}`);

      return {
        success: true,
        roomMember: roomMember.toJSON(),
        status: roomMember.status,
        roomId: room._id,
      };
    } catch (error) {
      logger.error('Request join room error:', error);
      throw error;
    }
  }

  /**
   * Approve user to join room
   * @param {String} roomCode
   * @param {String} hostId
   * @param {String} userId
   * @returns {Object} Updated room member
   */
  async approveUser(roomCode, hostId, userId) {
    try {
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Check if requester is host
      if (room.host_id.toString() !== hostId.toString()) {
        const error = new Error(ERROR_MESSAGES.NOT_HOST);
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      const roomMember = await RoomMember.findOneAndUpdate(
        { room_id: room._id, user_id: userId },
        { status: USER_STATUS.JOINED, joined_at: new Date() },
        { new: true }
      );

      if (!roomMember) {
        const error = new Error('User not found in room');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      if (room.status === ROOM_STATUS.WAITING) {
        room.status = ROOM_STATUS.ACTIVE;
      }
      if (!room.started_at) {
        room.started_at = new Date();
      }
      await room.save();

      await this.logEvent(room._id, userId, EVENT_TYPE.USER_APPROVED, 'User approved to join');

      logger.info(`✓ User ${userId} approved to join room ${roomCode}`);
      return { success: true, roomMember: roomMember.toJSON() };
    } catch (error) {
      logger.error('Approve user error:', error);
      throw error;
    }
  }

  /**
   * Reject user from joining room
   * @param {String} roomCode
   * @param {String} hostId
   * @param {String} userId
   * @returns {Object} Updated room member
   */
  async rejectUser(roomCode, hostId, userId) {
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

      const roomMember = await RoomMember.findOneAndUpdate(
        { room_id: room._id, user_id: userId },
        { status: USER_STATUS.REJECTED, left_at: new Date() },
        { new: true }
      );

      await this.logEvent(room._id, userId, EVENT_TYPE.USER_REJECTED, 'User rejected');

      logger.info(`✓ User ${userId} rejected from room ${roomCode}`);
      return { success: true, roomMember: roomMember.toJSON() };
    } catch (error) {
      logger.error('Reject user error:', error);
      throw error;
    }
  }

  /**
   * Kick user from room
   * @param {String} roomCode
   * @param {String} hostId
   * @param {String} userId
   * @returns {Object} Updated room member
   */
  async kickUser(roomCode, hostId, userId) {
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

      const roomMember = await RoomMember.findOneAndUpdate(
        { room_id: room._id, user_id: userId },
        { status: USER_STATUS.KICKED, left_at: new Date() },
        { new: true }
      );

      // Remove from Redis
      const redis = getRedisClient();
      await removeFromSet(`room:${roomCode}:members`, userId.toString());

      await this.logEvent(room._id, userId, EVENT_TYPE.USER_KICKED, 'User kicked from room');

      logger.info(`✓ User ${userId} kicked from room ${roomCode}`);
      return { success: true, roomMember: roomMember.toJSON() };
    } catch (error) {
      logger.error('Kick user error:', error);
      throw error;
    }
  }

  /**
   * End room
   * @param {String} roomCode
   * @param {String} hostId
   * @returns {Object} Updated room
   */
  async endRoom(roomCode, hostId) {
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

      room.status = ROOM_STATUS.ENDED;
      room.ended_at = new Date();
      if (!room.started_at) {
        room.started_at = room.created_at;
      }
      await room.save();

      // Mark all members as left
      await RoomMember.updateMany(
        { room_id: room._id, status: USER_STATUS.JOINED },
        { status: USER_STATUS.LEFT, left_at: new Date() }
      );

      // Clean up Redis
      const redis = getRedisClient();
      await deleteRedisKey(`room:${roomCode}:members`);
      await deleteRedisKey(`room:${roomCode}:host`);

      await this.logEvent(room._id, hostId, EVENT_TYPE.ROOM_ENDED, 'Room ended by host');

      logger.info(`✓ Room ended: ${roomCode}`);
      return { success: true, room: room.toJSON() };
    } catch (error) {
      logger.error('End room error:', error);
      throw error;
    }
  }

  /**
   * Get list of participants in a room
   * @param {String} roomCode
   * @returns {Array} List of participants
   */
  async getRoomParticipants(roomCode) {
    try {
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      const participants = await RoomMember.find({
        room_id: room._id,
        status: { $in: [USER_STATUS.JOINED, USER_STATUS.PENDING] },
      }).populate('user_id', '-password_hash');

      return {
        success: true,
        participants: participants.map(p => ({
          ...p.toJSON(),
          user: p.user_id?.toJSON() || null,
        })),
      };
    } catch (error) {
      logger.error('Get room participants error:', error);
      throw error;
    }
  }

  /**
   * Generate unique room code - improved security with longer, random alphanumeric
   * @returns {String} Room code (format: XXX-YYY-ZZZ in alphanumeric)
   */
  generateRoomCode() {
    // Generate 12-character random alphanumeric code (resistant to brute force)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}`;
  }

  /**
   * Log meeting event
   * @param {String} roomId
   * @param {String} userId
   * @param {String} eventType
   * @param {String} description
   */
  async logEvent(roomId, userId, eventType, description) {
    try {
      const event = new MeetingEvent({
        room_id: roomId,
        user_id: userId,
        event_type: eventType,
        description,
      });
      await event.save();
    } catch (error) {
      logger.error('Log event error:', error);
    }
  }
}

export default new RoomService();
