# Plan — Fix Chat Message Delivery
> Cập nhật: 2026-05-10 | Trạng thái: ✅ Done

## Checklist
| ID  | Task | Status | File(s) | Mô tả ngắn |
|-----|------|--------|---------|------------|
| T01 | Fix MongoDB CastError khi save Message | ✅ | `backend/src/sockets/chat.handler.js` | Lấy `room` theo `roomCode` và dùng `room._id` thay cho string `roomCode` khi lưu `Message` và gọi `Message.find` trong history. |
| T02 | Resolve Duplicate Event Listeners | ✅ | `frontend/src/screens/meeting/MeetingScreen.tsx`, `frontend/src/components/pages/meeting/ChatPanel.tsx` | Xoá `useChatEvents` trong `ChatPanel`, lấy `sendMessage` từ `MeetingScreen` truyền xuống dưới dạng prop để đảm bảo chỉ có 1 listener đang bắt sự kiện `CHAT_EVENTS.RECEIVE` nhưng vẫn tăng badge `unreadCount` khi đóng chat. |

## Progress Log
| Thời gian | Event |
|-----------|-------|
| 2026-05-10 | 🟢 Plan created & approved |
| 2026-05-10 | ✅ Completed Code Implementation |

## Post-implementation Notes
Quyết định kỹ thuật:
- Fix lỗi schema MongoDB không tự động cast String thành ObjectId. Phải query Room collection trước để lấy ObjectId.
- Dồn `useChatEvents` về `MeetingScreen` duy nhất để tránh trigger event 2 lần khi bật/tắt `ChatPanel`.

## Blocked
_(trống nếu không có)_
