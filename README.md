# IT4409 Meeting Platform

Nền tảng họp trực tuyến realtime gồm:

- `frontend/`: React 19 + Vite + TypeScript + Zustand + Socket.IO client.
- `backend/`: Express + MongoDB + Redis + Socket.IO + Swagger.
- `meeting-backend/`: snapshot cũ của backend, không nên dùng làm source chính.

Repo hiện dùng `backend/` làm backend canonical. Frontend và tài liệu dưới đây đã được đồng bộ theo cấu trúc này.

## 1. Trạng thái hiện tại

Các hạng mục đã được rà và chỉnh:

- Chuẩn hóa contract auth giữa frontend và backend.
- Chuẩn hóa room creation để frontend gửi cấu hình phòng theo payload thực tế.
- Sửa mismatch socket/WebRTC payload giữa client và server.
- Sửa lưu chat realtime để dùng đúng `room_id` ObjectId thay vì `roomCode`.
- Bổ sung `frontend/.env.example`.
- Bổ sung ESLint baseline cho backend để `npm run lint` chạy được.
- Cập nhật lại tài liệu đặc tả theo trạng thái source code hiện tại.

Các hạng mục vẫn còn là scope tiếp theo nếu muốn production-grade hoàn chỉnh:

- Tự động test end-to-end.
- TURN server thật cho WebRTC production.
- CI pipeline.
- token refresh persistence / blacklist khi logout.
- tách `meeting-backend/` ra khỏi repo hoặc archive rõ ràng.

## 2. Kiến trúc

### Frontend

- Router: `react-router-dom`
- State:
  - `useAuthStore`: phiên đăng nhập
  - `meetingStore`: participant, waiting list, chat
  - `mediaStore`: local media state
- HTTP client: [frontend/src/lib/axios.ts](/d:/BTL_IT4409/frontend/src/lib/axios.ts:1)
- Socket client: [frontend/src/socket/socket.ts](/d:/BTL_IT4409/frontend/src/socket/socket.ts:1)
- WebRTC hook: [frontend/src/hooks/useWebRTC.ts](/d:/BTL_IT4409/frontend/src/hooks/useWebRTC.ts:1)

### Backend

- App bootstrap: [backend/src/app.js](/d:/BTL_IT4409/backend/src/app.js:1)
- HTTP server + Socket.IO: [backend/src/server.js](/d:/BTL_IT4409/backend/src/server.js:1)
- API routes: [backend/src/routes](/d:/BTL_IT4409/backend/src/routes:1)
- Services:
  - auth
  - room
  - attendance
  - history
- Socket handlers:
  - `room.handler.js`
  - `webrtc.handler.js`
  - `chat.handler.js`

### Data layer

- MongoDB cho dữ liệu bền vững.
- Redis cho state realtime và socket/user mapping.

## 3. Contract triển khai

### REST base URL

- Development mặc định: `http://localhost:3000/api/v1`
- Override bằng `VITE_API_BASE_URL`

### Socket URL

- Development mặc định: `http://localhost:3000`
- Override bằng `VITE_SOCKET_URL`

### Response format

Backend đang chuẩn hóa theo dạng:

```json
{
  "success": true,
  "message": "optional",
  "data": {}
}
```

Lưu ý: một số endpoint legacy vẫn trả object ở top-level như `user`, `room`, `rooms`, `messages`. Frontend hiện đã thêm lớp normalize cho auth và dùng trực tiếp các contract còn lại.

## 4. Chạy local

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run lint
npm run dev
```

Yêu cầu:

- MongoDB
- Redis

Hoặc bật memory-mode cho local verification:

- `MONGODB_MEMORY=true`
- `REDIS_MEMORY=true`

Health check:

- `GET http://localhost:3000/health`
- `GET http://localhost:3000/api/v1/health`

Swagger:

- `http://localhost:3000/api-docs`

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run lint
npm run build
npm run dev -- --port 3001
```

Khuyến nghị local:

- backend: `3000`
- frontend: `3001`

## 5. Xác minh đã chạy

Đã chạy trực tiếp trên repo hiện tại:

- `frontend/npm run lint`
- `frontend/npm run build`
- `backend/npm run lint`
- `node --check` cho các module backend chính

Kết quả:

- Frontend typecheck pass.
- Frontend production build pass.
- Backend lint pass với warning còn lại ở mức cleanup kỹ thuật.
- Backend syntax check pass.

## 6. Tài liệu đặc tả

- [DacTaBackEnd.md](/d:/BTL_IT4409/DacTaBackEnd.md:1): đặc tả backend, API, socket contract, bảo mật, vận hành.
- [DacTaDatabase.md](/d:/BTL_IT4409/DacTaDatabase.md:1): đặc tả MongoDB, Redis, index và data lifecycle.
- [FRONTEND_FIX_GUIDE.md](/d:/BTL_IT4409/FRONTEND_FIX_GUIDE.md:1): audit/fix guide của frontend trước đó.

## 7. Quy ước phát triển

- Chỉ dùng `backend/` làm source backend chính.
- Mọi base URL phải đi qua biến môi trường.
- Event names giữa frontend/backend phải bám theo `backend/src/utils/constants.js`.
- Không lưu `roomCode` vào các collection yêu cầu `ObjectId`.
- Payload từ backend dùng `snake_case`; frontend có thể normalize ở edge nếu cần hiển thị.
