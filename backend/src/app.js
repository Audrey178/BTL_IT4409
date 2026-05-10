import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { errorHandler, notFoundHandler } from './middlewares/index.js';
import apiRoutes from './routes/index.js';
import { swaggerSpec } from './config/swagger.js';
import logger, { httpLogger } from './utils/logger.js';

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security & Compression Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS Configuration
const corsOptions = {
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body Parser Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded meeting assets (recordings/thumbnails)
app.use('/uploads', express.static(path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

// HTTP Logger Middleware
app.use(httpLogger);

// Request Logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health Check Route
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Swagger Documentation
if (process.env.ENABLE_SWAGGER !== 'false') {
  app.use(
    process.env.SWAGGER_PATH || '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  );
  logger.info(`✓ Swagger UI available at ${process.env.SWAGGER_PATH || '/api-docs'}`);
}

// API Routes
app.use('/api', apiRoutes);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

logger.info('✓ Express app configured');

export default app;
