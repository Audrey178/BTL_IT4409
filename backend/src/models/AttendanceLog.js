import mongoose from 'mongoose';

const attendanceLogSchema = new mongoose.Schema(
  {
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room ID is required'],
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    confidence_score: {
      type: Number,
      min: 0,
      max: 1,
      default: null, // null for manual check-in
    },
    check_in_time: {
      type: Date,
      required: [true, 'Check-in time is required'],
      index: -1,
    },
    check_out_time: {
      type: Date,
      default: null,
    },
    method: {
      type: String,
      enum: ['face_recognition', 'manual'],
      default: 'manual',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false, collection: 'attendance_logs' }
);

// Compound index for efficient queries
attendanceLogSchema.index({ room_id: 1, created_at: -1 });
attendanceLogSchema.index({ user_id: 1, room_id: 1 });

// Virtual field for duration calculation
attendanceLogSchema.virtual('duration').get(function () {
  if (this.check_out_time && this.check_in_time) {
    return Math.floor((this.check_out_time - this.check_in_time) / 1000); // seconds
  }
  return 0;
});

const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);

export default AttendanceLog;
