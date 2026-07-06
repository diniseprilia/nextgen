import { Router } from 'express';
import { Team, toPublicTeam } from '../models/Team.js';
import { User, toPublicUser } from '../models/User.js';
import { requireAuth, canInviteToTeam } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const teams = await Team.find().sort({ name: 1 });
  const visible = req.user.role === 'Admin'
    ? teams
    : teams.filter((t) => req.user.teamIds.some((id) => id.toString() === t._id.toString()));
  res.json(visible.map(toPublicTeam));
});

router.post('/', async (req, res) => {
  if (!['Master', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only Master or Admin can create teams' });
  }
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: 'Team name is required' });

  const team = await Team.create({ name, members: [req.user._id] });
  req.user.teamIds.push(team._id);
  await req.user.save();
  res.status(201).json(toPublicTeam(team));
});

router.delete('/:id', async (req, res) => {
  if (!['Master', 'Admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only Master or Admin can delete teams' });
  }
  const team = await Team.findById(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const teamId = team._id.toString();
  await User.updateMany({ teamIds: team._id }, { $pull: { teamIds: team._id } });
  await Team.findByIdAndDelete(team._id);
  res.status(204).send();
});

router.post('/:id/members', async (req, res) => {
  const teamId = req.params.id;
  const { userId } = req.body;

  if (!canInviteToTeam(req.user, teamId)) {
    return res.status(403).json({ error: 'You cannot invite users to this team' });
  }
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const team = await Team.findById(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const userIdStr = user._id.toString();
  if (!team.members.some((m) => m.toString() === userIdStr)) {
    team.members.push(user._id);
    await team.save();
  }
  if (!user.teamIds.some((id) => id.toString() === teamId)) {
    user.teamIds.push(team._id);
    await user.save();
  }

  const refreshed = await Team.findById(teamId);
  res.json({ team: toPublicTeam(refreshed), user: toPublicUser(user) });
});

router.delete('/:id/members/:userId', async (req, res) => {
  const { id: teamId, userId } = req.params;

  if (!canInviteToTeam(req.user, teamId)) {
    return res.status(403).json({ error: 'You cannot manage members of this team' });
  }

  const team = await Team.findById(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  team.members = team.members.filter((m) => m.toString() !== userId);
  await team.save();

  const user = await User.findById(userId);
  if (user) {
    user.teamIds = user.teamIds.filter((id) => id.toString() !== teamId);
    await user.save();
  }

  res.json({ team: toPublicTeam(team) });
});

export default router;
