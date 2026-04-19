# API Contracts & TypeScript Types Reference

## Core Types

```ts
// src/types/index.ts

export interface User {
  _id: string
  email: string
  full_name: string
  avatar?: string
  role: 'user' | 'admin'
  face_embeddings: Array<{ descriptor: number[]; created_at: string }>
  created_at: string
}

export interface Room {
  _id: string
  room_code: string
  host_id: string
  title: string
  status: 'waiting' | 'active' | 'ended'
  settings: {
    require_approval: boolean
    allow_chat: boolean
  }
  started_at?: string
  ended_at?: string
}

export interface RoomMember {
  _id: string
  room_id: string
  user_id: string
  status: 'pending' | 'joined' | 'rejected' | 'kicked' | 'left'
  joined_at?: string
  left_at?: string
}

export interface ChatMessage {
  _id: string
  room_id: string
  sender_id: string
  sender_name: string
  sender_avatar?: string
  type: 'text' | 'system' | 'file'
  content: string
  timestamp: string
}

export interface MeetingEvent {
  _id: string
  room_id: string
  user_id: string
  event_type: 'room_created' | 'user_joined' | 'user_left' | 'user_kicked' | 'room_ended'
  description: string
  created_at: string
}

export interface AttendanceLog {
  _id: string
  room_id: string
  user_id: string
  user?: User
  confidence_score: number
  check_in_time: string
  check_out_time?: string
  method: 'face_recognition' | 'manual'
}

// Socket / Meeting state types
export interface Participant {
  userId: string
  user?: User
  stream?: MediaStream
  isMuted: boolean
  isCamOff: boolean
}

export interface WaitingUser {
  userId: string
  socketId: string
  full_name: string
  avatar?: string
}
```

---

## Auth API

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/v1/auth/register` | `{ email, password, full_name }` | `{ user, access_token, refresh_token }` |
| POST | `/api/v1/auth/login` | `{ email, password }` | `{ user, access_token, refresh_token }` |
| POST | `/api/v1/auth/refresh-token` | `{ refresh_token }` | `{ access_token }` |
| POST | `/api/v1/auth/logout` | — | `{ message }` |

```ts
// api/auth.api.ts
import { api } from './client'
import { User } from '@/types'

export const authApi = {
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post<{ user: User; access_token: string; refresh_token: string }>('/api/v1/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; access_token: string; refresh_token: string }>('/api/v1/auth/login', data),

  refreshToken: (refresh_token: string) =>
    api.post<{ access_token: string }>('/api/v1/auth/refresh-token', { refresh_token }),

  logout: () => api.post('/api/v1/auth/logout'),
}
```

---

## Room API

| Method | Endpoint | Auth | Body/Params | Response |
|--------|----------|------|-------------|----------|
| POST | `/api/v1/rooms` | ✓ | `{ title, require_approval }` | `{ room }` |
| GET | `/api/v1/rooms/:roomCode` | ✓ | — | `{ room }` |
| PUT | `/api/v1/rooms/:roomCode/end` | ✓ Host only | — | `{ message }` |

```ts
// api/room.api.ts
import { api } from './client'
import { Room } from '@/types'

export const roomApi = {
  create: (data: { title: string; require_approval?: boolean }) =>
    api.post<{ room: Room }>('/api/v1/rooms', data),

  getByCode: (roomCode: string) =>
    api.get<{ room: Room }>(`/api/v1/rooms/${roomCode}`),

  endRoom: (roomCode: string) =>
    api.put(`/api/v1/rooms/${roomCode}/end`),
}
```

---

## History API

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| GET | `/api/v1/history/rooms` | ✓ | `{ rooms: Room[] }` |
| GET | `/api/v1/history/rooms/:roomCode/messages` | ✓ | `{ messages: ChatMessage[], total, page }` |
| GET | `/api/v1/history/rooms/:roomCode/events` | ✓ | `{ events: MeetingEvent[] }` |

---

## Zustand Auth Store

```ts
// stores/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth-storage' }
  )
)
```

---

## TanStack Query Setup

```tsx
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 }
  }
})
```

### Example query hook
```ts
// hooks/useRoomHistory.ts
export function useRoomHistory() {
  return useQuery({
    queryKey: ['history', 'rooms'],
    queryFn: () => api.get('/api/v1/history/rooms').then(r => r.data.rooms)
  })
}
```
