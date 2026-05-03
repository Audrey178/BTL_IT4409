# Fix Mic/Cam Sync + Screen Share

> Cập nhật: 2026-05-03T21:20 | Trạng thái: 🔄 Planning

## Background

### Bug: Mic/Cam toggle không đồng bộ
Khi user toggle mic/cam, `mediaStore` chỉ flip `track.enabled` + local state. **Không có socket event** nào được emit → remote users **không bao giờ biết** trạng thái mic/cam thay đổi. `Participant.isAudioMuted` / `isVideoMuted` luôn = `false`.

### Feature: Screen Share
Nút Share Screen hiện chỉ là UI placeholder. Cần implement `getDisplayMedia()` + `replaceTrack()` trên tất cả peer connections + socket broadcast.

---

## User Review Required

> [!IMPORTANT]
> **Constraint**: Chỉ 1 user share screen tại 1 thời điểm (đã confirm).

> [!WARNING]
> **Backend thay đổi**: Cần thêm `media.handler.js` mới + sửa `constants.js` + `index.js`. Không thay đổi database schema.

---

## Proposed Changes

### Backend — Socket Events

#### [MODIFY] [constants.js](file:///home/trang/Documents/BTL_IT4409/backend/src/utils/constants.js)
Thêm 3 MEDIA events vào `SOCKET_EVENTS`:
```js
// Media events
MEDIA_TOGGLE: 'media:toggle',
MEDIA_SCREEN_SHARE_START: 'media:screen_share_start',
MEDIA_SCREEN_SHARE_STOP: 'media:screen_share_stop',
```

#### [NEW] [media.handler.js](file:///home/trang/Documents/BTL_IT4409/backend/src/sockets/media.handler.js)
Handler broadcast media events tới tất cả users trong room (trừ sender):
- `handleMediaToggle(socket, data)`: Nhận `{ roomCode, userId, isAudioMuted, isVideoMuted }` → broadcast to room
- `handleScreenShareStart(socket, data)`: Nhận `{ roomCode, userId, userName }` → broadcast to room  
- `handleScreenShareStop(socket, data)`: Nhận `{ roomCode, userId }` → broadcast to room

Logic đơn giản: chỉ relay event, không cần Redis/DB.

#### [MODIFY] [index.js](file:///home/trang/Documents/BTL_IT4409/backend/src/sockets/index.js)
Register 3 handler mới cho media events.

---

### Frontend — Types & Events

#### [MODIFY] [events.ts](file:///home/trang/Documents/BTL_IT4409/frontend/src/socket/events.ts)
Thêm `MEDIA_EVENTS` object:
```ts
export const MEDIA_EVENTS = {
  TOGGLE: 'media:toggle',
  SCREEN_SHARE_START: 'media:screen_share_start',
  SCREEN_SHARE_STOP: 'media:screen_share_stop',
} as const;
```

#### [MODIFY] [index.ts](file:///home/trang/Documents/BTL_IT4409/frontend/src/types/index.ts)  
Thêm `isScreenSharing?: boolean` vào `Participant` interface.

---

### Frontend — Stores

#### [MODIFY] [mediaStore.ts](file:///home/trang/Documents/BTL_IT4409/frontend/src/stores/mediaStore.ts)
Thêm screen share state + actions:
```ts
screenStream: MediaStream | null;
isScreenSharing: boolean;
setScreenStream: (stream: MediaStream | null) => void;
setIsScreenSharing: (v: boolean) => void;
```
- `toggleAudio` / `toggleVideo` **không thay đổi** — vẫn chỉ quản lý local. Socket emit sẽ được xử lý ở hook layer.

#### [MODIFY] [meetingStore.ts](file:///home/trang/Documents/BTL_IT4409/frontend/src/stores/meetingStore.ts)
Thêm:
```ts
screenSharingUserId: string | null;
setScreenSharingUserId: (userId: string | null) => void;
updateParticipantMedia: (userId: string, patch: { isAudioMuted?: boolean; isVideoMuted?: boolean }) => void;
```

---

### Frontend — Hooks

#### [MODIFY] [useWebRTC.ts](file:///home/trang/Documents/BTL_IT4409/frontend/src/hooks/useWebRTC.ts)
Thay đổi:
1. **Return `replaceVideoTrack` function** thay vì return null:
   ```ts
   const replaceVideoTrack = (newTrack: MediaStreamTrack) => {
     peersRef.current.forEach((peer) => {
       const sender = peer.getSenders().find(s => s.track?.kind === 'video');
       if (sender) sender.replaceTrack(newTrack);
     });
   };
   return { replaceVideoTrack };
   ```
2. Khi tạo peer, nếu đang screen share → addTrack screen track thay vì camera track.

#### [MODIFY] [useRoomEvents.ts](file:///home/trang/Documents/BTL_IT4409/frontend/src/hooks/useRoomEvents.ts)  
Thêm listeners cho:
- `media:toggle` → gọi `updateParticipantMedia(userId, { isAudioMuted, isVideoMuted })`
- `media:screen_share_start` → gọi `setScreenSharingUserId(userId)`
- `media:screen_share_stop` → gọi `setScreenSharingUserId(null)`

---

### Frontend — UI

#### [MODIFY] [MeetingScreen.tsx](file:///home/trang/Documents/BTL_IT4409/frontend/src/screens/meeting/MeetingScreen.tsx)

**1. Wrap toggleAudio/toggleVideo** — sau khi toggle, emit `media:toggle` socket event với state mới

**2. Screen Share button handler:**
   - Gọi `getDisplayMedia()` → store stream → `replaceVideoTrack()` → emit `media:screen_share_start`
   - Listen `track.onended` (browser stop button) → cleanup + emit stop
   - Nếu đã có người khác đang share → show toast và block

**3. Presentation Mode Layout** (khi có user đang share screen):
   ```
   ┌─────────────────────────────────────────────────────────┐
   │ 🔴 Trang Trịnh Huyền (You, presenting)   [Stop presenting] │  ← Top banner
   ├───────────────────────────────────────┬─────────────────┤
   │                                       │  ┌───────────┐  │
   │                                       │  │ You (cam) │  │
   │     SCREEN SHARE CONTENT              │  └───────────┘  │
   │     (Large VideoTile)                 │  ┌───────────┐  │
   │     "Presenting: [Name]"              │  │ User 2    │  │
   │                                       │  └───────────┘  │
   │                                       │  ┌───────────┐  │
   │                                       │  │ User 3    │  │
   │                                       │  └───────────┘  │
   ├───────────────────────────────────────┴─────────────────┤
   │                    [Controls Bar]                       │
   └─────────────────────────────────────────────────────────┘
   ```
   - **Main area**: Dedicated `ScreenShareTile` component — full-width, no mirror, với overlay nhỏ "Presenting: [Name]"
   - **Right sidebar (filmstrip)**: Danh sách nhỏ các participant tiles xếp dọc (bao gồm local user + remotes), có scroll nếu nhiều
   - **Top banner**: Hiện khi user local đang present, có nút "Stop presenting"
   - Khi không ai share → quay lại grid layout bình thường (2x2)

**4. ControlButton share screen**: Toggle active state khi đang share

---

## Task Breakdown

| ID  | Task | File(s) | Depends |
|-----|------|---------|---------|
| T01 | Backend: constants + media handler | `constants.js`, `media.handler.js` [NEW], `index.js` | — |
| T02 | Frontend: socket events | `events.ts` | — |
| T03 | Frontend: types update | `types/index.ts` | — |
| T04 | Frontend: mediaStore (screen share state) | `stores/mediaStore.ts` | — |
| T05 | Frontend: meetingStore (participant media + screen share tracking) | `stores/meetingStore.ts` | T03 |
| T06 | Frontend: useWebRTC (replaceVideoTrack) | `hooks/useWebRTC.ts` | T04 |
| T07 | Frontend: useRoomEvents (media listeners) | `hooks/useRoomEvents.ts` | T02, T05 |
| T08 | Frontend: MeetingScreen UI + Presentation Layout | `screens/meeting/MeetingScreen.tsx` | T04–T07 |

---

## Verification Plan

### Manual Testing
```
1. Mic/Cam Sync:
   - 2 tabs join cùng phòng
   - Tab A toggle mic → Tab B thấy icon mic muted trên VideoTile của A
   - Tab A toggle cam → Tab B thấy avatar thay vì video của A

2. Screen Share:
   - Tab A click Share Screen → chọn màn hình/tab → Tab B thấy screen share stream
   - Tab A click Stop Share → Tab B thấy camera stream quay lại
   - Tab A đang share → Tab B click Share → bị block, show toast
   - Tab A share rồi click browser "Stop sharing" button → cleanup đúng

3. Edge cases:
   - User share screen rồi rời phòng → các user khác cập nhật đúng
   - Toggle mic/cam nhanh liên tục → state cuối cùng đúng
```

### Build Check
```bash
cd frontend && npx tsc --noEmit
```
