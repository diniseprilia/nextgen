import { createHmac } from 'crypto';
import { config } from '../config.js';

const SESSION_MS = 24 * 60 * 60 * 1000;

export function createSessionToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + SESSION_MS }),
  ).toString('base64url');
  const sig = createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.userId || Date.now() > data.exp) return null;
    return data.userId;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'nextgen_session';
export const SESSION_MAX_AGE_MS = SESSION_MS;
