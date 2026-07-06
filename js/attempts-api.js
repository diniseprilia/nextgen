import {
  getAttempts as getLocalAttempts,
  saveAttempts as saveLocalAttempts,
  uid,
} from './storage.js';

let attemptsCache = [];
let apiAvailable = false;

const API_BASE = '/api/attempts';
const API_OPTS = { credentials: 'include' };

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...API_OPTS, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function isAttemptsApiAvailable() {
  return apiAvailable;
}

export function getAttempts() {
  return attemptsCache;
}

export function getLatestAttempt(userId, courseId) {
  const attempts = attemptsCache
    .filter((a) => a.userId === userId && a.courseId === courseId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return attempts[0] || null;
}

export function getAllAttemptsForUserCourse(userId, courseId) {
  return attemptsCache
    .filter((a) => a.userId === userId && a.courseId === courseId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export function getCourseProgressStatus(userId, courseId) {
  const attempts = getAllAttemptsForUserCourse(userId, courseId);
  const inProgress = attempts.find((a) => !a.completedAt);
  if (inProgress) return { status: 'In progress', attempt: inProgress };
  if (!attempts.length) return { status: 'Not started', attempt: null };
  const latest = attempts[attempts.length - 1];
  const label = latest.passed ? 'Completed (Passed)' : 'Completed (Failed)';
  return { status: label, attempt: latest };
}

export function getUserAverageScore(userId) {
  return averageLatestPerCourse(
    attemptsCache.filter((a) => a.completedAt && a.userId === userId)
  );
}

export function getUserAverageScoreForTeam(userId, teamId, courses) {
  const teamCourseIds = new Set(
    (courses || []).filter((c) => c.teamId === teamId).map((c) => c.id)
  );
  if (!teamCourseIds.size) return 0;
  return averageLatestPerCourse(
    attemptsCache.filter(
      (a) => a.completedAt && a.userId === userId && teamCourseIds.has(a.courseId)
    )
  );
}

function averageLatestPerCourse(attempts) {
  if (!attempts.length) return 0;
  const byCourse = {};
  attempts.forEach((a) => {
    const existing = byCourse[a.courseId];
    if (!existing || new Date(a.timestamp) > new Date(existing.timestamp)) {
      byCourse[a.courseId] = a;
    }
  });
  const latest = Object.values(byCourse);
  if (!latest.length) return 0;
  return Math.round(latest.reduce((s, a) => s + a.score, 0) / latest.length);
}

export async function loadAttempts() {
  try {
    const health = await fetch('/api/health');
    if (!health.ok) throw new Error('API unavailable');
    attemptsCache = await request('');
    apiAvailable = true;
  } catch {
    apiAvailable = false;
    attemptsCache = getLocalAttempts();
  }
  return attemptsCache;
}

export async function loadAttemptsForCourse(courseId) {
  if (!apiAvailable) return attemptsCache;
  const courseAttempts = await request(`?courseId=${encodeURIComponent(courseId)}`);
  const other = attemptsCache.filter((a) => a.courseId !== courseId);
  attemptsCache = [...other, ...courseAttempts];
  return courseAttempts;
}

export async function createAttempt(data) {
  if (!apiAvailable) {
    const attempts = getLocalAttempts();
    const entry = { id: uid('att'), ...data };
    attempts.push(entry);
    saveLocalAttempts(attempts);
    attemptsCache = attempts;
    return entry;
  }
  const created = await request('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  attemptsCache = [...attemptsCache.filter((a) => a.id !== created.id), created];
  return created;
}

export async function updateAttempt(id, data) {
  if (!apiAvailable) {
    const attempts = getLocalAttempts();
    const idx = attempts.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Attempt not found');
    attempts[idx] = { ...attempts[idx], ...data };
    saveLocalAttempts(attempts);
    attemptsCache = attempts;
    return attempts[idx];
  }
  const updated = await request(`/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  attemptsCache = attemptsCache.map((a) => (a.id === id ? updated : a));
  return updated;
}

export async function refreshAttempts() {
  if (!apiAvailable) {
    attemptsCache = getLocalAttempts();
    return attemptsCache;
  }
  attemptsCache = await request('');
  return attemptsCache;
}

export async function refreshAttemptsForCourse(courseId) {
  if (!apiAvailable) return attemptsCache;
  return loadAttemptsForCourse(courseId);
}

export function saveAttemptsLocal(attempts) {
  attemptsCache = attempts;
  if (!apiAvailable) saveLocalAttempts(attempts);
}
