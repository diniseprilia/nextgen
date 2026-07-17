import { Router } from 'express';
import { User, toPublicUser } from '../models/User.js';
import { Team } from '../models/Team.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/roster', async (req, res) => {
  const actor = req.user;
  let query;
  if (actor.role === 'Admin') {
    query = {};
  } else if (actor.teamIds.length) {
    const teams = await Team.find({ _id: { $in: actor.teamIds } });
    const memberIds = new Set([actor._id.toString()]);
    teams.forEach((t) => t.members.forEach((m) => memberIds.add(m.toString())));
    query = { _id: { $in: [...memberIds] } };
  } else {
    query = { _id: actor._id };
  }
  const users = await User.find(query).sort({ name: 1 });
  res.json(users.map(toPublicUser));
});

router.get('/', async (req, res) => {
  if (!['Master', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  const { q } = req.query;
  let query = {};
  if (q && typeof q === 'string' && q.trim()) {
    const term = q.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query = { $or: [{ name: regex }, { email: regex }] };
  }
  const users = await User.find(query).sort({ name: 1 }).limit(50);
  res.json(users.map(toPublicUser));
});

router.patch('/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['Rookie', 'Master', 'Admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const actor = req.user;
  if (role === 'Admin' && actor.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admin can assign Admin role' });
  }
  if (!['Master', 'Admin'].includes(actor.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  if (target._id.toString() === actor._id.toString() && role !== actor.role) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }

  target.role = role;
  await target.save();
  res.json(toPublicUser(target));
});

router.patch('/:id/promote-admin', async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admin can promote users to Admin' });
  }
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  target.role = 'Admin';
  await target.save();
  res.json(toPublicUser(target));
});

router.patch('/:id/demote-admin', async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admin can demote Admins' });
  }
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target._id.toString() === req.user._id.toString()) {
    return res.status(400).json({ error: 'You cannot demote yourself' });
  }
  target.role = 'Master';
  await target.save();
  res.json(toPublicUser(target));
});

export default router;
