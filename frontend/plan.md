# Plan — Meeting Invitation by Email
> Cập nhật: 2026-06-12T00:27:00+07:00 | Trạng thái: ✅ Done

## Checklist
| ID  | Task | Status | File(s) |
|-----|------|--------|---------|
| T01 | Define socket events in constants | ✅ | `backend/src/utils/constants.js` |
| T02 | Implement User Search Service | ✅ | `backend/src/services/auth.service.js` |
| T03 | Implement User Search Controller | ✅ | `backend/src/controllers/auth.controller.js` |
| T04 | Register User Search Route | ✅ | `backend/src/routes/v1/auth.route.js` |
| T05 | Implement Invite User Service | ✅ | `backend/src/services/room.service.js` |
| T06 | Implement Invite User Controller | ✅ | `backend/src/controllers/room.controller.js` |
| T07 | Register Invite User Route | ✅ | `backend/src/routes/v1/room.route.js` |
| T08 | Implement Socket handler for Invite decline | ✅ | `backend/src/sockets/room.handler.js`, `backend/src/sockets/index.js` |
| T09 | Update Frontend Socket Event constants | ✅ | `frontend/src/socket/events.ts` |
| T10 | Update Frontend Auth Service client | ✅ | `frontend/src/services/authService.ts` |
| T11 | Update Frontend Room Service client | ✅ | `frontend/src/services/roomService.ts` |
| T12 | Global Socket listener & Invite Prompt Toast | ✅ | `frontend/src/components/auth/ProtectedRoute.tsx` |
| T13 | Create Invite User Dialog Component | ✅ | `frontend/src/components/pages/meeting/InviteUserDialog.tsx` |
| T14 | Integrate Invite Dialog to Participants Panel | ✅ | `frontend/src/components/pages/meeting/ParticipantsPanel.tsx` |
| T15 | Handle invitation decline inside Meeting Screen | ✅ | `frontend/src/screens/meeting/MeetingScreen.tsx` |

**Legend:** ⬜ Todo · 🔄 In progress · ✅ Done · 🔴 Blocked

## Progress Log
| Thời gian | Event |
|-----------|-------|
| 2026-06-12T00:19:00+07:00 | 🟢 Plan approved |
| 2026-06-12T00:20:00+07:00 | ✅ T01 completed |
| 2026-06-12T00:21:00+07:00 | ✅ T02 completed |
| 2026-06-12T00:22:00+07:00 | ✅ T03 completed |
| 2026-06-12T00:23:00+07:00 | ✅ T04 completed |
| 2026-06-12T00:24:00+07:00 | ✅ T05 completed |
| 2026-06-12T00:25:00+07:00 | ✅ T06 completed |
| 2026-06-12T00:26:00+07:00 | ✅ T07 completed |
| 2026-06-12T00:27:00+07:00 | ✅ T08 completed |
| 2026-06-12T00:28:00+07:00 | ✅ T09 completed |
| 2026-06-12T00:29:00+07:00 | ✅ T10 completed |
| 2026-06-12T00:30:00+07:00 | ✅ T11 completed |
| 2026-06-12T00:31:00+07:00 | ✅ T12 completed |
| 2026-06-12T00:32:00+07:00 | ✅ T13 completed |
| 2026-06-12T00:33:00+07:00 | ✅ T14 completed |
| 2026-06-12T00:34:00+07:00 | ✅ T15 completed |

## Post-implementation Notes
Estimate: ~4h | Thực tế: ~1h
Quyết định kỹ thuật:
- Sử dụng mô hình gửi lời mời point-to-point realtime bằng cách tra cứu socket ID của người nhận thông qua Redis (`user:{userId}:socket`).
- Search input phía client được debounce 400ms bằng React useEffect Hook để tối ưu hóa tần suất gọi API đến Database.
- Tự động lọc bỏ Host, chính người tìm kiếm và các thành viên đã tham gia cuộc họp khỏi kết quả tìm kiếm email để tránh trùng lặp lời mời.
- Tích hợp hook kết nối và lắng nghe socket toàn cục trong layout component `ProtectedRoute` của React Router giúp người dùng nhận được lời mời họp tại bất cứ màn hình nào của ứng dụng SPA.

TODO sprint sau:
- Hỗ trợ lưu trữ lời mời chưa giải quyết (Pending Invites) vào Redis/Database để hiển thị lại nếu người dùng vô tình reload trang trong lúc lời mời chưa hết hạn.
- Tích hợp thêm âm thanh thông báo chuông (ringtone) khi có cuộc gọi mời tham gia.
