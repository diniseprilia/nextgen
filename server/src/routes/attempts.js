import { Router } from 'express';
import { Attempt } from '../models/Attempt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

function toApiAttempt(doc) {
  const a = doc.toJSON ? doc.toJSON() : doc;
  return {
    id: a.id || a._id?.toString(),
    userId: a.userId,
    courseId: a.courseId,
    score: a.score,
    passed: a.passed,
    openedAt: a.openedAt ? new Date(a.openedAt).toISOString() : null,
    completedAt: a.completedAt ? new Date(a.completedAt).toISOString() : null,
    durationSeconds: a.durationSeconds || 0,
    answers: a.answers || {},
    qIndex: a.qIndex ?? 0,
    timestamp: a.timestamp ? new Date(a.timestamp).toISOString() : new Date().toISOString(),
  };
}

function canViewAllAttempts(user) {
  return user.role === 'Master' || user.role === 'Admin';
}

router.get('/', async (req, res) => {
  try {
    const { courseId } = req.query;
    let query = {};

    if (courseId) {
      query.courseId = courseId;
      if (!canViewAllAttempts(req.user)) {
        query.userId = req.user._id.toString();
      }
    } else if (canViewAllAttempts(req.user)) {
      query = {};
    } else {
      query.userId = req.user._id.toString();
    }

    const attempts = await Attempt.find(query).sort({ timestamp: -1 });
    res.json(attempts.map(toApiAttempt));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list attempts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const attempt = await Attempt.create({
      ...req.body,
      userId,
    });
    res.status(201).json(toApiAttempt(attempt));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create attempt' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await Attempt.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Attempt not found' });

    const userId = req.user._id.toString();
    if (existing.userId !== userId && !canViewAllAttempts(req.user)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Cannot modify another user\'s attempt' });
    }

    Object.assign(existing, req.body);
    await existing.save();
    res.json(toApiAttempt(existing));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update attempt' });
  }
});

export default router;
