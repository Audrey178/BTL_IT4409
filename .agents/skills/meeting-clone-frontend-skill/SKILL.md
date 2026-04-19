---
name: meeting-clone-frontend
description: >
  Comprehensive skill for building a production-grade Google Meet / Zoom clone frontend using
  React + TypeScript + Vite + TailwindCSS + shadcn/ui + Zustand + React Hook Form + Socket.IO +
  WebRTC + TensorFlow.js (face recognition attendance). Trigger this skill whenever the user
  asks to build, scaffold, implement, debug, or review any part of the meeting app frontend —
  including auth flows, room management UI, real-time video/audio, chat, waiting rooms, host
  controls, face recognition check-in, or attendance reports. Also trigger when the user asks
  about WebRTC signaling integration with Socket.IO, TensorFlow.js face-api usage in React, or
  Zustand store design for realtime meeting state.
---

# Meeting Clone — Frontend Engineer Skill

This skill captures all architectural decisions, patterns, and implementation guides for the
frontend of **IT4409 Meeting Project** — a feature-rich real-time video conferencing app.

Read the relevant reference file before writing any non-trivial code:
- **Architecture & stores** → `references/architecture.md`
- **WebRTC + Socket.IO signaling** → `references/webrtc-signaling.md`
- **Face recognition (TensorFlow.js)** → `references/face-recognition.md`
- **UI components & design system** → `references/ui-components.md`
- **API contracts & types** → `references/api-contracts.md`

---

## Project Bootstrap

```bash
pnpm create vite@latest meeting-app -- --template react-ts
cd meeting-app
pnpm add \
  socket.io-client \
  zustand \
  react-hook-form @hookform/resolvers zod \
  @tanstack/react-query axios \
  @tensorflow/tfjs \
  @vladmandic/face-api   # wraps face-api.js, works with @tensorflow/tfjs

# shadcn/ui (run init first)
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input card dialog badge avatar \
  dropdown-menu toast scroll-area separator sheet tooltip

# extras
pnpm add lucide-react clsx tailwind-merge date-fns
pnpm add -D @types/node
```

### Vite config essentials
```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true }
    }
  }
})
```

---

## Folder Structure

```
src/
├── api/              # axios instances, TanStack Query hooks
│   ├── client.ts     # axios with interceptors (attach JWT, refresh)
│   ├── auth.api.ts
│   ├── room.api.ts
│   └── attendance.api.ts
├── components/
│   ├── ui/           # shadcn auto-generated — DO NOT edit manually
│   ├── layout/       # AppLayout, RoomLayout, Sidebar
│   ├── auth/         # LoginForm, RegisterForm
│   ├── room/         # RoomCard, CreateRoomDialog, JoinRoomDialog
│   ├── meeting/      # VideoGrid, VideoTile, ControlBar, ChatPanel
│   │                 # WaitingRoom, ParticipantList, HostControls
│   └── attendance/   # FaceSetupWizard, AttendanceReport
├── hooks/            # useSocket, useWebRTC, useFaceRecognition, useMedia
├── pages/            # Route-level components (lazy-loaded)
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── DashboardPage.tsx
│   ├── MeetingPage.tsx   # <-- core, uses ALL hooks
│   └── HistoryPage.tsx
├── stores/           # Zustand slices
│   ├── authStore.ts
│   ├── meetingStore.ts   # participants, chat, room state
│   └── mediaStore.ts     # local stream, device settings
├── socket/
│   ├── socket.ts         # singleton socket instance
│   └── events.ts         # typed event constants (mirrors backend naming)
├── lib/
│   ├── utils.ts          # cn(), formatDuration()
│   └── validators.ts     # zod schemas
├── types/            # shared TypeScript interfaces
│   └── index.ts
└── router.tsx        # React Router v6, protected routes
```

---

## Key Patterns

### 1. Socket Singleton (never re-instantiate)
```ts
// src/socket/socket.ts
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/authStore'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL ?? '', {
      autoConnect: false,
      auth: { token: useAuthStore.getState().accessToken }
    })
  }
  return socket
}

export function connectSocket() {
  getSocket().connect()
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
```

### 2. Zustand Meeting Store Shape
```ts
interface MeetingState {
  roomCode: string | null
  status: 'idle' | 'waiting' | 'in-room' | 'ended'
  participants: Participant[]         // online users with stream refs
  hostId: string | null
  messages: ChatMessage[]
  waitingList: WaitingUser[]          // host sees this
  // actions
  addParticipant: (p: Participant) => void
  removeParticipant: (userId: string) => void
  addMessage: (msg: ChatMessage) => void
  setWaitingList: (list: WaitingUser[]) => void
  reset: () => void
}
```
**Rule**: Zustand stores own **who** is in the room. React state owns **UI toggles** (panel open/close). Never mix them.

### 3. Protected Route Pattern
```tsx
// router.tsx
const ProtectedRoute = () => {
  const token = useAuthStore(s => s.accessToken)
  return token ? <Outlet /> : <Navigate to="/login" replace />
}
```

### 4. React Hook Form + Zod
```ts
// lib/validators.ts
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})
export type LoginInput = z.infer<typeof loginSchema>

// components/auth/LoginForm.tsx
const { register, handleSubmit, formState: { errors } } =
  useForm<LoginInput>({ resolver: zodResolver(loginSchema) })
```

### 5. Axios Interceptors (Token Refresh)
```ts
// api/client.ts
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      const newToken = await refreshAccessToken()
      err.config.headers.Authorization = `Bearer ${newToken}`
      return api(err.config)
    }
    return Promise.reject(err)
  }
)
```

---

## WebRTC Architecture

See `references/webrtc-signaling.md` for the full signaling flow diagram.

**Quick rules:**
- One `RTCPeerConnection` per remote participant. Store in a `useRef<Map<userId, RTCPeerConnection>>`.
- The **new joiner** (late comer) sends `webrtc:offer` to **each existing peer**.
- The existing peer replies with `webrtc:answer`.
- Both sides exchange `webrtc:ice_candidate` continuously.
- On `room:user_left`, close and delete that peer's connection.
- Use `addTrack` (not `addStream`) for track management.

---

## Face Recognition (TensorFlow.js)

See `references/face-recognition.md` for full implementation.

**Quick rules:**
- Load models from `/public/models/` (copy from `@vladmandic/face-api/model/`).
- Run detection loop only when `isFaceSetup` mode is active — stop the interval on unmount.
- `faceapi.computeFaceDescriptor()` returns a `Float32Array(128)` — convert to `Array<number>` before sending to BE.
- **POST `/api/v1/attendance/face-embeddings`** saves the descriptor; call this during onboarding.
- **Recognition loop** in-meeting: compare incoming descriptor against stored embeddings using `faceapi.euclideanDistance()` — threshold `< 0.5` = match.
- On match: call **POST `/api/v1/attendance/:roomCode/check-in`** once per session (use a `checkedIn` ref to prevent duplicate calls).
- Emit `chat:system_alert` via socket after successful check-in so all participants see it.

---

## Socket Event Naming (mirrors backend exactly)

```ts
// src/socket/events.ts
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
} as const

export const WEBRTC_EVENTS = {
  OFFER:         'webrtc:offer',
  ANSWER:        'webrtc:answer',
  ICE_CANDIDATE: 'webrtc:ice_candidate',
} as const

export const CHAT_EVENTS = {
  SEND:         'chat:send',
  RECEIVE:      'chat:receive',
  SYSTEM_ALERT: 'chat:system_alert',
} as const
```

---

## UI Component Guidelines

- **shadcn/ui** components are in `src/components/ui/` — use them as base; extend with Tailwind.
- VideoTile: `aspect-video bg-zinc-900 rounded-xl overflow-hidden relative`. Show avatar fallback when stream is absent.
- ControlBar: fixed at bottom of meeting layout, dark frosted glass (`bg-zinc-900/80 backdrop-blur`).
- WaitingRoom panel (host): slide-in `Sheet` from the right, list of `WaitingUser` cards with Approve / Reject buttons.
- Chat panel: `ScrollArea` with `flex-col-reverse` trick — scroll to bottom on new messages.
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` for participants.

---

## Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

## Common Pitfalls & How to Avoid Them

| Pitfall | Fix |
|---|---|
| Socket reconnects flood the server | Use singleton pattern, `autoConnect: false` |
| WebRTC state lost on re-render | Store `RTCPeerConnection` in `useRef`, not state |
| Face detection blocks UI thread | Use `requestAnimationFrame` loop, not `setInterval` |
| Token expired during long meeting | Axios interceptor auto-refreshes silently |
| Memory leak: camera stream stays open | `stream.getTracks().forEach(t => t.stop())` on unmount |
| Chat scroll jumps on load | Use `ScrollArea` with `scrollTop = scrollHeight` in `useEffect` |
| `room:force_disconnect` ignored | Listen in `useEffect` at top-level meeting hook, navigate away |

---

## Implementation Checklist (Roadmap alignment)

- [ ] **Week 7** — Auth pages (Login/Register), Axios client, Zustand authStore, protected routes
- [ ] **Week 8** — Socket singleton, room create/join UI, WebRTC hook, VideoGrid
- [ ] **Week 9** — WaitingRoom, HostControls (approve/kick/mute), ParticipantList
- [ ] **Week 10** — FaceSetupWizard, recognition loop, attendance check-in, system alert
- [ ] **Week 11** — ChatPanel with history load, message pagination, system messages
- [ ] **Week 12** — E2E testing with backend, responsive polish, error boundaries
- [ ] **Week 13** — Performance audit, lazy loading, final demo prep
