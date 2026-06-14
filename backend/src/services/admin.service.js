/**
 * ============================================================================
 * SERVICE: ADMIN - Quản lý hệ thống
 * ============================================================================
 *
 * Mục đích: Business logic cho admin dashboard:
 * - Xem danh sách user
 * - Xem & quản lý meetings
 * - Thống kê tổng quan
 *
 * Tác giả: Meeting Team
 */

import { User, Room, RoomMember } from '../models/index.js';
import { HTTP_STATUS, ROOM_STATUS, USER_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

class AdminService {
  /**
   * Lấy thống kê tổng quan
   */
  async getStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalUsers, totalActiveMeetings, totalMeetingsToday, totalMeetings] = await Promise.all([
        User.countDocuments({ role: 'user' }),
        Room.countDocuments({ status: ROOM_STATUS.ACTIVE }),
        Room.countDocuments({ created_at: { $gte: today } }),
        Room.countDocuments({}),
      ]);

      return {
        success: true,
        stats: {
          totalUsers,
          totalActiveMeetings,
          totalMeetingsToday,
          totalMeetings,
        },
      };
    } catch (error) {
      logger.error('Admin getStats error:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách users (chỉ role = 'user'), phân trang
   */
  async getAllUsers({ page = 1, limit = 10, search = '' } = {}) {
    try {
      const skip = (page - 1) * limit;
      const query = { role: 'user' };

      if (search) {
        query.$or = [
          { full_name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      const [users, total] = await Promise.all([
        User.find(query)
          .select('_id full_name email avatar email_verified created_at role')
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(query),
      ]);

      return {
        success: true,
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Admin getAllUsers error:', error);
      throw error;
    }
  }

  /**
   * Lấy chi tiết 1 user kèm lịch sử họp
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId)
        .select('-password_hash -verify_token -reset_password_token -face_embeddings -fcm_tokens')
        .lean();

      if (!user) {
        const error = new Error('User not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      // Lấy lịch sử cuộc họp của user (10 gần nhất)
      const meetingHistory = await RoomMember.find({ user_id: userId })
        .sort({ joined_at: -1 })
        .limit(10)
        .populate('room_id', 'title room_code status started_at ended_at host_id')
        .lean();

      // Thống kê nhanh
      const totalMeetings = await RoomMember.countDocuments({ user_id: userId });
      const hostedMeetings = await Room.countDocuments({ host_id: userId });

      return {
        success: true,
        user,
        meetingHistory: meetingHistory.map((m) => ({
          ...m,
          room: m.room_id,
        })),
        stats: {
          totalMeetingsJoined: totalMeetings,
          totalMeetingsHosted: hostedMeetings,
        },
      };
    } catch (error) {
      logger.error('Admin getUserById error:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả meetings với filter
   */
  async getAllMeetings({ status = '', page = 1, limit = 10, search = '' } = {}) {
    try {
      const skip = (page - 1) * limit;
      const query = {};

      if (status && ['waiting', 'active', 'ended'].includes(status)) {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { room_code: { $regex: search, $options: 'i' } },
        ];
      }

      const [rooms, total] = await Promise.all([
        Room.find(query)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .populate('host_id', '_id full_name email avatar')
          .lean(),
        Room.countDocuments(query),
      ]);

      // Lấy số lượng participants cho từng room
      const roomIds = rooms.map((r) => r._id);
      const participantCounts = await RoomMember.aggregate([
        {
          $match: {
            room_id: { $in: roomIds },
            status: { $in: [USER_STATUS.JOINED, USER_STATUS.PENDING] },
          },
        },
        { $group: { _id: '$room_id', count: { $sum: 1 } } },
      ]);

      const countMap = {};
      participantCounts.forEach((p) => {
        countMap[p._id.toString()] = p.count;
      });

      const roomsWithCount = rooms.map((r) => ({
        ...r,
        participant_count: countMap[r._id.toString()] || 0,
      }));

      return {
        success: true,
        meetings: roomsWithCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Admin getAllMeetings error:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách meetings đang active (realtime overview)
   */
  async getActiveMeetings() {
    try {
      const rooms = await Room.find({ status: ROOM_STATUS.ACTIVE })
        .sort({ started_at: -1 })
        .populate('host_id', '_id full_name email avatar')
        .lean();

      // Lấy participants count & list
      const roomIds = rooms.map((r) => r._id);

      const allMembers = await RoomMember.find({
        room_id: { $in: roomIds },
        status: USER_STATUS.JOINED,
      })
        .populate('user_id', '_id full_name email avatar')
        .lean();

      const membersMap = {};
      allMembers.forEach((m) => {
        const rid = m.room_id.toString();
        if (!membersMap[rid]) membersMap[rid] = [];
        membersMap[rid].push({
          _id: m.user_id?._id,
          full_name: m.user_id?.full_name,
          email: m.user_id?.email,
          avatar: m.user_id?.avatar,
          joined_at: m.joined_at,
        });
      });

      const result = rooms.map((r) => ({
        ...r,
        participants: membersMap[r._id.toString()] || [],
        participant_count: (membersMap[r._id.toString()] || []).length,
      }));

      return {
        success: true,
        meetings: result,
      };
    } catch (error) {
      logger.error('Admin getActiveMeetings error:', error);
      throw error;
    }
  }

  /**
   * Admin force-xóa 1 phòng họp (không cần là host)
   */
  async forceDeleteMeeting(roomCode) {
    try {
      const normalizedCode = roomCode ? roomCode.toUpperCase() : '';
      const room = await Room.findOne({ room_code: normalizedCode });

      if (!room) {
        const error = new Error('Room not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      await RoomMember.deleteMany({ room_id: room._id });
      await Room.deleteOne({ _id: room._id });

      // Xóa Redis keys
      try {
        const redis = getRedisClient();
        await redis.del(`room:${normalizedCode}:members`);
        await redis.del(`room:${normalizedCode}:host`);
        await redis.del(`room:${normalizedCode}:host:socket`);
      } catch (redisErr) {
        logger.warn('Admin forceDelete: Redis cleanup failed:', redisErr.message);
      }

      logger.info(`Admin force-deleted room: ${normalizedCode}`);
      return { success: true, message: `Room ${normalizedCode} deleted by admin` };
    } catch (error) {
      logger.error('Admin forceDeleteMeeting error:', error);
      throw error;
    }
  }
}

export default new AdminService();
