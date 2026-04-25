export const ROOM_EVENTS = {
  JOIN:             'room:join',
  PENDING:          'room:pending',
  REQUEST_APPROVE:  'room:request_approve',
  REQUEST_APPROVAL: 'room:request_approval',
  APPROVE_USER:     'room:approve_user',
  REJECT_USER:      'room:reject_user',
  USER_JOINED:      'room:user_joined',
  USER_LEFT:        'room:user_left',
  USER_REJECTED:    'room:user_rejected',
  KICK_USER:        'room:kick_user',
  USER_KICKED:      'room:user_kicked',
  FORCE_DISCONNECT: 'room:force_disconnect',
  ENDED:            'room:ended',
  ERROR:            'error',
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
