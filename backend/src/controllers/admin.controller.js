/**
 * ============================================================================
 * CONTROLLER: ADMIN - Quản lý hệ thống
 * ============================================================================
 *
 * Mục đích: Handle HTTP requests cho admin dashboard.
 *
 * Tác giả: Meeting Team
 */

import adminService from '../services/admin.service.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class AdminController {
  /**
   * GET /api/v1/admin/stats
   */
  async getStats(req, res) {
    try {
      const result = await adminService.getStats();
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Admin getStats controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/admin/users?page=1&limit=10&search=
   */
  async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';

      const result = await adminService.getAllUsers({ page, limit, search });
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Admin getAllUsers controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/admin/users/:id
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const result = await adminService.getUserById(id);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Admin getUserById controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/admin/meetings?status=active&page=1&limit=10&search=
   */
  async getAllMeetings(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || '';
      const search = req.query.search || '';

      const result = await adminService.getAllMeetings({ status, page, limit, search });
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Admin getAllMeetings controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/admin/meetings/active
   */
  async getActiveMeetings(req, res) {
    try {
      const result = await adminService.getActiveMeetings();
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Admin getActiveMeetings controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * DELETE /api/v1/admin/meetings/:roomCode
   */
  async forceDeleteMeeting(req, res) {
    try {
      const { roomCode } = req.params;
      const result = await adminService.forceDeleteMeeting(roomCode);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Admin forceDeleteMeeting controller error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new AdminController();
