export const ROOM_EVENTS = {
  JOIN: 'room:join',
  PENDING: 'room:pending',
  REQUEST_APPROVE: 'room:request_approve',
  REQUEST_APPROVAL: 'room:request_approval',
  APPROVE_USER: 'room:approve_user',
  REJECT_USER: 'room:reject_user',
  USER_JOINED: 'room:user_joined',
  USER_LEFT: 'room:user_left',
  USER_REJECTED: 'room:user_rejected',
  KICK_USER: 'room:kick_user',
  USER_KICKED: 'room:user_kicked',
  HOST_TRANSFERRED: 'room:host_transferred',
  FORCE_DISCONNECT: 'room:force_disconnect',
  ENDED: 'room:ended',
  ERROR: 'error',
} as const;

// WebRTC events removed — signaling now handled by LiveKit Cloud SFU


export const CHAT_EVENTS = {
  SEND: 'chat:send',
  RECEIVE: 'chat:receive',
  SYSTEM_ALERT: 'chat:system_alert',
  HISTORY: 'chat:history',
} as const;

export const MEDIA_EVENTS = {
  TOGGLE: 'media:toggle',
  SCREEN_SHARE_START: 'media:screen_share_start',
  SCREEN_SHARE_STOP: 'media:screen_share_stop',
} as const;

export const RECORDING_EVENTS = {
  START: 'recording:start',
  STOP: 'recording:stop',
  STATUS: 'recording:status',
} as const;
