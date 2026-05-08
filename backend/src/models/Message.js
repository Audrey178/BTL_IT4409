import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room ID is required'],
      index: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    sender_name: {
      type: String, // Denormalized field for quick retrieval
      required: [true, 'Sender name is required'],
    },
    sender_avatar: {
      type: String, // Denormalized field
      default: null,
    },
    type: {
      type: String,
      enum: ['text', 'system', 'file'],
      default: 'text',
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
    },
    file_url: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: -1, // Descending index for latest messages
    },
  },
  { collection: 'messages' }
);

// Compound index for efficient pagination
messageSchema.index({ room_id: 1, timestamp: -1 });

// TTL index - auto-delete messages after 180 days for large collections
messageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
