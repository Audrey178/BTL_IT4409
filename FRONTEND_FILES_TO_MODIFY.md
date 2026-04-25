# 📁 FILES TO CREATE/MODIFY - Quick Reference

## 🆕 NEW FILES TO CREATE

### 1. Services Layer
```
✅ frontend/src/services/roomService.ts
✅ frontend/src/services/chatService.ts
✅ frontend/src/services/meetingService.ts
✅ frontend/src/services/attendanceService.ts
✅ frontend/src/hooks/useChat.ts (NEW - for chat event handling)
```

### 2. Utilities
```
May need: frontend/src/utils/socketHelpers.ts
```

---

## 📝 FILES TO MODIFY

### Priority 1 (CRITICAL)
| File | Changes | Lines |
|------|---------|-------|
| `frontend/src/screens/LobbyScreen.tsx` | Remove hard-coded room code, add room input | All |
| `frontend/src/screens/DashboardScreen.tsx` | Replace mock meetings with API calls, add loading state | 200-310 |
| `frontend/src/screens/MeetingScreen.tsx` | Add chat listeners, replace mock messages, fix handlers | All |
| `frontend/src/hooks/useWebRTC.ts` | Add room event listeners (approve, reject, kick) | 45-120 |
| `frontend/src/socket/events.ts` | Add attendance events | 21-26 |
| `frontend/src/stores/useAuthStore.ts` | Add error handling, token refresh logic | All |

### Priority 2 (HIGH)
| File | Changes | Lines |
|------|---------|-------|
| `frontend/src/types/index.ts` | Add component prop types, event types | Add new |
| `frontend/src/lib/axios.ts` | Improve error handling, add refresh token | 20-50 |
| `frontend/src/socket/socket.ts` | Auto-update auth token, better reconnection | All |
| `frontend/src/screens/AdminDashboardScreen.tsx` | Replace mock data or remove section | 14-50 |

### Priority 3 (MEDIUM)
| File | Changes | Lines |
|------|---------|-------|
| `frontend/src/screens/auth/LoginScreen.tsx` | Better error messages | Refs |
| `frontend/src/screens/auth/SignupScreen.tsx` | Better error messages | Refs |
| `frontend/src/stores/meetingStore.ts` | Add sync methods for participant updates | New methods |
| `frontend/src/stores/mediaStore.ts` | Add listener sync callback | New callback |
| `frontend/src/App.tsx` | Route protection (auth check) | Add |

---

## 🔄 DETAILED FILE MODIFICATIONS

### 1. `frontend/src/screens/LobbyScreen.tsx`

**What to change:**
- Remove hard-coded `HEARTH-2024-STUDIO`
- Add room code input field
- Add display name input field
- Import `roomService`
- Add loading state
- Call `roomService.joinRoom(roomCode)` on submit

**Estimated lines to modify:** ~50

---

### 2. `frontend/src/screens/DashboardScreen.tsx`

**What to change:**
- Add `meetingService` import
- Add state: `meetings`, `loading`, `error`
- Add `useEffect` to fetch meetings via `meetingService.getUserMeetingHistory()`
- Replace hard-coded `MeetingCard` components with `.map()`
- Add loading spinner UI
- Add error message UI
- Remove mock calendar data or fetch actual data

**Estimated lines to modify:** ~100

---

### 3. `frontend/src/screens/MeetingScreen.tsx`

**What to change:**
- Import `useChat` hook
- Remove hard-coded chat messages
- Add chat input state and handler
- Call `socket.emit(CHAT_EVENTS.SEND, ...)`
- Map `messages` from store instead of hard-coded data
- Replace hard-coded user names with `authUser` data
- Remove mock images, use actual avatars

**Estimated lines to modify:** ~80

---

### 4. `frontend/src/hooks/useWebRTC.ts`

**What to change:**
- Add socket listeners for:
  - `ROOM_EVENTS.PENDING`
  - `ROOM_EVENTS.APPROVE_USER`
  - `ROOM_EVENTS.REJECT_USER`
  - `ROOM_EVENTS.KICK_USER`
  - `ROOM_EVENTS.FORCE_DISCONNECT`
- Add toast notifications
- Add store updates
- Add proper cleanup

**Estimated lines to add:** ~80

---

### 5. `frontend/src/socket/events.ts`

**What to change:**
- Add `ATTENDANCE_EVENTS` constant

```typescript
export const ATTENDANCE_EVENTS = {
  CHECK_IN: 'attendance:check_in',
  CHECK_OUT: 'attendance:check_out',
  STATS_UPDATE: 'attendance:stats_update',
} as const;
```

---

### 6. `frontend/src/lib/axios.ts`

**What to change:**
- Enhance response interceptor with retry logic
- Add token refresh mechanism
- Better error handling
- Add timeout configuration

**Estimated lines to modify:** ~50

---

### 7. `frontend/src/types/index.ts`

**What to add:**
- `VideoTileProps` interface
- `ChatMessageProps` interface
- `ControlButtonProps` interface
- Socket event interfaces
- API response interfaces

**Estimated lines to add:** ~80

---

### 8. `frontend/src/stores/useAuthStore.ts`

**What to change:**
- Add `setAccessToken` method
- Improve `signUp` error handling
- Improve `signIn` error handling
- Store `refresh_token`
- Add logout call to backend

**Estimated lines to modify:** ~30

---

### 9. `frontend/src/socket/socket.ts`

**What to change:**
- Subscribe to auth store token changes
- Auto-reconnect when token changes
- Better reconnection config
- Add `updateSocketAuth` function

**Estimated lines to modify:** ~40

---

### 10. `frontend/src/screens/AdminDashboardScreen.tsx`

**What to change:**
- Either: Replace hard-coded `userRows` with API call
- Or: Remove this screen entirely (if no admin endpoints exist)

**Estimated lines to modify:** ~50

---

## 📊 SUMMARY

| Category | Files | Total Lines |
|----------|-------|------------|
| New Files | 5 | ~500 |
| Modify (Critical) | 6 | ~200 |
| Modify (High) | 4 | ~150 |
| Modify (Medium) | 5 | ~100 |
| **TOTAL** | **20** | **~950** |

---

## 🚀 IMPLEMENTATION ORDER

### Phase 1: Setup (Day 1)
1. Create 5 new services
2. Create new hook `useChat`
3. Update type definitions

### Phase 2: Fix Critical Issues (Day 1-2)
4. Fix LobbyScreen
5. Fix DashboardScreen
6. Fix MeetingScreen
7. Add socket listeners in useWebRTC

### Phase 3: Error Handling (Day 2)
8. Update axios interceptor
9. Update auth store
10. Update socket connection

### Phase 4: UI Polish (Day 3)
11. Replace mock data
12. Update AdminDashboard
13. Test and verify

---

## ✅ TEST CASES AFTER FIXES

- [ ] User can signup/login successfully
- [ ] User can join meeting by entering room code
- [ ] Chat messages are sent/received in real-time
- [ ] Participant list updates when users join/leave
- [ ] Video streams work for all participants
- [ ] Audio/video mute/unmute works
- [ ] Host can approve/reject/kick users
- [ ] Attendance check-in/check-out works
- [ ] Errors are handled gracefully
- [ ] Loading states show during async operations
- [ ] Token refresh works automatically
- [ ] Socket reconnects on network error

---

**Last Updated:** 25/04/2026
**Ready for implementation:** ✅ Yes
