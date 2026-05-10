import recordingService from '../services/recording.service.js';
import { buildUploadUrl } from '../middlewares/upload.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class RecordingController {
  async uploadRecording(req, res) {
    try {
      const { roomCode } = req.params;
      const video = req.files?.video?.[0];
      const thumbnail = req.files?.thumbnail?.[0];

      if (!video && !req.body.file_url) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'A video file or file_url is required',
        });
      }

      const result = await recordingService.createRecording(roomCode, req.userId, {
        ...req.body,
        file_url: req.body.file_url || buildUploadUrl(req, video),
        thumbnail_url: req.body.thumbnail_url || buildUploadUrl(req, thumbnail),
        mime_type: video?.mimetype || req.body.mime_type,
        size_bytes: video?.size || req.body.size_bytes,
      });

      res.status(HTTP_STATUS.CREATED).json(result);
    } catch (error) {
      logger.error('Upload recording error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  async listRecordings(req, res) {
    try {
      const { page = 1, limit = 20, status, roomCode } = req.query;
      const result = await recordingService.listUserRecordings(req.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null,
        roomCode: roomCode || null,
      });
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('List recordings error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  async listRoomRecordings(req, res) {
    try {
      const { roomCode } = req.params;
      const { page = 1, limit = 20, status } = req.query;
      const result = await recordingService.listRoomRecordings(roomCode, req.userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null,
      });
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('List room recordings error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getRecording(req, res) {
    try {
      const result = await recordingService.getRecording(req.params.recordingId, req.userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Get recording error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateRecording(req, res) {
    try {
      const result = await recordingService.updateRecording(req.params.recordingId, req.userId, req.body);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Update recording error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteRecording(req, res) {
    try {
      const result = await recordingService.deleteRecording(req.params.recordingId, req.userId);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error('Delete recording error:', error);
      res.status(error.statusCode || HTTP_STATUS.INTERNAL_ERROR).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new RecordingController();
