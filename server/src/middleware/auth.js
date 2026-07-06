import { User } from '../models/User.js';
import { verifySessionToken, SESSION_COOKIE } from '../utils/session.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const userId = verifySessionToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = await User.findById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  next();
}

export function canInviteToTeam(user, teamId) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Master') {
    return user.teamIds.some((id) => id.toString() === teamId);
  }
  return false;
}
