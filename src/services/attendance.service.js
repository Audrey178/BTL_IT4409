/**
 * ============================================================================
 * SERVICE: ATTENDANCE - Quản lý điểm danh & Nhân diện khuôn mặt
 * ============================================================================
 * 
 * Mục đích: Xử lý business logic liên quan đến điểm danh:
 * - Upload face embeddings
 * - Check-in/Check-out
 * - Tính toán thời lượng tham gia
 * - Lấy báo cáo điểm danh
 * 
 * Tác giả: Meeting Team
 */

import { User, AttendanceLog, Room, RoomMember } from '../models/index.js';
import { HTTP_STATUS, ERROR_MESSAGES, USER_STATUS, EVENT_TYPE } from '../utils/constants.js';
import logger from '../utils/logger.js';

class AttendanceService {
  /**
   * Upload face embeddings for user
   * @param {String} userId
   * @param {Array<Number>} descriptor
   * @returns {Object} Updated user
   */
  async uploadFaceEmbeddings(userId, descriptor) {
    try {
      if (!Array.isArray(descriptor) || descriptor.length < 128) {
        const error = new Error('Invalid descriptor format or size');
        error.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw error;
      }

      const user = await User.findById(userId);
      if (!user) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Add embedding to user's face_embeddings
      user.face_embeddings.push({
        descriptor,
        created_at: new Date(),
      });

      // Keep only latest 10 embeddings for performance
      if (user.face_embeddings.length > 10) {
        user.face_embeddings = user.face_embeddings.slice(-10);
      }

      await user.save();

      logger.info(`✓ Face embeddings uploaded for user ${userId}`);

      return {
        success: true,
        message: 'Face embeddings uploaded successfully',
        embeddingsCount: user.face_embeddings.length,
      };
    } catch (error) {
      logger.error('Upload face embeddings error:', error);
      throw error;
    }
  }

  /**
   * User check-in to room
   * @param {String} roomCode
   * @param {String} userId
   * @param {Object} data - { confidence_score, method }
   * @returns {Object} Attendance log
   */
  async checkIn(roomCode, userId, data) {
    try {
      const { confidence_score = null, method = 'manual' } = data;

      // Find room
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Verify user is joined
      const roomMember = await RoomMember.findOne({
        room_id: room._id,
        user_id: userId,
        status: USER_STATUS.JOINED,
      });

      if (!roomMember) {
        const error = new Error('User is not joined in this room');
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      // Create attendance log
      const attendanceLog = new AttendanceLog({
        room_id: room._id,
        user_id: userId,
        confidence_score,
        check_in_time: new Date(),
        check_out_time: null,
        method,
      });

      await attendanceLog.save();

      logger.info(`✓ User ${userId} checked in to room ${roomCode}`);

      return {
        success: true,
        attendanceLog: attendanceLog.toJSON(),
      };
    } catch (error) {
      logger.error('Check-in error:', error);
      throw error;
    }
  }

  /**
   * User check-out from room
   * @param {String} roomCode
   * @param {String} userId
   * @returns {Object} Updated attendance log
   */
  async checkOut(roomCode, userId) {
    try {
      // Find room
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Find latest check-in without check-out
      const attendanceLog = await AttendanceLog.findOne({
        room_id: room._id,
        user_id: userId,
        check_out_time: null,
      });

      if (!attendanceLog) {
        logger.warn(`No active check-in found for user ${userId} in room ${roomCode}`);
        return { success: false, message: 'No active check-in found' };
      }

      // Update check-out time
      attendanceLog.check_out_time = new Date();
      await attendanceLog.save();

      logger.info(`✓ User ${userId} checked out from room ${roomCode}`);

      return {
        success: true,
        attendanceLog: attendanceLog.toJSON(),
        duration: this.calculateDuration(attendanceLog.check_in_time, attendanceLog.check_out_time),
      };
    } catch (error) {
      logger.error('Check-out error:', error);
      throw error;
    }
  }

  /**
   * Get attendance stats for a room
   * @param {String} roomCode
   * @param {String} userId - Must be room host
   * @returns {Object} Attendance stats
   */
  async getRoomAttendanceStats(roomCode, userId) {
    try {
      // Verify user is room host
      const room = await Room.findOne({ room_code: roomCode });
      if (!room) {
        const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      if (room.host_id.toString() !== userId.toString()) {
        const error = new Error(ERROR_MESSAGES.NOT_HOST);
        error.statusCode = HTTP_STATUS.FORBIDDEN;
        throw error;
      }

      // Get all attendance logs
      const logs = await AttendanceLog.find({
        room_id: room._id,
      }).populate('user_id', 'full_name email');

      // Calculate stats
      const stats = logs.map(log => ({
        user: log.user_id?.toJSON() || null,
        checkInTime: log.check_in_time,
        checkOutTime: log.check_out_time,
        duration: this.calculateDuration(log.check_in_time, log.check_out_time),
        method: log.method,
        confidenceScore: log.confidence_score,
      }));

      return {
        success: true,
        room: room.toJSON(),
        totalParticipants: stats.length,
        attendance: stats,
      };
    } catch (error) {
      logger.error('Get attendance stats error:', error);
      throw error;
    }
  }

  /**
   * Get user attendance history
   * @param {String} userId
   * @param {Object} pagination - { page, limit }
   * @returns {Object} Attendance history
   */
  async getUserAttendanceHistory(userId, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      const skip = (page - 1) * limit;

      const logs = await AttendanceLog.find({ user_id: userId })
        .populate('room_id', 'title room_code')
        .sort({ check_in_time: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AttendanceLog.countDocuments({ user_id: userId });

      const history = logs.map(log => ({
        room: log.room_id?.toJSON() || null,
        checkInTime: log.check_in_time,
        checkOutTime: log.check_out_time,
        duration: this.calculateDuration(log.check_in_time, log.check_out_time),
        method: log.method,
        confidenceScore: log.confidence_score,
      }));

      return {
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        history,
      };
    } catch (error) {
      logger.error('Get user attendance history error:', error);
      throw error;
    }
  }

  /**
   * Calculate duration between check-in and check-out in seconds
   * @param {Date} checkInTime
   * @param {Date} checkOutTime
   * @returns {Number} Duration in seconds
   */
  calculateDuration(checkInTime, checkOutTime) {
    if (!checkInTime || !checkOutTime) return 0;
    return Math.floor((checkOutTime - checkInTime) / 1000);
  }

  /**
   * Format duration as HH:MM:SS
   * @param {Number} seconds
   * @returns {String} Formatted duration
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

export default new AttendanceService();
