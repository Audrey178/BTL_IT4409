export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  INTERNAL_ERROR: 500,
};

export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_EXISTS: 'User already exists',
  USER_NOT_FOUND: 'User not found',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  UNAUTHORIZED: 'Unauthorized access',
  ROOM_NOT_FOUND: 'Room not found',
  ROOM_ENDED: 'This room has ended',
  INVALID_ROOM_CODE: 'Invalid room code',
  NOT_HOST: 'Only room host can perform this action',
  MAX_PARTICIPANTS: 'Maximum participants reached',
  SERVER_ERROR: 'Internal server error',
};

export const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Room events
  ROOM_JOIN: 'room:join',
  ROOM_PENDING: 'room:pending',
  ROOM_REQUEST_APPROVAL: 'room:request_approval',
  ROOM_APPROVE_USER: 'room:approve_user',
  ROOM_REJECT_USER: 'room:reject_user',
  ROOM_USER_JOINED: 'room:user_joined',
  ROOM_USER_LEFT: 'room:user_left',
  ROOM_USER_KICKED: 'room:user_kicked',
  ROOM_ENDED: 'room:ended',

  // WebRTC events
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc:ice_candidate',

  // Chat events
  CHAT_SEND: 'chat:send',
  CHAT_RECEIVE: 'chat:receive',
  CHAT_HISTORY: 'chat:history',

  // Attendance events
  ATTENDANCE_CHECK_IN: 'attendance:check_in',
  ATTENDANCE_CHECK_OUT: 'attendance:check_out',
};

export const ROOM_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  ENDED: 'ended',
};

export const USER_STATUS = {
  PENDING: 'pending',
  JOINED: 'joined',
  REJECTED: 'rejected',
  KICKED: 'kicked',
  LEFT: 'left',
};

export const MESSAGE_TYPE = {
  TEXT: 'text',
  SYSTEM: 'system',
  FILE: 'file',
};

export const EVENT_TYPE = {
  ROOM_CREATED: 'room_created',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  USER_KICKED: 'user_kicked',
  ROOM_ENDED: 'room_ended',
  USER_APPROVED: 'user_approved',
  USER_REJECTED: 'user_rejected',
};

export default {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SOCKET_EVENTS,
  ROOM_STATUS,
  USER_STATUS,
  MESSAGE_TYPE,
  EVENT_TYPE,
};
