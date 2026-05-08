/**
 * ============================================================================
 * CONTROLLER: AUTH - Xác thực
 * ============================================================================
 * 
 * Mục đích: Handle HTTP requests liên quan đến xác thực.
 * Lưu ý: Tất cả business logic nên ở Service layer, Controller chỉ:
 * - Validate request
 * - Call service
 * - Handle response/errors
 * 
 * Tác giả: Meeting Team
 */

import authService from '../services/auth.service.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  async register(req, res) {
    try {
      const result = await authService.register(req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      logger.error('Register controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  async login(req, res) {
    try {
      const result = await authService.login(req.body);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Login controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/auth/refresh-token
   */
  async refreshToken(req, res) {
    try {
      const result = await authService.refreshToken(req.body.refresh_token);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Refresh token controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  async getProfile(req, res) {
    try {
      const user = await authService.getUserProfile(req.userId);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        user,
      });
    } catch (error) {
      logger.error('Get profile controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * PUT /api/v1/auth/me
   */
  async updateProfile(req, res) {
    try {
      const user = await authService.updateUserProfile(req.userId, req.body);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        user,
      });
    } catch (error) {
      logger.error('Update profile controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req, res) {
    try {
      // Client handles token removal
      // Backend could implement token blacklist if needed
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout controller error:', error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new AuthController();
