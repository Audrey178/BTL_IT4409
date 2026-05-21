# Plan — Fix Camera Toggle Sync Issue
> Cập nhật: 2026-05-21T19:08:00+07:00 | Trạng thái: 🔄 In progress

## Checklist
| ID  | Task | Status | File(s) |
|-----|------|--------|---------|
| T01 | Cập nhật hook `useLiveKit.ts` để đồng bộ track chuẩn xác, tránh race condition của LiveKit SDK | ✅ | `frontend/src/hooks/useLiveKit.ts` |
| T02 | Cập nhật component `VideoTile` trong `MeetingScreen.tsx` để kích hoạt `play()` chủ động và thêm transition mượt mà | ✅ | `frontend/src/screens/meeting/MeetingScreen.tsx` |
| T03 | Chạy kiểm tra build và lint frontend | ✅ | Tích hợp hệ thống |

## Progress Log
| Thời gian | Event |
|-----------|-------|
| 2026-05-21T19:07:00+07:00 | 🟢 Plan approved |

## Blocked
_(trống nếu không có)_
