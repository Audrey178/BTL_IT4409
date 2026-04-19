export const ROOM_EVENTS = {
  JOIN:             'room:join',
  PENDING:          'room:pending',
  REQUEST_APPROVE:  'room:request_approve',
  APPROVE_USER:     'room:approve_user',
  REJECT_USER:      'room:reject_user',
  USER_JOINED:      'room:user_joined',
  USER_LEFT:        'room:user_left',
  KICK_USER:        'room:kick_user',
  FORCE_DISCONNECT: 'room:force_disconnect',
} as const;

export const WEBRTC_EVENTS = {
  OFFER:         'webrtc:offer',
  ANSWER:        'webrtc:answer',
  ICE_CANDIDATE: 'webrtc:ice_candidate',
} as const;

export const CHAT_EVENTS = {
  SEND:         'chat:send',
  RECEIVE:      'chat:receive',
  SYSTEM_ALERT: 'chat:system_alert',
} as const;
