import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { SystemLog } from '../models/SystemLog.js';
import { logService } from '../utils/logger.js';

const router = express.Router();

// Middleware to ensure user is an Admin
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }
  next();
}

// All log endpoints require authentication & Admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/logs - Query historical logs
router.get('/', async (req, res) => {
  try {
    const { level, category, search, limit = 100, page = 1 } = req.query;

    const query = {};
    if (level && level !== 'ALL') {
      query.level = level.toUpperCase();
    }
    if (category && category !== 'ALL') {
      query.category = category.toUpperCase();
    }
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { 'meta.url': { $regex: search, $options: 'i' } },
        { 'meta.userEmail': { $regex: search, $options: 'i' } },
        { 'meta.errorStack': { $regex: search, $options: 'i' } },
      ];
    }

    const parsedLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [logs, total] = await Promise.all([
      SystemLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(parsedLimit).lean(),
      SystemLog.countDocuments(query),
    ]);

    const counts = await SystemLog.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]);

    const levelCounts = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
    counts.forEach((item) => {
      if (levelCounts[item._id] !== undefined) {
        levelCounts[item._id] = item.count;
      }
    });

    res.json({
      ok: true,
      logs,
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit),
      levelCounts,
      isDebugMode: logService.isDebugMode,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch system logs', details: err.message });
  }
});

// GET /api/admin/logs/stream - Server-Sent Events (SSE) for real-time live log tailing
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send connection greeting
  res.write(`data: ${JSON.stringify({ type: 'connected', isDebugMode: logService.isDebugMode })}\n\n`);

  const onLog = (logEntry) => {
    res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
  };

  logService.on('log', onLog);

  req.on('close', () => {
    logService.off('log', onLog);
    res.end();
  });
});

// POST /api/admin/logs/debug-mode - Toggle global verbose Debug Mode
router.post('/debug-mode', (req, res) => {
  const { enabled } = req.body;
  logService.setDebugMode(Boolean(enabled));
  res.json({ ok: true, isDebugMode: logService.isDebugMode });
});

// DELETE /api/admin/logs - Clear logs
router.delete('/', async (_req, res) => {
  try {
    await SystemLog.deleteMany({});
    logService.emitLog({
      level: 'WARN',
      category: 'SYSTEM',
      message: 'System logs cleared by Admin',
      meta: {},
    });
    res.json({ ok: true, message: 'All system logs cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear logs', details: err.message });
  }
});

export default router;
