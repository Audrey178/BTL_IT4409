import api from "@/lib/axios";

export interface AttendanceLog {
  _id: string;
  room_id: string;
  user_id: string;
  check_in_time: string;
  check_out_time?: string;
  method: "face_recognition" | "manual";
  confidence_score?: number;
  duration?: number;
}

export interface AttendanceStats {
  total_participants: number;
  present_count: number;
  absent_count: number;
  average_duration: number;
  participants: any[];
}

export const attendanceService = {
  /**
   * Upload face embeddings for AI recognition
   */
  uploadFaceEmbeddings: async (descriptor: number[]): Promise<any> => {
    const res = await api.post("/attendance/face-embeddings", {
      descriptor,
    });
    return res.data;
  },

  /**
   * Check in to a room (start tracking attendance)
   */
  checkIn: async (
    roomCode: string,
    options?: {
      method?: "face_recognition" | "manual";
      confidenceScore?: number;
    }
  ): Promise<any> => {
    const res = await api.post(`/attendance/${roomCode}/check-in`, {
      method: options?.method || "manual",
      confidence_score: options?.confidenceScore || null,
    });
    return res.data;
  },

  /**
   * Check out from a room (end tracking attendance)
   */
  checkOut: async (roomCode: string): Promise<any> => {
    const res = await api.post(`/attendance/${roomCode}/check-out`);
    return res.data;
  },

  /**
   * Get attendance statistics for a room (host only)
   */
  getRoomAttendanceStats: async (roomCode: string): Promise<any> => {
    const res = await api.get(`/attendance/${roomCode}/stats`);
    return res.data;
  },

  /**
   * Get user's attendance history
   */
  getUserAttendanceHistory: async (options?: { page?: number; limit?: number }): Promise<any> => {
    const params = {
      page: options?.page || 1,
      limit: options?.limit || 50,
    };
    const res = await api.get("/attendance/history", { params });
    return res.data;
  },
};
