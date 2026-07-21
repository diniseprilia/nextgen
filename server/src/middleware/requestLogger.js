import { logService } from '../utils/logger.js';

export function requestLogger(req, res, next) {
  // Skip logging static asset requests (e.g. css, js, images) to reduce noise
  if (req.originalUrl.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/i)) {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    let level = 'INFO';
    if (statusCode >= 500) {
      level = 'ERROR';
    } else if (statusCode >= 400) {
      level = 'WARN';
    } else if (logService.isDebugMode) {
      level = 'DEBUG';
    }

    const logEntry = {
      timestamp: new Date(),
      level,
      category: req.originalUrl.startsWith('/api/auth') ? 'AUTH' : 'HTTP',
      message: `${req.method} ${req.originalUrl} ${statusCode} - ${duration}ms`,
      meta: {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        responseTimeMs: duration,
        ip: req.ip || req.socket.remoteAddress,
        userId: req.user?._id?.toString() || req.user?.id || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
      },
    };

    if (logService.isDebugMode && req.body && Object.keys(req.body).length > 0) {
      logEntry.meta.extra = { body: logService.sanitize(req.body) };
    }

    logService.emitLog(logEntry);
  });

  next();
}
