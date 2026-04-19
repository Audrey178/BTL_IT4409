/**
 * ============================================================================
 * SERVICE: AUTH - Xác thực & Quản lý tài khoản
 * ============================================================================
 * 
 * Mục đích: Xử lý tất cả business logic liên quan đến xác thực:
 * - Đăng ký tài khoản
 * - Đăng nhập
 * - Refresh token
 * - Đăng xuất
 * 
 * Tác giả: Meeting Team
 */

import { User } from '../models/index.js';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../utils/constants.js';
import logger from '../utils/logger.js';

class AuthService {
  /**
   * Đăng ký tài khoản mới
   * @param {Object} data - { email, password, full_name }
   * @returns {Object} { user, accessToken, refreshToken }
   */
  async register(data) {
    try {
      const { email, password, full_name } = data;

      // Kiểm tra email tồn tại
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        const error = new Error(ERROR_MESSAGES.USER_EXISTS);
        error.statusCode = HTTP_STATUS.CONFLICT;
        throw error;
      }

      // Tạo user mới
      const user = new User({
        email: email.toLowerCase(),
        password_hash: password,
        full_name: full_name.trim(),
      });

      await user.save();
      logger.info(`✓ User registered: ${user.email}`);

      // Generate tokens
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

  /**
   * Đăng nhập
   * @param {Object} data - { email, password }
   * @returns {Object} { user, accessToken, refreshToken }
   */
  async login(data) {
    try {
      const { email, password } = data;

      // Tìm user
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password_hash');
      if (!user) {
        const error = new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      // Kiểm tra password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        const error = new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      logger.info(`✓ User logged in: ${user.email}`);

      // Generate tokens
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

  /**
   * Refresh access token
   * @param {String} refreshToken
   * @returns {Object} { accessToken, refreshToken }
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        const error = new Error(ERROR_MESSAGES.TOKEN_INVALID);
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      // Verify user still exists
      const user = await User.findById(decoded.userId);
      if (!user) {
        const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        error.statusCode = HTTP_STATUS.UNAUTHORIZED;
        throw error;
      }

      // Generate new tokens
      const tokens = generateTokens(user._id, user.email);
      logger.info(`✓ Token refreshed for user: ${user.email}`);

      return {
        success: true,
        ...tokens,
      };
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   * @param {String} userId
   * @returns {Object} User profile
   */
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

  /**
   * Update user profile
   * @param {String} userId
   * @param {Object} updateData
   * @returns {Object} Updated user
   */
  async updateUserProfile(userId, updateData) {
    try {
      const allowedFields = ['full_name', 'avatar'];
      const updateObj = {};

      allowedFields.forEach(field => {
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

      logger.info(`✓ User profile updated: ${user._id}`);
      return user.toJSON();
    } catch (error) {
      logger.error('Update user profile error:', error);
      throw error;
    }
  }
}

export default new AuthService();
