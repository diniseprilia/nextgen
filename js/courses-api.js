import {
  getCourses as getLocalCourses,
  saveCourses as saveLocalCourses,
  applyCourseScheduleStatuses as applyLocalScheduleStatuses,
} from './storage.js';

let coursesCache = [];
let apiAvailable = false;

const API_BASE = '/api/courses';
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

export function isCoursesApiAvailable() {
  return apiAvailable;
}

export function getCourses() {
  return coursesCache;
}

function applyScheduleStatuses(courses) {
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  courses.forEach((c) => {
    if (c.status === 'Draft') return;
    if (c.closeDate && c.closeDate <= today) {
      if (c.status !== 'Closed') { c.status = 'Closed'; changed = true; }
    } else if (c.status === 'Closed') {
      c.status = 'Open';
      changed = true;
    }
  });
  if (changed && !apiAvailable) saveLocalCourses(courses);
  return courses;
}

export function applyCourseScheduleStatuses() {
  coursesCache = applyScheduleStatuses(coursesCache);
}

export function getCoursesForUser(user, teamId) {
  applyCourseScheduleStatuses();
  const canMgmt = user?.role === 'Master' || user?.role === 'Admin';
  return coursesCache.filter((c) => {
    if (teamId && c.teamId !== teamId) return false;
    if (c.status === 'Draft' && !canMgmt) return false;
    return true;
  });
}

export function getCoursesForAnalytics(teamId) {
  applyCourseScheduleStatuses();
  return coursesCache.filter((c) => {
    if (teamId && c.teamId !== teamId) return false;
    return c.status !== 'Draft';
  });
}

export async function loadCourses() {
  try {
    const health = await fetch('/api/health');
    if (!health.ok) throw new Error('API unavailable');
    coursesCache = await request('');
    apiAvailable = true;
  } catch {
    apiAvailable = false;
    applyLocalScheduleStatuses();
    coursesCache = getLocalCourses();
  }
  return coursesCache;
}

export async function createCourse(data) {
  if (!apiAvailable) {
    const courses = getLocalCourses();
    const entry = { id: `c_${Date.now()}`, ...data };
    courses.push(entry);
    saveLocalCourses(courses);
    coursesCache = courses;
    return entry;
  }
  const created = await request('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  coursesCache = [created, ...coursesCache.filter((c) => c.id !== created.id)];
  return created;
}

export async function updateCourse(id, data) {
  if (!apiAvailable) {
    const courses = getLocalCourses();
    const idx = courses.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Course not found');
    courses[idx] = { ...courses[idx], ...data };
    saveLocalCourses(courses);
    coursesCache = courses;
    return courses[idx];
  }
  const updated = await request(`/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  coursesCache = coursesCache.map((c) => (c.id === id ? updated : c));
  return updated;
}

export async function deleteCourse(id) {
  if (!apiAvailable) {
    const courses = getLocalCourses().filter((c) => c.id !== id);
    saveLocalCourses(courses);
    coursesCache = courses;
    return { ok: true, id };
  }
  await request(`/${id}`, { method: 'DELETE' });
  coursesCache = coursesCache.filter((c) => c.id !== id);
  return { ok: true, id };
}

export async function refreshCourses(_teamId) {
  if (!apiAvailable) {
    applyLocalScheduleStatuses();
    coursesCache = getLocalCourses();
    return coursesCache;
  }
  coursesCache = await request('');
  return coursesCache;
}
