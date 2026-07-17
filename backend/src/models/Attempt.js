import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    score: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    openedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    qIndex: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

attemptSchema.index({ userId: 1, courseId: 1 });
attemptSchema.index({ courseId: 1, completedAt: -1 });

export const Attempt = mongoose.model('Attempt', attemptSchema);
