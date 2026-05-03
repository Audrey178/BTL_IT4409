export interface Participant {
  id: string;
  fullName: string;
  isActive: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing?: boolean;
  stream?: MediaStream;
}

export interface WaitingUser {
  id: string;
  fullName: string;
  socketId: string;
  email?: string;
  avatarUrl?: string;
  memberId?: string;
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
  host_id: string | { _id: string; full_name: string; email: string };
  title: string;
  status: 'waiting' | 'active' | 'ended';
  description?: string;
  settings: {
    require_approval: boolean;
    allow_chat: boolean;
    max_participants: number;
  };
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string;
}

export interface CreateRoomPayload {
  title: string;
  description?: string;
  started_at?: string;
  settings?: {
    require_approval?: boolean;
    allow_chat?: boolean;
    max_participants?: number;
  };
}

export interface RoomResponse {
  success: boolean;
  room: Room;
}

export interface JoinRoomResponse {
  success: boolean;
  roomMember: {
    _id: string;
    room_id: string;
    user_id: string;
    status: 'pending' | 'joined' | 'rejected' | 'kicked' | 'left';
    joined_at: string | null;
  };
  status: string;
  roomId: string;
}

export type ScheduledMeeting = Room;
