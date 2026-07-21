import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    level: {
      type: String,
      enum: ['INFO', 'WARN', 'ERROR', 'DEBUG'],
      default: 'INFO',
      index: true,
    },
    category: {
      type: String,
      enum: ['HTTP', 'AUTH', 'DATABASE', 'STORAGE', 'SYSTEM'],
      default: 'HTTP',
      index: true,
    },
    message: { type: String, required: true },
    meta: {
      userId: { type: String, default: null },
      userEmail: { type: String, default: null },
      userRole: { type: String, default: null },
      method: { type: String, default: null },
      url: { type: String, default: null },
      statusCode: { type: Number, default: null },
      responseTimeMs: { type: Number, default: null },
      ip: { type: String, default: null },
      errorStack: { type: String, default: null },
      extra: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    createdAt: { type: Date, default: Date.now, expires: '7d' }, // MongoDB TTL auto-cleanup after 7 days
  },
  { timestamps: false }
);

systemLogSchema.index({ message: 'text', 'meta.url': 'text', 'meta.errorStack': 'text' });

export const SystemLog = mongoose.model('SystemLog', systemLogSchema);
