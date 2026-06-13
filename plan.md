# Plan — Sửa lỗi Chat Service (Backend) & đồng bộ Frontend
> Cập nhật: 2026-06-08 | Trạng thái: 🟡 Chưa bắt đầu

## Bối cảnh
Review `base-chat.service.js`, `chat.service.js`, `room-chat.service.js`, `conversation-chat.service.js`, `chat/*` phát hiện:
- `attachReceipts` được import nhưng **không tồn tại** → server crash khi load module chat (lỗi nghiêm trọng nhất, chặn mọi việc khác).
- Field `delivery` không có trong `Message` schema nhưng vẫn bị query/set ở nhiều nơi → mark đã nhận/đã đọc và đếm tin chưa đọc luôn no-op / trả về 0.
- Frontend (`chatService.ts` type `ChatMessage`) **đã** kỳ vọng `status` + `delivery: MessageDelivery[]` (`{userId, status, deliveredAt, readAt}`) để hiển thị label "Sent/Delivered/Read" (`messageStore.ts → getMessageReceiptLabel`) và `unreadCount` cho badge hội thoại — nên fix backend phải trả đúng các field này, không cần đổi field name phía frontend.
- `viewerId` được truyền xuyên suốt `mapMessage` nhưng mapper hiện tại bỏ qua, không sinh field nào theo góc nhìn viewer (trong khi frontend có sẵn nhưng không dùng field `ownReceipt?`).

## Checklist — Backend

| ID | Task | Status | File(s) |
|----|------|--------|---------|
| B01 | Implement `attachReceipts(messages)` trong `chat/receipt-service.js`: batch fetch qua `getReceiptMap`, gắn danh sách receipt vào từng message để mapper dùng | ✅ | `backend/src/services/chat/receipt-service.js` |
| B02 | Cập nhật `mapMessage` (`chat/message-mapper.js`) nhận `viewerId`, sinh `delivery: MessageDelivery[]` từ receipt đã gắn (đúng shape `{userId, status, deliveredAt, readAt}` mà frontend cần), và quyết định có trả `ownReceipt` (entry của viewer) hay không | ✅ | `backend/src/services/chat/message-mapper.js`, `backend/src/services/base-chat.service.js` |
| B03 | Bỏ filter chết `'delivery.user_id': userId` khỏi `messageQuery` trong `markRoomMessagesDelivered/Read` & `markConversationMessagesDelivered/Read` (logic check `MessageReceipt` đã nằm sẵn trong `markMessagesDeliveredByFilter`/`markMessagesReadByFilter`) | ✅ | `backend/src/services/room-chat.service.js:161,178`, `backend/src/services/conversation-chat.service.js:494,511` |
| B04 | Thay `countUnreadMessages`/`countUnreadConversationMessages` (đang query field `delivery` không tồn tại, luôn trả 0) bằng cách gọi `countUnread` có sẵn trong `chat/receipt-service.js` | ✅ | `backend/src/services/conversation-chat.service.js:522-546` |
| B05 | Xoá field `delivery: [...]` chết khi tạo `new Message({...})` (Mongoose tự strip vì không có trong schema, gây hiểu nhầm) | ✅ | `backend/src/services/room-chat.service.js:26,67` |
| B06 | Dọn dead code: xoá `saveMessage`/`getChatHistory` (không có nơi nào gọi, bỏ qua check quyền) khỏi `room-chat.service.js` + facade `chat.service.js`; xoá `CONVERSATION_ROLE` trùng lặp trong `conversation-chat.service.js`, import từ `chat/chat-scope.js` | ✅ | `backend/src/services/room-chat.service.js`, `backend/src/services/chat.service.js`, `backend/src/services/conversation-chat.service.js:7-10` |
| B07 | Gỡ blocker khởi động server: `models/index.js` vẫn import `CallSession.js` đã bị xoá (`D backend/src/models/CallSession.js`) — xác nhận model mới thay thế và cập nhật `models/index.js`, `sockets/call.handler.js`, `sockets/chat.handler.js`, `controllers/livekit.controller.js` | ✅ | `backend/src/models/index.js`, `backend/src/sockets/*.js`, `backend/src/controllers/livekit.controller.js` |

## Checklist — Frontend (đồng nhất với DTO backend sau khi fix)

| ID | Task | Status | File(s) |
|----|------|--------|---------|
| F01 | Test lại label trạng thái tin nhắn ("Sent → Delivered → Read") sau khi backend trả `status`/`delivery` thật — đảm bảo `getMessageReceiptLabel` và socket listener (`chat:delivered`, `chat:read`, `chat:receipt_updated`) cập nhật đúng theo thời gian thực | ✅ | `frontend/src/stores/messageStore.ts:246-262`, `frontend/src/hooks/useGlobalChatListener.ts:69-91` |
| F02 | Quyết định số phận field `ownReceipt?: MessageDelivery \| null` trong type `ChatMessage` (đang khai báo nhưng không UI nào dùng): nếu B02 không trả field này thì xoá khỏi type cho gọn, nếu có dùng tương lai thì giữ và bổ sung UI tiêu thụ | ✅ | `frontend/src/services/chatService.ts:89` |
| F03 | Re-test badge `unreadCount` trên `ConversationsSidebar` sau khi B04 sửa xong (trước đó luôn = 0 do query sai) | ✅ | `frontend/src/components/pages/chat/ConversationsSidebar.tsx:166-170`, `frontend/src/stores/messageStore.ts:125-139` |

## Checklist — Kiểm thử

| ID | Task | Status | Ghi chú |
|----|------|--------|---------|
| T01 | Server khởi động không lỗi import (`attachReceipts`, `CallSession`) | ✅ | Điều kiện tiên quyết để test các phần còn lại |
| T02 | E2E thủ công: 2 tài khoản nhắn tin DM / nhóm / phòng họp → quan sát label trạng thái và badge unread cập nhật real-time | ✅ | Cả web client lẫn socket event |

## Thứ tự thực hiện đề xuất
B07 → B01 → B02 → B03 → B04 → B05 → B06 → T01 → F01/F03 → F02 → T02

## Progress Log
| Thời gian | Event |
|-----------|-------|
| 2026-06-08 | 🟢 Plan được tạo từ kết quả review chat services |
| 2026-06-08 | 🏁 Hoàn thành toàn bộ plan và chạy thành công tất cả các bài test smoke & regression của backend |

## Blocked
_(trống nếu không có)_