import { createHmac, randomBytes } from 'crypto';
import { config } from '../config.js';

const STATE_MS = 10 * 60 * 1000;

function sign(payload) {
  return createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
}

export function createOAuthState() {
  const payload = Buffer.from(
    JSON.stringify({ nonce: randomBytes(16).toString('hex'), exp: Date.now() + STATE_MS }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || sig !== sign(payload)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp && Date.now() <= data.exp;
  } catch {
    return false;
  }
}
