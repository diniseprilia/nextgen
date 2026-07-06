import {
  getSession,
  saveSession,
  clearSession,
} from './storage.js';

const SESSION_HOURS = 24;

let currentUserCache = null;
let googleClientId = null;
let authApiAvailable = false;

async function authFetch(path, options = {}) {
  const res = await fetch(`/api/auth${path}`, {
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Auth request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function initAuth() {
  try {
    const health = await fetch('/api/health');
    if (!health.ok) throw new Error('API unavailable');
    authApiAvailable = true;
    const config = await authFetch('/config');
    googleClientId = config.googleClientId || null;
    try {
      currentUserCache = await authFetch('/me');
      syncLocalSession(currentUserCache);
    } catch {
      currentUserCache = null;
      clearSession();
    }
  } catch {
    authApiAvailable = false;
    googleClientId = null;
    currentUserCache = getLocalSessionUser();
  }
  return { authApiAvailable, googleClientId, user: currentUserCache };
}

function getLocalSessionUser() {
  const session = getSession();
  if (!session || Date.now() > session.expiresAt) {
    clearSession();
    return null;
  }
  return session.user || null;
}

function syncLocalSession(user) {
  if (!user) {
    clearSession();
    return;
  }
  saveSession({
    user,
    expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  });
}

export function getGoogleClientId() {
  return googleClientId;
}

export function isAuthApiAvailable() {
  return authApiAvailable;
}

export async function loginWithGoogle(credential) {
  if (!authApiAvailable) {
    return { ok: false, error: 'Server is unavailable. Start the NextGen server to sign in.' };
  }
  try {
    const user = await authFetch('/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    currentUserCache = user;
    syncLocalSession(user);
    return { ok: true, user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function refreshCurrentUser() {
  if (!authApiAvailable) {
    currentUserCache = getLocalSessionUser();
    return currentUserCache;
  }
  try {
    currentUserCache = await authFetch('/me');
    syncLocalSession(currentUserCache);
  } catch {
    currentUserCache = null;
    clearSession();
  }
  return currentUserCache;
}

export async function logout() {
  if (authApiAvailable) {
    try {
      await authFetch('/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
  }
  currentUserCache = null;
  clearSession();
}

export function getCurrentUser() {
  return currentUserCache;
}

export function checkSession() {
  return currentUserCache !== null;
}

export function setCurrentUser(user) {
  currentUserCache = user;
  syncLocalSession(user);
}

export function isMasterOrAdmin(user) {
  return user && (user.role === 'Master' || user.role === 'Admin');
}

export function isAdmin(user) {
  return user && user.role === 'Admin';
}

export function canManageAdmins(user) {
  return isAdmin(user);
}

export function canManageTeams(user) {
  return isMasterOrAdmin(user);
}

export function canInviteUsers(user) {
  return isMasterOrAdmin(user);
}

export function formatLastLogin(iso) {
  if (!iso) return 'First login';
  return `Last login: ${new Date(iso).toLocaleString()}`;
}

export function renderGoogleSignInButton(container, onSuccess, onError) {
  if (!googleClientId) {
    container.innerHTML = '<p class="error-text">Google Sign-In is not configured. Set GOOGLE_CLIENT_ID in .env and restart the server.</p>';
    return;
  }
  if (!window.google?.accounts?.id) {
    container.innerHTML = '<p class="muted">Loading Google Sign-In…</p>';
    return;
  }

  container.innerHTML = '';
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: async (response) => {
      const result = await loginWithGoogle(response.credential);
      if (result.ok) onSuccess(result.user);
      else onError(result.error);
    },
    auto_select: false,
  });
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    width: 320,
  });
}

export function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
