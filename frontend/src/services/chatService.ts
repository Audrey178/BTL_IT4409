import api from "@/lib/axios";

export interface ChatMessage {
  _id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  type: "text" | "system";
  content: string;
  timestamp: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  messages: ChatMessage[];
}

export const chatService = {
  /**
   * Get chat history for a room
   */
  getChatHistory: async (
    roomCode: string,
    options?: { page?: number; limit?: number }
  ): Promise<ChatHistoryResponse> => {
    const params = {
      page: options?.page || 1,
      limit: options?.limit || 50,
    };
    const res = await api.get(`/history/rooms/${roomCode}/messages`, { params });
    return res.data;
  },

  /**
   * Get chat history via history service
   */
  getRoomMessages: async (
    roomCode: string,
    options?: { page?: number; limit?: number }
  ): Promise<any> => {
    const params = {
      page: options?.page || 1,
      limit: options?.limit || 50,
    };
    const res = await api.get(`/history/rooms/${roomCode}/messages`, { params });
    return res.data;
  },
};
