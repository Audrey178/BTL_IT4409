import mongoose from 'mongoose';

const deliverySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    delivered_at: {
      type: Date,
      default: null,
    },
    read_at: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const systemEventSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['call'],
      default: null,
    },
    call_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CallSession',
      default: null,
    },
    call_type: {
      type: String,
      enum: ['audio', 'video'],
      default: null,
    },
    call_status: {
      type: String,
      enum: ['ended', 'missed', 'rejected'],
      default: null,
    },
    caller_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receiver_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    started_at: {
      type: Date,
      default: null,
    },
    answered_at: {
      type: Date,
      default: null,
    },
    ended_at: {
      type: Date,
      default: null,
    },
    duration_seconds: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const messageReferenceSchema = new mongoose.Schema(
  {
    message_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sender_name: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ['text', 'system', 'file'],
      default: 'text',
    },
    timestamp: {
      type: Date,
      default: null,
    },
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
  },
  { _id: false }
);

const reactionCountSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      index: true,
      default: null,
    },
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true,
      default: null,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
      enum: ['text', 'system', 'file', 'sticker', 'emoji'],
      default: 'text',
    },
    content: {
      type: String,
      default: null,
    },
    // Attachment object for uploaded files/images/documents
    attachment: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Sticker or emoji fields
    sticker_id: {
      type: String,
      default: null,
    },
    emoji: {
      type: String,
      default: null,
    },
    client_id: {
      type: String,
      default: null,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    delivery: {
      type: [deliverySchema],
      default: [],
    },
    system_event: {
      type: systemEventSchema,
      default: null,
    },
    edited_at: {
      type: Date,
      default: null,
    },
    edited_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    edit_count: {
      type: Number,
      default: 0,
    },
    deleted_for_everyone_at: {
      type: Date,
      default: null,
    },
    deleted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    delete_reason: {
      type: String,
      default: null,
    },
    reply_to_message_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
      index: true,
    },
    reply_snapshot: {
      type: messageReferenceSchema,
      default: null,
    },
    forwarded_from: {
      type: messageReferenceSchema,
      default: null,
    },
    reaction_counts: {
      type: [reactionCountSchema],
      default: [],
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: -1, // Descending index for latest messages
    },
  },
  { collection: 'messages' }
);

messageSchema.pre('validate', function (next) {
  if (!this.room_id && !this.conversation_id) {
    this.invalidate('room_id', 'Either room_id or conversation_id is required');
  }

  if (this.type !== 'system' && !this.sender_id) {
    this.invalidate('sender_id', 'Sender ID is required');
  }

  // Require content for text/emoji messages
  if ((this.type === 'text' || this.type === 'emoji') && !this.content) {
    this.invalidate('content', 'Message content is required for text/emoji messages');
  }

  next();
});

// Compound index for efficient pagination
messageSchema.index({ room_id: 1, timestamp: -1 });
messageSchema.index({ conversation_id: 1, timestamp: -1 });
messageSchema.index({ sender_id: 1, timestamp: -1 });
messageSchema.index({ room_id: 1, 'delivery.user_id': 1 });
messageSchema.index({ 'system_event.call_id': 1 });
messageSchema.index(
  { deleted_for_everyone_at: 1 },
  { partialFilterExpression: { deleted_for_everyone_at: { $type: 'date' } } }
);

// TTL index - auto-delete messages after 180 days for large collections
messageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
