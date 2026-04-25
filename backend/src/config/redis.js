import { createClient } from 'redis';
import pino from 'pino';

const logger = pino();

let redisClient = null;

/**
 * Connect to Redis with proper configuration and error handling
 * @returns {Promise<Object>} Redis client instance
 */
export const connectRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 
      `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error({ retries }, 'Redis reconnection failed after 10 attempts');
            return new Error('Max retries exceeded');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Error handler
    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis error');
    });

    // Ready handler
    redisClient.on('ready', () => {
      logger.info('✓ Redis client ready');
    });

    // Connect handler
    redisClient.on('connect', () => {
      logger.info('✓ Redis connected successfully');
    });

    // Disconnect handler
    redisClient.on('disconnect', () => {
      logger.warn('⚠ Redis disconnected');
    });

    // Reconnecting handler
    redisClient.on('reconnecting', () => {
      logger.info('🔄 Attempting to reconnect to Redis...');
    });

    await redisClient.connect();
    logger.info(`✓ Connected to Redis at ${redisUrl.split('//')[1].split('?')[0]}`);
    
    return redisClient;
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect Redis');
    process.exit(1);
  }
};

/**
 * Disconnect from Redis gracefully
 */
export const disconnectRedis = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('✓ Redis disconnected gracefully');
      redisClient = null;
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to disconnect Redis');
  }
};

/**
 * Get Redis client instance
 * @returns {Object} Redis client
 * @throws {Error} If Redis client not initialized
 */
export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis first.');
  }
  return redisClient;
};

/**
 * Utility: Set key-value with expiration (in seconds)
 */
export const setWithExpire = async (key, value, expiresIn = null) => {
  try {
    const client = getRedisClient();
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (expiresIn) {
      await client.setEx(key, expiresIn, stringValue);
    } else {
      await client.set(key, stringValue);
    }
  } catch (error) {
    logger.error({ err: error, key }, 'Error setting Redis key');
    throw error;
  }
};

/**
 * Utility: Get value from Redis
 */
export const getRedisValue = async (key) => {
  try {
    const client = getRedisClient();
    return await client.get(key);
  } catch (error) {
    logger.error({ err: error, key }, 'Error getting Redis key');
    throw error;
  }
};

/**
 * Utility: Delete key from Redis
 */
export const deleteRedisKey = async (key) => {
  try {
    const client = getRedisClient();
    return await client.del(key);
  } catch (error) {
    logger.error({ err: error, key }, 'Error deleting Redis key');
    throw error;
  }
};

/**
 * Utility: Add member to set
 */
export const addToSet = async (setKey, member) => {
  try {
    const client = getRedisClient();
    return await client.sAdd(setKey, member);
  } catch (error) {
    logger.error({ err: error, setKey }, 'Error adding to Redis set');
    throw error;
  }
};

/**
 * Utility: Remove member from set
 */
export const removeFromSet = async (setKey, member) => {
  try {
    const client = getRedisClient();
    return await client.sRem(setKey, member);
  } catch (error) {
    logger.error({ err: error, setKey }, 'Error removing from Redis set');
    throw error;
  }
};

/**
 * Utility: Get all members from set
 */
export const getSetMembers = async (setKey) => {
  try {
    const client = getRedisClient();
    return await client.sMembers(setKey);
  } catch (error) {
    logger.error({ err: error, setKey }, 'Error getting Redis set members');
    throw error;
  }
};

export default redisClient;
