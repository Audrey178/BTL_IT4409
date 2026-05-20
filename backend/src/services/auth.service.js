import { User } from '../models/index.js';
import { decodeToken, generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

class AuthService {
  getTokenBlacklistKey(type, token) {
    return `token:blacklist:${type}:${token}`;
  }

  getTokenTtlSeconds(token, fallbackSeconds) {
    const decoded = decodeToken(token);
    if (!decoded?.exp) return fallbackSeconds;

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    return ttl > 0 ? ttl : 1;
  }

  async isRefreshTokenBlacklisted(refreshToken) {
    try {
      const redis = getRedisClient();
      const blacklistEntry = await redis.get(this.getTokenBlacklistKey('refresh', refreshToken));
      const legacyEntry = await redis.get(`token:blacklist:${refreshToken}`);
      return Boolean(blacklistEntry || legacyEntry);
    } catch (error) {
      logger.warn('Refresh token blacklist check failed:', error.message);
      return false;
    }
  }

  async register(data) {
    try {
      const { email, password, full_name } = data;

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        const error = new Error(ERROR_MESSAGES.USER_EXISTS);
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      const user = new User({
        email: email.toLowerCase(),
        password_hash: password,
        full_name: full_name.trim(),
      });

      await user.save();
      logger.info(`User registered: ${user.email}`);

      const { accessToken, refreshToken } = generateTokens(user._id, user.email);

      return {
        success: true,
        user: user.toJSON(),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Register error:', error);
      throw error;
    }
  }

  async login(data) {
    try {
      const { email, password } = data;

      const user = await User.findOne({ email: email.toLowerCase() }).select('+password_hash');
      if (!user) {
        const error = new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        const error = new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      logger.info(`User logged in: ${user.email}`);

      const { accessToken, refreshToken } = generateTokens(user._id, user.email);

      return {
        success: true,
        user: user.toJSON(),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken) {
    try {
      const isBlacklisted = await this.isRefreshTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        const error = new Error('Token has been revoked');
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        const error = new Error(ERROR_MESSAGES.TOKEN_INVALID);
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      const tokens = generateTokens(user._id, user.email);
      logger.info(`Token refreshed for user: ${user.email}`);

      return {
        success: true,
        ...tokens,
      };
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw error;
    }
  }

  async logout(refreshToken, accessToken = null) {
    try {
      const redis = getRedisClient();
      const revokedAt = new Date().toISOString();
      const operations = [];

      if (accessToken) {
        operations.push(
          redis.setEx(
            this.getTokenBlacklistKey('access', accessToken),
            this.getTokenTtlSeconds(accessToken, 15 * 60),
            JSON.stringify({ revokedAt })
          )
        );
      }

      if (refreshToken) {
        const decoded = verifyRefreshToken(refreshToken);
        if (decoded) {
          operations.push(
            redis.setEx(
              this.getTokenBlacklistKey('refresh', refreshToken),
              this.getTokenTtlSeconds(refreshToken, 7 * 24 * 60 * 60),
              JSON.stringify({ userId: decoded.userId, revokedAt })
            )
          );
        } else {
          logger.warn('Logout called with invalid refresh token');
        }
      }

      if (operations.length > 0) {
        await Promise.all(operations);
      }

      logger.info('User logged out - provided tokens blacklisted');

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error) {
      logger.error('Logout error:', error);
      return { success: true, message: 'Logout processed' };
    }
  }

  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId).select('-password_hash');
      if (!user) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }
      return user.toJSON();
    } catch (error) {
      logger.error('Get user profile error:', error);
      throw error;
    }
  }

  async updateUserProfile(userId, updateData) {
    try {
      const allowedFields = ['full_name', 'avatar'];
      const updateObj = {};

      allowedFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          updateObj[field] = updateData[field];
        }
      });

      updateObj.updated_at = new Date();

      const user = await User.findByIdAndUpdate(userId, updateObj, {
        new: true,
        runValidators: true,
      });

      if (!user) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      logger.info(`User profile updated: ${user._id}`);
      return user.toJSON();
    } catch (error) {
      logger.error('Update user profile error:', error);
      throw error;
    }
  }
}

export default new AuthService();
