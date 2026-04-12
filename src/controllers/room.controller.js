/**
 * ============================================================================
 * CONTROLLER: ROOM - Quản lý phòng họp
 * ============================================================================
 * 
 * Tác giả: Meeting Team
 */

import roomService from '../services/room.service.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class RoomController {
  /**
   * POST /api/v1/rooms - Tạo phòng
   */
  async createRoom(req, res) {
    try {
      const result = await roomService.createRoom(req.userId, req.body);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      logger.error('Create room error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/rooms/:roomCode - Lấy thông tin phòng
   */
  async getRoomInfo(req, res) {
    try {
      const { roomCode } = req.params;
      const room = await roomService.getRoomInfo(roomCode);
      res.status(HTTP_STATUS.OK).json({
        success: true,
        room,
      });
    } catch (error) {
      logger.error('Get room info error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/rooms/:roomCode/join - Vào phòng
   */
  async joinRoom(req, res) {
    try {
      const { roomCode } = req.params;
      const result = await roomService.requestJoinRoom(roomCode, req.userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Join room error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/rooms/:roomCode/approve/:userId - Host duyệt người
   */
  async approveUser(req, res) {
    try {
      const { roomCode, userId } = req.params;
      const result = await roomService.approveUser(roomCode, req.userId, userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Approve user error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/rooms/:roomCode/reject/:userId - Host từ chối người
   */
  async rejectUser(req, res) {
    try {
      const { roomCode, userId } = req.params;
      const result = await roomService.rejectUser(roomCode, req.userId, userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Reject user error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/v1/rooms/:roomCode/kick/:userId - Host đuổi người
   */
  async kickUser(req, res) {
    try {
      const { roomCode, userId } = req.params;
      const result = await roomService.kickUser(roomCode, req.userId, userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Kick user error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * PUT /api/v1/rooms/:roomCode/end - Kết thúc phòng
   */
  async endRoom(req, res) {
    try {
      const { roomCode } = req.params;
      const result = await roomService.endRoom(roomCode, req.userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('End room error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/rooms/:roomCode/participants - Danh sách người tham gia
   */
  async getRoomParticipants(req, res) {
    try {
      const { roomCode } = req.params;
      const result = await roomService.getRoomParticipants(roomCode);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Get room participants error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new RoomController();
