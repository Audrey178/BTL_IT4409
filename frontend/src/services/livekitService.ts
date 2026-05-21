import api from '@/lib/axios';

interface LiveKitTokenResponse {
  success: boolean;
  token: string;
  url: string;
}

export const livekitService = {
  /**
   * Fetch a LiveKit access token from the backend.
   * The backend derives identity/name from the authenticated user's JWT.
   */
  getToken: async (roomCode: string): Promise<LiveKitTokenResponse> => {
    const res = await api.post('/livekit/token', { roomCode });
    return res.data;
  },
};
