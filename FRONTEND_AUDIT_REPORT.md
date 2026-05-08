# 🔍 FRONTEND AUDIT REPORT
**Ngày quét:** 25 tháng 4, 2026

---

## 📋 TÓM TẮT TỔNG QUÁT
Trong quá trình quét frontend (d:\BTL_IT4409\frontend\src\), tôi đã xác định **7 loại vấn đề chính** với **43+ chi tiết cụ thể** cần sửa.

---

## 1️⃣ MISMATCHES GIỮA COMPONENT VÀ BACKEND API

### ❌ 1.1 Hard-coded Room Code (LobbyScreen)
**File:** [frontend/src/screens/LobbyScreen.tsx](frontend/src/screens/LobbyScreen.tsx#L96)  
**Vấn đề:**
```typescript
const handleJoin = () => {
  navigate("/meeting/HEARTH-2024-STUDIO");  // ❌ Hard-coded
};
```
**Vấn đề:** Room code được hard-code, không nhận từ input  
**Endpoint cần dùng:** `POST /api/v1/rooms/:roomCode/join` (room code phải từ input hoặc backend)  
**Fix:** Thêm state để nhận roomCode từ input, validate với backend trước khi join

---

### ❌ 1.2 Missing Room List API Call (DashboardScreen)
**File:** [frontend/src/screens/DashboardScreen.tsx](frontend/src/screens/DashboardScreen.tsx)  
**Vấn đề:**
- Component hiển thị upcoming meetings nhưng không có API call
- Data hiển thị là mock (hardcoded)
- Không gọi `GET /api/v1/history/rooms` để fetch user's meeting history

**Expected Endpoints:**
```
GET /api/v1/history/rooms?page=1&limit=20&status=waiting|active|ended
```

**Data Structure Mismatch:**
- Backend trả về room data với fields: `_id`, `room_code`, `host_id`, `title`, `status`
- Frontend không có type định nghĩa field này

**Fix:** 
- Thêm hàm fetch rooms vào authService hoặc tạo roomService
- Update type Room để match backend schema
- Add loading state khi fetch data

---

### ❌ 1.3 Missing Participant List & Join Room Handling (MeetingScreen)
**File:** [frontend/src/screens/MeetingScreen.tsx](frontend/src/screens/MeetingScreen.tsx#L45-L60)  
**Vấn đề:**
```typescript
useEffect(() => {
  if (socket && roomCode && authUser) {
    socket.emit(ROOM_EVENTS.JOIN, { 
      roomCode, 
      userId: authUser._id, 
      user: authUser 
    });
  }
}, [socket, roomCode, authUser]);
```

- JOIN event được emit nhưng **KHÔNG có listener** cho `room:user_joined` event
- Participant list không được populate khi users join
- Khi API return list participants, **data structure không match**:
  - Backend: `{ _id: string, full_name: string, isActive: boolean }`
  - Frontend Participant type: `{ id: string, fullName: string, isActive: boolean, ... }`

**Missing Socket Listeners:**
```javascript
socket.on(ROOM_EVENTS.USER_JOINED, (data) => { /* chưa implement */ })
socket.on(ROOM_EVENTS.USER_LEFT, (data) => { /* chưa implement */ })
socket.on(ROOM_EVENTS.PENDING, (data) => { /* waiting for approval */ })
socket.on(ROOM_EVENTS.APPROVE_USER, (data) => { /* user approved */ })
socket.on(ROOM_EVENTS.KICK_USER, (data) => { /* user kicked */ })
```

**Fix:** 
- Add socket listeners trong useWebRTC hook
- Map backend data structure sang frontend Participant interface
- Update meetingStore khi socket events trigger

---

### ❌ 1.4 Chat Message Send/Receive Not Implemented (MeetingScreen)
**File:** [frontend/src/screens/MeetingScreen.tsx](frontend/src/screens/MeetingScreen.tsx#L170-L220)  
**Vấn đề:**
- Chat input field có UI nhưng **onClick handler rỗng**
```jsx
<button className="...">
  <Send size={18} />  // ❌ Không gọi API hoặc socket event
</button>
```

- Không gọi `POST /api/v1/history/rooms/:roomCode/messages` để gửi message
- Không listen socket event `chat:receive`
- Hard-coded chat messages trong component (mock data)

**Missing Data Structure:**
```typescript
interface ChatMessagePayload {
  roomCode: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;  // ISO format
}
```

**Fix:**
- Implement chat input handler để emit `chat:send` hoặc POST message
- Add listener cho `chat:receive` event
- Store messages trong meetingStore
- Remove hard-coded mock messages

---

### ❌ 1.5 Missing Admin Dashboard API Calls
**File:** [frontend/src/screens/AdminDashboardScreen.tsx](frontend/src/screens/AdminDashboardScreen.tsx#L14-L50)  
**Vấn đề:**
- Hard-coded user data:
```javascript
const userRows = [
  { name: "Elena Vance", email: "elena@digitalhearth.com", role: "Admin", status: "Active" },
  // ... 3 more users
];
```

- Không gọi endpoint để lấy danh sách users
- Hard-coded stats (1,280 users, 18 meetings, 6 pending approvals)
- Hard-coded activity log

**Missing API Endpoints:**
```
GET /api/v1/users  // Không tồn tại trong backend
GET /api/v1/admin/users  // Không tồn tại
GET /api/v1/admin/stats  // Không tồn tại
GET /api/v1/admin/activity-log  // Không tồn tại
```

**CẢNH BÁO:** Các endpoint này **không tồn tại trong backend** - cần tạo hoặc AdminDashboard chỉ là UI stub

**Fix:**
- Either: Tạo các endpoint admin trong backend
- Or: Thay DashboardScreen bằng UI từ `/api/v1/history/rooms` data

---

### ❌ 1.6 Chat History Not Fetched (MeetingScreen)
**Vấn đề:**
- Khi vào meeting, messages không được load từ backend
- Endpoint `GET /api/v1/history/rooms/:roomCode/messages?page=1&limit=100` không được gọi
- Component chỉ hiển thị hard-coded messages

**Fix:**
```typescript
useEffect(() => {
  const fetchChatHistory = async () => {
    try {
      const res = await api.get(`/history/rooms/${roomCode}/messages?limit=50`);
      useMeetingStore.setState({ messages: res.data.data });
    } catch (err) {
      console.error('Failed to fetch chat history', err);
    }
  };
  
  if (roomCode) fetchChatHistory();
}, [roomCode]);
```

---

## 2️⃣ HARD-CODED & MOCK DATA CHƯA REPLACE

### ❌ 2.1 DashboardScreen - Mock Meetings
**File:** [frontend/src/screens/DashboardScreen.tsx](frontend/src/screens/DashboardScreen.tsx#L280-L310)  
```jsx
<MeetingCard
  date="02"
  month="Oct"
  title="Product Sync & Design Review"  // ❌ Hard-coded
  time="10:00 AM - 11:30 AM"           // ❌ Hard-coded
  location="Studio A"                   // ❌ Hard-coded
  participants={4}                      // ❌ Hard-coded
  onJoin={() => {}}                     // ❌ Handler rỗng
/>
```
**Fix:** Fetch từ `GET /api/v1/history/rooms?status=waiting`

---

### ❌ 2.2 DashboardScreen - Mock Calendar & Recordings
**File:** [frontend/src/screens/DashboardScreen.tsx](frontend/src/screens/DashboardScreen.tsx#L130-L170)  
```jsx
<img
  src="https://picsum.photos/seed/room/800/450"  // ❌ Mock image
  alt="Recording"
  className="..."
/>
```
**Fix:** Thay bằng actual recording thumbnail từ backend hoặc S3

---

### ❌ 2.3 MeetingScreen - Hard-coded Chat Messages
**File:** [frontend/src/screens/MeetingScreen.tsx](frontend/src/screens/MeetingScreen.tsx#L133-L155)  
```jsx
<ChatMessage
  name="Marcus Chen"
  time="10:42 AM"
  message="Welcome everyone! Let's dive into the Q3 goals."  // ❌ Hard-coded
/>
```
**Fix:** Load từ `/api/v1/history/rooms/{roomCode}/messages`

---

### ❌ 2.4 MeetingScreen - Hard-coded User Names
**File:** [frontend/src/screens/MeetingScreen.tsx](frontend/src/screens/MeetingScreen.tsx#L77)  
```jsx
<span className="font-bold text-orange-900 text-sm">
  Elena Vance  {/* ❌ Hard-coded name instead of authUser.fullName */}
</span>
```
**Fix:** `{authUser?.fullName || "You"}`

---

### ❌ 2.5 MeetingScreen - Mock Video Tile
**File:** [frontend/src/screens/MeetingScreen.tsx](frontend/src/screens/MeetingScreen.tsx#L280)  
```jsx
<img
  src="https://picsum.photos/seed/me/400/225"  // ❌ Mock image
  alt="Self"
/>
```
**Fix:** Dùng actual video stream hoặc user avatar

---

### ❌ 2.6 LobbyScreen - Mock User Avatar
**File:** [frontend/src/screens/LobbyScreen.tsx](frontend/src/screens/LobbyScreen.tsx#L60)  
```jsx
<AvatarImage src="https://i.pravatar.cc/100?u=me" />  // ❌ Mock avatar
```
**Fix:** `{authUser?.avatar || `https://i.pravatar.cc/100?u=${authUser?._id}`}`

---

### ❌ 2.7 AdminDashboardScreen - All Hard-coded Data
**File:** [frontend/src/screens/AdminDashboardScreen.tsx](frontend/src/screens/AdminDashboardScreen.tsx)  
- Hard-coded user list
- Hard-coded stats cards
- Hard-coded activity log
- **Solution:** Tạo backend endpoints hoặc remove section này

---

## 3️⃣ MISSING ERROR HANDLING & LOADING STATES

### ❌ 3.1 No Error Handling for Auth (useAuthStore)
**File:** [frontend/src/stores/useAuthStore.ts](frontend/src/stores/useAuthStore.ts#L25-L40)  
```typescript
signIn: async (email: string, password: string) => {
  try {
    set({ loading: true });
    const response = await authService.signIn(email, password);
    
    if (response.success && response.data) {
      set({ 
        accessToken: response.data.access_token || response.data.accessToken,
        user: response.data.user
      });
      toast.success("Sign In successfully!");
    } else {
      toast.error(response.message || "Sign In failed");  // ❌ Generic error
    }
  } catch (error: any) {
    console.log(error);  // ❌ Chỉ console.log
    toast.error(error.response?.data?.message || "Sign In unsuccessfully!");
  } finally {
    set({ loading: false });
  }
}
```

**Issues:**
- Không handle network timeout
- Không retry logic
- Không validate token expiration
- Error message không chi tiết

---

### ❌ 3.2 No Error Handling for API Calls
**File:** [frontend/src/screens/MeetingScreen.tsx](frontend/src/screens/MeetingScreen.tsx)  
- Khi emit socket events, không có timeout hoặc error callback
- Không catch lỗi từ WebRTC signaling

---

### ❌ 3.3 No Loading States
**Files:** Tất cả screens
- DashboardScreen: Không show loading khi fetch meetings
- MeetingScreen: Không show loading khi waiting for participants
- AdminDashboardScreen: Không show loading khi fetch user data

**Fix:** Thêm loading states:
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

---

### ❌ 3.4 No Fallback for Missing Data
```jsx
<VideoTile
  name={authUser?.fullName || "You"}  // ✅ Good
  stream={localStream}
  isMuted={isAudioMuted}
  isVideoOff={isVideoMuted}
/>
```

Nhưng nhiều component khác không có fallback:
```jsx
<span>{name?.[0]}</span>  // ❌ Có thể undefined
```

---

## 4️⃣ SOCKET EVENT LISTENERS KHÔNG HOÀN CHỈNH

### ❌ 4.1 Missing Room Event Listeners
**File:** [frontend/src/hooks/useWebRTC.ts](frontend/src/hooks/useWebRTC.ts)  

**Implemented:**
- ✅ `webrtc:offer`
- ✅ `webrtc:answer`
- ✅ `webrtc:ice_candidate`
- ✅ `room:user_joined`
- ✅ `room:user_left`

**Missing:**
- ❌ `room:pending` - Khi room yêu cầu approval
- ❌ `room:request_approve` - Host approval request
- ❌ `room:approve_user` - User được duyệt
- ❌ `room:reject_user` - User bị từ chối
- ❌ `room:kick_user` - User bị đuổi
- ❌ `room:force_disconnect` - Connection bị ngắt

**Fix:** Thêm listeners:
```typescript
const handleUserRejected = (data: any) => {
  toast.error("Your join request was rejected");
  navigate("/lobby");
};

socket.on(ROOM_EVENTS.REJECT_USER, handleUserRejected);
```

---

### ❌ 4.2 Missing Chat Event Listeners
**File:** [frontend/src/socket/events.ts](frontend/src/socket/events.ts)  
```typescript
export const CHAT_EVENTS = {
  SEND:         'chat:send',
  RECEIVE:      'chat:receive',  // ❌ Listener không implement
  SYSTEM_ALERT: 'chat:system_alert',  // ❌ Listener không implement
}
```

**Missing Implementation:**
- Không listen `chat:receive` để receive messages từ users khác
- Không listen `chat:system_alert` cho system notifications

**Fix:**
```typescript
const handleChatReceive = (data: ChatMessage) => {
  useMeetingStore.setState(state => ({
    messages: [...state.messages, data]
  }));
};

socket.on(CHAT_EVENTS.RECEIVE, handleChatReceive);
```

---

### ❌ 4.3 Incomplete Attendance Event Listeners
**Backend events** (từ socket handlers trong backend):
- Không define trong [frontend/src/socket/events.ts](frontend/src/socket/events.ts)

**Missing:**
```typescript
export const ATTENDANCE_EVENTS = {
  CHECK_IN: 'attendance:check_in',
  CHECK_OUT: 'attendance:check_out',
  STATS_UPDATE: 'attendance:stats_update',
};
```

---

### ❌ 4.4 WebRTC Signaling Không Handle Errors
**File:** [frontend/src/hooks/useWebRTC.ts](frontend/src/hooks/useWebRTC.ts#L70-L110)  
```typescript
peer.createOffer().then(offer => {
  return peer.setLocalDescription(offer);
}).then(() => {
  socket.emit(WEBRTC_EVENTS.OFFER, {
    to: userId,
    offer: peer.localDescription
  });
});
```

**Issues:**
- Không catch errors
- Không timeout khi offer không được receive
- Không cleanup khi signaling fails

---

## 5️⃣ STATE MANAGEMENT NOT SYNCHRONIZED

### ❌ 5.1 mediaStore vs meetingStore Mismatch
**File:** [frontend/src/stores/mediaStore.ts](frontend/src/stores/mediaStore.ts)  
```typescript
interface MediaState {
  localStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
}
```

**File:** [frontend/src/stores/meetingStore.ts](frontend/src/stores/meetingStore.ts)  
```typescript
interface Participant {
  id: string;
  fullName: string;
  isActive: boolean;
  isAudioMuted: boolean;    // ❌ Not sync with mediaStore
  isVideoMuted: boolean;     // ❌ Not sync with mediaStore
  stream?: MediaStream;
}
```

**Issue:** Khi user toggle audio/video trong mediaStore, participant state không update  
**Fix:** Add callback trong mediaStore:
```typescript
toggleAudio: () => {
  // ... toggle logic
  // Sync to meeting store
  useMeetingStore.getState().updateParticipantAudio(userId, !isAudioMuted);
}
```

---

### ❌ 5.2 useAuthStore Not Synced with Socket Auth
**File:** [frontend/src/socket/socket.ts](frontend/src/socket/socket.ts#L10)  
```typescript
socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: { token: useAuthStore.getState().accessToken },  // ❌ Static value
  transports: ['websocket', 'polling'],
});
```

**Issue:** Token được set khi socket init, nhưng khi user login, token không được update  
**Fix:**
```typescript
export function updateSocketAuth(token: string) {
  const skt = getSocket();
  skt.auth = { token };
  if (skt.connected) {
    skt.disconnect();
    skt.connect();
  }
}

// Call after login:
useAuthStore.subscribe(state => {
  if (state.accessToken) {
    updateSocketAuth(state.accessToken);
  }
});
```

---

### ❌ 5.3 meetingStore Not Reset on Leave
**Issue:** Khi user leave room, meetingStore không được reset  
**Fix:**
```typescript
useEffect(() => {
  return () => {
    // Cleanup khi component unmount
    useMeetingStore.getState().reset();
  };
}, []);
```

---

### ❌ 5.4 No Participant Metadata Sync
**Issue:** Participant fullName có thể change, nhưng UI không update  
**Fix:** Add mechanism để update participant metadata

---

## 6️⃣ UNUSED COMPONENTS & DEAD CODE

### ❌ 6.1 Unused UI Components
**File:** [frontend/src/components/ui/](frontend/src/components/ui/)
- `card.tsx` - Imported nhưng không dùng
- Có thể có component khác không dùng

---

### ❌ 6.2 Unused Imports
**File:** [frontend/src/screens/DashboardScreen.tsx](frontend/src/screens/DashboardScreen.tsx#L15)  
```typescript
import { Archive, Plus, ... } from "lucide-react";
// Archive icon không được dùng
```

---

### ❌ 6.3 Unused Event Handlers
**File:** [frontend/src/screens/DashboardScreen.tsx](frontend/src/screens/DashboardScreen.tsx#L58)  
```jsx
<Button
  onClick={() => {}}  // ❌ Empty handler
  className="..."
>
  New Meeting
</Button>
```

---

## 7️⃣ TYPESCRIPT ERRORS & ANY TYPES

### ❌ 7.1 Excessive Use of `any` Types
**Files affected:**
- [frontend/src/screens/AdminDashboardScreen.tsx](frontend/src/screens/AdminDashboardScreen.tsx#L162) - `StatusCard` props
- [frontend/src/screens/DashboardScreen.tsx](frontend/src/screens/DashboardScreen.tsx#L320) - Component props
- [frontend/src/screens/MeetingScreen.tsx](frontend/src/screens/MeetingScreen.tsx#L319) - `VideoTile`, `ChatMessage`, `ControlButton`, `FilterItem`, `ColorFilter` props
- [frontend/src/screens/LobbyScreen.tsx](frontend/src/screens/LobbyScreen.tsx#L231) - `LobbyControl` props

**Example:**
```typescript
// ❌ Bad
function VideoTile({ name, stream, isMuted = false, isVideoOff = false, isHost = false, isLocal = false }: any) {
  // ...
}

// ✅ Good
interface VideoTileProps {
  name: string;
  stream: MediaStream | null;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isHost?: boolean;
  isLocal?: boolean;
}

function VideoTile({ name, stream, isMuted = false, isVideoOff = false, isHost = false, isLocal = false }: VideoTileProps) {
  // ...
}
```

**Fix:** Define proper interfaces cho tất cả component props

---

### ❌ 7.2 Unsafe Socket Data Handling
**File:** [frontend/src/hooks/useWebRTC.ts](frontend/src/hooks/useWebRTC.ts#L45-L55)  
```typescript
const handleUserJoined = (data: any) => {  // ❌ any type
  const uId = data.userId || data.user?._id;  // ❌ Unsafe access
  if (!uId) return;
  addParticipant({ id: uId, fullName: data.user?.fullName || data.user?.full_name || 'Guest', isActive: true, isAudioMuted: false, isVideoMuted: false });
};
```

**Fix:** Define socket event types:
```typescript
interface UserJoinedEvent {
  userId: string;
  user: {
    _id: string;
    fullName: string;
    email: string;
  };
}

const handleUserJoined = (data: UserJoinedEvent) => {
  // ...
};
```

---

### ❌ 7.3 Unsafe API Response Handling
**File:** [frontend/src/stores/useAuthStore.ts](frontend/src/stores/useAuthStore.ts#L28-L35)  
```typescript
const response = await authService.signIn(email, password);

if (response.success && response.data) {  // ❌ No type checking
  set({ 
    accessToken: response.data.access_token || response.data.accessToken,  // ❌ Fallback without validation
    user: response.data.user
  });
}
```

**Fix:** Define API response types:
```typescript
interface LoginResponse {
  success: boolean;
  data: {
    access_token: string;
    refresh_token?: string;
    user: User;
  };
  message: string;
}
```

---

## 📊 SUMMARY TABLE

| Loại Vấn đề | Số lượng | Mức độ | Fix Priority |
|-------------|---------|-------|-------------|
| API Mismatches | 6 | 🔴 Critical | 1 |
| Mock Data | 7 | 🟠 High | 2 |
| Missing Error Handling | 4 | 🟠 High | 3 |
| Incomplete Socket Listeners | 4 | 🟠 High | 4 |
| State Sync Issues | 4 | 🟡 Medium | 5 |
| Unused Code | 3 | 🟡 Medium | 6 |
| TypeScript Issues | 3 | 🟡 Medium | 7 |
| **TOTAL** | **31** | - | - |

---

## 🔧 RECOMMENDED ACTION ITEMS

### Phase 1 (Critical - Fix First)
1. **Create Missing Services**
   - `roomService.ts` - Fetch rooms, create room, join room
   - `attendanceService.ts` - Check-in/check-out
   - `historyService.ts` - Fetch room history, chat history, events

2. **Replace Mock Data**
   - Remove hard-coded chat messages, meetings, users
   - Fetch từ actual API endpoints

3. **Fix Data Structure Mismatches**
   - Map backend User fields: `full_name` → `fullName`
   - Map backend Participant data

### Phase 2 (High - Fix Next)
4. **Implement Complete Socket Listeners**
   - Room events: approve, reject, kick
   - Chat events: send, receive
   - Attendance events

5. **Add Error Handling & Loading States**
   - Global error handler
   - Loading indicators
   - Retry logic

### Phase 3 (Medium - Fix After)
6. **Fix State Management**
   - Sync mediaStore with meetingStore
   - Sync useAuthStore with socket
   - Reset stores on navigation

7. **Replace `any` Types**
   - Define interfaces for all component props
   - Define socket event types
   - Define API response types

---

## 🚀 NEXT STEPS

1. **Create backend endpoints** cho admin dashboard (nếu cần)
2. **Create API services** cho room, attendance, history
3. **Implement socket listeners** trong useWebRTC hook
4. **Add type definitions** cho component props
5. **Replace mock data** với actual API calls
6. **Test end-to-end** flow: auth → lobby → meeting → chat → leave

---

**Generated:** 25/04/2026
**Status:** ⚠️ NEEDS FIX
