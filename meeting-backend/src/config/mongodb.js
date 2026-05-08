import mongoose from 'mongoose';
import pino from 'pino';

const logger = pino();

export const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/meeting_db?authSource=admin';
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('✓ MongoDB connected successfully');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠ MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    logger.error('Failed to connect MongoDB:', error.message);
    process.exit(1);
  }
};

export const disconnectMongoDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('✓ MongoDB disconnected');
  } catch (error) {
    logger.error('Failed to disconnect MongoDB:', error.message);
  }
};

export default mongoose;
