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
    );

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
          userId,
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
    const approvedSocketId = await redis.get(`user:${approvedUserId}:socket`);
    if (approvedSocketId) {
      const approvedSocket = socket.nsp.sockets.get(approvedSocketId);
      approvedSocket?.join(roomCode);
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

export default { handleRoomJoin, handleApproveUser, handleRejectUser };
