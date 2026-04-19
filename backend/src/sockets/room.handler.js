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
        status: room.settings.require_approval ? USER_STATUS.PENDING : USER_STATUS.JOINED,
        joined_at: new Date(),
      },
      { upsert: true, new: true }
    );

    // 4. Cập nhật Redis: Lưu socket -> user -> room mapping
    await redis.set(
      `socket:${socket.id}`,
      JSON.stringify({ userId, roomCode })
    );

    // 5. Thêm user vào Set thành viên phòng
    await redis.sAdd(`room:${roomCode}:members`, userId);

    // 6. Join socket vào room namespace
    socket.join(roomCode);

    if (room.settings.require_approval) {
      // Nếu cần duyệt, phát thông báo tới Host
      socket.emit(SOCKET_EVENTS.ROOM_PENDING, {
        message: 'Yêu cầu vào phòng đang chờ duyệt',
        memberId: member._id,
      });

      const hostSocketId = await redis.get(`room:${roomCode}:host:socket`);
      if (hostSocketId) {
        socket.to(hostSocketId).emit(SOCKET_EVENTS.ROOM_REQUEST_APPROVAL, {
          userId,
          memberId: member._id,
          message: `Người dùng yêu cầu vào phòng`,
        });
      }
    } else {
      // Nếu không cần duyệt, thông báo cho tất cả
      socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
        userId,
        message: `Một người dùng đã vào phòng`,
      });

      socket.emit(SOCKET_EVENTS.ROOM_USER_JOINED, { success: true });
    }

    logger.info(`✅ Người dùng ${userId} đã tham gia phòng ${roomCode}`);
  } catch (error) {
    logger.error('❌ Lỗi trong handleRoomJoin:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi vào phòng' });
  }
};

/**
 * Xử lý Host duyệt người tham gia
 * 
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} data - { roomCode, memberId }
 * @returns {Promise<void>}
 */
export const handleApproveUser = async (socket, data) => {
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

    // Phát thông báo tới người dùng đó và tất cả trong phòng
    socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
      userId: member.user_id._id,
      userName: member.user_id.full_name,
      message: `${member.user_id.full_name} đã được duyệt vào phòng`,
    });

    logger.info(`✅ Host đã duyệt người dùng ${member.user_id._id} vào phòng ${roomCode}`);
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

    // Phát thông báo tới tất cả trong phòng
    socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_REJECTED, {
      memberId,
      message: 'Yêu cầu vào phòng đã bị từ chối',
    });

    logger.info(`❌ Host từ chối người dùng vào phòng ${roomCode}`);
  } catch (error) {
    logger.error('❌ Lỗi trong handleRejectUser:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi từ chối người' });
  }
};

export default { handleRoomJoin, handleApproveUser, handleRejectUser };
