# 🏗️ Architecture & Best Practices

**Meeting Project Backend - Code Organization & Design Principles**

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Design Patterns](#design-patterns)
3. [Best Practices](#best-practices)
4. [Code Organization](#code-organization)
5. [Error Handling Strategy](#error-handling-strategy)
6. [Performance Optimization](#performance-optimization)
7. [Security Checklist](#security-checklist)

---

## Architecture Overview

### Layered Architecture (Clean Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    API Routes Layer                          │
│  (HTTP endpoints, request validation, routing)               │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Middleware Layer                                │
│  - Authentication (JWT verification)                         │
│  - Input Validation (Joi schemas)                            │
│  - Error Handling (try-catch, global handler)                │
│  - Logging & Monitoring                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│           Controller Layer                                    │
│  - Request/Response handling                                 │
│  - Parameter extraction                                      │
│  - Call service methods                                      │
│  - Return appropriate HTTP status codes                      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│            Service Layer (CRITICAL)                          │
│  - Business logic implementation                             │
│  - Data validation                                           │
│  - Complex calculations                                      │
│  - Database orchestration                                    │
│  - Event logging                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│             Model Layer (Data Access)                        │
│  - Mongoose schemas & models                                 │
│  - Database queries                                          │
│  - Relationships & indexes                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│           Persistence Layer (Databases)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MongoDB (Persistent Data - Users, Rooms, Messages) │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Redis (In-Memory Cache - Session, State)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Benefits of Layered Architecture
- ✅ **Separation of Concerns**: Each layer has single responsibility
- ✅ **Testability**: Easy to mock dependencies
- ✅ **Maintainability**: Clear organization and structure
- ✅ **Scalability**: Easy to add features without affecting other layers
- ✅ **Reusability**: Services can be used by multiple controllers

---

## Design Patterns

### 1. Service Layer Pattern
**Location**: `src/services/*.service.js`

Every domain (Auth, Room, Attendance, etc.) has a dedicated service.

```javascript
// ✅ GOOD: Service encapsulates business logic
class RoomService {
  async createRoom(hostId, data) {
    // Validate
    // Create room in DB
    // Log event
    // Cache in Redis
    // Return result
  }
}

// ❌ BAD: Business logic in controller
router.post('/', (req, res) => {
  // All logic here - hard to test, reuse, maintain
});
```

### 2. Repository Pattern
**Purpose**: Abstract database access

```javascript
// Services use models, never call DB directly
const room = await Room.findOne({ room_code: roomCode });

// Models handle all query complexity
// This allows switching DB without changing service code
```

### 3. Singleton Pattern
**Services are singletons**:

```javascript
// src/services/auth.service.js
class AuthService { ... }
export default new AuthService(); // Single instance

// Usage everywhere - efficient & consistent
import authService from './services/auth.service.js';
```

### 4. Factory Pattern
**Event logging**:

```javascript
// Service creates appropriate event type
await this.logEvent(roomId, userId, EVENT_TYPE.ROOM_CREATED, description);
```

### 5. Observer Pattern
**Socket.IO handlers**:

```javascript
// Events trigger actions across the system
socket.on('room:join', (data) => handleRoomJoin(socket, data));
socket.on('chat:send', (data) => handleChatSend(socket, data));
```

---

## Best Practices

### 1. Error Handling

#### ✅ DO's
```javascript
// Throw descriptive errors with proper status codes
try {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }
  return user;
} catch (error) {
  logger.error('Get user error:', error);
  throw error; // Controller catches and responds
}

// Global error handler deals with all errors
app.use(errorHandler);

// Never expose stack traces to client in production
```

#### ❌ DON'Ts
```javascript
// ❌ Silent failures
try { ... } catch (error) { }

// ❌ Generic error messages
throw new Error('Error');

// ❌ Exposing implementation details
res.500(error.message); // Shows stack trace
```

### 2. Validation

#### ✅ DO's
```javascript
// Validate at entry point (route level)
router.post('/rooms', 
  validate(roomValidation.create), // ← Middleware
  roomController.createRoom.bind(roomController)
);

// Validate data shape with Joi
const schema = Joi.object({
  title: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
});
```

#### ❌ DON'Ts
```javascript
// ❌ Validate inside controller/service
if (!data.title) { ... } // Repetitive and error-prone

// ❌ Trust client data
const room = new Room(req.body); // Unsafe!
```

### 3. Logging

#### ✅ DO's
```javascript
// Structured logging with context
logger.info('User registered', { userId, email, timestamp: new Date() });
logger.error('Database error', { query, error: error.message });
logger.debug('Function called with', { param1, param2 });

// Different levels for different purposes
LOG_LEVEL=debug  // Development
LOG_LEVEL=info   // Staging
LOG_LEVEL=error  // Production
```

#### ❌ DON'Ts
```javascript
// ❌ Console.log (no structured format)
console.log('User data:', userData);

// ❌ Inconsistent logging
if (error) logger.error(error);
if (!success) console.log('failed');
```

### 4. Async/Await

#### ✅ DO's
```javascript
async login(credentials) {
  try {
    const user = await User.findOne({ email });
    if (!user) throw new Error('Invalid credentials');
    
    const isValid = await user.comparePassword(password);
    if (!isValid) throw new Error('Invalid credentials');
    
    const tokens = generateTokens(user._id);
    return { user, ...tokens };
  } catch (error) {
    logger.error('Login error:', error);
    throw error;
  }
}
```

#### ❌ DON'Ts
```javascript
// ❌ Callback hell / Promise chaining
User.findOne().then().catch().then()...

// ❌ Not awaiting promises
const user = User.findOne(); // Returns Promise!
```

### 5. Constants & Enums

#### ✅ DO's
```javascript
// src/utils/constants.js - Single source of truth
export const ROOM_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  ENDED: 'ended',
};

export const HTTP_STATUS = { ...};

// Use everywhere
if (room.status === ROOM_STATUS.ENDED) { ... }
```

#### ❌ DON'Ts
```javascript
// ❌ Magic strings scattered everywhere
if (room.status === 'ended') { ... }
if (room.status === 'ENDED') { ... } // Different!
```

---

## Code Organization

### Module Structure

```javascript
// src/services/room.service.js

/**
 * ============================================================================
 * SERVICE: ROOM - Phòng họp
 * ============================================================================
 * 
 * Mục đích: Business logic cho quản lý phòng họp
 * Điểm vào: Controllers gọi service methods
 * Điểm ra: Returns objects hoặc throws errors
 * 
 * Tác giả: Team
 */

import { Room, RoomMember } from '../models/index.js';
import logger from '../utils/logger.js';

class RoomService {
  /**
   * Method documentation: What it does, params, returns
   */
  async createRoom(hostId, data) {
    // Implementation
  }
}

export default new RoomService();
```

### File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Controllers | `*.controller.js` | `auth.controller.js` |
| Services | `*.service.js` | `room.service.js` |
| Routes | `*.route.js` | `auth.route.js` |
| Models | `*.js` (PascalCase) | `User.js`, `Room.js` |
| Handlers | `*.handler.js` | `room.handler.js` |
| Utilities | As needed | `validators.js`, `helpers.js` |

---

## Error Handling Strategy

### Error Flow

```
Client Request
     ↓
Routes + Validators
     ↓ (validates input)
Controllers
     ↓ (catches error)
Services (throws errors)
     ↓
Database Layer
     ↓
Global Error Handler
     ↓
Response to Client
```

### Error Types

1. **Validation Errors** (400)
   ```javascript
   { 
     "success": false,
     "message": "Validation failed",
     "errors": [{ "field": "email", "message": "..." }]
   }
   ```

2. **Authentication Errors** (401)
   ```javascript
   { "success": false, "message": "Invalid token" }
   ```

3. **Authorization Errors** (403)
   ```javascript
   { "success": false, "message": "Forbidden" }
   ```

4. **Not Found Errors** (404)
   ```javascript
   { "success": false, "message": "Resource not found" }
   ```

5. **Server Errors** (500)
   ```javascript
   { "success": false, "message": "Internal server error" }
   ```

---

## Performance Optimization

### 1. Database

- ✅ Use indexes on frequently queried fields
- ✅ Denormalize data when appropriate (e.g., sender_name in messages)
- ✅ Use pagination for large result sets
- ✅ Lazy load relationships (use populate selectively)

```javascript
// ✅ Good: Only populate needed fields
const room = await Room.findById(id).populate('host_id', 'full_name email');

// ❌ Bad: Populate everything
const room = await Room.findById(id).populate('*');
```

### 2. Caching

- ✅ Use Redis for frequently accessed data
- ✅ Cache room member lists in Redis
- ✅ Set TTL on cache entries
- ✅ Invalidate cache on data changes

```javascript
// Store in Redis with 1-hour expiry
await redis.setEx(`room:${roomCode}:members`, 3600, JSON.stringify(members));
```

### 3. Query Optimization

- ✅ Select only needed fields
- ✅ Use `lean()` for read-only queries
- ✅ Use batch operations when possible
- ✅ Avoid N+1 queries

```javascript
// ✅ Good: Select only needed fields
const users = await User.find().select('email full_name');

// ✅ Good: Use lean() for read-only
const messages = await Message.find().lean();

// ❌ Bad: Get all fields, then filter
const allUsers = await User.find();
const filtered = allUsers.filter(u => u.active);
```

---

## Security Checklist

- [x] **Authentication**: JWT with access + refresh tokens
- [x] **Password Hashing**: bcryptjs with 10 rounds + salt
- [x] **Input Validation**: Joi schemas on all inputs
- [x] **SQL Injection**: Using Mongoose (Object DB, not SQL)
- [x] **CORS**: Configured with whitelist
- [x] **HTTPS**: Supported in production
- [x] **Rate Limiting**: Can be added with express-rate-limit
- [x] **XSS**: Automatic via framework (not eval, innerHTML)
- [x] **CSRF**: Stateless JWT auth (not vulnerable)
- [x] **Security Headers**: Helmet.js middleware
- [x] **Error Messages**: Sanitized (no stack traces in prod)
- [x] **Logging**: Audit trail for all major events
- [x] **Dependency Audits**: `npm audit` regularly

---

## Testing Strategy

### Unit Tests (Recommended)
```javascript
// src/services/__tests__/auth.service.test.js
describe('AuthService', () => {
  test('register creates user', async () => {
    // Mock User model
    // Call authService.register()
    // Assert result
  });
});
```

### Integration Tests
```javascript
// Tests full flow: Route → Controller → Service → Model
describe('POST /auth/register', () => {
  test('returns user and tokens', async () => {
    // Call endpoint
    // Verify database
    // Check tokens
  });
});
```

---

## Deployment Considerations

1. **Environment Variables**: Never commit secrets
2. **Database Migrations**: Plan schema changes carefully
3. **API Versioning**: Prepare for v2, v3, etc.
4. **Monitoring**: Setup error tracking (Sentry, etc.)
5. **Auto-scaling**: Design for horizontal scaling
6. **Backups**: Regular MongoDB backups
7. **CDN**: For static assets

---

**Document Version**: 1.0  
**Last Updated**: April 2026
