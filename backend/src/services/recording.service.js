import mongoose from 'mongoose';
import { Recording, Room, RoomMember, MeetingEvent } from '../models/index.js';
import { ERROR_MESSAGES, EVENT_TYPE, HTTP_STATUS, USER_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

class RecordingService {
  async createRecording(roomCode, userId, data) {
    try {
      const room = await this.getRoomOrThrow(roomCode);
      await this.ensureRoomAccess(room, userId);

      const recording = new Recording({
        room_id: room._id,
        owner_id: userId,
        title: data.title || `${room.title} recording`,
        description: data.description || null,
        file_url: data.file_url,
        thumbnail_url: data.thumbnail_url || null,
        mime_type: data.mime_type || 'video/webm',
        size_bytes: Number(data.size_bytes || 0),
        duration_seconds: data.duration_seconds !== undefined ? Number(data.duration_seconds) : null,
        status: data.status || 'ready',
        metadata: data.metadata || null,
        recorded_at: data.recorded_at ? new Date(data.recorded_at) : new Date(),
      });

      await recording.save();
      await this.logRecordingEvent(room._id, userId, EVENT_TYPE.RECORDING_CREATED, 'Recording uploaded', {
        recording_id: recording._id,
        title: recording.title,
      });

      return {
        success: true,
        recording: await this.populateRecording(recording._id),
      };
    } catch (error) {
      logger.error('Create recording error:', error);
      throw error;
    }
  }

  async listUserRecordings(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status = null, roomCode = null } = options;
      const skip = (page - 1) * limit;
      const accessibleRoomIds = await this.getAccessibleRoomIds(userId);

      const query = { room_id: { $in: accessibleRoomIds } };
      if (status) query.status = status;

      if (roomCode) {
        const room = await this.getRoomOrThrow(roomCode);
        await this.ensureRoomAccess(room, userId);
        query.room_id = room._id;
      }

      const [recordings, total] = await Promise.all([
        Recording.find(query)
          .populate('room_id', 'room_code title status started_at ended_at')
          .populate('owner_id', 'full_name avatar email')
          .sort({ recorded_at: -1, created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Recording.countDocuments(query),
      ]);

      return {
        success: true,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        recordings: recordings.map(this.mapRecording),
      };
    } catch (error) {
      logger.error('List recordings error:', error);
      throw error;
    }
  }

  async listRoomRecordings(roomCode, userId, options = {}) {
    const { page = 1, limit = 20, status = null } = options;
    return this.listUserRecordings(userId, { page, limit, status, roomCode });
  }

  async getRecording(recordingId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(recordingId)) {
        const error = new Error('Invalid recording ID');
        error.statusCode = HTTP_STATUS.BAD_REQUEST;
        throw error;
      }

      const recording = await Recording.findById(recordingId)
        .populate('room_id', 'room_code title status host_id started_at ended_at')
        .populate('owner_id', 'full_name avatar email')
        .lean();

      if (!recording) {
        const error = new Error('Recording not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      await this.ensureRoomAccess(recording.room_id, userId);

      return {
        success: true,
        recording: this.mapRecording(recording),
      };
    } catch (error) {
      logger.error('Get recording error:', error);
      throw error;
    }
  }

  async updateRecording(recordingId, userId, data) {
    try {
      const recording = await Recording.findById(recordingId).populate('room_id', 'host_id room_code title');
      if (!recording) {
        const error = new Error('Recording not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      this.ensureCanManageRecording(recording, userId);

      const allowedFields = ['title', 'description', 'thumbnail_url', 'duration_seconds', 'status', 'metadata'];
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          recording[field] = data[field];
        }
      }

      await recording.save();

      return {
        success: true,
        recording: await this.populateRecording(recording._id),
      };
    } catch (error) {
      logger.error('Update recording error:', error);
      throw error;
    }
  }

  async deleteRecording(recordingId, userId) {
    try {
      const recording = await Recording.findById(recordingId).populate('room_id', 'host_id room_code title');
      if (!recording) {
        const error = new Error('Recording not found');
        error.statusCode = HTTP_STATUS.NOT_FOUND;
        throw error;
      }

      this.ensureCanManageRecording(recording, userId);
      await Recording.deleteOne({ _id: recording._id });

      await this.logRecordingEvent(
        recording.room_id._id,
        userId,
        EVENT_TYPE.RECORDING_DELETED,
        'Recording deleted',
        { recording_id: recording._id, title: recording.title }
      );

      return {
        success: true,
        message: 'Recording deleted successfully',
      };
    } catch (error) {
      logger.error('Delete recording error:', error);
      throw error;
    }
  }

  async getRoomOrThrow(roomCode) {
    const room = await Room.findOne({ room_code: roomCode });
    if (!room) {
      const error = new Error(ERROR_MESSAGES.ROOM_NOT_FOUND);
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }
    return room;
  }

  async ensureRoomAccess(room, userId) {
    const hostId = room.host_id?._id || room.host_id;
    const isHost = hostId?.toString() === userId.toString();
    if (isHost) return;

    const membership = await RoomMember.findOne({
      room_id: room._id,
      user_id: userId,
      status: { $in: [USER_STATUS.JOINED, USER_STATUS.LEFT] },
    });

    if (!membership) {
      const error = new Error('Unauthorized to access recordings for this room');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }
  }

  ensureCanManageRecording(recording, userId) {
    const hostId = recording.room_id?.host_id?._id || recording.room_id?.host_id;
    const isHost = hostId?.toString() === userId.toString();
    const isOwner = recording.owner_id?.toString() === userId.toString();

    if (!isHost && !isOwner) {
      const error = new Error('Only the recording owner or room host can manage this recording');
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }
  }

  async getAccessibleRoomIds(userId) {
    const [hostedRooms, memberRoomIds] = await Promise.all([
      Room.find({ host_id: userId }).distinct('_id'),
      RoomMember.find({
        user_id: userId,
        status: { $in: [USER_STATUS.JOINED, USER_STATUS.LEFT] },
      }).distinct('room_id'),
    ]);

    return [...new Set([...hostedRooms, ...memberRoomIds].map(id => id.toString()))];
  }

  async populateRecording(recordingId) {
    const recording = await Recording.findById(recordingId)
      .populate('room_id', 'room_code title status started_at ended_at')
      .populate('owner_id', 'full_name avatar email')
      .lean();

    return this.mapRecording(recording);
  }

  mapRecording(recording) {
    if (!recording) return null;
    return {
      ...recording,
      room: recording.room_id || null,
      owner: recording.owner_id || null,
      room_id: recording.room_id?._id || recording.room_id,
      owner_id: recording.owner_id?._id || recording.owner_id,
    };
  }

  async logRecordingEvent(roomId, userId, eventType, description, metadata = null) {
    try {
      await MeetingEvent.create({
        room_id: roomId,
        user_id: userId,
        event_type: eventType,
        description,
        metadata,
      });
    } catch (error) {
      logger.error('Log recording event error:', error);
    }
  }
}

export default new RecordingService();
