import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { User, toPublicUser } from '../models/User.js';
import { isEmailAllowed, nameFromEmail } from '../utils/email.js';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_MS } from '../utils/session.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();
const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

function setSessionCookie(res, userId) {
  const token = createSessionToken(userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    secure: process.env.NODE_ENV === 'production',
  });
}

router.get('/config', (_req, res) => {
  res.json({
    googleClientId: config.googleClientId || null,
    allowedDomain: config.allowedDomain,
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(toPublicUser(req.user));
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential' });
    }
    if (!googleClient) {
      return res.status(503).json({ error: 'Google Sign-In is not configured on the server' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();
    const googleSub = payload.sub;

    if (!email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }
    if (!isEmailAllowed(email)) {
      return res.status(403).json({
        error: `Please sign in with your @${config.allowedDomain} Google account.`,
      });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: nameFromEmail(email),
        role: 'Rookie',
        teamIds: [],
        googleSub,
        lastLogin: new Date(),
      });
    } else {
      if (!user.googleSub && googleSub) user.googleSub = googleSub;
      user.lastLogin = new Date();
      if (!user.role) user.role = 'Rookie';
      await user.save();
    }

    setSessionCookie(res, user._id.toString());
    res.json(toPublicUser(user));
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Invalid Google sign-in. Please try again.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

export default router;
