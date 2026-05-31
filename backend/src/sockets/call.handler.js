import { CallSession, Room, RoomMember, User } from '../models/index.js';
import chatService from '../services/chat.service.js';
import { CALL_STATUS, CALL_TYPE, SOCKET_EVENTS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const getConversationChannel = (conversationId) => `conversation:${conversationId}`;
const normalizeRoomCode = (roomCode) => (roomCode ? roomCode.toUpperCase() : null);

const toIdString = (value) => value?.toString();

const buildScopeQuery = ({ roomId = null, conversationId = null }) =>
  roomId ? { room_id: roomId } : { conversation_id: conversationId };

const emitCallError = (socket, message) => {
  socket.emit(SOCKET_EVENTS.CALL_ERROR, { message });
};

const emitToScope = (io, scope, event, payload) => {
  if (scope.conversationId) {
    io.to(getConversationChannel(scope.conversationId)).emit(event, payload);
    return;
  }

  if (scope.roomCode) {
    io.to(scope.roomCode).emit(event, payload);
  }
};

const emitToParticipantRooms = (io, session, event, payload) => {
  const participantIds = [
    session.caller_id,
    ...(session.receiver_ids || []),
  ]
    .map(toIdString)
    .filter(Boolean);

  for (const participantId of [...new Set(participantIds)]) {
    io.to(`user:${participantId}`).emit(event, payload);
  }
};

const getDurationSeconds = (answeredAt, endedAt = new Date()) => {
  if (!answeredAt) {
    return 0;
  }

  return Math.max(0, Math.floor((endedAt.getTime() - answeredAt.getTime()) / 1000));
};

const formatDuration = (durationSeconds) => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const STALE_RINGING_MS = 60 * 1000;
const STALE_ACCEPTED_MS = 6 * 60 * 60 * 1000;

const createCallSystemMessage = async (scope, userId, session, status) => {
  const endedAt = session.ended_at || new Date();
  const durationSeconds = session.duration_seconds || 0;
  const callTypeLabel = session.call_type === CALL_TYPE.VIDEO ? 'video' : 'audio';

  let content = '';
  if (status === CALL_STATUS.MISSED) {
    content = `Missed ${callTypeLabel} call`;
  } else if (status === CALL_STATUS.REJECTED) {
    content = 'Call declined';
  } else {
    content = `Call ended • ${formatDuration(durationSeconds)}`;
  }

  return chatService.createSystemMessage(
    { ...scope, userId },
    content,
    {
      systemEvent: {
        category: 'call',
        call_id: session._id,
        call_type: session.call_type,
        call_status: status,
        caller_id: session.caller_id,
        receiver_ids: session.receiver_ids,
        started_at: session.started_at,
        answered_at: session.answered_at,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
      },
    }
  );
};

const finalizeSession = async (io, session, scope, status, userId, extraPayload = {}) => {
  const endedAt = new Date();
  session.status = status;
  session.ended_at = endedAt;
  session.duration_seconds = getDurationSeconds(session.answered_at, endedAt);
  session.updated_at = endedAt;
  await session.save();

  const systemMessage = await createCallSystemMessage(scope, userId, session, status);
  emitToScope(io, scope, SOCKET_EVENTS.CHAT_RECEIVE, systemMessage);

  const event =
    status === CALL_STATUS.MISSED
      ? SOCKET_EVENTS.CALL_MISSED
      : status === CALL_STATUS.REJECTED
        ? SOCKET_EVENTS.CALL_REJECTED
        : SOCKET_EVENTS.CALL_ENDED;

  emitToParticipantRooms(io, session, event, {
    callId: session._id.toString(),
    roomCode: scope.roomCode,
    conversationId: scope.conversationId,
    durationSeconds: session.duration_seconds,
    endedAt: endedAt.toISOString(),
    final: true,
    status,
    ...extraPayload,
  });
};

const resolveScope = async (data, userId) => {
  if (data.conversationId) {
    const conversation = await chatService.getAccessibleConversation(data.conversationId, userId);
    return {
      roomCode: null,
      roomId: null,
      conversationId: conversation._id.toString(),
      conversation,
      room: null,
    };
  }

  const roomCode = normalizeRoomCode(data.roomCode);
  if (!roomCode) {
    const error = new Error('conversationId or roomCode is required');
    error.statusCode = 400;
    throw error;
  }

  const room = await chatService.getAccessibleRoom(roomCode, userId, { requireJoined: true });
  return {
    roomCode: room.room_code,
    roomId: room._id.toString(),
    conversationId: null,
    conversation: null,
    room,
  };
};

const resolveAllowedTargets = async (scope, callerId) => {
  if (scope.conversation) {
    return scope.conversation.member_ids
      .map((memberId) => memberId.toString())
      .filter((memberId) => memberId !== callerId.toString());
  }

  const members = await RoomMember.find({
    room_id: scope.room._id,
    status: 'joined',
  })
    .select('user_id')
    .lean();

  return members
    .map((member) => member.user_id.toString())
    .filter((memberId) => memberId !== callerId.toString());
};

const cleanupStaleActiveCall = async (io, activeCall, scope, userId) => {
  if (!activeCall) {
    return null;
  }

  const now = Date.now();
  const startedAtMs = activeCall.started_at ? new Date(activeCall.started_at).getTime() : now;
  const updatedAtMs = activeCall.updated_at ? new Date(activeCall.updated_at).getTime() : startedAtMs;

  const isStaleRinging =
    activeCall.status === CALL_STATUS.RINGING &&
    now - startedAtMs >= STALE_RINGING_MS;

  const isStaleAccepted =
    activeCall.status === CALL_STATUS.ACCEPTED &&
    activeCall.accepted_by?.length === 0 &&
    now - updatedAtMs >= STALE_ACCEPTED_MS;

  if (!isStaleRinging && !isStaleAccepted) {
    return activeCall;
  }

  const session = await CallSession.findById(activeCall._id);
  if (!session) {
    return null;
  }

  if (isStaleRinging) {
    await finalizeSession(io, session, scope, CALL_STATUS.MISSED, userId, {
      userId: session.caller_id.toString(),
      stale: true,
    });
    return null;
  }

  await finalizeSession(io, session, scope, CALL_STATUS.ENDED, userId, {
    userId: session.caller_id.toString(),
    stale: true,
  });
  return null;
};

const loadSessionById = async (callId) => {
  if (!callId) {
    return null;
  }

  return CallSession.findById(callId);
};

const buildSessionScope = async (session, fallbackRoomCode = null) => {
  if (session.conversation_id) {
    return {
      conversationId: session.conversation_id.toString(),
      roomCode: null,
    };
  }

  if (fallbackRoomCode) {
    return {
      conversationId: null,
      roomCode: normalizeRoomCode(fallbackRoomCode),
    };
  }

  const room = session.room_id ? await Room.findById(session.room_id).select('room_code').lean() : null;
  return {
    conversationId: null,
    roomCode: room?.room_code || null,
  };
};

const buildRingingPayload = (session, scope, callerName, direction) => ({
  callId: session._id.toString(),
  roomCode: scope.roomCode,
  conversationId: scope.conversationId,
  callerId: toIdString(session.caller_id),
  callerName,
  targetUserIds: session.receiver_ids.map((id) => id.toString()),
  callType: session.call_type,
  startedAt: session.started_at.toISOString(),
  direction,
  acceptedUserIds: (session.accepted_by || []).map((id) => id.toString()),
});

export const handleCallStart = async (io, socket, data = {}) => {
  try {
    const scope = await resolveScope(data, socket.userId);
    const caller = await User.findById(socket.userId).select('_id full_name').lean();
    if (!caller) {
      emitCallError(socket, 'User not found');
      return;
    }

    const requestedTargetIds = [...new Set((Array.isArray(data.targetUserIds) ? data.targetUserIds : []).map(String))];
    const allowedTargetIds = await resolveAllowedTargets(scope, socket.userId);
    const targetUserIds = requestedTargetIds.filter((userId) => allowedTargetIds.includes(userId));

    if (targetUserIds.length === 0) {
      emitCallError(socket, 'No valid call recipients found');
      return;
    }

    const activeCall = await CallSession.findOne({
      ...buildScopeQuery(scope),
      status: { $in: [CALL_STATUS.RINGING, CALL_STATUS.ACCEPTED] },
    }).lean();

    const blockingCall = await cleanupStaleActiveCall(io, activeCall, scope, socket.userId);

    if (blockingCall) {
      emitCallError(socket, 'Another call is already active');
      return;
    }

    const session = await CallSession.create({
      ...buildScopeQuery(scope),
      caller_id: socket.userId,
      receiver_ids: targetUserIds,
      call_type: data.callType === CALL_TYPE.VIDEO ? CALL_TYPE.VIDEO : CALL_TYPE.AUDIO,
      status: CALL_STATUS.RINGING,
      started_at: new Date(),
      accepted_by: [],
      rejected_by: [],
      left_by: [],
      missed_by: [],
      updated_at: new Date(),
    });

    socket.emit(SOCKET_EVENTS.CALL_RINGING, buildRingingPayload(session, scope, caller.full_name, 'outgoing'));

    for (const targetUserId of targetUserIds) {
      io.to(`user:${targetUserId}`).emit(
        SOCKET_EVENTS.CALL_RINGING,
        buildRingingPayload(session, scope, caller.full_name, 'incoming')
      );
    }
  } catch (error) {
    logger.error('handleCallStart error:', error);
    emitCallError(socket, error.message || 'Failed to start call');
  }
};

export const handleCallAccept = async (io, socket, data = {}) => {
  try {
    const session = await loadSessionById(data.callId);
    if (!session) {
      emitCallError(socket, 'Call session not found');
      return;
    }

    const scope = await buildSessionScope(session, data.roomCode);
    const userId = socket.userId.toString();
    const receiverIds = session.receiver_ids.map((id) => id.toString());

    if (!receiverIds.includes(userId)) {
      emitCallError(socket, 'Only invited participants can accept this call');
      return;
    }

    if ([CALL_STATUS.ENDED, CALL_STATUS.MISSED, CALL_STATUS.REJECTED].includes(session.status)) {
      emitCallError(socket, 'Call is no longer active');
      return;
    }

    if (!session.accepted_by.some((id) => id.toString() === userId)) {
      session.accepted_by = [...session.accepted_by, socket.userId];
    }
    session.rejected_by = session.rejected_by.filter((id) => id.toString() !== userId);
    session.left_by = session.left_by.filter((id) => id.toString() !== userId);
    if (!session.answered_at) {
      session.answered_at = new Date();
    }
    session.status = CALL_STATUS.ACCEPTED;
    session.updated_at = new Date();
    await session.save();

    emitToParticipantRooms(io, session, SOCKET_EVENTS.CALL_ACCEPTED, {
      callId: session._id.toString(),
      roomCode: scope.roomCode,
      conversationId: scope.conversationId,
      answeredAt: session.answered_at.toISOString(),
      acceptedUserIds: session.accepted_by.map((id) => id.toString()),
      userId,
      final: false,
    });
  } catch (error) {
    logger.error('handleCallAccept error:', error);
    emitCallError(socket, error.message || 'Failed to accept call');
  }
};

export const handleCallReject = async (io, socket, data = {}) => {
  try {
    const session = await loadSessionById(data.callId);
    if (!session) {
      emitCallError(socket, 'Call session not found');
      return;
    }

    const scope = await buildSessionScope(session, data.roomCode);
    const userId = socket.userId.toString();
    const receiverIds = session.receiver_ids.map((id) => id.toString());

    if (!receiverIds.includes(userId)) {
      emitCallError(socket, 'Only invited participants can reject this call');
      return;
    }

    if ([CALL_STATUS.ENDED, CALL_STATUS.MISSED, CALL_STATUS.REJECTED].includes(session.status)) {
      return;
    }

    if (!session.rejected_by.some((id) => id.toString() === userId)) {
      session.rejected_by = [...session.rejected_by, socket.userId];
    }
    session.accepted_by = session.accepted_by.filter((id) => id.toString() !== userId);
    session.updated_at = new Date();
    await session.save();

    const everyoneRejected =
      session.accepted_by.length === 0 &&
      receiverIds.every((receiverId) => session.rejected_by.some((id) => id.toString() === receiverId));

    if (everyoneRejected) {
      await finalizeSession(io, session, scope, CALL_STATUS.REJECTED, socket.userId, {
        userId,
      });
      return;
    }

    emitToParticipantRooms(io, session, SOCKET_EVENTS.CALL_REJECTED, {
      callId: session._id.toString(),
      roomCode: scope.roomCode,
      conversationId: scope.conversationId,
      userId,
      final: false,
    });
  } catch (error) {
    logger.error('handleCallReject error:', error);
    emitCallError(socket, error.message || 'Failed to reject call');
  }
};

export const handleCallCancel = async (io, socket, data = {}) => {
  try {
    const session = await loadSessionById(data.callId);
    if (!session) {
      emitCallError(socket, 'Call session not found');
      return;
    }

    if (session.caller_id.toString() !== socket.userId.toString()) {
      emitCallError(socket, 'Only the caller can cancel this call');
      return;
    }

    const scope = await buildSessionScope(session, data.roomCode);

    if (session.accepted_by.length > 0) {
      emitCallError(socket, 'Accepted calls cannot be cancelled');
      return;
    }

    await finalizeSession(io, session, scope, CALL_STATUS.MISSED, socket.userId);
  } catch (error) {
    logger.error('handleCallCancel error:', error);
    emitCallError(socket, error.message || 'Failed to cancel call');
  }
};

export const handleCallEnd = async (io, socket, data = {}) => {
  try {
    const session = await loadSessionById(data.callId);
    if (!session) {
      emitCallError(socket, 'Call session not found');
      return;
    }

    const scope = await buildSessionScope(session, data.roomCode);
    const userId = socket.userId.toString();
    const isCaller = session.caller_id.toString() === userId;
    const isReceiver = session.receiver_ids.some((id) => id.toString() === userId);

    if (!isCaller && !isReceiver) {
      emitCallError(socket, 'You are not part of this call');
      return;
    }

    if ([CALL_STATUS.ENDED, CALL_STATUS.MISSED, CALL_STATUS.REJECTED].includes(session.status)) {
      return;
    }

    if (isCaller) {
      await finalizeSession(io, session, scope, CALL_STATUS.ENDED, socket.userId, {
        userId,
      });
      return;
    }

    session.accepted_by = session.accepted_by.filter((id) => id.toString() !== userId);
    if (!session.left_by.some((id) => id.toString() === userId)) {
      session.left_by = [...session.left_by, socket.userId];
    }
    session.updated_at = new Date();
    await session.save();

    if (session.accepted_by.length === 0) {
      await finalizeSession(io, session, scope, CALL_STATUS.ENDED, socket.userId, {
        userId,
      });
      return;
    }

    socket.emit(SOCKET_EVENTS.CALL_ENDED, {
      callId: session._id.toString(),
      roomCode: scope.roomCode,
      conversationId: scope.conversationId,
      durationSeconds: getDurationSeconds(session.answered_at),
      final: false,
      scope: 'self',
      userId,
    });

    emitToParticipantRooms(io, session, SOCKET_EVENTS.CALL_ACCEPTED, {
      callId: session._id.toString(),
      roomCode: scope.roomCode,
      conversationId: scope.conversationId,
      answeredAt: session.answered_at?.toISOString() || null,
      acceptedUserIds: session.accepted_by.map((id) => id.toString()),
      userId,
      final: false,
    });
  } catch (error) {
    logger.error('handleCallEnd error:', error);
    emitCallError(socket, error.message || 'Failed to end call');
  }
};

export default {
  handleCallStart,
  handleCallAccept,
  handleCallReject,
  handleCallCancel,
  handleCallEnd,
};
