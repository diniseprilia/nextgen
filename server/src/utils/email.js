import { config } from '../config.js';

export function nameFromEmail(email) {
  const local = email.split('@')[0];
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function isEmailAllowed(email) {
  const normalized = email.trim().toLowerCase();
  if (config.emailAllowlist.includes(normalized)) return true;
  const [, domain] = normalized.split('@');
  return domain === config.allowedDomain;
}
