import api from "@/lib/axios";

export interface Room {
  _id: string;
  room_code: string;
  title: string;
  description?: string;
  host_id: string;
  host_name: string;
  status: "waiting" | "active" | "ended";
  require_approval: boolean;
  allow_chat: boolean;
  max_participants: number;
  created_at: string;
  updated_at: string;
}

export interface RoomResponse {
  success: boolean;
  room?: Room;
  participants?: any[];
  message?: string;
}

export const roomService = {
  /**
   * Create a new meeting room
   */
  createRoom: async (
    title: string,
    options?: {
      description?: string;
      requireApproval?: boolean;
      allowChat?: boolean;
      maxParticipants?: number;
    }
  ): Promise<RoomResponse> => {
    const res = await api.post("/rooms", {
      title,
      description: options?.description || "",
      require_approval: options?.requireApproval || false,
      allow_chat: options?.allowChat !== false,
      max_participants: options?.maxParticipants || 100,
    });
    return res.data;
  },

  /**
   * Get room information by room code
   */
  getRoomInfo: async (roomCode: string): Promise<RoomResponse> => {
    const res = await api.get(`/rooms/${roomCode}`);
    return res.data;
  },

  /**
   * Join a room
   */
  joinRoom: async (roomCode: string): Promise<RoomResponse> => {
    const res = await api.post(`/rooms/${roomCode}/join`);
    return res.data;
  },

  /**
   * Get list of room participants
   */
  getRoomParticipants: async (roomCode: string) => {
    const res = await api.get(`/rooms/${roomCode}/participants`);
    return res.data;
  },

  /**
   * Approve a user to join the room (host only)
   */
  approveUser: async (roomCode: string, userId: string): Promise<RoomResponse> => {
    const res = await api.post(`/rooms/${roomCode}/approve/${userId}`);
    return res.data;
  },

  /**
   * Reject a user from joining the room (host only)
   */
  rejectUser: async (roomCode: string, userId: string): Promise<RoomResponse> => {
    const res = await api.post(`/rooms/${roomCode}/reject/${userId}`);
    return res.data;
  },

  /**
   * Kick a user from the room (host only)
   */
  kickUser: async (roomCode: string, userId: string): Promise<RoomResponse> => {
    const res = await api.post(`/rooms/${roomCode}/kick/${userId}`);
    return res.data;
  },

  /**
   * End the meeting room (host only)
   */
  endRoom: async (roomCode: string): Promise<RoomResponse> => {
    const res = await api.put(`/rooms/${roomCode}/end`);
    return res.data;
  },
};
