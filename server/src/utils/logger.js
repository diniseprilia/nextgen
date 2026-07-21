import { EventEmitter } from 'events';
import { SystemLog } from '../models/SystemLog.js';

class LogService extends EventEmitter {
  constructor() {
    super();
    this.isDebugMode = false;
  }

  setDebugMode(enabled) {
    this.isDebugMode = Boolean(enabled);
    this.emitLog({
      level: 'INFO',
      category: 'SYSTEM',
      message: `Debug Mode turned ${this.isDebugMode ? 'ON' : 'OFF'} by Admin`,
      meta: {}
    });
  }

  sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sensitiveKeys = ['password', 'token', 'authorization', 'cookie', 'secret', 'key'];
    const sanitized = Array.isArray(obj) ? [] : {};

    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitized[key] = this.sanitize(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
    return sanitized;
  }

  async emitLog(logData) {
    const entry = {
      timestamp: logData.timestamp || new Date(),
      level: logData.level || 'INFO',
      category: logData.category || 'HTTP',
      message: logData.message || '',
      meta: this.sanitize(logData.meta || {}),
    };

    // Emit event to all connected SSE clients (Admin dashboard)
    this.emit('log', entry);

    // Asynchronously persist to MongoDB without blocking the request loop
    try {
      await SystemLog.create(entry);
    } catch (err) {
      console.error('Failed to persist system log to MongoDB:', err.message);
    }
  }
}

export const logService = new LogService();
