import { Router } from 'express';
import { toPublicUser } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_MS } from '../utils/session.js';
import { verifyAuth0IdToken } from '../utils/auth0.js';
import { provisionUserFromSso } from '../services/authUser.js';
import {
  buildAuthorizeUrl,
  buildLogoutUrl,
  exchangeAuthorizationCode,
  getAuth0CallbackUrl,
} from '../utils/auth0OAuth.js';
import { createOAuthState, verifyOAuthState } from '../utils/oauthState.js';
import { config } from '../config.js';

const router = Router();
const OAUTH_STATE_COOKIE = 'auth0_oauth_state';

function setSessionCookie(res, userId) {
  const token = createSessionToken(userId);
  const req = res.req;
  const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    secure: isSecure,
  });
}

function authConfigured() {
  return Boolean(config.auth0Domain && config.auth0ClientId && config.auth0ClientSecret);
}

router.get('/config', (req, res) => {
  res.json({
    auth0Domain: config.auth0Domain || null,
    auth0ClientId: config.auth0ClientId || null,
    googleConnection: config.auth0GoogleConnection,
    allowedDomain: config.allowedDomain,
    callbackUrl: authConfigured() ? getAuth0CallbackUrl(req) : null,
    authMode: 'server',
    ready: authConfigured(),
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(toPublicUser(req.user));
});

router.get('/login', (req, res) => {
  if (!authConfigured()) {
    return res.status(503).send('Auth0 is not configured. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET in .env');
  }

  const state = createOAuthState();
  const redirectUri = getAuth0CallbackUrl(req);
  const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    secure: isSecure,
  });
  res.redirect(buildAuthorizeUrl({ state, redirectUri }));
});

router.get('/oauth/callback', async (req, res) => {
  const redirectHome = (message) => {
    const query = message ? `?auth_error=${encodeURIComponent(message)}` : '';
    res.redirect(`/${query}`);
  };

  try {
    if (!authConfigured()) {
      return redirectHome('Auth0 is not configured on the server');
    }

    const { code, state, error, error_description: errorDescription } = req.query;
    if (error) {
      return redirectHome(errorDescription || error);
    }

    const savedState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE);
    if (!code || !state || !savedState || state !== savedState || !verifyOAuthState(state)) {
      return redirectHome('Invalid login session. Please try again.');
    }

    const redirectUri = getAuth0CallbackUrl(req);
    const tokens = await exchangeAuthorizationCode(code, redirectUri);
    const { email, sub } = await verifyAuth0IdToken(tokens.id_token);
    const dbUser = await provisionUserFromSso({ email, auth0Sub: sub });
    setSessionCookie(res, dbUser._id.toString());
    res.redirect('/');
  } catch (err) {
    if (err.status === 403) {
      return redirectHome(err.message);
    }
    console.error('Auth0 OAuth callback error:', err.message);
    redirectHome(err.message || 'Sign-in failed. Please try again.');
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  if (!authConfigured()) {
    return res.redirect('/');
  }
  const returnTo = `${req.protocol}://${req.get('host')}/`;
  res.redirect(buildLogoutUrl(returnTo));
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

export default router;
