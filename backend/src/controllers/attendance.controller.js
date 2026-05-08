/**
 * ============================================================================
 * CONTROLLER: ATTENDANCE - Điểm danh & AI Attendance
 * ============================================================================
 * 
 * Tác giả: Meeting Team
 */

import attendanceService from '../services/attendance.service.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class AttendanceController {
  /**
   * POST /api/v1/attendance/face-embeddings - Upload face embeddings
   */
  async uploadFaceEmbeddings(req, res) {
    try {
      const { descriptor } = req.body;
      const result = await attendanceService.uploadFaceEmbeddings(req.userId, descriptor);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      logger.error('Upload face embeddings error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/attendance/:roomCode/check-in - Check-in
   */
  async checkIn(req, res) {
    try {
      const { roomCode } = req.params;
      const result = await attendanceService.checkIn(roomCode, req.userId, req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      logger.error('Check-in error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/attendance/:roomCode/check-out - Check-out
   */
  async checkOut(req, res) {
    try {
      const { roomCode } = req.params;
      const result = await attendanceService.checkOut(roomCode, req.userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Check-out error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/attendance/:roomCode/stats - Báo cáo điểm danh (host only)
   */
  async getRoomAttendanceStats(req, res) {
    try {
      const { roomCode } = req.params;
      const result = await attendanceService.getRoomAttendanceStats(roomCode, req.userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Get attendance stats error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/attendance/history - Lịch sử điểm danh của user
   */
  async getUserAttendanceHistory(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const result = await attendanceService.getUserAttendanceHistory(req.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Get user attendance history error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new AttendanceController();
