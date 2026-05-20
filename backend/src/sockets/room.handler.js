import { getRedisClient } from '../config/redis.js';
import { RoomMember, Room, User } from '../models/index.js';
import { SOCKET_EVENTS, ROOM_STATUS, USER_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const emitSocketError = (socket, message) => {
  socket.emit(SOCKET_EVENTS.ERROR, { message });
};

const getRoomForHostAction = async (socket, roomCode) => {
  if (!roomCode) {
    emitSocketError(socket, 'Room code is required');
    return null;
  }

  const room = await Room.findOne({ room_code: roomCode });
  if (!room) {
    emitSocketError(socket, 'Room not found');
    return null;
  }

  if (room.host_id.toString() !== socket.userId?.toString()) {
    emitSocketError(socket, 'Only room host can perform this action');
    return null;
  }

  return room;
};

const getUserPayload = async (userId) => {
  const user = await User.findById(userId).select('full_name email avatar').lean();
  if (!user) return null;

  return {
    _id: user._id.toString(),
    full_name: user.full_name,
    email: user.email,
    avatar: user.avatar || null,
  };
};

export const handleRoomJoin = async (socket, data = {}) => {
  try {
    const userId = socket.userId;
    const { roomCode } = data;

    if (!roomCode) {
      emitSocketError(socket, 'Room code is required');
      return;
    }

    const redis = getRedisClient();
    const room = await Room.findOne({ room_code: roomCode });
    if (!room) {
      emitSocketError(socket, 'Room not found');
      return;
    }

    if (room.status === ROOM_STATUS.ENDED) {
      emitSocketError(socket, 'Room has ended');
      return;
    }

    const shouldJoinImmediately = !room.settings.require_approval;
    const member = await RoomMember.findOneAndUpdate(
      { room_id: room._id, user_id: userId },
      {
        room_id: room._id,
        user_id: userId,
        status: shouldJoinImmediately ? USER_STATUS.JOINED : USER_STATUS.PENDING,
        joined_at: shouldJoinImmediately ? new Date() : null,
        left_at: null,
      },
      { upsert: true, new: true }
    ).populate("user_id");

    await redis.set(`socket:${socket.id}`, JSON.stringify({ userId, roomCode }));
    await redis.set(`user:${userId}:socket`, socket.id);

    const userPayload = await getUserPayload(userId);

    if (!shouldJoinImmediately) {
      socket.emit(SOCKET_EVENTS.ROOM_PENDING, {
        message: 'Join request is pending approval',
        memberId: member._id,
      });

      const hostSocketId = await redis.get(`user:${room.host_id.toString()}:socket`);
      if (hostSocketId) {
        socket.to(hostSocketId).emit(SOCKET_EVENTS.ROOM_REQUEST_APPROVAL, {
          userId: member.user_id._id,
          userName: member.user_id.full_name,
          memberId: member._id,
          user: userPayload,
          message: 'A user requested to join the room',
        });
      }
      return;
    }

    await redis.sAdd(`room:${roomCode}:members`, userId);
    socket.join(roomCode);

    if (room.status === ROOM_STATUS.WAITING) {
      room.status = ROOM_STATUS.ACTIVE;
    }
    if (!room.started_at) {
      room.started_at = new Date();
    }
    await room.save();

    socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
      userId,
      user: userPayload,
      message: 'A user joined the room',
    });

    socket.emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
      success: true,
      userId,
      user: userPayload,
    });

    logger.info(`User ${userId} joined room ${roomCode}`);
  } catch (error) {
    logger.error('handleRoomJoin error:', error);
    emitSocketError(socket, 'Failed to join room');
  }
};

export const handleApproveUser = async (socket, data = {}) => {
  try {
    const { roomCode, memberId } = data;
    const redis = getRedisClient();
    const room = await getRoomForHostAction(socket, roomCode);
    if (!room) return;

    const member = await RoomMember.findOneAndUpdate(
      { _id: memberId, room_id: room._id },
      { status: USER_STATUS.JOINED, joined_at: new Date(), left_at: null },
      { new: true }
    ).populate('user_id', 'full_name email avatar');

    if (!member) {
      emitSocketError(socket, 'Member not found in room');
      return;
    }

    if (room.status === ROOM_STATUS.WAITING) {
      room.status = ROOM_STATUS.ACTIVE;
    }
    if (!room.started_at) {
      room.started_at = new Date();
    }
    await room.save();

    const approvedUserId = member.user_id._id.toString();
    logger.info(`Người dùng ${member.user_id.full_name} đã được duyệt vào phòng ${roomCode}`);

    // 1. Tìm socket của approved user
    const approvedSocketId = await redis.get(`user:${approvedUserId}:socket`);
    let approvedSocket = null;
    if (approvedSocketId) {
      approvedSocket = io.sockets.sockets.get(approvedSocketId);
    }

    await redis.sAdd(`room:${roomCode}:members`, approvedUserId);

    const userPayload = {
      _id: approvedUserId,
      full_name: member.user_id.full_name,
      email: member.user_id.email,
      avatar: member.user_id.avatar || null,
    };

    socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
      userId: approvedUserId,
      user: userPayload,
      message: `${member.user_id.full_name} joined the room`,
    });

    if (approvedSocketId) {
      socket.to(approvedSocketId).emit(SOCKET_EVENTS.ROOM_USER_JOINED, {
        userId: approvedUserId,
        user: userPayload,
        message: 'You have been approved to join the room',
      });
      logger.info(`📤 Đã notify approved user ${approvedUserId} với ${existingParticipants.length} existing participants`);
    } else {
      logger.warn(`⚠️  Không tìm thấy socket của user ${approvedUserId}`);
    }

    logger.info(`Host ${socket.userId} approved ${approvedUserId} for room ${roomCode}`);
  } catch (error) {
    logger.error('handleApproveUser error:', error);
    emitSocketError(socket, 'Failed to approve user');
  }
};

export const handleRejectUser = async (socket, data = {}) => {
  try {
    const { roomCode, memberId } = data;
    const redis = getRedisClient();
    const room = await getRoomForHostAction(socket, roomCode);
    if (!room) return;

    const member = await RoomMember.findOneAndUpdate(
      { _id: memberId, room_id: room._id },
      { status: USER_STATUS.REJECTED, left_at: new Date() },
      { new: true }
    );

    if (!member) {
      emitSocketError(socket, 'Member not found in room');
      return;
    }

    const rejectedSocketId = await redis.get(`user:${member.user_id.toString()}:socket`);

    socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_USER_REJECTED, {
      memberId,
      userId: member.user_id.toString(),
      message: 'Join request was rejected',
    });

    if (rejectedSocketId) {
      socket.to(rejectedSocketId).emit(SOCKET_EVENTS.ROOM_USER_REJECTED, {
        memberId,
        userId: member.user_id.toString(),
        message: 'Your join request was rejected',
      });
    }

    logger.info(`Host ${socket.userId} rejected member ${memberId} for room ${roomCode}`);
  } catch (error) {
    logger.error('handleRejectUser error:', error);
    emitSocketError(socket, 'Failed to reject user');
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
      { status: USER_STATUS.LEFT, left_at: new Date() },
      { new: true }
    ).populate('user_id', 'full_name email avatar');

    if (!member) return;

    // Xóa user khỏi Set thành viên phòng
    await redis.sRem(`room:${roomCode}:members`, userId);

    // Cleanup Redis socket mappings (tránh disconnect handler double-fire)
    await redis.del(`socket:${socket.id}`);
    await redis.del(`user:${userId}:socket`);

    // Rời khỏi room namespace
    socket.leave(roomCode);

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


/**
 * Xử lý Host kết thúc cuộc họp cho tất cả
 * 
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket.IO socket instance (host)
 * @param {Object} data - { roomCode }
 * @returns {Promise<void>}
 */
export const handleEndMeeting = async (io, socket, data) => {
  try {
    const { roomCode } = data;
    const redis = getRedisClient();

    logger.info(`🔴 Host kết thúc phòng ${roomCode}`);

    // 1. Broadcast room:ended cho tất cả participant trong room (trừ host)
    socket.to(roomCode).emit(SOCKET_EVENTS.ROOM_ENDED, {
      message: 'The meeting has been ended by the host',
    });

    // 2. Notify waiting users (pending members chưa join room namespace)
    const room = await Room.findOne({ room_code: roomCode });
    if (room) {
      const pendingMembers = await RoomMember.find({
        room_id: room._id,
        status: USER_STATUS.PENDING,
      });

      for (const member of pendingMembers) {
        const waitingUserId = member.user_id.toString();
        const waitingSocketId = await redis.get(`user:${waitingUserId}:socket`);
        if (waitingSocketId) {
          const waitingSocket = io.sockets.sockets.get(waitingSocketId);
          if (waitingSocket) {
            waitingSocket.emit(SOCKET_EVENTS.ROOM_ENDED, {
              message: 'The meeting has been ended by the host',
            });
          }
        }
      }
    }

    // 3. Cleanup Redis keys cho host socket
    await redis.del(`room:${roomCode}:host:socket`);

    // 4. Host rời khỏi room namespace
    socket.leave(roomCode);

    logger.info(`✅ Phòng ${roomCode} đã kết thúc, tất cả đã được thông báo`);
  } catch (error) {
    logger.error('❌ Lỗi trong handleEndMeeting:', error);
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Lỗi khi kết thúc phòng' });
  }
};

export default { handleRoomJoin, handleApproveUser, handleRejectUser, handleUserLeft, handleEndMeeting };
