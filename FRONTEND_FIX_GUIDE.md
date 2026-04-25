# 🛠️ FRONTEND FIX GUIDE - Chi tiết Cụ Thể

## 📌 DANH SÁCH CÁC API ENDPOINT CẦN IMPLEMENT

### Endpoints Hiện Có Trong Backend
```
✅ POST   /api/v1/auth/register
✅ POST   /api/v1/auth/login
✅ POST   /api/v1/auth/refresh-token
✅ POST   /api/v1/auth/logout
✅ POST   /api/v1/rooms
✅ GET    /api/v1/rooms/:roomCode
✅ POST   /api/v1/rooms/:roomCode/join
✅ POST   /api/v1/rooms/:roomCode/approve/:userId
✅ POST   /api/v1/rooms/:roomCode/reject/:userId
✅ POST   /api/v1/rooms/:roomCode/kick/:userId
✅ PUT    /api/v1/rooms/:roomCode/end
✅ GET    /api/v1/rooms/:roomCode/participants
✅ POST   /api/v1/attendance/face-embeddings
✅ POST   /api/v1/attendance/:roomCode/check-in
✅ POST   /api/v1/attendance/:roomCode/check-out
✅ GET    /api/v1/attendance/:roomCode/stats
✅ GET    /api/v1/attendance/history
✅ GET    /api/v1/history/rooms
✅ GET    /api/v1/history/rooms/:roomCode/messages
✅ GET    /api/v1/history/rooms/:roomCode/events
```

### Endpoints NOT Implemented (Frontend Calls Missing)
```
❌ /api/v1/rooms/:roomCode/participants  <- Frontend never calls this
❌ /api/v1/attendance/history              <- Frontend never calls this
❌ Admin endpoints                          <- Not implemented in backend
```

---

## 🔴 CRITICAL FIX #1: Create Missing Services

### File: `frontend/src/services/roomService.ts` (NEW)
```typescript
import api from "@/lib/axios";

export const roomService = {
  // Create a new room
  createRoom: async (title: string, description?: string, options?: any) => {
    const res = await api.post("/rooms", {
      title,
      description,
      require_approval: options?.requireApproval || false,
      allow_chat: options?.allowChat !== false,
      max_participants: options?.maxParticipants || 100,
    });
    return res.data;
  },

  // Get room info
  getRoomInfo: async (roomCode: string) => {
    const res = await api.get(`/rooms/${roomCode}`);
    return res.data;
  },

  // Join room
  joinRoom: async (roomCode: string) => {
    const res = await api.post(`/rooms/${roomCode}/join`);
    return res.data;
  },

  // Get room participants
  getRoomParticipants: async (roomCode: string) => {
    const res = await api.get(`/rooms/${roomCode}/participants`);
    return res.data;
  },

  // Approve user (host only)
  approveUser: async (roomCode: string, userId: string) => {
    const res = await api.post(`/rooms/${roomCode}/approve/${userId}`);
    return res.data;
  },

  // Reject user (host only)
  rejectUser: async (roomCode: string, userId: string) => {
    const res = await api.post(`/rooms/${roomCode}/reject/${userId}`);
    return res.data;
  },

  // Kick user (host only)
  kickUser: async (roomCode: string, userId: string) => {
    const res = await api.post(`/rooms/${roomCode}/kick/${userId}`);
    return res.data;
  },

  // End room (host only)
  endRoom: async (roomCode: string) => {
    const res = await api.put(`/rooms/${roomCode}/end`);
    return res.data;
  },
};
```

### File: `frontend/src/services/chatService.ts` (NEW)
```typescript
import api from "@/lib/axios";

export const chatService = {
  // Get chat history for a room
  getRoomChatHistory: async (roomCode: string, page = 1, limit = 50) => {
    const res = await api.get(
      `/history/rooms/${roomCode}/messages?page=${page}&limit=${limit}`
    );
    return res.data;
  },

  // Send message (will be via socket.emit, but keep for consistency)
  sendMessage: async (roomCode: string, content: string) => {
    // This might be handled by socket event instead
    // But backend might have REST endpoint too
    return { success: true };
  },

  // Get room events/audit log
  getRoomAuditLog: async (roomCode: string, page = 1, limit = 50) => {
    const res = await api.get(
      `/history/rooms/${roomCode}/events?page=${page}&limit=${limit}`
    );
    return res.data;
  },
};
```

### File: `frontend/src/services/meetingService.ts` (NEW)
```typescript
import api from "@/lib/axios";

export const meetingService = {
  // Get user's meeting history
  getUserMeetingHistory: async (status?: string, page = 1, limit = 20) => {
    let url = `/history/rooms?page=${page}&limit=${limit}`;
    if (status) {
      url += `&status=${status}`;  // waiting, active, ended
    }
    const res = await api.get(url);
    return res.data;
  },

  // Get attendance stats
  getAttendanceStats: async (roomCode: string) => {
    const res = await api.get(`/attendance/${roomCode}/stats`);
    return res.data;
  },

  // Check in to room
  checkIn: async (roomCode: string, method = "manual", confidenceScore?: number) => {
    const res = await api.post(`/attendance/${roomCode}/check-in`, {
      method,
      confidence_score: confidenceScore || 0.95,
    });
    return res.data;
  },

  // Check out from room
  checkOut: async (roomCode: string) => {
    const res = await api.post(`/attendance/${roomCode}/check-out`);
    return res.data;
  },
};
```

### File: `frontend/src/services/attendanceService.ts` (NEW)
```typescript
import api from "@/lib/axios";

export const attendanceService = {
  // Upload face embeddings
  uploadFaceEmbeddings: async (descriptor: number[]) => {
    const res = await api.post("/attendance/face-embeddings", {
      descriptor,
    });
    return res.data;
  },

  // Get user's attendance history
  getAttendanceHistory: async (page = 1, limit = 50) => {
    const res = await api.get(`/attendance/history?page=${page}&limit=${limit}`);
    return res.data;
  },
};
```

---

## 🔴 CRITICAL FIX #2: Fix DashboardScreen - Replace Mock Data

### Current Issues
- Hard-coded meetings
- Hard-coded calendar
- Hard-coded recordings

### Fix Strategy
```typescript
// Before: DashboardScreen.tsx

import { useEffect, useState } from "react";
import { meetingService } from "@/services/meetingService";
import { toast } from "sonner";

export function DashboardScreen() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await meetingService.getUserMeetingHistory("active");
        setMeetings(response.data || []);
      } catch (err: any) {
        const message = err.response?.data?.message || "Failed to load meetings";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="...">
      {/* Replace mock MeetingCard components with actual data */}
      {meetings.map((meeting) => (
        <MeetingCard
          key={meeting._id}
          date={new Date(meeting.createdAt).getDate().toString()}
          month={new Date(meeting.createdAt).toLocaleString("en-US", { month: "short" })}
          title={meeting.title}
          time={meeting.startTime || "TBD"}
          location={meeting.room_code}
          participants={meeting.participantCount || 0}
          onJoin={() => navigate(`/meeting/${meeting.room_code}`)}
          active={meeting.status === "active"}
        />
      ))}
    </div>
  );
}
```

---

## 🔴 CRITICAL FIX #3: Fix LobbyScreen - Replace Hard-coded Room Code

### Current Code
```typescript
const handleJoin = () => {
  navigate("/meeting/HEARTH-2024-STUDIO");  // ❌ Hard-coded
};
```

### Fixed Code
```typescript
import { useState } from "react";
import { toast } from "sonner";
import { roomService } from "@/services/roomService";

export function LobbyScreen() {
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async () => {
    if (!roomCode.trim()) {
      toast.error("Please enter a room code");
      return;
    }
    if (!displayName.trim()) {
      toast.error("Please enter your display name");
      return;
    }

    try {
      setLoading(true);
      const response = await roomService.joinRoom(roomCode);
      
      if (response.success) {
        toast.success("Joining room...");
        // Save display name to local state or store
        navigate(`/meeting/${roomCode}`);
      } else {
        toast.error(response.message || "Failed to join room");
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to join room";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="...">
      <Input
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
        placeholder="Enter room code (e.g., HEARTH-2024-STUDIO)"
      />
      <Input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="How should we call you?"
      />
      <Button
        onClick={handleJoin}
        disabled={loading || !roomCode.trim() || !displayName.trim()}
      >
        {loading ? "Joining..." : "Join Meeting"}
      </Button>
    </div>
  );
}
```

---

## 🔴 CRITICAL FIX #4: Fix MeetingScreen - Add Socket Listeners

### File: `frontend/src/hooks/useWebRTC.ts` - Update

**Add these listeners:**

```typescript
export function useWebRTC(roomCode: string | null) {
  const socket = getSocket();
  const { addParticipant, removeParticipant, updateParticipantStream } = useMeetingStore();
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    if (!roomCode || !socket) return;

    // ✅ Handle user joined
    const handleUserJoined = (data: any) => {
      const userId = data.userId || data.user?._id;
      if (!userId) return;

      const newParticipant: Participant = {
        id: userId,
        fullName: data.user?.fullName || data.user?.full_name || "Guest",
        isActive: true,
        isAudioMuted: data.isAudioMuted || false,
        isVideoMuted: data.isVideoMuted || false,
      };

      addParticipant(newParticipant);
      
      // Create peer connection for the new participant
      createPeer(userId, true);
    };

    // ✅ Handle user left
    const handleUserLeft = (data: any) => {
      const userId = data.userId || data.user?._id;
      if (!userId) return;
      
      removeParticipant(userId);
      
      const peer = peersRef.current.get(userId);
      if (peer) {
        peer.close();
        peersRef.current.delete(userId);
      }
    };

    // ✅ Handle pending approval
    const handlePending = (data: any) => {
      toast.info("Waiting for host approval to join...");
      useMeetingStore.setState({ status: "waiting" });
    };

    // ✅ Handle user approved
    const handleApproveUser = (data: any) => {
      toast.success("You have been approved to join!");
      useMeetingStore.setState({ status: "in-room" });
    };

    // ✅ Handle user rejected
    const handleRejectUser = (data: any) => {
      toast.error(data.reason || "Your join request was rejected");
      useMeetingStore.getState().reset();
      navigate("/lobby");
    };

    // ✅ Handle user kicked
    const handleKickUser = (data: any) => {
      toast.error(data.reason || "You have been removed from the room");
      useMeetingStore.getState().reset();
      navigate("/lobby");
    };

    // ✅ Handle force disconnect
    const handleForceDisconnect = (data: any) => {
      toast.error(data.reason || "Room connection terminated");
      useMeetingStore.getState().reset();
      navigate("/");
    };

    // Register listeners
    socket.on(ROOM_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(ROOM_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(ROOM_EVENTS.PENDING, handlePending);
    socket.on(ROOM_EVENTS.APPROVE_USER, handleApproveUser);
    socket.on(ROOM_EVENTS.REJECT_USER, handleRejectUser);
    socket.on(ROOM_EVENTS.KICK_USER, handleKickUser);
    socket.on(ROOM_EVENTS.FORCE_DISCONNECT, handleForceDisconnect);

    // Cleanup
    return () => {
      socket.off(ROOM_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(ROOM_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(ROOM_EVENTS.PENDING, handlePending);
      socket.off(ROOM_EVENTS.APPROVE_USER, handleApproveUser);
      socket.off(ROOM_EVENTS.REJECT_USER, handleRejectUser);
      socket.off(ROOM_EVENTS.KICK_USER, handleKickUser);
      socket.off(ROOM_EVENTS.FORCE_DISCONNECT, handleForceDisconnect);
    };
  }, [roomCode, socket, addParticipant, removeParticipant]);

  // ... rest of WebRTC logic
}
```

---

## 🔴 CRITICAL FIX #5: Add Chat Event Listeners

### File: `frontend/src/socket/events.ts` - Update

```typescript
// Add attendance events
export const ATTENDANCE_EVENTS = {
  CHECK_IN: 'attendance:check_in',
  CHECK_OUT: 'attendance:check_out',
  STATS_UPDATE: 'attendance:stats_update',
} as const;
```

### File: `frontend/src/hooks/useSocket.ts` - Create Chat Hook

```typescript
import { useEffect } from 'react';
import { getSocket } from '@/socket/socket';
import { useMeetingStore } from '@/stores/meetingStore';
import { CHAT_EVENTS } from '@/socket/events';
import { toast } from 'sonner';

export function useChat(roomCode: string | null) {
  const socket = getSocket();
  const { addMessage } = useMeetingStore();

  useEffect(() => {
    if (!socket || !roomCode) return;

    // ✅ Handle chat message received
    const handleChatReceive = (data: any) => {
      const message = {
        id: data._id || crypto.randomUUID(),
        senderId: data.senderId,
        senderName: data.senderName || data.sender?.fullName || "Unknown",
        content: data.content,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      
      addMessage(message);
    };

    // ✅ Handle system alert
    const handleSystemAlert = (data: any) => {
      toast.info(data.message);
      
      const systemMessage = {
        id: crypto.randomUUID(),
        senderId: "SYSTEM",
        senderName: "System",
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      
      addMessage(systemMessage);
    };

    socket.on(CHAT_EVENTS.RECEIVE, handleChatReceive);
    socket.on(CHAT_EVENTS.SYSTEM_ALERT, handleSystemAlert);

    return () => {
      socket.off(CHAT_EVENTS.RECEIVE, handleChatReceive);
      socket.off(CHAT_EVENTS.SYSTEM_ALERT, handleSystemAlert);
    };
  }, [roomCode, socket, addMessage]);
}
```

### File: `frontend/src/screens/MeetingScreen.tsx` - Update Chat Input

```typescript
import { useChat } from '@/hooks/useChat';

export function MeetingScreen() {
  const { id: roomCode } = useParams<{ id: string }>();
  const [chatMessage, setChatMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const socket = useSocket();
  useChat(roomCode || null);
  
  const { messages } = useMeetingStore();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !socket || !roomCode) return;

    try {
      setSendingMessage(true);
      socket.emit(CHAT_EVENTS.SEND, {
        roomCode,
        content: chatMessage,
      });
      setChatMessage("");
    } catch (err) {
      console.error("Failed to send message", err);
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="...">
      {/* Chat messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              name={msg.senderName}
              time={new Date(msg.timestamp).toLocaleTimeString()}
              message={msg.content}
              isSelf={msg.senderId === authUser?._id}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Chat input */}
      <div className="p-6 bg-surface-container-low border-t border-outline-variant/10">
        <form onSubmit={handleSendMessage} className="relative">
          <input
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            disabled={sendingMessage}
            className="w-full h-12 bg-surface-container-highest border-none rounded-2xl px-4 pr-12 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/40 disabled:opacity-50"
            placeholder="Send a message..."
          />
          <button
            type="submit"
            disabled={sendingMessage || !chatMessage.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## 🟠 HIGH FIX #6: Replace `any` Types with Proper Interfaces

### File: `frontend/src/types/index.ts` - Update

```typescript
// Component Props Types
export interface VideoTileProps {
  name: string;
  stream: MediaStream | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHost?: boolean;
  isLocal?: boolean;
}

export interface ChatMessageProps {
  name: string;
  time: string;
  message: string;
  isSelf?: boolean;
  color?: string;
}

export interface ControlButtonProps {
  icon: React.ReactNode;
  label?: string;
  active?: boolean;
  badge?: number;
  className?: string;
  onClick?: () => void;
}

export interface FilterItemProps {
  label: string;
  active?: boolean;
  src?: string;
  icon?: React.ReactNode;
  blur?: boolean;
}

export interface ColorFilterProps {
  color: string;
  label: string;
}

export interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  variant: string;
}

// Socket Event Types
export interface UserJoinedEvent {
  userId: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
  };
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}

export interface UserLeftEvent {
  userId: string;
  user?: {
    _id: string;
    fullName: string;
  };
}

export interface ChatMessageEvent {
  _id?: string;
  senderId: string;
  senderName: string;
  sender?: {
    fullName: string;
  };
  content: string;
  timestamp: string;
  roomCode: string;
}

export interface WebRTCOfferEvent {
  from: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerEvent {
  from: string;
  answer: RTCSessionDescriptionInit;
}

export interface ICECandidateEvent {
  from: string;
  candidate: RTCIceCandidate;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  statusCode?: number;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  user: User;
}

export interface RoomResponse {
  _id: string;
  room_code: string;
  host_id: string;
  title: string;
  description?: string;
  status: "waiting" | "active" | "ended";
  require_approval: boolean;
  allow_chat: boolean;
  max_participants: number;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 🟠 HIGH FIX #7: Add Global Error Handling

### File: `frontend/src/lib/axios.ts` - Update

```typescript
import axios from "axios";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";

const api = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:3000/api/v1"
      : "/api/v1",
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const message = err.response?.data?.message || err.message || "An error occurred";

    // Handle 401 - Token expired or invalid
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          const response = await axios.post(
            `${api.defaults.baseURL}/auth/refresh-token`,
            { refresh_token: refreshToken }
          );
          
          const { access_token } = response.data.data;
          useAuthStore.getState().setAccessToken(access_token);
          
          // Retry original request
          err.config.headers.Authorization = `Bearer ${access_token}`;
          return api(err.config);
        } else {
          useAuthStore.getState().clearState();
          window.location.href = "/signin";
        }
      } catch (refreshError) {
        useAuthStore.getState().clearState();
        window.location.href = "/signin";
      }
    }

    // Handle 403 - Forbidden
    if (err.response?.status === 403) {
      toast.error("You don't have permission to perform this action");
    }

    // Handle 500 - Server error
    if (err.response?.status === 500) {
      toast.error("Server error. Please try again later");
    }

    // Network error
    if (!err.response) {
      toast.error("Network error. Please check your connection");
    }

    return Promise.reject(err);
  }
);

export default api;
```

### Update `frontend/src/stores/useAuthStore.ts`

```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,

      setAccessToken: (token: string) => set({ accessToken: token }),

      clearState: () => {
        set({ accessToken: null, user: null, loading: false });
        localStorage.removeItem("auth-storage");
      },

      signUp: async (fullname: string, email: string, password: string) => {
        try {
          set({ loading: true });
          const response = await authService.signUp(fullname, email, password);
          
          if (response.success) {
            toast.success("Sign Up successfully! Please log in.");
          } else {
            toast.error(response.message || "Sign Up failed");
          }
        } catch (error: any) {
          const message = error.response?.data?.message || "Sign Up failed";
          toast.error(message);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      signIn: async (email: string, password: string) => {
        try {
          set({ loading: true });
          const response = await authService.signIn(email, password);
          
          if (response.success && response.data) {
            const { access_token, refresh_token, user } = response.data;
            
            set({
              accessToken: access_token,
              user,
            });
            
            // Store refresh token
            if (refresh_token) {
              localStorage.setItem("refresh_token", refresh_token);
            }
            
            toast.success("Sign In successfully!");
          } else {
            toast.error(response.message || "Sign In failed");
          }
        } catch (error: any) {
          const message = error.response?.data?.message || "Sign In failed";
          toast.error(message);
          throw error;
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    }
  )
);
```

---

## 🟡 MEDIUM FIX #8: Fix State Synchronization

### File: `frontend/src/socket/socket.ts` - Update

```typescript
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const SOCKET_URL = import.meta.env.MODE === 'development'
      ? 'http://localhost:3000'
      : '/';

    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token: useAuthStore.getState().accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Update auth token when user logs in
    useAuthStore.subscribe(
      (state) => state.accessToken,
      (token) => {
        if (socket && token) {
          socket.auth = { token };
          if (!socket.connected) {
            socket.connect();
          } else {
            socket.disconnect();
            socket.connect();
          }
        }
      }
    );
  }

  return socket;
}

export function connectSocket() {
  const skt = getSocket();
  if (!skt.connected) {
    skt.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function updateSocketAuth(token: string) {
  const skt = getSocket();
  skt.auth = { token };
  if (skt.connected) {
    skt.disconnect();
    skt.connect();
  }
}
```

---

## 🟡 MEDIUM FIX #9: Remove Hard-coded Mock Data

### Replace in DashboardScreen, MeetingScreen, AdminDashboardScreen

**Before:**
```jsx
<img
  src="https://picsum.photos/seed/room/800/450"
  alt="Recording"
/>
```

**After:**
```jsx
<img
  src={meeting.thumbnail || "https://via.placeholder.com/800x450?text=No+Thumbnail"}
  alt={meeting.title}
/>
```

---

## ✅ VERIFICATION CHECKLIST

- [ ] All `any` types replaced with proper interfaces
- [ ] All hard-coded data replaced with API calls
- [ ] Error handlers implemented for all API calls
- [ ] Loading states shown for all async operations
- [ ] Socket event listeners registered for room, chat, attendance
- [ ] Chat functionality working (send/receive)
- [ ] Participant list updates when users join/leave
- [ ] Room approval flow working (pending → approved/rejected)
- [ ] Attendance check-in/check-out implemented
- [ ] State stores properly synchronized
- [ ] Token refresh logic implemented
- [ ] Network errors handled gracefully

---

**Last Updated:** 25/04/2026
**Status:** Ready for implementation
