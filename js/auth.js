import {
  getSession,
  saveSession,
  clearSession,
} from './storage.js';

const SESSION_HOURS = 24;

let currentUserCache = null;
let authConfig = null;
let authApiAvailable = false;
let lastAuthError = null;

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

function readAuthErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('auth_error');
  if (!error) return null;
  window.history.replaceState({}, document.title, window.location.pathname);
  return error;
}

async function loadAuthConfig() {
  const health = await fetch('/api/health');
  if (!health.ok) throw new Error('API unavailable');
  authApiAvailable = true;
  authConfig = await authFetch('/config');
  if (!authConfig?.auth0Domain || !authConfig?.auth0ClientId) {
    throw new Error('Auth0 is not configured on the server. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET in .env and restart the server.');
  }
  return authConfig;
}

export async function initAuth() {
  lastAuthError = readAuthErrorFromUrl();
  try {
    await loadAuthConfig();
    try {
      currentUserCache = await authFetch('/me');
      syncLocalSession(currentUserCache);
      lastAuthError = null;
    } catch {
      currentUserCache = null;
      clearSession();
    }
  } catch (err) {
    authApiAvailable = false;
    authConfig = null;
    lastAuthError = lastAuthError || err.message;
    currentUserCache = getLocalSessionUser();
  }
  return { authApiAvailable, authConfig, user: currentUserCache, error: lastAuthError };
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

export function isAuthApiAvailable() {
  return authApiAvailable;
}

export function getAuthConfig() {
  return authConfig;
}

export async function loginWithAuth0() {
  if (!authApiAvailable) {
    return { ok: false, error: 'Server is unavailable. Start the NextGen server to sign in.' };
  }
  if (!authConfig?.auth0Domain || !authConfig?.auth0ClientId) {
    return { ok: false, error: 'Auth0 is not configured. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET in .env and restart the server.' };
  }
  window.location.href = '/api/auth/login';
  return { ok: true, redirecting: true };
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
    window.location.href = '/api/auth/logout';
    return;
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

export function getLastAuthError() {
  return lastAuthError;
}

export function renderAuth0SignInButton(container, onSuccess, onError) {
  if (!authApiAvailable) {
    container.innerHTML = '<p class="error-text">Server is unavailable. Start the NextGen server at <strong>http://localhost:3000</strong> and refresh this page.</p>';
    return;
  }
  if (!authConfig?.ready) {
    container.innerHTML = '<p class="error-text">Auth0 is not fully configured. Add AUTH0_CLIENT_SECRET to .env (Regular Web Application in Auth0), set callback URL to <code>/api/auth/oauth/callback</code>, and restart the server.</p>';
    return;
  }

  container.innerHTML = '';
  if (lastAuthError) {
    onError(lastAuthError);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ng-btn ng-btn--brand ng-btn--pill';
  button.style.width = '100%';
  button.textContent = 'Sign in with Google';
  button.addEventListener('click', async () => {
    button.disabled = true;
    const result = await loginWithAuth0();
    if (result.ok && result.redirecting) return;
    button.disabled = false;
    if (result.ok) onSuccess(getCurrentUser());
    else onError(result.error);
  });
  container.appendChild(button);
}
