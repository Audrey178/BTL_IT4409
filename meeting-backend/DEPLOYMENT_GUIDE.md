# 🚀 Deployment Guide - Meeting Backend

**Status**: Production Ready v1.0  
**Last Updated**: January 2024

---

## 📋 Pre-Deployment Checklist

### Environment & Dependencies
- [ ] Node.js 18+ installed on server
- [ ] Docker & Docker Compose available
- [ ] npm 8+ installed
- [ ] All dependencies installed locally: `npm install --legacy-peer-deps`
- [ ] No syntax errors: `node -c src/app.js && node -c src/server.js`

### Configuration
- [ ] Create production `.env` file with strong secrets
- [ ] JWT_ACCESS_SECRET: minimum 32 characters, randomly generated
- [ ] JWT_REFRESH_SECRET: minimum 32 characters, randomly generated
- [ ] MongoDB credentials updated in `MONGODB_URI`
- [ ] Redis credentials configured in `REDIS_URL`
- [ ] CORS_ORIGIN configured for production domain
- [ ] LOG_LEVEL set to 'info' (not 'debug')

### Database
- [ ] MongoDB instance provisioned and verified
- [ ] Backup strategy in place
- [ ] Indexes created on all collections
- [ ] TTL indexes working (messages, events)
- [ ] Connection string tested from server

### Security
- [ ] HTTPS/TLS certificate obtained
- [ ] Firewall rules configured for ports 3000 (API) and 3001 (Socket.IO)
- [ ] Database firewall configured (IP whitelist)
- [ ] Redis behind firewall (not exposed publicly)
- [ ] Secrets never in code repositories
- [ ] .env file not in git repository

### Monitoring
- [ ] Logging service configured (Winston, Datadog, NewRelic, etc.)
- [ ] Error tracking setup (Sentry, Rollbar, etc.)
- [ ] Uptime monitoring configured
- [ ] Performance monitoring enabled
- [ ] Alerting rules created

---

## 🔧 Local Deployment (Development)

### 1. Setup Development Environment
```bash
cd meeting-backend

# Install dependencies
npm install --legacy-peer-deps

# Create development env file
cp .env.example .env.development

# Edit with your settings
nano .env.development
```

### 2. Start Docker Services
```bash
# Start MongoDB and Redis
docker-compose up -d

# Verify containers running
docker-compose ps
# Expected output:
# - meeting-mongodb  (port 27017)
# - meeting-redis    (port 6379)
```

### 3. Run Development Server
```bash
npm run dev
# Server running on http://localhost:3000
# Swagger: http://localhost:3000/api-docs
```

### 4. Verify Installation
```bash
# Test API endpoint
curl http://localhost:3000/api/v1/auth/register

# Try Swagger UI
open http://localhost:3000/api-docs
```

---

## 🌐 Production Deployment (Heroku Example)

### 1. Prepare Application
```bash
# Ensure all tests pass
npm run verify

# Check for unused packages
npm prune

# Build production image (optional)
docker build -t meeting-backend:prod .
```

### 2. Setup Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create Heroku app
heroku create meeting-backend-prod

# Add MongoDB addon
heroku addons:create mongolab:sandbox --app meeting-backend-prod

# Add Redis addon
heroku addons:create heroku-redis:premium-0 --app meeting-backend-prod

# View created databases
heroku config --app meeting-backend-prod
```

### 3. Configure Environment
```bash
# Set production environment
heroku config:set NODE_ENV=production --app meeting-backend-prod

# Set JWT secrets (use strong random values)
heroku config:set JWT_ACCESS_SECRET=your_super_long_random_secret --app meeting-backend-prod
heroku config:set JWT_REFRESH_SECRET=another_super_long_random_secret --app meeting-backend-prod

# Set CORS origin (your frontend domain)
heroku config:set CORS_ORIGIN=https://yourdomain.com --app meeting-backend-prod

# Verify configuration
heroku config --app meeting-backend-prod
```

### 4. Deploy Application
```bash
# Add Heroku as remote
heroku git:remote --app meeting-backend-prod

# Deploy code
git push heroku main

# View logs
heroku logs --tail --app meeting-backend-prod

# Check app status
heroku ps --app meeting-backend-prod
```

### 5. Verify Deployment
```bash
# Test API
curl https://meeting-backend-prod.herokuapp.com/api/v1/auth/register

# View application logs
heroku logs --tail

# Scale dynos if needed
heroku ps:scale web=2 --app meeting-backend-prod
```

---

## ☁️ Production Deployment (AWS EC2)

### 1. Infrastructure Setup

**Create EC2 Instance**
```bash
# Requirements:
# - Ubuntu 22.04 LTS
# - t3.small or larger
# - 20GB storage
# - Security group: Allow 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

**Configure Security Group**
```
Inbound Rules:
- SSH (22): Your IP
- HTTP (80): 0.0.0.0/0
- HTTPS (443): 0.0.0.0/0

Outbound Rules:
- All traffic allowed
```

### 2. Install Dependencies on Server
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker
sudo apt install -y docker.io

# Install Docker Compose
sudo apt install -y docker-compose

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Verify installations
node --version
npm --version
docker --version
docker-compose --version
```

### 3. Deploy Application
```bash
# Clone repository
git clone https://github.com/your-repo/meeting-backend.git
cd meeting-backend

# Install dependencies
npm install --legacy-peer-deps

# Create production environment
cp .env.example .env
nano .env  # Edit with production values

# Start services with Docker
docker-compose -f docker-compose.yml up -d

# Verify services
docker-compose ps
```

### 4. Setup Nginx Reverse Proxy
```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/meeting-backend
```

**Nginx Configuration**:
```nginx
upstream meeting_backend {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (use certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        proxy_pass http://meeting_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://meeting_backend/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Enable Nginx**:
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/meeting-backend /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Setup SSL Certificate
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Create SSL certificate
sudo certbot certonly --nginx -d your-domain.com

# Auto-renewal (already enabled with Certbot)
sudo systemctl status snap.certbot.renew.timer
```

### 6. Setup Process Manager (PM2)
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start app with PM2
cd ~/meeting-backend
pm2 start src/server.js --name "meeting-backend"

# Configure startup
pm2 startup
pm2 save

# Monitor app
pm2 monit
pm2 logs meeting-backend
```

### 7. Verify Production Deployment
```bash
# Test API
curl https://your-domain.com/api/v1/auth/register

# Check SSL certificate
curl -I https://your-domain.com

# View application logs
pm2 logs meeting-backend

# Check server resources
free -h
df -h
top
```

---

## 📊 Production Monitoring

### Health Check Endpoint
```bash
# Add health check to Express
GET /health
Response: { status: 'ok', timestamp: '2024-01-15T10:30:00Z' }
```

### Key Metrics to Monitor
- **Response Time**: Target < 200ms
- **CPU Usage**: Alert if > 80% sustained
- **Memory Usage**: Alert if > 85% sustained
- **Database Connections**: Monitor pool utilization
- **Redis Operations**: Monitor hit rate and evictions
- **Error Rate**: Alert if > 1% of requests
- **Request Volume**: Track for scalability planning

### Production Logging
```bash
# View real-time logs
pm2 logs meeting-backend

# View logs from specific date
pm2 logs meeting-backend --lines 100

# Search logs
pm2 logs meeting-backend | grep "error"

# Export logs
pm2 save logs > app.log
```

### Common Issues in Production

**High Memory Usage**
```bash
# Check for memory leaks
pm2 stop meeting-backend
pm2 restart meeting-backend

# Monitor memory over time
pm2 monit

# Update Node.js to latest LTS
nvm install 18
nvm use 18
```

**Database Connection Failures**
```bash
# Check MongoDB connectivity
mongo "mongodb://user:pass@host:27017/db"

# Check Redis connectivity
redis-cli ping

# Verify firewall rules
sudo ufw status
```

**High CPU Usage**
```bash
# Check running processes
ps aux | grep node

# Profile with Node.js tools
node --prof src/server.js
node --prof-process isolate-*.log > processed.txt

# Scale horizontally
pm2 start src/server.js -i max  # Use all cores
```

---

## 🔄 Continuous Deployment (GitHub Actions Example)

**Create `.github/workflows/deploy.yml`**:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install --legacy-peer-deps
      
      - name: Run tests
        run: npm test
      
      - name: Check syntax
        run: |
          node -c src/app.js
          node -c src/server.js
      
      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.13.15
        with:
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
          heroku_app_name: "meeting-backend-prod"
          heroku_email: your-email@example.com
```

---

## 🔒 Security Hardening

### Before Going Live
1. **Rotate Secrets**
   ```bash
   # Generate new JWT secrets
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Enable Rate Limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   });
   app.use('/api/', limiter);
   ```

3. **Setup CORS Properly**
   ```javascript
   app.use(cors({
     origin: process.env.CORS_ORIGIN?.split(','),
     credentials: true
   }));
   ```

4. **Enable Helmet Security Headers**
   ```javascript
   app.use(helmet({
     contentSecurityPolicy: false
   }));
   ```

5. **Database Backups**
   ```bash
   # Setup automated MongoDB backups
   mongodump --uri "mongodb://..." --archive=backup.archive
   
   # Restore
   mongorestore --uri "mongodb://..." --archive=backup.archive
   ```

---

## 📈 Scaling Strategy

### Vertical Scaling (Single Server)
```bash
# Increase EC2 instance size
- t3.small → t3.medium → t3.large → etc.
- Requires server restart/redeployment
```

### Horizontal Scaling (Multiple Servers)
```bash
# Use Load Balancer (ALB/NLB on AWS)
1. Create target group
2. Launch multiple EC2 instances
3. Register instances with target group
4. Configure health checks
5. Deploy application to all instances
```

### Database Scaling
```bash
# MongoDB
- Implement sharding for horizontal scaling
- Use replica sets for high availability

# Redis
- Use Redis Cluster for horizontal scaling
- Implement Redis Sentinel for high availability
```

---

## 🆘 Rollback Procedure

```bash
# If deployment breaks, quickly rollback:

# 1. Stop current deployment
pm2 stop meeting-backend

# 2. Revert to previous version
git revert HEAD
git push origin main

# 3. Redeploy
git pull
npm install --legacy-peer-deps
pm2 start src/server.js --name "meeting-backend"

# 4. Verify health
curl https://your-domain.com/health
```

---

## ✅ Post-Deployment Verification

```bash
# 1. Test all API endpoints
npm run test:api

# 2. Load testing
npm run test:load

# 3. Security audit
npm run audit

# 4. Performance profiling
npm run profile

# 5. Check logs
tail -f /var/log/app.log
```

---

## 📞 Support Contacts

- **DevOps Team**: devops@example.com
- **Database Admin**: dba@example.com
- **Security Team**: security@example.com

**Deployment Status Page**: https://status.your-domain.com

---

**Last Deployed**: [Update when deployed]  
**Last Updated**: January 2024  
**Next Review**: [Quarterly]
