BẢN ĐẶC TẢ KỸ THUẬT BACKEND - MEETING PROJECT (IT4409)

I. TỔNG QUAN DỰ ÁN & CÔNG NGHỆ
1. Phạm vi tính năng (MVP & Nâng cao)
Hệ thống tập trung vào một luồng cốt lõi vững chắc, kèm theo các tính năng ăn điểm kỹ thuật:

Cơ bản (MVP): Đăng nhập/Đăng ký, Tạo/Tham gia phòng họp, Streaming Audio/Video realtime (WebRTC), Chat realtime.

Tính năng nâng cao (Ăn điểm tuyệt đối):

Điểm danh khuôn mặt (AI Attendance): FE trích xuất đặc trưng (TensorFlow.js), BE lưu trữ, đối sánh và ghi log thời lượng.

Host Control: Waiting room (duyệt người vào), Mute/Kick participant, Kết thúc phòng.

Audit Logging: Lưu vết toàn bộ sự kiện trong phòng (Ai vào, ra, bị kick lúc nào).

2. Stack Công nghệ Backend
Core: Node.js, Express.js.

Realtime Communication: Socket.IO (Signaling Server & Chat).

Database: * MongoDB (Mongoose): Lưu trữ dữ liệu lâu dài (Persistent Data).

Redis: Quản lý State/Session Realtime (In-memory Data Store) giúp hệ thống chạy mượt và dễ scale.

Bảo mật: JWT (Access & Refresh Token), bcrypt (Hash password).

Công cụ hỗ trợ (Ghi điểm chuyên nghiệp): Swagger (Tài liệu API), Docker & Docker-compose (Môi trường), Pino/Winston (Logging).

II. LỘ TRÌNH PHÁT TRIỂN (ROADMAP)
Tiến độ bám sát yêu cầu commit code hàng tuần từ Tuần 7:

Tuần 7: Khởi tạo project (Docker, folder structure), Auth API, DB Schema, cấu hình Swagger. (Bắt buộc có commit base project).

Tuần 8: Thiết lập Socket Server, logic Tạo/Join room, xây dựng luồng WebRTC Signaling.

Tuần 9: Phát triển Host Control (Waiting room, duyệt user, quản lý danh sách member online qua Redis).

Tuần 10: Tích hợp AI Attendance (API lưu mảng face_embeddings, ghi log check-in/check-out).

Tuần 11: Hoàn thiện Chat realtime, lưu lịch sử tin nhắn và ghi Audit event log.

Tuần 12: Deploy hệ thống (Render/Railway), test End-to-End (E2E) cùng Frontend, fix bug.

Tuần 13: Tối ưu code, xuất tài liệu Swagger, viết báo cáo kiến trúc và chốt bản Demo.

III. KIẾN TRÚC BACKEND (ARCHITECTURE)
Hệ thống hoạt động song song 2 luồng giao tiếp:

RESTful API (Stateless): Dùng để lấy/ghi dữ liệu tĩnh (Đăng nhập, thống kê, lấy lịch sử chat, upload khuôn mặt). Mọi request đều đi qua JWT Middleware.

WebSocket (Stateful): Dùng cho giao tiếp thời gian thực. Redis đóng vai trò là "Bộ nhớ đệm" để lưu trạng thái của Socket (Ai đang ở phòng nào) mà không cần liên tục query MongoDB.
IV. CẤU TRÚC THƯ MỤC (LAYERED ARCHITECTURE)
meeting-backend/
├── src/
│   ├── config/             # Cấu hình môi trường (mongodb.js, redis.js)
│   ├── controllers/        # Nhận HTTP request, gọi Service, trả Response (auth, room, face)
│   ├── services/           # Xử lý Business Logic (Query DB, tính toán)
│   ├── models/             # Schema Mongoose (users.model.js, rooms.model.js,...)
│   ├── routes/             # Định nghĩa API Endpoints
│   │   └── v1/             # Phiên bản API (auth.route.js, room.route.js, index.js)
│   ├── sockets/            # Logic xử lý Realtime
│   │   ├── index.js        # Gateway, middleware gắn user vào socket
│   │   ├── room.handler.js # Xử lý room:join, room:approve,...
│   │   ├── webrtc.handler.js # Xử lý webrtc:offer, webrtc:answer,...
│   │   └── chat.handler.js # Xử lý chat:send,...
│   ├── middlewares/        # JWT Auth, Error Handler, Validator
│   ├── utils/              # Helper functions, logger (Winston/Pino)
│   ├── app.js              # Khởi tạo Express, cấu hình middleware, Swagger
│   └── server.js           # Entry point: Chạy HTTP server & Socket.IO
├── package.json
├── docker-compose.yml      # Chạy MongoDB & Redis local
├── Dockerfile              # Build image
└── .env
V. THIẾT KẾ DATABASE (MONGODB SCHEMA)
Thiết kế tối ưu truy vấn (có đánh Index) và áp dụng Denormalization cho lịch sử Chat.

1. Collection users
{
  "_id": "ObjectId",
  "email": "String (Unique, Index)",
  "password_hash": "String",
  "full_name": "String",
  "avatar": "String",
  "face_embeddings": [{ 
    "descriptor": "Array<Number>", 
    "created_at": "Date"
  }],
  "role": "String (Enum: 'user', 'admin')",
  "created_at": "Date"
}
2. Collection rooms
{
  "_id": "ObjectId",
  "room_code": "String (Unique, Index)", 
  "host_id": "ObjectId (Ref: users)",
  "title": "String",
  "status": "String (Enum: 'waiting', 'active', 'ended')",
  "settings": {
    "require_approval": "Boolean",
    "allow_chat": "Boolean"
  },
  "started_at": "Date",
  "ended_at": "Date"
}
3. Collection room_members
{
  "_id": "ObjectId",
  "room_id": "ObjectId (Ref: rooms, Index)",
  "user_id": "ObjectId (Ref: users, Index)",
  "status": "String (Enum: 'pending', 'joined', 'rejected', 'kicked', 'left')",
  "joined_at": "Date",
  "left_at": "Date"
}
// Index: Compound { room_id: 1, user_id: 1 }
4. Collection attendance_logs
{
  "_id": "ObjectId",
  "room_id": "ObjectId (Ref: rooms, Index)",
  "user_id": "ObjectId (Ref: users, Index)",
  "confidence_score": "Number",
  "check_in_time": "Date",
  "check_out_time": "Date", // Khởi tạo null khi mới vào phòng, cập nhật khi rời
  "method": "String (Enum: 'face_recognition', 'manual')"
}
5. Collection messages
{
  "_id": "ObjectId",
  "room_id": "ObjectId (Ref: rooms, Index)",
  "sender_id": "ObjectId (Ref: users)",
  "sender_name": "String", 
  "sender_avatar": "String",
  "type": "String (Enum: 'text', 'system', 'file')",
  "content": "String",
  "timestamp": "Date (Index: -1)"
}
6. Collection meeting_events (Audit Logs)
{
  "_id": "ObjectId",
  "room_id": "ObjectId (Ref: rooms, Index)",
  "user_id": "ObjectId (Ref: users)",
  "event_type": "String (Enum: 'room_created', 'user_joined', 'user_left', 'user_kicked', 'room_ended')",
  "description": "String",
  "created_at": "Date (Index: 1)"
}
// Index: Compound { room_id: 1, created_at: -1 }
VI. THIẾT KẾ REDIS STATE (QUẢN LÝ REALTIME)
Redis lưu trữ trạng thái tạm thời để phục vụ logic Socket.IO siêu tốc, hỗ trợ debug và scale hệ thống:

Mapping SocketID -> UserID & RoomCode: Key: socket:{socketId} | Value: { userId, roomCode }. Việc lưu thêm roomCode ở đây cực kỳ quan trọng để debug khi hệ thống có nhiều phòng chạy song song.

Room Members (Danh sách online): Key: room:{roomCode}:members | Value: Set<userId>.

Room Host: Key: room:{roomCode}:host | Value: userId.

VII. DANH SÁCH API ENDPOINTS (RESTFUL)
Tiền tố chung: /api/v1. Các endpoint [Auth] yêu cầu JWT Token ở Header.

1. Nhóm Auth (Xác thực)
POST /auth/register: Đăng ký tài khoản.

POST /auth/login: Trả về access_token và refresh_token.

POST /auth/refresh-token: Cấp lại token mới.

POST /auth/logout [Auth]: Đăng xuất. Bắt buộc xử lý ở Backend: Xóa refresh token ở DB/Redis hoặc đưa token hiện tại vào blacklist để hủy quyền truy cập thực sự, không chỉ phụ thuộc vào việc FE tự xóa token ở localStorage/cookie.

2. Nhóm Rooms (Phòng họp)
POST /rooms [Auth]: Tạo phòng, trả về roomCode.

GET /rooms/:roomCode [Auth]: Lấy thông tin phòng (Chặn join nếu status là ended).

PUT /rooms/:roomCode/end [Auth]: Kết thúc phòng. Logic: Chỉ Host được gọi, cập nhật status Mongo, bắn Socket event ép mọi người thoát, dọn dẹp sạch sẽ State trong Redis.

3. Nhóm Attendance (Điểm danh AI)
POST /attendance/face-embeddings [Auth]: Nhận mảng Vector từ FE, push vào face_embeddings của User. Cho phép lưu nhiều mảng để tăng độ chính xác.

POST /attendance/:roomCode/check-in [Auth]: Bắn từ FE khi nhận diện thành công. Ghi log check_in_time (với check_out_time mặc định là null).

GET /attendance/:roomCode/stats [Auth]: Host lấy báo cáo điểm danh, tính tổng thời lượng từ check_in đến check_out.

4. Nhóm History / Chat (Lịch sử)
GET /history/rooms [Auth]: Danh sách phòng đã từng join/tạo.

GET /history/rooms/:roomCode/messages [Auth]: Lấy lịch sử chat (phân trang).

GET /history/rooms/:roomCode/events [Auth]: Lấy Audit Log của phòng.

VIII. THIẾT KẾ LUỒNG SỰ KIỆN SOCKET.IO
Quy ước Naming Convention chuẩn hóa toàn bộ dự án: [namespace]:[action_in_snake_case] để đảm bảo tính đồng nhất, dễ đọc, dễ debug.

1. Nhóm Room & Host Control (room:)
room:join: Client gửi yêu cầu vào phòng.

room:pending: Server phản hồi yêu cầu chờ ở Waiting Room.

room:request_approve: Server báo cho Host có người đợi.

room:approve_user / room:reject_user: Lệnh từ Host.

room:user_joined: Server broadcast cho phòng biết có người mới vào.

room:user_left: Server broadcast khi ai đó ngắt kết nối. Cập nhật check_out_time trong database.

room:kick_user: Lệnh Host đuổi người.

room:force_disconnect: Ép Client ngắt kết nối (khi bị kick hoặc phòng end).

2. Nhóm WebRTC Signaling (webrtc:)
webrtc:offer: Chuyển SDP Offer.

webrtc:answer: Chuyển SDP Answer.

webrtc:ice_candidate: Chuyển ICE Candidates.

3. Nhóm Tương tác (chat:)
chat:send: Gửi tin nhắn mới.

chat:receive: Nhận tin nhắn.

chat:system_alert: Broadcast thông báo hệ thống (VD: "Người A đã điểm danh thành công").

