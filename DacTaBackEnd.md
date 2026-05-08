# Đặc tả Backend

## 1. Mục tiêu

Backend cung cấp:

- xác thực người dùng
- quản lý phòng họp
- lịch sử phòng, chat, audit log
- attendance
- realtime signaling qua Socket.IO cho room/chat/WebRTC

Backend canonical của repo là `backend/`.

## 2. Stack kỹ thuật

- Node.js 18+
- Express 4
- MongoDB + Mongoose
- Redis
- Socket.IO 4
- Joi validation
- JWT
- Swagger
- Pino logging

## 3. Kiến trúc module

### Entry points

- [backend/src/app.js](/d:/BTL_IT4409/backend/src/app.js:1): middleware, routes, swagger, error handling
- [backend/src/server.js](/d:/BTL_IT4409/backend/src/server.js:1): HTTP server, Socket.IO, database bootstrapping

### Layers

- `routes`: HTTP routing
- `controllers`: HTTP orchestration
- `services`: business logic
- `models`: MongoDB schema
- `middlewares`: auth + error handling
- `sockets`: realtime handlers
- `utils`: constants, jwt, validators, logger

## 4. API namespaces

Base path: `/api/v1`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh-token`
- `POST /auth/logout`
- `GET /auth/me`
- `PUT /auth/me`

### Rooms

- `POST /rooms`
- `GET /rooms/:roomCode`
- `POST /rooms/:roomCode/join`
- `GET /rooms/:roomCode/participants`
- `POST /rooms/:roomCode/approve/:userId`
- `POST /rooms/:roomCode/reject/:userId`
- `POST /rooms/:roomCode/kick/:userId`
- `PUT /rooms/:roomCode/end`

### Attendance

- `POST /attendance/face-embeddings`
- `POST /attendance/:roomCode/check-in`
- `POST /attendance/:roomCode/check-out`
- `GET /attendance/:roomCode/stats`
- `GET /attendance/history`

### History

- `GET /history/rooms`
- `GET /history/rooms/:roomCode/messages`
- `GET /history/rooms/:roomCode/events`
- `GET /history/rooms/:roomCode/stats`

## 5. Chuẩn payload

### Auth response

`register` và `login` trả:

```json
{
  "success": true,
  "user": {
    "_id": "string",
    "full_name": "string",
    "email": "string"
  },
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

### Create room request

Backend chấp nhận cả hai dạng để tương thích:

```json
{
  "title": "Sprint Review",
  "description": "Optional",
  "require_approval": false,
  "allow_chat": true,
  "max_participants": 100
}
```

hoặc:

```json
{
  "title": "Sprint Review",
  "description": "Optional",
  "settings": {
    "require_approval": false,
    "allow_chat": true,
    "max_participants": 100
  }
}
```

## 6. Socket contract

### Room events

- `room:join`
  - request: `{ roomCode }`
- `room:pending`
- `room:request_approval`
- `room:approve_user`
- `room:reject_user`
- `room:user_joined`
- `room:user_rejected`
- `room:user_left`

### WebRTC events

- `webrtc:offer`
  - request: `{ roomCode, to, offer }`
  - forward: `{ from, fromUserId, targetUserId, offer }`
- `webrtc:answer`
  - request: `{ roomCode, to, answer }`
  - forward: `{ from, fromUserId, targetUserId, answer }`
- `webrtc:ice_candidate`
  - request: `{ roomCode, to, candidate }`
  - forward: `{ from, fromUserId, targetUserId, candidate }`

### Chat events

- `chat:send`
- `chat:receive`
- `chat:history`

## 7. Các quyết định kỹ thuật quan trọng

### Auth socket

- Socket connection bắt buộc có JWT.
- `socket.userId` được set từ token sau khi verify.
- Mỗi socket được join vào room logic `user:{userId}` để server gửi tín hiệu point-to-point.

### Room lifecycle

- `waiting` khi mới tạo
- `active` khi có thành viên đã được join thực sự
- `ended` khi host kết thúc

### Chat persistence

- Tin nhắn realtime được lưu bằng `room_id` ObjectId.
- Không dùng `roomCode` để ghi trực tiếp vào collection `messages`.

### Validation

- Joi validate request body tại route layer.
- Middleware hiện ghi đè lại `req.body` bằng dữ liệu đã sanitize.

## 8. Bảo mật

- JWT cho HTTP và Socket.IO
- CORS whitelist qua `CORS_ORIGIN`
- `helmet()` cho security headers
- Validate input bằng Joi
- Không tin dữ liệu định danh user do client gửi lên cho socket
- Server tự lấy `userId` từ JWT và user profile từ DB

## 9. Logging và observability

- HTTP logging qua `pino-http`
- service/controller/socket log qua logger chung
- Swagger enable/disable bằng env

## 10. Biến môi trường

Backend dùng file mẫu [backend/.env.example](/d:/BTL_IT4409/backend/.env.example:1)

Biến tối thiểu:

- `PORT`
- `MONGODB_URI`
- `MONGODB_MEMORY`
- `REDIS_HOST` / `REDIS_PORT` hoặc `REDIS_URL`
- `REDIS_MEMORY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`

### Local verification mode

Backend hỗ trợ chạy local không cần MongoDB/Redis cài sẵn bằng:

- `MONGODB_MEMORY=true`
- `REDIS_MEMORY=true`

## 11. Quality gate tối thiểu

Trước khi merge:

```bash
cd backend
npm install
npm run lint
node --check src/server.js
```

## 12. Known gaps

- Chưa có automated test suite
- Chưa có TURN server config production
- Một số warning lint còn tồn tại
- `meeting-backend/` vẫn còn trong repo và có nguy cơ drift nếu tiếp tục sửa song song
