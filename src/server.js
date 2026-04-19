import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js';
import { connectRedis, disconnectRedis, getRedisClient } from './config/redis.js';
import { initializeSocket } from './sockets/index.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Create HTTP server
const httpServer = http.createServer(app);

// Socket.IO Configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Store io instance in app for use in routes
app.locals.io = io;

let server = null;

const gracefulShutdown = async () => {
  logger.info('\n✓ Received shutdown signal, closing gracefully...');
  try {
    if (server) {
      server.close();
      logger.info('✓ HTTP server closed');
    }
    await disconnectMongoDB();
    await disconnectRedis();
    logger.info('✓ All connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Graceful shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const startServer = async () => {
  try {
    // Connect to databases
    logger.info('🔄 Connecting to MongoDB...');
    await connectMongoDB();

    logger.info('🔄 Connecting to Redis...');
    const redisClient = await connectRedis();

    // Initialize Socket.IO
    logger.info('🔄 Initializing Socket.IO...');
    initializeSocket(io, redisClient);

    // Start HTTP server
    server = httpServer.listen(PORT, HOST, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║     🚀 Meeting Backend Server Started Successfully        ║
╚════════════════════════════════════════════════════════════╝
  
  Server Info:
  ├─ URL: http://${HOST}:${PORT}
  ├─ API Docs: http://${HOST}:${PORT}/api-docs
  ├─ Health Check: http://${HOST}:${PORT}/health
  ├─ Environment: ${process.env.NODE_ENV || 'development'}
  ├─ Node Version: ${process.version}
  └─ Status: ✓ Ready

      `);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`✗ Port ${PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();

export default httpServer;
