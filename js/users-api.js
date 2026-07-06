const API_OPTS = { credentials: 'include' };

let usersCache = [];
let teamsCache = [];
let apiAvailable = false;

async function request(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, { ...API_OPTS, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function authRequest(path, options) {
  return request('/api/auth', path, options);
}

function usersRequest(path, options) {
  return request('/api/users', path, options);
}

function teamsRequest(path, options) {
  return request('/api/teams', path, options);
}

export function isUsersApiAvailable() {
  return apiAvailable;
}

export function getUsers() {
  return usersCache;
}

export function getTeams() {
  return teamsCache;
}

export function getUserById(id) {
  return usersCache.find((u) => u.id === id);
}

export function getAccessibleTeams(user) {
  if (!user) return [];
  if (user.role === 'Admin') return teamsCache;
  return teamsCache.filter((t) => user.teamIds?.includes(t.id));
}

export function getInvitableTeams(user) {
  if (!user) return [];
  if (user.role === 'Admin') return teamsCache;
  if (user.role === 'Master') {
    return teamsCache.filter((t) => user.teamIds?.includes(t.id));
  }
  return [];
}

export function userHasTeams(user) {
  return (user?.teamIds?.length ?? 0) > 0;
}

export async function loadUsersAndTeams() {
  try {
    const health = await fetch('/api/health');
    if (!health.ok) throw new Error('API unavailable');
    [usersCache, teamsCache] = await Promise.all([
      usersRequest('/roster'),
      teamsRequest(''),
    ]);
    apiAvailable = true;
  } catch {
    apiAvailable = false;
    usersCache = [];
    teamsCache = [];
  }
  return { users: usersCache, teams: teamsCache };
}

export async function searchUsers(query) {
  if (!apiAvailable) return [];
  const q = encodeURIComponent(query.trim());
  return usersRequest(`?q=${q}`);
}

export async function inviteUserToTeam(teamId, userId) {
  const result = await teamsRequest(`/${teamId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  await refreshCaches();
  return result;
}

export async function removeTeamMember(teamId, userId) {
  const result = await teamsRequest(`/${teamId}/members/${userId}`, { method: 'DELETE' });
  await refreshCaches();
  return result;
}

export async function updateUserRole(userId, role) {
  const result = await usersRequest(`/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  await refreshCaches();
  return result;
}

export async function promoteToAdmin(userId) {
  await usersRequest(`/${userId}/promote-admin`, { method: 'PATCH' });
  await refreshCaches();
}

export async function demoteAdmin(userId) {
  await usersRequest(`/${userId}/demote-admin`, { method: 'PATCH' });
  await refreshCaches();
}

export async function createTeam(name) {
  const team = await teamsRequest('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  await refreshCaches();
  return team;
}

export async function deleteTeam(teamId) {
  await teamsRequest(`/${teamId}`, { method: 'DELETE' });
  await refreshCaches();
}

async function refreshCaches() {
  if (!apiAvailable) return;
  [usersCache, teamsCache] = await Promise.all([
    usersRequest('/roster'),
    teamsRequest(''),
  ]);
}

export function getTeamLeaderboard(teamId, limit, getUserAverageScore) {
  const team = teamsCache.find((t) => t.id === teamId);
  if (!team) return [];
  return team.members
    .map((uid) => {
      const user = getUserById(uid);
      return user ? { user, score: getUserAverageScore(uid) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getGlobalLeaderboard(limit, getUserAverageScore) {
  return usersCache
    .map((u) => ({ user: u, score: getUserAverageScore(u.id) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function isTop3Global(userId, getUserAverageScore) {
  const top = getGlobalLeaderboard(3, getUserAverageScore);
  return top.some((x) => x.user.id === userId);
}

export function isTop3Team(userId, teamId, getUserAverageScore) {
  const top = getTeamLeaderboard(teamId, 3, getUserAverageScore);
  return top.some((x) => x.user.id === userId);
}
