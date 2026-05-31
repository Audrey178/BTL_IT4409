import mongoose from 'mongoose';

const callSessionSchema = new mongoose.Schema(
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
    caller_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiver_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    call_type: {
      type: String,
      enum: ['audio', 'video'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ringing', 'accepted', 'rejected', 'missed', 'ended', 'failed'],
      default: 'ringing',
      index: true,
    },
    started_at: {
      type: Date,
      default: Date.now,
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
      default: 0,
    },
    rejected_by: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    accepted_by: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    left_by: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    missed_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false, collection: 'call_sessions' }
);

callSessionSchema.pre('validate', function (next) {
  if (!this.room_id && !this.conversation_id) {
    this.invalidate('room_id', 'Either room_id or conversation_id is required');
  }
  next();
});

callSessionSchema.index({ room_id: 1, status: 1, created_at: -1 });
callSessionSchema.index({ conversation_id: 1, status: 1, created_at: -1 });

const CallSession = mongoose.model('CallSession', callSessionSchema);

export default CallSession;
