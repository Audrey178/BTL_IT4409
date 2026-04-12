# 🚀 Meeting Project - Backend

**Real-time Video Conference System with WebRTC, AI Attendance, and Chat**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)  
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [API Documentation](#api-documentation)
7. [Socket.IO Events](#socketio-events)
8. [Database Schema](#database-schema)
9. [Contributing](#contributing)

---

## 🎯 Overview

Meeting Project is an enterprise-grade backend system for real-time video conferencing with advanced features including:

- **Real-time Video/Audio**: WebRTC for P2P communication
- **AI Attendance**: Face recognition-based attendance tracking
- **Host Controls**: Waiting room, user approval, kick functionality
- **Chat & Messaging**: Realtime chat with persistent history
- **Audit Logging**: Complete event tracking and audit trails

---

## ✨ Features

### MVP (Must-have)
- ✅ User Authentication (JWT-based)
- ✅ Room Creation & Management
- ✅ WebRTC Audio/Video Streaming
- ✅ Realtime Chat
- ✅ Database Persistence
- ✅ Error Handling & Validation

### Advanced Features
- ✅ **AI Attendance**: Face embeddings + recognition
- ✅ **Host Control**: Waiting room & user approval
- ✅ **Attendance Reports**: Duration tracking & statistics
- ✅ **Audit Logging**: Complete event history
- ✅ **API Documentation**: Swagger/OpenAPI
- ✅ **Docker Support**: Containerization ready

---

## 🛠 Tech Stack

### Core
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Realtime**: Socket.IO
- **Language**: JavaScript (ES6 Modules)

### Databases
- **primary**: MongoDB (Persistent Data)
- **Cache**: Redis (Session/State)

### Authentication & Security
- **Auth**: JWT (Access + Refresh Tokens)
- **Hashing**: bcryptjs
- **Security Headers**: Helmet.js

### Utilities
- **Validation**: Joi
- **Logging**: Pino
- **Documentation**: Swagger/OpenAPI
- **Task ID**: UUID

### Development
- **Containerization**: Docker & Docker-Compose
- **Linting**: ESLint
- **Package Manager**: NPM

---

## 📁 Project Structure

```
meeting-backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── mongodb.js       # MongoDB connection
│   │   ├── redis.js         # Redis client
│   │   └── swagger.js       # Swagger/OpenAPI setup
│   │
│   ├── controllers/         # HTTP request handlers
│   │   ├── auth.controller.js
│   │   ├── room.controller.js
│   │   ├── attendance.controller.js
│   │   └── history.controller.js
│   │
│   ├── services/            # Business logic (core domain)
│   │   ├── auth.service.js
│   │   ├── room.service.js
│   │   ├── attendance.service.js
│   │   ├── chat.service.js
│   │   └── history.service.js
│   │
│   ├── models/              # MongoDB Schemas (Mongoose)
│   │   ├── User.js
│   │   ├── Room.js
│   │   ├── RoomMember.js
│   │   ├── Message.js
│   │   ├── AttendanceLog.js
│   │   ├── MeetingEvent.js
│   │   └── index.js
│   │
│   ├── routes/              # API Endpoints
│   │   ├── index.js
│   │   └── v1/
│   │       ├── auth.route.js
│   │       ├── room.route.js
│   │       ├── attendance.route.js
│   │       ├── history.route.js
│   │       └── index.js
│   │
│   ├── sockets/             # WebSocket handlers
│   │   ├── index.js         # Socket.IO initialization
│   │   ├── room.handler.js
│   │   ├── webrtc.handler.js
│   │   └── chat.handler.js
│   │
│   ├── middlewares/         # Express middlewares
│   │   ├── auth.js          # JWT authentication
│   │   ├── errorHandler.js  # Global error handling
│   │   └── index.js
│   │
│   ├── utils/               # Utility modules
│   │   ├── constants.js     # Constants & enums
│   │   ├── logger.js        # Pino logger
│   │   ├── jwt.js           # JWT utilities
│   │   ├── validators.js    # Joi validation schemas
│   │   ├── helpers.js       # Helper functions
│   │   └── index.js
│   │
│   ├── app.js               # Express app setup
│   └── server.js            # Entry point (HTTP + Socket.IO)
│
├── docker-compose.yml       # Docker services (MongoDB, Redis)
├── Dockerfile               # Backend container
├── package.json            # npm dependencies
├── .env.example            # Environment variables template
└── README.md               # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- NPM 9+
- MongoDB 5+
- Redis 6+
- Docker & Docker-Compose (optional)

### Installation

1. **Clone Repository**
   ```bash
   git clone <repository>
   cd meeting-backend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Databases (Docker)**
   ```bash
   docker-compose up -d
   ```

5. **Start Server**
   ```bash
   # Development (watch mode)
   npm run dev

   # Production
   npm start
   ```

6. **Access APIs**
   - API Base: `http://localhost:3000/api`
   - Swagger Docs: `http://localhost:3000/api-docs`
   - Health Check: `http://localhost:3000/health`

---

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All protected endpoints require JWT token in `Authorization` header:
```
Authorization: Bearer <access_token>
```

### Endpoints

#### Auth
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh-token` - Refresh access token
- `GET /auth/me` - Get profile
- `PUT /auth/me` - Update profile
- `POST /auth/logout` - Logout

#### Rooms
- `POST /rooms` - Create room
- `GET /rooms/:roomCode` - Get room info
- `POST /rooms/:roomCode/join` - Join room
- `POST /rooms/:roomCode/approve/:userId` - Approve user (host)
- `POST /rooms/:roomCode/reject/:userId` - Reject user (host)
- `POST /rooms/:roomCode/kick/:userId` - Kick user (host)
- `PUT /rooms/:roomCode/end` - End room (host)
- `GET /rooms/:roomCode/participants` - Get participants

#### Attendance
- `POST /attendance/face-embeddings` - Upload face data
- `POST /attendance/:roomCode/check-in` - User check-in
- `POST /attendance/:roomCode/check-out` - User check-out
- `GET /attendance/:roomCode/stats` - Get attendance stats (host)
- `GET /attendance/history` - Get user attendance history

#### History
- `GET /history/rooms` - Get user's room history
- `GET /history/rooms/:roomCode/messages` - Get chat history
- `GET /history/rooms/:roomCode/events` - Get audit log (host)
- `GET /history/rooms/:roomCode/stats` - Get room statistics (host)

**Full documentation**: Visit `/api-docs` for interactive Swagger UI

---

## 🔌 Socket.IO Events

### Room Events
| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `room:join` | C→S | `{userId, roomCode}` | Request to join room |
| `room:user_joined` | S→C | `{userId, username}` | User joined broadcast |
| `room:user_left` | S→C | `{userId}` | User left broadcast |
| `room:approve_user` | C→S | `{roomCode, userId}` | Host approves user |
| `room:reject_user` | C→S | `{roomCode, userId}` | Host rejects user |
| `room:kick_user` | C→S | `{roomCode, userId}` | Host kicks user |

### WebRTC Events
| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `webrtc:offer` | C→S→C | `{roomCode, target, offer}` | SDP offer exchange |
| `webrtc:answer` | C→S→C | `{roomCode, target, answer}` | SDP answer exchange |
| `webrtc:ice_candidate` | C→S→C | `{roomCode, target, candidate}` | ICE candidate exchange |

### Chat Events
| Event | Direction | Data | Purpose |
|-------|-----------|------|---------|
| `chat:send` | C→S | `{roomCode, content, type}` | Send message |
| `chat:receive` | S→C | `{senderId, content, timestamp}` | Receive message |
| `chat:history` | C→S→C | `{roomCode, page, limit}` | Fetch history |

---

## 🗄️ Database Schema

### Collections (6 total)

**1. users**
- Stores user accounts, credentials, face embeddings
- Indexes: email (UNIQUE), created_at

**2. rooms**
- Meeting room metadata and settings
- Indexes: room_code (UNIQUE), status, host_id+created_at

**3. room_members**
- Tracks user participation and status
- Compound index: (room_id, user_id) UNIQUE

**4. messages**
- Chat messages with denormalization
- Denormalized: sender_name, sender_avatar
- Indexes: (room_id, timestamp), TTL (180 days)

**5. attendance_logs**
- User check-in/check-out records
- Virtual: duration calculation
- Indexes: (room_id, created_at), (user_id, room_id)

**6. meeting_events**
- Audit trail of all room events
- Events: room_created, user_joined, user_kicked, etc.
- Indexes: (room_id, created_at), TTL (1 year)

**Full Schema**: See [DATABASE_DESIGN_VI.md](./DATABASE_DESIGN_VI.md)

---

## 🏗️ Architecture

### Layered Architecture
```
┌─────────────────────────────┐
│  Routes (API Endpoints)     │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Middlewares (Auth, Validate)│
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Controllers (HTTP Handlers) │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Services (Business Logic)   │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Models (DB Access - Mongoose)│
├────────────────────────────┤
│ MongoDB (Persistent)        │
│ Redis (Cache/Session)       │
└────────────────────────────┘
```

### Design Patterns
- **MVC**: Models, Views (API responses), Controllers
- **Service Layer**: Separation of business logic
- **Repository Pattern**: Data access abstraction
- **Event-Driven**: Socket.IO for realtime communication
- **Error Handling**: Global middleware + try-catch

---

## 🔒 Security Features

- ✅ **JWT Authentication**: Stateless, token-based auth
- ✅ **Password Hashing**: bcryptjs (10 rounds)
- ✅ **Input Validation**: Joi schemas on all endpoints
- ✅ **CORS Protection**: Configurable origins
- ✅ **Security Headers**: Helmet.js middleware
- ✅ **Error Messages**: Sanitized responses (no stack traces in prod)
- ✅ **Refresh Tokens**: Separate token rotation mechanism

---

## 📊 Monitoring & Logging

**Logger**: Pino with HTTP integration
- Structured logging (JSON format)
- Log levels: debug, info, warn, error
- Request/response logging
- Performance metrics

**Configuration**:
```javascript
LOG_LEVEL=info  // debug, info, warn, error
```

---

## 🐳 Docker Deployment

### Development
```bash
docker-compose up -d
npm install
npm run dev
```

### Production
```bash
docker build -t meeting-backend:latest .
docker run -d --env-file .env meeting-backend:latest
```

---

## 📝 Contributing Guidelines

1. **Code Style**: Follow ESLint configuration
2. **Commits**: Descriptive messages (feat, fix, docs, etc.)
3. **Testing**: All features must have unit tests
4. **Code Review**: All PR must be reviewed
5. **Documentation**: Update README for new features

---

## 📄 License

MIT License - See LICENSE file

---

## 👥 Team

- Meeting Team - Backend Development
- Timezone: UTC+7 (Vietnam)

---

## 📞 Support

- **Issues**: Create GitHub issues for bugs
- **Discussions**: GitHub discussions for feature requests
- **Email**: team@meetingproject.local

---

**Last Updated**: April 2026  
**Version**: 1.0.0
