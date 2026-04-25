/**
 * ============================================================================
 * MEETING PROJECT - BACKEND - XỬ LÝ SỰ KIỆN ROOM (PHÒNG HỌP)
 * ============================================================================
 * 
 * Module này xử lý toàn bộ logic Socket.IO liên quan tới Phòng họp:
 * - Người dùng yêu cầu vào phòng (room:join)
 * - Duyệt/Từ chối người tham gia (room:approve_user, room:reject_user)
 * - Quản lý danh sách thành viên
 * - Xử lý các sự kiện rời khỏi phòng
 * 
 * Kiến trúc: Handler này được gọi từ sockets/index.js
 * 
 * Tác giả: Meeting Team
 * Ngày tạo: 2026-04-08
 */

import { getRedisClient } from '../config/redis.js';
import { RoomMember, Room } from '../models/index.js';
import { SOCKET_EVENTS, ROOM_STATUS, USER_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

/**
 * Xử lý sự kiện người dùng yêu cầu vào phòng
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { userId, roomCode }
 * @returns {Promise<void>}
 */
export const handleRoomJoin = async (socket, data) => {
  try {
    const { userId, roomCode } = data;
    const redis = getRedisClient();

    logger.info(`👤 Người dùng ${userId} yêu cầu vào phòng ${roomCode}`);

    // 1. Kiểm tra phòng có tồn tại không
    const room = await Room.findOne({ room_code: roomCode });
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Phòng không tồn tại' });
      return;
    }

    // 2. Nếu phòng đã kết thúc, từ chối
    if (room.status === ROOM_STATUS.ENDED) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Phòng đã kết thúc' });
      return;
    }

    // 3. Thêm member vào Database
    const member = await RoomMember.findOneAndUpdate(
      { room_id: room._id, user_id: userId },
      {
        room_id: room._id,
        user_id: userId,
        joined_at: new Date(),
      },
      { upsert: true, new: true }
    ).populate("user_id");

    // 4. Cập nhật Redis: Lưu socket -> user -> room mapping
    await redis.set(
      `socket:${socket.id}`,
      JSON.stringify({ userId, roomCode })
    );
    // Lưu ngược: userId -> socketId (để host có thể notify user sau khi approve)
    await redis.set(`user:${userId}:socket`, socket.id);

    if (room.settings.require_approval) {
      // ====================================================================
      // CẦN DUYỆT: KHÔNG join room namespace ngay — chờ host approve
      // ====================================================================
      socket.emit(SOCKET_EVENTS.ROOM_PENDING, {
        message: 'Yêu cầu vào phòng đang chờ duyệt',
        memberId: member._id,
      });

      const hostSocketId = await redis.get(`room:${roomCode}:host:socket`);
      if (hostSocketId) {
        socket.to(hostSocketId).emit(SOCKET_EVENTS.ROOM_REQUEST_APPROVAL, {
          userId: member.user_id._id,
          userName: member.user_id.full_name,
          memberId: member._id,
          message: `${member.user_id.full_name} yêu cầu vào phòng`,
        });
      }
    } else {
      // ====================================================================
      // KHÔNG CẦN DUYỆT: join room namespace ngay
      // ====================================================================
      // Nếu là host thì lưu socket vào redis
      if (room.host_id.toString() === userId) {
        await redis.set(`room:${roomCode}:host:socket`, socket.id);
      }

      // Lấy existing participants TRƯỚC khi join room
      const memberIds = await redis.sMembers(`room:${roomCode}:members`);
      const existingParticipants = [];
      for (const mId of memberIds) {
        if (mId === userId) continue;
        const rm = await RoomMember.findOne({
          room_id: room._id,
          user_id: mId,
        }).populate('user_id', 'full_name email');
        if (rm && rm.user_id) {
          existingParticipants.push({
            userId: rm.user_id._id.toString(),
            userName: rm.user_id.full_name,
          });
        }
      }

      // Thêm vào members set + join room
      await redis.sAdd(`room:${roomCode}:members`, userId);
      socket.join(roomCode);

      // Thông báo cho những người ĐANG trong phòng (trừ bản thân)
      socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
        userId,
        userName: member.user_id.full_name,
        message: `Một người dùng đã vào phòng`,
      });

      // Gửi cho bản thân kèm existing participants
      socket.emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
        success: true,
        existingParticipants,
      });
    }

    // Host luôn join room ngay (không cần approval)
    if (room.host_id.toString() === userId && room.settings.require_approval) {
      await redis.sAdd(`room:${roomCode}:members`, userId);
      socket.join(roomCode);
      await redis.set(`room:${roomCode}:host:socket`, socket.id);

      socket.emit(SOCKET_EVENTS.ROOM_USER_JOINED, { success: true });
    }

    logger.info(`✅ Người dùng ${userId} đã xử lý join phòng ${roomCode}`);
  } catch (error) {
    logger.error('❌ Lỗi trong handleRoomJoin:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi vào phòng' });
  }
};

/**
 * Xử lý Host duyệt người tham gia
 * 
 * io được truyền từ index.js để có thể join approved user vào room
 * 
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket.IO socket instance (host)
 * @param {Object} data - { roomCode, memberId }
 * @returns {Promise<void>}
 */
export const handleApproveUser = async (io, socket, data) => {
  try {
    const { roomCode, memberId } = data;
    const redis = getRedisClient();

    // Cập nhật status thành JOINED
    const member = await RoomMember.findByIdAndUpdate(
      memberId,
      { status: USER_STATUS.JOINED, joined_at: new Date() },
      { new: true }
    ).populate('user_id', 'full_name email');

    if (!member) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Không tìm thấy thành viên' });
      return;
    }

    const approvedUserId = member.user_id._id.toString();
    logger.info(`Người dùng ${member.user_id.full_name} đã được duyệt vào phòng ${roomCode}`);

    // 1. Tìm socket của approved user
    const approvedSocketId = await redis.get(`user:${approvedUserId}:socket`);
    let approvedSocket = null;
    if (approvedSocketId) {
      approvedSocket = io.sockets.sockets.get(approvedSocketId);
    }

    // 2. Lấy danh sách existing participants TRƯỚC khi thêm approved user
    const room = await Room.findOne({ room_code: roomCode });
    const memberIds = await redis.sMembers(`room:${roomCode}:members`);
    const existingParticipants = [];
    for (const mId of memberIds) {
      if (mId === approvedUserId) continue;
      const rm = await RoomMember.findOne({
        room_id: room?._id,
        user_id: mId,
      }).populate('user_id', 'full_name email');
      if (rm && rm.user_id) {
        existingParticipants.push({
          userId: rm.user_id._id.toString(),
          userName: rm.user_id.full_name,
        });
      }
    }

    // 3. Thêm approved user vào Redis members set
    await redis.sAdd(`room:${roomCode}:members`, approvedUserId);

    const payload = {
      userId: approvedUserId,
      userName: member.user_id.full_name,
      message: `${member.user_id.full_name} đã được duyệt vào phòng`,
    };

    // 4. Notify HOST (socket.emit → chính host nhận)
    socket.emit(SOCKET_EVENTS.ROOM_USER_JOINED, payload);

    // 5. Notify người KHÁC trong room (approved user CHƯA join room nên không nhận duplicate)
    socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_JOINED, payload);

    // 6. Emit riêng cho approved user: isSelf + existingParticipants
    if (approvedSocket) {
      approvedSocket.emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
        ...payload,
        isSelf: true,
        existingParticipants,
      });
      logger.info(`📤 Đã notify approved user ${approvedUserId} với ${existingParticipants.length} existing participants`);
    } else {
      logger.warn(`⚠️  Không tìm thấy socket của user ${approvedUserId}`);
    }

    // 7. SAU KHI emit xong → join approved user vào room cho các event tương lai
    if (approvedSocket) {
      approvedSocket.join(roomCode);
      logger.info(`📥 Socket ${approvedSocketId} đã join room namespace ${roomCode}`);
    }

    logger.info(`✅ Host đã duyệt người dùng ${approvedUserId} vào phòng ${roomCode}`);
  } catch (error) {
    logger.error('❌ Lỗi trong handleApproveUser:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi duyệt người' });
  }
};

/**
 * Xử lý Host từ chối người tham gia
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { roomCode, memberId }
 * @returns {Promise<void>}
 */
export const handleRejectUser = async (socket, data) => {
  try {
    const { roomCode, memberId } = data;

    const member = await RoomMember.findByIdAndUpdate(
      memberId,
      { status: USER_STATUS.REJECTED },
      { new: true }
    );

    if (!member) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Không tìm thấy thành viên' });
      return;
    }

    // Tìm socket của user bị reject để notify trực tiếp
    const redis = getRedisClient();
    const rejectedUserId = member.user_id.toString();
    const rejectedSocketId = await redis.get(`user:${rejectedUserId}:socket`);
    if (rejectedSocketId) {
      socket.to(rejectedSocketId).emit(SOCKET_EVENTS.ROOM_USER_REJECTED, {
        memberId,
        userId: rejectedUserId,
        message: 'Yêu cầu vào phòng đã bị từ chối',
      });
    }

    logger.info(`❌ Host từ chối người dùng vào phòng ${roomCode}`);
  } catch (error) {
    logger.error('❌ Lỗi trong handleRejectUser:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi từ chối người' });
  }
};

/**
 * Xử lý người dùng rời khỏi phòng
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { roomCode, userId }
 * @returns {Promise<void>}
 */
export const handleUserLeft = async (socket, data) => {
  try {
    const { roomCode, userId } = data;
    const redis = getRedisClient();

    const room = await Room.findOne({ room_code: roomCode });
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Không tìm thấy phòng' });
      return;
    }

    const member = await RoomMember.findOneAndUpdate(
      { room_id: room._id, user_id: userId },
      { status: USER_STATUS.LEFT },
      { new: true }
    ).populate('user_id', 'full_name email avatar');

    if (!member) return;

    // Xóa user khỏi Set thành viên phòng
    await redis.sRem(`room:${roomCode}:members`, userId);

    // Phát thông báo tới tất cả trong phòng
    socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_LEFT, {
      userId,
      user: member.user_id,
      message: `${member.user_id.full_name} đã rời khỏi phòng`,
    });

    logger.info(`👋 Người dùng ${userId} rời khỏi phòng ${roomCode}`);
  } catch (error) {
    logger.error('❌ Lỗi trong handleUserLeft:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi rời khỏi phòng' });
  }
};


export default { handleRoomJoin, handleApproveUser, handleRejectUser, handleUserLeft };
