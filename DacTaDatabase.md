# Đặc tả Database

## 1. Tổng quan

Hệ thống dùng:

- MongoDB cho persistent data
- Redis cho realtime/session state

Thiết kế hiện tại tối ưu cho:

- room lifecycle
- participant tracking
- chat history
- meeting audit trail
- attendance logging

## 2. MongoDB collections

### `users`

Mục đích:

- thông tin định danh user
- password hash
- face embeddings
- role

Thuộc tính chính:

- `_id`
- `email` unique
- `password_hash`
- `full_name`
- `avatar`
- `face_embeddings[]`
- `role`
- `created_at`
- `updated_at`

Index:

- `email` unique
- `created_at`

### `rooms`

Mục đích:

- metadata phòng họp
- trạng thái phòng
- cấu hình phòng

Thuộc tính chính:

- `_id`
- `room_code` unique
- `host_id`
- `title`
- `description`
- `status`
- `settings.require_approval`
- `settings.allow_chat`
- `settings.max_participants`
- `started_at`
- `ended_at`
- `created_at`
- `updated_at`

Index:

- `room_code` unique
- `status`
- `(status, created_at)`
- `host_id`

### `room_members`

Mục đích:

- membership của user trong từng room
- waiting/joined/rejected/kicked/left state
- joined/left timestamp

Thuộc tính chính:

- `_id`
- `room_id`
- `user_id`
- `status`
- `joined_at`
- `left_at`
- `duration`
- `created_at`
- `updated_at`

Index:

- unique `(room_id, user_id)`
- `(room_id, status)`
- `(user_id, created_at)`

### `messages`

Mục đích:

- chat persistence

Thuộc tính chính:

- `_id`
- `room_id`
- `sender_id`
- `sender_name`
- `sender_avatar`
- `type`
- `content`
- `file_url`
- `timestamp`

Index:

- `(room_id, timestamp desc)`
- TTL `timestamp` 180 ngày

Ràng buộc triển khai:

- `room_id` phải là ObjectId của room, không phải `room_code`

### `meeting_events`

Mục đích:

- audit trail

Event điển hình:

- `room_created`
- `user_joined`
- `user_left`
- `user_approved`
- `user_rejected`
- `user_kicked`
- `room_ended`

Thuộc tính chính:

- `_id`
- `room_id`
- `user_id`
- `event_type`
- `description`
- `created_at`

### `attendance_logs`

Mục đích:

- check-in / check-out
- attendance reporting

Thuộc tính chính:

- `_id`
- `room_id`
- `user_id`
- `check_in_time`
- `check_out_time`
- `method`
- `confidence_score`

## 3. Redis design

### Keys đang dùng

- `socket:{socketId}`
  - value: `{ userId, roomCode }`
- `user:{userId}:socket`
  - value: `socketId`
- `room:{roomCode}:members`
  - set user ids
- `room:{roomCode}:host`
  - host user id

### Redis usage

- map user/socket để gửi socket event point-to-point
- track realtime room membership
- cleanup nhanh khi disconnect

## 4. Quan hệ dữ liệu

- `rooms.host_id -> users._id`
- `room_members.room_id -> rooms._id`
- `room_members.user_id -> users._id`
- `messages.room_id -> rooms._id`
- `messages.sender_id -> users._id`
- `meeting_events.room_id -> rooms._id`
- `meeting_events.user_id -> users._id`
- `attendance_logs.room_id -> rooms._id`
- `attendance_logs.user_id -> users._id`

## 5. Lifecycle dữ liệu

### Room

1. tạo room
2. host hoặc participant join
3. room chuyển `waiting -> active`
4. chat/events/attendance phát sinh
5. host end room
6. room chuyển `ended`

### Attendance

1. user join room
2. check-in
3. check-out
4. thống kê theo room hoặc theo user

### Chat

1. socket nhận message
2. xác thực user và membership
3. resolve `room_code -> room_id`
4. persist vào `messages`
5. emit realtime

## 6. Retention và housekeeping

- `messages` có TTL 180 ngày
- các collection khác chưa có retention policy tự động

Khuyến nghị tiếp theo:

- retention cho audit log nếu volume tăng
- archive room history cũ
- background cleanup cho redis stale keys nếu shutdown không graceful

## 7. Ràng buộc nghiệp vụ

- một user chỉ có một membership record trên mỗi room
- chỉ host được approve/reject/kick/end room
- attendance stats theo room chỉ host được xem
- history room/chat/event chỉ host hoặc member của room được xem

## 8. Khuyến nghị production

- bật replica set cho MongoDB nếu cần transactional guarantees tốt hơn
- thêm backup policy
- thêm monitoring cho Redis memory growth
- nếu message volume lớn, cân nhắc tách chat sang storage chuyên dụng hoặc retention ngắn hơn
