export interface Participant {
  id: string;
  fullName: string;
  isActive: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  stream?: MediaStream;
}

export interface WaitingUser {
  id: string;
  fullName: string;
  socketId: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface Room {
  _id: string;
  room_code: string;
  host_id: string;
  title: string;
  status: string;
}
