# IT4409 Meeting Project

Nền tảng họp trực tuyến realtime gồm frontend React/Vite và backend Node.js/Express/Socket.IO, được tổ chức theo mô hình tách lớp và có bổ sung các tính năng như waiting room, chat realtime, lịch sử phòng họp, audit log, và AI attendance bằng face embeddings.

README này được viết từ việc quét toàn bộ mã nguồn hiện có trong repo, không dựa hoàn toàn vào các README con sẵn có. Mục tiêu là mô tả đúng trạng thái triển khai hiện tại, chỉ ra các giới hạn còn tồn tại, và cung cấp quy trình chạy dự án đủ rõ cho môi trường phát triển.

## Tổng quan

- `frontend/`: ứng dụng client React 19 + Vite + TypeScript + Zustand + Socket.IO Client.
- `backend/`: backend Express + MongoDB + Redis + Socket.IO + Swagger, là bản source sạch hơn để theo dõi.
- `meeting-backend/`: một bản backend gần như song song với `backend/`, đang chứa `node_modules/` và `.env`; có thể xem như working snapshot.
- `DacTaBackEnd.md`, `DacTaDatabase.md`: đặc tả kỹ thuật và thiết kế dữ liệu ở mức bài tập/môn học.

## Phạm vi chức năng

### Đã có trong mã nguồn

- Đăng ký, đăng nhập, lấy profile, cập nhật profile bằng JWT.
- Tạo phòng họp, join room, approve/reject user chờ duyệt, kick user, end room.
- Signaling WebRTC qua Socket.IO.
- Quản lý media local trên frontend bằng `getUserMedia`.
- Lưu chat history, attendance logs, room history, audit events vào MongoDB.
- Lưu trạng thái realtime cơ bản vào Redis.
- Swagger UI cho REST API.

### Đang ở trạng thái một phần hoặc chưa hoàn tất end-to-end

- Frontend có nhiều màn hình đẹp và đầy đủ flow UI, nhưng một phần dữ liệu vẫn hard-coded/demo.
- Chat UI ở `MeetingScreen` hiện đang hiển thị message mẫu, chưa nối hoàn toàn với store/socket flow.
- Logout backend chưa có token blacklist hoặc refresh-token persistence; hiện chủ yếu là client-side cleanup.
- Có script `lint`, nhưng backend chưa có file cấu hình ESLint; frontend cần cài dependencies trước khi chạy `tsc`.
- Repo chưa có test suite tự động thực thụ.

## Kiến trúc hệ thống

### Frontend

- React 19 + Vite 6 + TypeScript.
- State management bằng Zustand.
- Form validation bằng React Hook Form + Zod.
- Giao tiếp HTTP qua Axios.
- Giao tiếp realtime qua Socket.IO Client.
- WebRTC peer connection được xử lý trong `src/hooks/useWebRTC.ts`.

### Backend

- Express làm HTTP API.
- Socket.IO làm realtime gateway cho room, signaling và chat.
- MongoDB/Mongoose lưu dữ liệu bền vững.
- Redis lưu state realtime như room members, socket mapping, host mapping.
- Joi dùng cho validation.
- Pino dùng cho logging.
- Swagger dùng cho tài liệu API.

### Dữ liệu chính

- `users`
- `rooms`
- `room_members`
- `attendance_logs`
- `messages`
- `meeting_events`

## Cấu trúc repo

```text
BTL_IT4409/
├─ frontend/
│  ├─ src/
│  │  ├─ screens/             # Dashboard, lobby, meeting, auth, admin
│  │  ├─ hooks/               # useMedia, useSocket, useWebRTC
│  │  ├─ stores/              # auth, meeting, media
│  │  ├─ services/            # authService
│  │  ├─ socket/              # socket factory + event constants
│  │  └─ components/
│  ├─ package.json
│  └─ vite.config.ts
├─ backend/
│  ├─ src/
│  │  ├─ config/
│  │  ├─ controllers/
│  │  ├─ services/
│  │  ├─ models/
│  │  ├─ routes/v1/
│  │  ├─ sockets/
│  │  ├─ middlewares/
│  │  └─ utils/
│  ├─ docker-compose.yml
│  ├─ Dockerfile
│  └─ .env.example
├─ meeting-backend/           # Bản backend song song, gần trùng với backend/
├─ DacTaBackEnd.md
└─ DacTaDatabase.md
```

## Trạng thái repo hiện tại

### Điểm cần biết ngay

- Repo có hai thư mục backend gần như giống nhau. Với trạng thái hiện tại, nên chọn một thư mục làm canonical source để tránh drift.
- `frontend` mặc định chạy Vite ở port `3000`, trong khi backend cũng mặc định chạy ở `3000`. Đây là xung đột cấu hình thực tế.
- Frontend hiện hard-code backend URL/socket URL về `http://localhost:3000`, nên cách chạy hợp lý là giữ backend ở `3000` và chạy frontend ở một port khác, ví dụ `3001`.

### Khuyến nghị vận hành local

- Dùng `backend/` làm nguồn backend chính để phát triển.
- Chỉ dùng `meeting-backend/` nếu bạn cần đúng snapshot đang có `node_modules` và `.env`.
- Chạy backend ở `3000`.
- Chạy frontend ở `3001`.

## Yêu cầu môi trường

- Node.js `>= 18`
- npm `>= 8`
- Docker + Docker Compose
- MongoDB 7 và Redis 7 nếu không dùng Docker

## Quick Start

### 1. Khởi động backend

```bash
cd backend
cp .env.example .env
docker-compose up -d
npm install
npm run dev
```

Các endpoint chính:

- Health: `http://localhost:3000/health`
- API v1: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api-docs`

### 2. Khởi động frontend

```bash
cd frontend
npm install
npm run dev -- --port 3001
```

Frontend sẽ truy cập backend tại:

- REST base URL: `http://localhost:3000/api/v1`
- Socket URL: `http://localhost:3000`

## Biến môi trường

### Backend

File mẫu đã có tại [backend/.env.example](/d:/BTL_IT4409/backend/.env.example:1).

Các biến quan trọng:

- `PORT`
- `MONGODB_URI`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`
- `ENABLE_SWAGGER`

### Frontend

Frontend hiện chưa có `.env.example` riêng cho API URL/socket URL. Một biến có xuất hiện trong cấu hình Vite là `GEMINI_API_KEY`, nhưng mã ứng dụng hiện tại chưa sử dụng thực tế thư viện `@google/genai`.

## API và realtime

### REST groups

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh-token`
- `GET /api/v1/auth/me`
- `PUT /api/v1/auth/me`
- `POST /api/v1/rooms`
- `POST /api/v1/rooms/:roomCode/join`
- `POST /api/v1/rooms/:roomCode/approve/:userId`
- `POST /api/v1/rooms/:roomCode/reject/:userId`
- `POST /api/v1/rooms/:roomCode/kick/:userId`
- `PUT /api/v1/rooms/:roomCode/end`
- `GET /api/v1/attendance/:roomCode/stats`
- `GET /api/v1/history/rooms`
- `GET /api/v1/history/rooms/:roomCode/messages`
- `GET /api/v1/history/rooms/:roomCode/events`

### Socket events

- `room:join`
- `room:pending`
- `room:request_approval`
- `room:approve_user`
- `room:reject_user`
- `room:user_joined`
- `room:user_left`
- `webrtc:offer`
- `webrtc:answer`
- `webrtc:ice_candidate`
- `chat:send`
- `chat:receive`
- `chat:history`

## Frontend routes

- `/`
- `/admin`
- `/lobby`
- `/meeting/:id`
- `/signin`
- `/signup`

## Tài liệu trong repo

### Root

- [DacTaBackEnd.md](/d:/BTL_IT4409/DacTaBackEnd.md:1): đặc tả backend.
- [DacTaDatabase.md](/d:/BTL_IT4409/DacTaDatabase.md:1): thiết kế database và Redis.

### Backend docs

- [backend/ARCHITECTURE_GUIDE.md](/d:/BTL_IT4409/backend/ARCHITECTURE_GUIDE.md:1)
- [backend/DEPLOYMENT_GUIDE.md](/d:/BTL_IT4409/backend/DEPLOYMENT_GUIDE.md:1)
- [backend/IMPLEMENTATION_GUIDE.md](/d:/BTL_IT4409/backend/IMPLEMENTATION_GUIDE.md:1)
- [backend/FINAL_VERIFICATION_REPORT.md](/d:/BTL_IT4409/backend/FINAL_VERIFICATION_REPORT.md:1)

## Những vấn đề đã xác minh khi quét repo

- `meeting-backend/` và `backend/` gần như trùng nhau nhưng không đồng nhất hoàn toàn.
- `meeting-backend/package.json` khác `backend/package.json` ở dependency `pino-pretty`.
- `meeting-backend/src/app.js` import `httpLogger` từ middleware index, còn `backend/src/app.js` import từ logger.
- `frontend/package.json` có dependency cho `@google/genai`, `express`, `dotenv`, nhưng mã frontend hiện tại chưa phản ánh rõ nhu cầu dùng các gói này.
- `meeting-backend` có `node_modules/`; `backend` và `frontend` hiện chưa có.

## Kiểm tra đã chạy

Tôi đã thử các lệnh xác minh tối thiểu trên trạng thái repo hiện tại:

- `meeting-backend/npm run lint`: thất bại vì chưa có cấu hình ESLint trong project.
- `frontend/npm run lint`: thất bại vì chưa cài dependencies nên `tsc` chưa khả dụng.

Điều này có nghĩa README mới không nên tuyên bố repo đang ở trạng thái production-ready hoàn chỉnh.

## Hướng cải thiện nên làm tiếp

1. Hợp nhất `backend/` và `meeting-backend/` thành một nguồn duy nhất.
2. Chuẩn hóa port và đưa API URL/socket URL của frontend vào `.env`.
3. Hoàn thiện end-to-end cho chat, participant sync và waiting room trên frontend.
4. Thêm ESLint config, Prettier và test setup cho cả frontend/backend.
5. Thêm CI cơ bản: install, lint, typecheck, smoke test.
6. Thêm seed data hoặc script bootstrap để demo nhanh hơn.

## License

Repo hiện chưa có file `LICENSE` ở root. Nếu đây là đồ án học phần nội bộ, nên bổ sung license hoặc ghi rõ phạm vi sử dụng trong lần cập nhật tiếp theo.
