# Implementation Guide - Week 7 Backend Setup

## ✅ What's Already Done

This project setup includes:

1. **Complete Database Schema** (6 MongoDB Collections)
   - ✅ User model with bcrypt password hashing
   - ✅ Room model with status tracking
   - ✅ RoomMember model with compound indexes
   - ✅ AttendanceLog model with face embeddings support
   - ✅ Message model with denormalization (TTL index)
   - ✅ MeetingEvent model for audit logging (TTL index)

2. **MongoDB Connection**
   - ✅ Connection pooling configured
   - ✅ Error handling & reconnection logic
   - ✅ Docker container ready

3. **Redis Integration**
   - ✅ Connection with retry strategy
   - ✅ Ready for session/state management
   - ✅ Docker container ready

4. **Express Application**
   - ✅ CORS configured
   - ✅ Helmet security headers
   - ✅ Request/response logging (Pino)
   - ✅ Global error handling
   - ✅ 404 handler

5. **Authentication Middleware**
   - ✅ JWT token verification
   - ✅ User session checking
   - ✅ Optional auth for some routes

6. **Swagger/OpenAPI**
   - ✅ Auto-generated API documentation
   - ✅ Interactive UI at /api-docs
   - ✅ Schema definitions

7. **Socket.IO Foundation**
   - ✅ Basic setup & CORS
   - ✅ Connection handling structure

8. **Utilities & Helpers**
   - ✅ JWT token generation/verification
   - ✅ Input validation schemas (Joi)
   - ✅ Constants & enums
   - ✅ Logger setup
   - ✅ Helper functions

9. **Docker & DevOps**
   - ✅ docker-compose.yml for full stack
   - ✅ Dockerfile for production build
   - ✅ Health checks configured

---

## 🔄 What Needs Implementation (Week 8+)

### Phase 1: Controllers & Services (Week 8)

#### Your Responsibilities (Database):

1. **User Service** (`src/services/userService.js`)
   ```javascript
   // Methods needed:
   - createUser(email, password, fullName)
   - getUserById(userId)
   - getUserByEmail(email)
   - updateUserProfile(userId, data)
   - addFaceEmbedding(userId, descriptor)
   ```

2. **Room Service** (`src/services/roomService.js`)
   ```javascript
   // Methods needed:
   - createRoom(hostId, title, settings)
   - getRoomByCode(roomCode)
   - updateRoomStatus(roomCode, status)
   - endRoom(roomCode)
   ```

3. **Room Member Service** (`src/services/roomMemberService.js`)
   ```javascript
   // Methods needed:
   - addMember(roomId, userId, status)
   - updateMemberStatus(roomId, userId, status)
   - getMembersInRoom(roomCode)
   - calculateDuration(roomId, userId)
   ```

4. **Attendance Service** (`src/services/attendanceService.js`)
   ```javascript
   // Methods needed:
   - checkIn(roomCode, userId, method, confidence)
   - checkOut(roomCode, userId)
   - getAttendanceStat(roomCode)
   - saveFaceEmbedding(userId, descriptor)
   ```

5. **Message Service** (`src/services/messageService.js`)
   ```javascript
   // Methods needed:
   - saveMessage(roomId, senderId, content, type)
   - getMessageHistory(roomCode, page, limit)
   - deleteOldMessages(roomCode)
   ```

6. **Audit Service** (`src/services/auditService.js`)
   ```javascript
   // Methods needed:
   - logEvent(roomId, userId, eventType, description, metadata)
   - getAuditLog(roomCode)
   - getEventsByType(eventType)
   ```

#### Controllers to Create:
- `src/controllers/authController.js` → For friend
- `src/controllers/roomController.js`
- `src/controllers/attendanceController.js`
- `src/controllers/historyController.js`

### Phase 2: API Routes Implementation (Week 8-9)

Complete these route files:
- `src/routes/v1/auth.route.js` → Friend's part
- `src/routes/v1/room.route.js` → Wire services to HTTP
- `src/routes/v1/attendance.route.js` → Wire services
- `src/routes/v1/history.route.js` → Wire services

### Phase 3: Socket.IO Implementation (Week 8-9)

Implement handlers in `src/sockets/`:
- `room.handler.js` - Room join, approval, member list
- `webrtc.handler.js` - Peer signaling
- `chat.handler.js` - Message broadcasting
- `attendance.handler.js` - Real-time check-in

---

## 🚀 How to Start

### Step 1: Verify Setup
```bash
cd meeting-backend
npm install
docker-compose up -d
npm run dev
```

Should see:
```
✓ MongoDB connected successfully
✓ Redis connected successfully
✓ Socket.IO initialized
✓ Meeting Backend Server Started Successfully
```

### Step 2: Test Database Connection
```bash
# In another terminal
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-04-08T10:00:00.000Z",
  "environment": "development"
}
```

### Step 3: Create Your First Service
Create `src/services/userService.js`:

```javascript
import { User } from '../models/index.js';
import logger from '../utils/logger.js';

export class UserService {
  async createUser(email, passwordHash, fullName, avatar = null) {
    try {
      const user = new User({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        avatar,
      });
      await user.save();
      logger.info(`✓ User created: ${email}`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserById(userId) {
    return await User.findById(userId).select('-password_hash');
  }

  async getUserByEmail(email) {
    return await User.findOne({ email }).select('-password_hash');
  }

  async addFaceEmbedding(userId, descriptor) {
    return await User.findByIdAndUpdate(
      userId,
      { $push: { face_embeddings: { descriptor, created_at: new Date() } } },
      { new: true }
    );
  }
}

export default new UserService();
```

### Step 4: Example Controller
Create `src/controllers/roomController.js`:

```javascript
import { Room } from '../models/index.js';
import { generateRoomCode } from '../utils/helpers.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../utils/constants.js';
import logger from '../utils/logger.js';

export const createRoom = async (req, res, next) => {
  try {
    const { title, description, settings } = req.validated;
    const hostId = req.userId;

    const roomCode = generateRoomCode();
    const room = new Room({
      room_code: roomCode,
      host_id: hostId,
      title,
      description,
      settings: settings || {},
    });

    await room.save();
    logger.info(`✓ Room created: ${roomCode} by ${hostId}`);

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Room created successfully',
      data: room,
    });
  } catch (error) {
    next(error);
  }
};
```

---

## 📊 Redis State Management

Expected Redis keys during runtime:

```javascript
// Socket connection mapping
socket:{socketId} = { userId: "...", roomCode: "..." }

// Room members list
room:{roomCode}:members = [userId1, userId2, ...]

// Room host
room:{roomCode}:host = userId

// Room metadata (optional, for quick lookup)
room:{roomCode}:metadata = { title: "...", started_at: "..." }
```

Use `getRedisClient()` from utils to access:

```javascript
import { getRedisClient } from '../config/redis.js';

const redis = getRedisClient();

// Set value
await redis.set(`socket:${socketId}`, JSON.stringify({ userId, roomCode }));

// Get value
const data = await redis.get(`socket:${socketId}`);

// Add to set
await redis.sAdd(`room:${roomCode}:members`, userId);

// Get set members
const members = await redis.sMembers(`room:${roomCode}:members`);

// Delete key
await redis.del(`socket:${socketId}`);
```

---

## 🔐 Security Checklist

Before committing to GitHub:

- ✅ Never commit `.env` file (already in .gitignore)
- ✅ Use strong JWT secrets (min 32 chars)
- ✅ Hash passwords with bcryptjs (models already do this)
- ✅ Validate all user inputs (Joi schemas ready)
- ✅ Use HTTPS in production
- ✅ Set CORS_ORIGIN correctly
- ✅ Keep MongoDB credentials in .env
- ✅ Use connection pooling (configured)

---

## 📝 Commit Strategy

### Week 7 Base Commit
```bash
git add .
git commit -m "feat: Initialize Meeting Backend with database schema and project structure

- Create complete folder structure (12 directories)
- Implement 6 MongoDB models with optimized indexes
- Setup Express app with middleware stack
- Configure MongoDB and Redis connections
- Add Swagger/OpenAPI documentation
- Create JWT authentication middleware
- Setup Docker and docker-compose
- Add comprehensive logging with Pino
- Create validation schemas with Joi
- Implement error handling middleware
- Add CORS and security headers
- Create Socket.IO foundation
- Add Docker support (Dockerfile, docker-compose.yml)
- Create comprehensive README and setup guide

Services ready for Week 8 implementation:
- Database layer ✓
- Connection management ✓
- Authentication middleware ✓
- Error handling ✓
- API documentation ✓"
```

### Weekly Commits Pattern
```bash
# After implementing auth service
git commit -m "feat: Implement UserService with CRUD operations

- Create UserService for user management
- Implement createUser with password hashing
- Add getUserById and getUserByEmail
- Create addFaceEmbedding method
- Add proper error logging"

# After implementing auth controller
git commit -m "feat: Create auth controller and routes

- Implement AuthController
- Wire auth routes
- Add input validation
- Add Swagger documentation
- Test with Postman"
```

---

## 🧪 Testing Locally

### Test Endpoints with cURL

```bash
# Health check
curl http://localhost:3000/health

# Swagger docs
curl http://localhost:3000/api-docs

# Test MongoDB
curl -X GET http://localhost:3000/api/v1/health

# Test with Docker (if needed)
docker-compose exec mongo mongosh -u admin -p admin123 meeting_db --eval "db.users.countDocuments()"
docker-compose exec redis redis-cli ping
```

### Test in Postman
1. Import collection from API docs
2. Create `Authorization` environment variable with JWT token
3. Test each endpoint

---

## 📚 Additional Resources

### Database Indexing
Indexes are already configured, but understand them:
- Single field indexes for common queries
- Compound indexes for complex lookups
- TTL indexes for auto-cleanup

### Query Optimization
```javascript
// Good: Returns only needed fields
User.find().select('email full_name -_id')

// Good: Use indexes for filtering
Room.find({ status: 'active' }).sort({ created_at: -1 })

// Good: Populate related data
Room.findById(roomId).populate('host_id', 'full_name email')

// Bad: Heavy aggregation without indexes
Room.find().lean() // Use lean() for read-only queries
```

---

## ⚠️ Common Pitfalls

❌ Forgetting to hash passwords
✅ Models already do this with bcryptjs pre-hook

❌ Storing sensitive data in logs
✅ Use logger.debug() for sensitive info only

❌ Queries returning too much data
✅ Always use `.select()` to limit fields

❌ Not handling connection errors
✅ Try-catch and error middleware ready

❌ MongoDB connection string wrong
✅ Check MONGODB_URI in .env

---

## 🎯 Success Criteria for Week 7

- ✅ Code compiles without errors
- ✅ Docker services start successfully
- ✅ Database models load without issues
- ✅ API health check responds
- ✅ Swagger documentation displays
- ✅ All files committed to GitHub
- ✅ README is comprehensive
- ✅ Team can understand the structure

---

**Next: Week 8 - Start implementing services!** 🚀

*Questions? Review the README.md and DacTaBackEnd.md specification files.*
