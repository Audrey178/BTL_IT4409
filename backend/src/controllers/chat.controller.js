import chatService from '../services/chat.service.js';
import { SOCKET_EVENTS, HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class ChatController {
  async getRoomMessages(req, res) {
    try {
      const { roomCode } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const result = await chatService.getRoomMessages(roomCode, req.userId, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Get room messages error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  async sendRoomMessage(req, res) {
    try {
      const { roomCode } = req.params;
      const result = await chatService.sendRoomMessage(roomCode, req.user, req.body);
      const payload = {
        ...result.message,
        isOwn: false,
      };

      req.app.locals.io?.to(roomCode.toUpperCase()).emit(SOCKET_EVENTS.CHAT_RECEIVE, payload);
      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      logger.error('Send room message error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteRoomMessage(req, res) {
    try {
      const { roomCode, messageId } = req.params;
      const result = await chatService.deleteRoomMessage(roomCode, messageId, req.userId);

      req.app.locals.io?.to(roomCode.toUpperCase()).emit('chat:deleted', {
        messageId: result.deletedMessageId,
      });
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Delete room message error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new ChatController();
