# 🎥 IT4409 Meeting Platform - Hệ thống Họp trực tuyến Realtime

Hệ thống họp trực tuyến thời gian thực (Real-time Video Conference System) được phát triển phục vụ môn học **IT4409**. Dự án tích hợp các công nghệ truyền thông WebRTC, cơ chế Signaling qua Socket.IO, quản lý phòng họp linh hoạt, lưu trữ Chat bền vững, thông báo đẩy FCM và hỗ trợ điểm danh qua AI face recognition.

Dự án sử dụng mô hình Monorepo chứa 2 thành phần chính:
- **Frontend** ([frontend/](file:///d:/BTL_IT4409-1/frontend)): Phát triển bằng React 19 + Vite + TypeScript + Zustand + TailwindCSS.
- **Backend** ([backend/](file:///d:/BTL_IT4409-1/backend)): Phát triển bằng Node.js (Express.js) + MongoDB + Redis + Socket.IO.

---

## 📋 Mục lục

1. [✨ Các tính năng chính](#-các-tính-năng-chính)
2. [🛠️ Stack công nghệ](#️-stack-công-nghệ)
3. [📦 Cấu trúc thư mục dự án](#-cấu-trúc-thư-mục-dự-án)
4. [🏗️ Kiến trúc & Luồng xử lý](#️-kiến-trúc--luồng-xử-lý)
5. [🗄️ Thiết kế Cơ sở dữ liệu (Database Spec)](#️-thiết-kế-cơ-sở-dữ-liệu-database-spec)
6. [🔌 Đặc tả Giao thức WebSocket (Socket.IO)](#-đặc-tả-giao-thức-websocket-socketio)
7. [📝 Danh sách API RESTful (Endpoints)](#-danh-sách-api-restful-endpoints)
8. [🚀 Hướng dẫn Cài đặt & Khởi chạy (Local Setup)](#-hướng-dẫn-cài-đặt--khởi-chạy-local-setup)
9. [🔐 Bảo mật & Tối ưu hóa](#-bảo-mật--tối-ưu-hóa)
10. [🐳 Triển khai Production](#-triển-khai-production)

---

## ✨ Các tính năng chính

- **Xác thực người dùng (Authentication)**: Đăng nhập/Đăng ký tài khoản, Đăng nhập qua Google (OAuth2), cơ chế JWT tự động làm mới qua Refresh Token (Access Token 15 phút, Refresh Token 7 ngày).
- **Quản lý phòng họp (Room Management)**: Tạo phòng họp ngẫu nhiên hoặc đặt tiêu đề, phê duyệt thành viên chờ tham gia (Waiting Room), mời thành viên tham gia phòng họp, kick thành viên, chuyển quyền Host phòng họp.
- **Đàm thoại Realtime (Video/Audio Call)**: Kết nối đa người dùng thông qua WebRTC / LiveKit signaling, chuyển đổi bật/tắt camera, micro, chia sẻ màn hình (Screen Share).
- **Trò chuyện Realtime (Chat System)**: Nhắn tin trực tiếp (Direct Message - 1:1) hoặc nhắn tin nhóm trong phòng họp, gửi file đính kèm, sửa/xoá tin nhắn, bày tỏ cảm xúc (Reaction) và thống kê tin nhắn chưa đọc.
- **Điểm danh thông minh (AI Attendance)**: Tải lên Face Descriptor (vector đặc trưng khuôn mặt), Check-in/Check-out điểm danh trong phòng họp bằng nhận diện khuôn mặt và tính toán thời gian tham gia thực tế của từng người.
- **Quản lý quản trị (Admin Dashboard)**: Xem thống kê hệ thống, quản lý tài khoản người dùng, quản lý phòng họp đang hoạt động (Active Meetings) và cưỡng chế kết thúc phòng.
- **Ghi nhật ký sự kiện (Audit Log)**: Theo dõi toàn bộ vòng đời của phòng họp (tạo phòng, join, left, kick, end) phục vụ mục đích kiểm toán.

---

## 🛠️ Stack công nghệ

### 1. Backend Layer
- **Runtime**: Node.js v18+
- **Framework**: Express.js v4
- **Real-time Engine**: Socket.IO v4
- **Database (Persistent)**: MongoDB + Mongoose ORM
- **Cache & Real-time State**: Redis (để quản lý mapping Socket và session của người dùng)
- **Validation**: Joi (kiểm tra định dạng request body ở lớp route)
- **Logging**: Pino / Pino-HTTP (ghi log có cấu trúc hiệu năng cao)
- **Security**: `bcryptjs` (băm mật khẩu), `helmet` (bảo vệ HTTP headers)
- **API Doc**: Swagger UI (OpenAPI v3)

### 2. Frontend Layer
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Routing**: `react-router-dom`
- **State Management**: Zustand
- **Real-time Client**: Socket.IO Client
- **HTTP Client**: Axios (có interceptors tự động đính kèm JWT và refresh token khi hết hạn)
- **Media Engine**: WebRTC / LiveKit Client SDK

---

## 📦 Cấu trúc thư mục dự án

```
BTL_IT4409/
├── backend/                    # ✅ PROJECT BACKEND
│   ├── src/
│   │   ├── config/             # Cấu hình DB, Redis, Swagger, Mailer
│   │   ├── controllers/        # Xử lý Request HTTP (auth, room, chat, history, livekit...)
│   │   ├── middlewares/        # Bộ lọc JWT auth, check quyền Admin, xử lý lỗi tập trung
│   │   ├── models/             # Mongoose schemas (12 collections)
│   │   ├── routes/             # Định tuyến API RESTful (/api/v1/...)
│   │   ├── services/           # Nghiệp vụ logic chính (auth, room, chat, history...)
│   │   ├── sockets/            # Socket.IO event handlers (room, chat, webrtc)
│   │   ├── utils/              # Tiện ích bổ trợ (logger, validators, constants)
│   │   ├── app.js              # Khởi tạo Express App & Middlewares
│   │   └── server.js           # Khởi chạy HTTP Server & Socket.IO
│   ├── .env.example            # Biến môi trường mẫu cho Backend
│   ├── Dockerfile              # Dockerfile build backend
│   └── docker-compose.yml      # Cấu hình container MongoDB & Redis
│
├── frontend/                   # ✅ PROJECT FRONTEND
│   ├── src/
│   │   ├── components/         # React components (Common UI, Dialogs, Auth)
│   │   ├── hooks/              # Custom React Hooks (useWebRTC, useChat, useSocket...)
│   │   ├── lib/                # Cấu hình Axios Client
│   │   ├── screens/            # Màn hình ứng dụng (Lobby, Meeting, Dashboard, Auth)
│   │   ├── services/           # Gọi API backend (roomService, chatService, authService...)
│   │   ├── socket/             # Khởi tạo socket client và định nghĩa event constants
│   │   ├── stores/             # Zustand stores (useAuthStore, meetingStore, mediaStore)
│   │   ├── types/              # Định nghĩa các Interfaces TypeScript
│   │   └── utils/              # Các hàm bổ trợ helper
│   ├── .env.example            # Biến môi trường mẫu cho Frontend
│   └── vite.config.ts          # Cấu hình Vite build
│
└── README.md                   # File tài liệu hướng dẫn chính (File này)
```

---

## 🏗️ Kiến trúc & Luồng xử lý

### 1. Kiến trúc phân lớp Backend (Layered Architecture)
Hệ thống Backend được thiết kế theo cấu trúc phân lớp rõ ràng nhằm nâng cao tính module hoá:
1. **HTTP/Socket Entry Points**: Nhận request từ Client qua Express Routes hoặc Socket.IO events.
2. **Middleware Layer**: Thực hiện các nhiệm vụ chung như xác thực JWT, kiểm tra quyền admin, validate cấu trúc body bằng Joi schema, hoặc bắt lỗi tập trung (Centralized Error Handler).
3. **Controller Layer**: Tiếp nhận dữ liệu đầu vào đã được validate, điều hướng gọi các Service nghiệp vụ tương ứng và định dạng lại dữ liệu trả về cho Client.
4. **Service Layer**: Nơi xử lý logic nghiệp vụ chính (Business Logic), tương tác với Database và tính toán thuật toán.
5. **Model Layer**: Định nghĩa cấu trúc các Collections trong MongoDB thông qua Mongoose Schemas.

```
Request ──> Route Validation (Joi) ──> Auth Middleware (JWT) ──> Controller ──> Service (Business) ──> DB/Cache ──> Response
```

### 2. Luồng kết nối WebRTC (Signaling Flow)
Quá trình thiết lập cuộc gọi realtime được xử lý thông qua giao thức truyền tin hiệu (Signaling) qua Socket.IO:
1. Client A phát hành một `webrtc:offer` chứa SDP của mình lên Socket server ở namespace `/webrtc`.
2. Socket server xác thực người gửi và chuyển tiếp `webrtc:offer` tới Client B thông qua Socket ID tương ứng được mapping trong Redis.
3. Client B nhận offer, thiết lập peer connection, tạo ra `webrtc:answer` chứa thông tin SDP phản hồi và gửi lại Socket server.
4. Socket server chuyển tiếp `webrtc:answer` về cho Client A.
5. Song song với đó, cả hai client trao đổi các ứng viên ICE (`webrtc:ice_candidate`) qua Socket server để dò tìm đường truyền mạng tối ưu nhất.

---

## 🗄️ Thiết kế Cơ sở dữ liệu (Database Spec)

### 1. Các Collection chính trong MongoDB

#### A. `users` (Thông tin tài khoản)
- `_id`: `ObjectId` (Primary Key)
- `email`: `String` (Unique, Indexed)
- `password_hash`: `String`
- `full_name`: `String`
- `avatar`: `String` (URL ảnh đại diện)
- `face_embeddings`: `Array` (Danh sách vector nhận diện mặt phục vụ điểm danh, tối đa 10 vector)
- `role`: `String` (`'user'` hoặc `'admin'`)
- `email_verified`: `Boolean` (Trạng thái xác thực email)

#### B. `rooms` (Phòng họp)
- `_id`: `ObjectId`
- `room_code`: `String` (Mã phòng độc nhất dạng chữ, Unique, Indexed)
- `host_id`: `ObjectId` (Liên kết tới `users._id`)
- `title`: `String` (Tiêu đề phòng họp)
- `description`: `String`
- `status`: `String` (`'waiting'` - đang chờ, `'active'` - đang họp, `'ended'` - đã kết thúc)
- `settings`: `Object`
  - `require_approval`: `Boolean` (Cần host duyệt mới được vào phòng)
  - `allow_chat`: `Boolean` (Cho phép chat trong phòng)
  - `max_participants`: `Number` (Số lượng người tham gia tối đa)
- `started_at`: `Date`
- `ended_at`: `Date`

#### C. `room_members` (Quan hệ thành viên trong phòng)
- `_id`: `ObjectId`
- `room_id`: `ObjectId` (Liên kết tới `rooms._id`)
- `user_id`: `ObjectId` (Liên kết tới `users._id`)
- `status`: `String` (`'pending'` - đang đợi duyệt, `'joined'` - đã tham gia, `'rejected'` - bị từ chối, `'kicked'` - bị kích, `'left'` - đã tự rời phòng)
- `joined_at`: `Date`
- `left_at`: `Date`
- `duration`: `Number` (Thời gian tham gia thực tế tính bằng giây)

#### D. `messages` (Tin nhắn)
- `_id`: `ObjectId`
- `room_id`: `ObjectId` (Chỉ định phòng họp nếu chat trong phòng)
- `conversation_id`: `ObjectId` (Chỉ định hội thoại nếu chat Direct Message 1:1)
- `sender_id`: `ObjectId` (Liên kết tới `users._id`)
- `sender_name`: `String` (Lưu phi chuẩn hoá để hiển thị nhanh)
- `type`: `String` (`'text'`, `'system'`, `'file'`)
- `content`: `String`
- `file_url`: `String` (Đường dẫn file đính kèm)
- `timestamp`: `Date` (Có cấu hình TTL 180 ngày để tự động dọn dẹp)

#### E. `meeting_events` (Nhật ký sự kiện phòng họp - Audit Log)
- `_id`: `ObjectId`
- `room_id`: `ObjectId`
- `user_id`: `ObjectId`
- `event_type`: `String` (`'room_created'`, `'user_joined'`, `'user_left'`, `'user_kicked'`, `'room_ended'`, `'user_approved'`, `'user_rejected'`)
- `description`: `String`
- `created_at`: `Date` (Có cấu hình TTL 1 năm)

### 2. Thiết kế Cấu trúc Key trong Redis
Hệ thống sử dụng Redis để lưu trạng thái kết nối thời gian thực cực kỳ nhanh chóng:
- `socket:{socketId}`: Lưu thông tin `{ userId, roomCode }` của kết nối socket đó.
- `user:{userId}:socket`: Lưu mapping ngược từ UserId sang SocketId hiện tại để tìm kiếm kênh kết nối gửi tin nhắn point-to-point.
- `room:{roomCode}:members`: Set chứa danh sách `userId` của các thành viên đang thực sự trực tuyến trong phòng họp.
- `room:{roomCode}:host`: Key lưu giữ `userId` của Host phòng họp đó để xác nhận quyền nhanh chóng không cần truy vấn MongoDB.

---

## 🔌 Đặc tả Giao thức WebSocket (Socket.IO)

Hệ thống realtime chia thành 3 namespaces chính phục vụ các nghiệp vụ riêng biệt:

### 1. Room Namespace (`/room`)
Quản lý trạng thái vào/ra phòng họp và phân quyền Host:
- `room:join` (Client gửi): Đăng ký tham gia phòng họp. Payload: `{ roomCode }`.
- `room:pending` (Server gửi): Báo cho Client biết yêu cầu tham gia đang chờ host duyệt.
- `room:request_approval` (Server gửi tới Host): Thông báo có thành viên mới đang xin duyệt vào phòng.
- `room:approve_user` (Host gửi): Đồng ý cho thành viên vào phòng. Payload: `{ roomCode, userId }`.
- `room:reject_user` (Host gửi): Từ chối không cho thành viên vào phòng. Payload: `{ roomCode, userId }`.
- `room:user_joined` (Server phát): Thông báo cho toàn bộ phòng họp biết có người mới đã tham gia phòng thành công.
- `room:user_left` (Server phát): Thông báo có thành viên đã rời phòng.
- `room:user_kicked` (Host gửi / Server phát): Kích thành viên ra khỏi phòng họp.
- `room:ended` (Host gửi / Server phát): Host kết thúc cuộc họp, toàn bộ thành viên bị ngắt kết nối.
- `room:invite` (Host gửi): Mời một user tham gia phòng.

### 2. WebRTC Namespace (`/webrtc`)
Truyền tín hiệu truyền thông đa phương tiện:
- `webrtc:offer` (Client gửi / Server forward): Gửi cấu hình luồng SDP Offer. Payload: `{ roomCode, to, offer }`.
- `webrtc:answer` (Client gửi / Server forward): Trả lời luồng SDP Answer. Payload: `{ roomCode, to, answer }`.
- `webrtc:ice_candidate` (Client gửi / Server forward): Gửi ứng cử viên đường truyền ICE. Payload: `{ roomCode, to, candidate }`.

### 3. Chat Namespace (`/chat`)
Xử lý các sự kiện trò chuyện thời gian thực:
- `chat:send` (Client gửi): Gửi tin nhắn. Payload: `{ roomCode, content }` hoặc `{ conversationId, content }`.
- `chat:receive` (Server phát): Phân phối tin nhắn mới đến các thành viên hợp lệ.
- `chat:history` (Server gửi): Trả về lịch sử tin nhắn của phòng họp/hội thoại khi client kết nối.
- `chat:typing` / `chat:typing_stop`: Trạng thái đang soạn thảo tin nhắn.

---

## 📝 Danh sách API RESTful (Endpoints)

Tất cả các API được ánh xạ dưới tiền tố (Prefix): `/api/v1`. Các endpoint yêu cầu đăng nhập cần đính kèm Header: `Authorization: Bearer <access_token>`.

### 1. Nhóm Xác thực (`/auth`)
| Method | Endpoint | Auth | Chi tiết |
| :--- | :--- | :---: | :--- |
| **POST** | `/auth/register` | ❌ | Đăng ký tài khoản mới (email, password, full_name) |
| **POST** | `/auth/login` | ❌ | Đăng nhập tài khoản, trả về cặp accessToken & refreshToken |
| **POST** | `/auth/refresh-token` | ❌ | Làm mới accessToken bằng refreshToken hợp lệ |
| **POST** | `/auth/logout` | ✔️ | Hủy phiên đăng nhập của người dùng |
| **GET** | `/auth/me` | ✔️ | Lấy thông tin chi tiết tài khoản hiện tại |
| **PUT** | `/auth/me` | ✔️ | Cập nhật thông tin cá nhân (tên, avatar...) |
| **GET** | `/auth/users/search` | ✔️ | Tìm kiếm danh sách người dùng theo email để mời họp |
| **POST** | `/auth/google` | ❌ | Đăng nhập bằng Google OAuth ID token |

### 2. Nhóm Quản lý Phòng họp (`/rooms`)
| Method | Endpoint | Auth | Chi tiết |
| :--- | :--- | :---: | :--- |
| **POST** | `/rooms` | ✔️ | Tạo phòng họp mới (có cấu hình duyệt, cho phép chat, tối đa người...) |
| **GET** | `/rooms` | ✔️ | Lấy toàn bộ danh sách phòng họp do user hiện tại tham gia/tạo |
| **GET** | `/rooms/:roomCode` | ✔️ | Xem thông tin chi tiết của một phòng họp theo mã |
| **POST** | `/rooms/:roomCode/join` | ✔️ | Gửi yêu cầu xin tham gia vào phòng họp |
| **POST** | `/rooms/:roomCode/approve/:userId`| ✔️ | Phê duyệt cho phép thành viên chờ được vào phòng (Host) |
| **POST** | `/rooms/:roomCode/reject/:userId` | ✔️ | Từ chối yêu cầu vào phòng của thành viên (Host) |
| **POST** | `/rooms/:roomCode/kick/:userId`   | ✔️ | Trục xuất thành viên ra khỏi phòng họp (Host) |
| **PUT** | `/rooms/:roomCode/transfer-host` | ✔️ | Chuyển quyền Host cho một thành viên khác trong phòng |
| **PUT** | `/rooms/:roomCode/end` | ✔️ | Kết thúc cuộc họp hiện tại (Host) |
| **DELETE**| `/rooms/:roomCode` | ✔️ | Xóa vĩnh viễn dữ liệu phòng họp khỏi hệ thống (Host) |
| **GET** | `/rooms/:roomCode/participants` | ✔️ | Lấy danh sách toàn bộ participants trong phòng họp |
| **POST** | `/rooms/:roomCode/invite` | ✔️ | Host gửi lời mời tham gia phòng họp đến một UserId khác |

### 3. Nhóm Tin nhắn & Hội thoại (`/chat`)
| Method | Endpoint | Auth | Chi tiết |
| :--- | :--- | :---: | :--- |
| **POST** | `/chat/conversations/direct` | ✔️ | Tạo hội thoại chat 1:1 trực tiếp với user khác |
| **GET** | `/chat/conversations` | ✔️ | Lấy danh sách tất cả các hội thoại chat của user hiện tại |
| **GET** | `/chat/conversations/:conversationId/messages` | ✔️ | Lấy lịch sử chat của hội thoại 1:1 (Phân trang) |
| **POST** | `/chat/uploads/chat` | ✔️ | Tải file đính kèm phục vụ tin nhắn chat (multipart/form-data) |
| **DELETE**| `/chat/messages/:messageId` | ✔️ | Xóa tin nhắn đã gửi (người gửi tin nhắn) |
| **PUT** | `/chat/messages/:messageId/reactions/:emoji` | ✔️ | Thêm cảm xúc (Like, Love, Haha...) vào tin nhắn |

### 4. Nhóm Lịch sử & Thống kê (`/history`)
| Method | Endpoint | Auth | Chi tiết |
| :--- | :--- | :---: | :--- |
| **GET** | `/history/rooms` | ✔️ | Xem lịch sử các phòng họp đã tham gia (Phân trang) |
| **GET** | `/history/rooms/:roomCode/messages` | ✔️ | Lấy toàn bộ lịch sử tin nhắn đã gửi trong phòng họp đó |
| **GET** | `/history/rooms/:roomCode/events` | ✔️ | Lấy toàn bộ nhật ký sự kiện của phòng họp đó |
| **GET** | `/history/rooms/:roomCode/stats` | ✔️ | Xem bảng thống kê số lượng thành viên, thời gian họp (Host) |

### 5. Nhóm Quản trị hệ thống (`/admin`)
*(Chỉ người dùng có thuộc tính `role: 'admin'` mới có quyền truy cập)*
| Method | Endpoint | Auth | Chi tiết |
| :--- | :--- | :---: | :--- |
| **GET** | `/admin/stats` | Admin | Lấy thông số thống kê tổng lượng users, rooms, messages toàn hệ thống |
| **GET** | `/admin/users` | Admin | Lấy danh sách toàn bộ người dùng trong hệ thống (Phân trang) |
| **POST** | `/admin/users` | Admin | Quản trị viên khởi tạo tài khoản người dùng mới trực tiếp |
| **PUT** | `/admin/users/:id` | Admin | Cập nhật thông tin chi tiết hoặc phân quyền cho người dùng |
| **DELETE**| `/admin/users/:id` | Admin | Xóa tài khoản người dùng khỏi cơ sở dữ liệu |
| **GET** | `/admin/meetings/active` | Admin | Danh sách các phòng họp đang hoạt động realtime |
| **DELETE**| `/admin/meetings/:roomCode` | Admin | Cưỡng chế ngắt kết nối và đóng phòng họp từ xa |

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy (Local Setup)

### 1. Chuẩn bị môi trường
- Đảm bảo máy tính đã cài đặt **Node.js v18** trở lên và **npm v8+**.
- Đã cài đặt **Docker** và **Docker Compose** (để khởi chạy MongoDB và Redis cực nhanh không cần cài đặt trực tiếp lên hệ điều hành).

### 2. Cài đặt Backend
Di chuyển vào thư mục backend và tiến hành cấu hình:
```bash
cd backend
npm install --legacy-peer-deps
cp .env.example .env
```
Thiết lập các biến môi trường chính trong file `.env` vừa tạo:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/meeting_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=your_super_long_access_secret_key_at_least_32_chars
JWT_REFRESH_SECRET=your_super_long_refresh_secret_key_at_least_32_chars
CORS_ORIGIN=http://localhost:3001
```

*Lưu ý*: Trong môi trường local, bạn có thể kích hoạt chế độ "trong bộ nhớ" để test nhanh không cần cài đặt MongoDB và Redis bằng cách thiết lập:
```env
MONGODB_MEMORY=true
REDIS_MEMORY=true
```

Khởi chạy MongoDB và Redis qua Docker:
```bash
docker-compose up -d
```
Chạy lệnh kiểm tra kết nối cơ sở dữ liệu:
```bash
npm run verify
```
Khởi động backend server ở chế độ phát triển:
```bash
npm run dev
# Server sẽ khởi chạy tại http://localhost:3000
# Giao diện Swagger API Documentation sẽ hoạt động tại http://localhost:3000/api-docs
```

### 3. Cài đặt Frontend
Mở một terminal mới, chuyển vào thư mục frontend và tiến hành cấu hình:
```bash
cd frontend
npm install
cp .env.example .env
```
Thiết lập các biến môi trường chính trong file `.env` của frontend:
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```
Khởi chạy frontend ở chế độ phát triển:
```bash
npm run dev -- --port 3001
# Frontend sẽ khởi chạy tại http://localhost:3001
```

---

## 🔐 Bảo mật & Tối ưu hóa

Hệ thống áp dụng các nguyên tắc thiết kế bảo mật nghiêm ngặt cấp doanh nghiệp:
- **Bảo vệ chống rò rỉ JWT**: Access token có thời gian hết hạn cực ngắn (15 phút) lưu trong bộ nhớ tạm thời của client. Refresh token được quản lý chặt chẽ hỗ trợ cơ chế thu hồi token cũ khi đăng xuất.
- **Xác thực kênh Socket.IO**: Mọi kết nối socket kết nối vào namespace đều phải truyền kèm token JWT ở cấu hình `auth`. Server tự động giải mã token lấy `userId` để thiết lập định danh, loại bỏ hoàn toàn rủi ro giả mạo thông tin client gửi.
- **Lớp bảo mật HTTP Headers**: Tích hợp module `helmet()` ở Express để ngăn chặn các kiểu tấn công khai thác trình duyệt phổ biến (XSS, Clickjacking, MIME sniffing).
- **Sanitize & Validate dữ liệu đầu vào**: Lớp middleware validation sử dụng thư viện `Joi` đảm bảo toàn bộ request body gửi lên đúng định dạng, lọc sạch các ký tự lạ tránh lỗi Injection trước khi đẩy xuống tầng Service.
- **Tối ưu hóa Truy vấn MongoDB**: Cấu hình các Compound Indexes `{ room_id: 1, user_id: 1 }` và các Single Index trên các cột tìm kiếm thường xuyên (`email`, `room_code`, `status`) đảm bảo thời gian truy vấn tối ưu khi dữ liệu tăng lớn.
- **Chính sách Tự động Hủy dữ liệu (Data Retention)**: Cấu hình chỉ mục TTL Index trên collection `messages` tự động xóa các tin nhắn chat cũ sau 180 ngày và `meeting_events` sau 1 năm để giảm tải dung lượng lưu trữ cho MongoDB.

---

## 🐳 Triển khai Production

Khi cấu hình triển khai hệ thống lên môi trường Production thực tế, hãy tuân thủ các quy tắc sau:

### 1. Thay đổi thiết lập biến môi trường
- Đặt `NODE_ENV=production`.
- Đảm bảo các JWT secrets được tạo mới ngẫu nhiên bằng thuật toán mã hoá mạnh và có độ dài tối thiểu 32 ký tự.
- Chỉ định chính xác tên miền frontend của bạn tại biến `CORS_ORIGIN` (Ví dụ: `CORS_ORIGIN=https://meeting.yourdomain.com`), tuyệt đối không dùng giá trị wildcard `*`.

### 2. Sử dụng Reverse Proxy
Khuyến nghị cài đặt một Reverse Proxy phía trước Backend Node.js của bạn (ví dụ như **Nginx** hoặc **Cloudflare**) để:
- Thực hiện mã hóa SSL/TLS (HTTPS) cho toàn bộ lưu lượng dữ liệu.
- Cấu hình cân bằng tải (Load Balancing) nếu scale nhiều instance backend chạy song song.
- Tận dụng cơ chế nén dữ liệu gzip để tăng tốc truyền tải và giảm băng thông mạng.

---

*Cập nhật lần cuối: 17/06/2026 bởi Meeting Team*
