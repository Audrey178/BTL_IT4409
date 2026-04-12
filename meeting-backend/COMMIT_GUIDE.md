# Commit Guide - Meeting Backend

This guide helps you properly commit your work to GitHub.

---

## 🎯 Initial Setup Commit (Week 7)

### Before Committing

1. **Verify everything works:**
   ```bash
   npm install
   docker-compose up -d
   npm run dev
   # Should see: "Meeting Backend Server Started Successfully"
   ```

2. **Stop the server:**
   ```bash
   # Ctrl+C in terminal
   # docker-compose down
   ```

3. **Create .env from template:**
   ```bash
   cp .env.example .env
   ```
   The `.env` file will NOT be committed (it's in .gitignore)

### Commit Command

```bash
cd meeting-backend

git init
git add .

git commit -m "feat: Initialize Meeting Backend with complete database schema

- Setup Express.js application with middleware stack
- Create 6 MongoDB models with optimized indexes:
  * User (with bcrypt password hashing)
  * Room (with status tracking)
  * RoomMember (with compound indexes)
  * AttendanceLog (with face embedding support)
  * Message (with TTL index for auto-cleanup)
  * MeetingEvent (audit logging with TTL)
- Configure MongoDB connection with pooling
- Setup Redis connection with retry strategy
- Implement JWT authentication middleware
- Create comprehensive error handling middleware
- Add Joi input validation schemas
- Setup Swagger/OpenAPI documentation
- Configure CORS and Helmet security
- Implement Pino logging system
- Create Socket.IO foundation
- Add Docker support:
  * Dockerfile for production builds
  * docker-compose.yml for full stack
- Implement utility helpers and constants
- Create comprehensive README with setup guide
- Add implementation guide for team

Database schema and configuration layer complete.
Ready for service/controller implementation in Week 8.

Closes #1
BREAKING CHANGE: Initial setup - no existing code to break"
```

### Commit Format Explanation

**Format:** `<type>(<scope>): <subject>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code reorganization
- `docs`: Documentation only
- `chore`: Build/config changes
- `style`: Code style (not breaking)

**Scope:** Component affected (optional)
**Subject:** What changed (imperative mood)

---

## 📅 Weekly Commit Pattern

### Week 8: Services Implementation

```bash
# After implementing UserService
git add src/services/userService.js
git commit -m "feat(services): Implement UserService with CRUD operations

- Create UserService class for user management
- Implement createUser with password hashing
- Add getUserById and getUserByEmail methods
- Create addFaceEmbedding for face recognition
- Add proper error logging and validation
- Handle MongoDB errors gracefully"

# After implementing RoomService
git add src/services/roomService.js
git commit -m "feat(services): Implement RoomService

- Create RoomService for room management
- Add createRoom with room code generation
- Implement getRoomByCode with eager loading
- Add updateRoomStatus for room state management
- Create endRoom with cleanup logic"

# After implementing Auth Controller
git add src/controllers/authController.js src/routes/v1/auth.route.js
git commit -m "feat(auth): Implement authentication controller

- Create AuthController with register and login methods
- Wire auth routes with validation
- Implement JWT token generation and verification
- Add password hashing with bcryptjs
- Create refresh token mechanism
- Add Swagger documentation for auth endpoints"
```

### Week 9: Room Management

```bash
git add src/services/roomMemberService.js src/controllers/roomController.js
git commit -m "feat(rooms): Implement room management and membership

- Create RoomMemberService for membership tracking
- Implement room creation with host designation
- Add member approval/rejection logic
- Create member list retrieval with Redis caching
- Implement room joining with status tracking
- Add proper transaction handling"
```

### Week 10: Attendance System

```bash
git add src/services/attendanceService.js
git commit -m "feat(attendance): Implement AI attendance system

- Create AttendanceService for check-in/check-out
- Implement face embedding storage
- Add check-in with confidence score
- Create check-out with duration calculation
- Implement attendance statistics retrieval
- Add support for both face recognition and manual methods"
```

---

## 🔄 Handling Multiple Changes

### Option 1: Single Commit (Small changes)
```bash
git add .
git commit -m "fix: Handle edge case in room member status update"
```

### Option 2: Multiple Commits (Large changes)
```bash
# First set of changes
git add src/services/userService.js
git commit -m "feat(services): Add UserService"

# Second set
git add src/controllers/userController.js
git commit -m "feat(controllers): Wire user endpoints"

# Third set
git add tests/user.test.js
git commit -m "test(user): Add unit tests for user service"
```

### Option 3: Staged Commits
```bash
# See what's changed
git status

# Stage specific files
git add src/services/
git commit -m "feat(services): Implement business logic layer"

git add src/controllers/
git commit -m "feat(controllers): Wire service layers to HTTP"

git add src/routes/
git commit -m "feat(routes): Register API endpoints"
```

---

## 🚀 Pushing to GitHub

### First Time Setup
```bash
# Add remote repository
git remote add origin https://github.com/yourusername/meeting-backend.git

# Verify remote
git remote -v

# Push initial commits
git push -u origin main
```

### Regular Pushes
```bash
# After committing changes
git push

# Push specific branch
git push origin week-8-implementation

# Force push (use carefully!)
git push --force-with-lease
```

---

## 🏷️ Version Tags

Create tags for milestones:

```bash
# After Week 7 (Database setup complete)
git tag -a v1.0.0-week7 -m "Week 7: Database schema and project structure"
git push origin v1.0.0-week7

# After Week 8 (Services complete)
git tag -a v1.0.0-week8 -m "Week 8: Services and controllers implementation"
git push origin v1.0.0-week8

# Production release
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0
```

---

## ✅ Pre-Commit Checklist

Before pushing, verify:

- [ ] Code compiles: `npm run lint` (if available)
- [ ] No console.log() left (use logger instead)
- [ ] No secrets in code (JWT secret in .env only)
- [ ] .env is in .gitignore (never commit!)
- [ ] MongoDB indexes are in models
- [ ] Error handling is complete
- [ ] Logging is appropriate
- [ ] Comments explain why, not what
- [ ] Related files are committed together
- [ ] Commit message is descriptive

---

## ❌ Common Mistakes to Avoid

### ❌ Committing .env or secrets
```bash
# WRONG - never do this!
git add .env
git commit -m "Add env file"
```

**Fix:** These files are in .gitignore already

### ❌ Vague commit messages
```bash
# WRONG
git commit -m "update"
git commit -m "fixed bugs"
git commit -m "changes"

# RIGHT
git commit -m "fix: Prevent race condition in room join logic"
git commit -m "refactor: Simplify attendance calculation logic"
```

### ❌ Committing node_modules
```bash
# WRONG
git add node_modules/

# CORRECT - already in .gitignore
```

### ❌ Large single commit
```bash
# WRONG - months of work in one commit
git commit -m "Implement everything"

# RIGHT - logical, smaller commits
git commit -m "feat: Implement room service"
git commit -m "feat: Add room controller"
git commit -m "feat: Wire room routes"
```

---

## 📖 Commit History Example

Good commit history should look like:

```
e3d5a8c fix: Handle concurrent check-in requests
b2f1e4a feat(attendance): Add AI confidence score storage
9c7d2e1 feat(attendance): Implement check-in/check-out logic
5a8f3c2 feat(services): Create AttendanceService
4b6g2d1 test: Add attendance service unit tests
3c5h1a0 feat(rooms): Implement room management
2b4i0z9 fix: Correct user service database query
1a3j9y8 feat: Initialize database models and schema
```

Each commit should be independently meaningful!

---

## 🔍 Reviewing Changes Before Commit

```bash
# See what's changed
git status

# See differences in detail
git diff

# See what will be staged
git diff --staged

# See last commit
git show HEAD

# See commit log
git log --oneline -10
```

---

## 🆘 Undo Mistakes

### Undo unstaged changes
```bash
git checkout -- filename.js
```

### Unstage a file
```bash
git reset HEAD filename.js
```

### Undo last commit (keep changes)
```bash
git reset --soft HEAD~1
```

### Fix last commit message
```bash
git commit --amend -m "new message"
```

### Revert a specific commit
```bash
git revert <commit-hash>
```

---

## 📋 Branch Strategy

For team collaboration:

```bash
# Main branch - stable, production-ready
main

# Development branch - for integration
develop

# Feature branches - per team member/feature
feature/user-service
feature/room-management
feature/attendance-ai

# Example workflow:
git checkout -b feature/user-service
# ... make changes ...
git add .
git commit -m "feat: Implement user service"
git push origin feature/user-service
# ... create Pull Request ...
git checkout main
git merge feature/user-service
```

---

## 📝 Git Configuration

Set your identity:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify
git config --global --list
```

---

## 🎓 Best Practices Summary

✅ **DO:**
- Write descriptive commit messages
- Commit logical groups of changes
- Commit frequently (daily)
- Review changes before committing
- Use branches for features
- Keep commits focused and small
- Tag important milestones

❌ **DON'T:**
- Commit secrets or .env files
- Use generic messages ("fix", "update")
- Mix unrelated changes
- Commit large files or node_modules
- Force push to main branch
- Commit commented-out code
- Commit console.log() or debug code

---

## 📞 Help & Questions

For Git help:
```bash
git help commit
git help push
git help log
```

Or online resources:
- Git Book: https://git-scm.com/book
- GitHub Docs: https://docs.github.com
- Atlassian Git Tutorial: https://www.atlassian.com/git

---

**Happy committing! 🎉**

*Remember: Good commits make good history, which helps your team understand what happened and why.*
