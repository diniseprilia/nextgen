const KEYS = {
  users: 'nextgen_users',
  teams: 'nextgen_teams',
  materials: 'nextgen_materials',
  courses: 'nextgen_courses',
  attempts: 'nextgen_attempts',
  session: 'nextgen_session',
  settings: 'nextgen_settings',
  initialized: 'nextgen_initialized',
};

export function get(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function set(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getUsers() { return get(KEYS.users) || []; }
export function saveUsers(users) { set(KEYS.users, users); }

export function getTeams() { return get(KEYS.teams) || []; }
export function saveTeams(teams) { set(KEYS.teams, teams); }

export function getMaterials() { return get(KEYS.materials) || []; }
export function saveMaterials(materials) { set(KEYS.materials, materials); }

export function getCourses() { return get(KEYS.courses) || []; }
export function saveCourses(courses) { set(KEYS.courses, courses); }

export function getAttempts() { return get(KEYS.attempts) || []; }
export function saveAttempts(attempts) { set(KEYS.attempts, attempts); }

export function getSettings() { return get(KEYS.settings) || { geminiApiKey: '' }; }
export function saveSettings(settings) { set(KEYS.settings, settings); }

export function getSession() { return get(KEYS.session); }
export function saveSession(session) { set(KEYS.session, session); }
export function clearSession() { localStorage.removeItem(KEYS.session); }

function seedData() {
  const adminUser = {
    id: 'u_admin',
    name: 'Dinis Eprilia',
    email: 'diniseprilia@ninjavan.co',
    password: 'NextGen2026!',
    role: 'Admin',
    teamIds: ['t1', 't2'],
    lastLogin: null,
  };

  const users = [
    adminUser,
    {
      id: 'u1',
      name: 'Jane Doe',
      email: 'jane.doe@ninjavan.co',
      password: 'rookie123',
      role: 'Rookie',
      teamIds: ['t1'],
      lastLogin: '2026-06-15T10:00:00Z',
    },
    {
      id: 'u2',
      name: 'Ken Tan',
      email: 'ken.tan@ninjavan.co',
      password: 'master123',
      role: 'Master',
      teamIds: ['t1'],
      lastLogin: '2026-06-14T09:00:00Z',
    },
    {
      id: 'u3',
      name: 'Sarah Lim',
      email: 'sarah.lim@ninjavan.co',
      password: 'rookie123',
      role: 'Rookie',
      teamIds: ['t1', 't2'],
      lastLogin: '2026-06-13T14:00:00Z',
    },
    {
      id: 'u4',
      name: 'Alex Wong',
      email: 'alex.wong@ninjavan.co',
      password: 'rookie123',
      role: 'Rookie',
      teamIds: ['t2'],
      lastLogin: '2026-06-12T11:00:00Z',
    },
  ];

  const teams = [
    { id: 't1', name: 'Logistics Operations', members: ['u_admin', 'u1', 'u2', 'u3'] },
    { id: 't2', name: 'Last Mile Delivery', members: ['u_admin', 'u3', 'u4'] },
  ];

  const materials = [
    {
      id: 'm1',
      title: 'Delivery Operations Guide',
      content: `Ninja Van delivery operations require strict adherence to dispatch cutoff times. The primary dispatch cutoff is 2 PM daily to ensure adequate packaging time before evening routes. Drivers must scan parcels at pickup and delivery points. Failed deliveries require three attempts before return-to-sender. Customer notifications are sent via SMS at each milestone. Safety protocols mandate helmet use and speed limits in residential zones. COD parcels must be collected before marking delivery complete.`,
      sourceUrl: 'https://docs.ninjavan.co/ops',
      group: 'Operations',
      teamId: 't1',
      updatedAt: '2026-06-15T10:00:00Z',
    },
    {
      id: 'm2',
      title: 'Sorting Hub Procedures',
      content: `Hub sorting follows a zone-based system. Parcels are scanned upon arrival and assigned to sort lanes by destination postcode. The morning shift runs from 6 AM to 2 PM. Quality checks require weight verification for parcels over 5kg. Damaged parcels are flagged in the system and routed to the claims team. End-of-shift reconciliation must match physical count with system inventory.`,
      sourceUrl: 'https://docs.ninjavan.co/hub',
      group: 'Operations',
      teamId: 't1',
      updatedAt: '2026-06-14T08:00:00Z',
    },
    {
      id: 'm3',
      title: 'Customer Service Standards',
      content: `All customer inquiries must be acknowledged within 2 hours. Escalation tiers: Tier 1 handles tracking queries, Tier 2 handles delivery disputes, Tier 3 handles compensation claims. Use empathetic language and never blame the customer. Document all interactions in the CRM. SLA for resolution is 24 hours for standard cases and 4 hours for urgent cases.`,
      sourceUrl: 'https://docs.ninjavan.co/cs',
      group: 'Customer Experience',
      teamId: 't2',
      updatedAt: '2026-06-13T12:00:00Z',
    },
  ];

  const courses = [
    {
      id: 'c1',
      title: 'Ops Basics 101',
      description: 'Introductory course for logistics dispatch routing.',
      materialIds: ['m1'],
      questions: [
        {
          id: 'q1',
          question: 'What is the primary dispatch cutoff time?',
          options: ['10 AM', '12 PM', '2 PM', '4 PM'],
          correctAnswer: 2,
          explanation: 'Cutoff is 2 PM to ensure packaging time.',
        },
        {
          id: 'q2',
          question: 'How many delivery attempts are required before return-to-sender?',
          options: ['1', '2', '3', '5'],
          correctAnswer: 2,
          explanation: 'Failed deliveries require three attempts before RTS.',
        },
        {
          id: 'q3',
          question: 'COD parcels must be collected before marking delivery complete.',
          options: ['True', 'False'],
          correctAnswer: 0,
          explanation: 'Cash on delivery must be collected at delivery.',
        },
        {
          id: 'q4',
          question: 'When must drivers scan parcels?',
          options: ['Pickup only', 'Delivery only', 'Pickup and delivery', 'End of shift'],
          correctAnswer: 2,
          explanation: 'Scanning at both pickup and delivery ensures tracking accuracy.',
        },
        {
          id: 'q5',
          question: 'Customer notifications are sent via:',
          options: ['Email only', 'SMS', 'Phone call', 'App push only'],
          correctAnswer: 1,
          explanation: 'SMS notifications are sent at each delivery milestone.',
        },
      ],
      minScore: 80,
      status: 'Open',
      openDate: '2026-06-01',
      closeDate: null,
      synced: true,
      format: 'multiple',
      teamId: 't1',
    },
    {
      id: 'c2',
      title: 'Hub Sorting Fundamentals',
      description: 'Learn hub sorting zone systems and quality checks.',
      materialIds: ['m2'],
      questions: [
        {
          id: 'q6',
          question: 'Hub sorting uses a zone-based system organized by:',
          options: ['Weight', 'Destination postcode', 'Sender name', 'Package color'],
          correctAnswer: 1,
          explanation: 'Parcels are sorted by destination postcode zones.',
        },
        {
          id: 'q7',
          question: 'The morning shift at the hub runs until:',
          options: ['10 AM', '12 PM', '2 PM', '6 PM'],
          correctAnswer: 2,
          explanation: 'Morning shift is 6 AM to 2 PM.',
        },
        {
          id: 'q8',
          question: 'Weight verification is required for parcels over 5kg.',
          options: ['True', 'False'],
          correctAnswer: 0,
          explanation: 'Quality checks mandate weight verification above 5kg.',
        },
      ],
      minScore: 70,
      status: 'Open',
      openDate: '2026-06-10',
      closeDate: null,
      synced: true,
      format: 'multiple',
      teamId: 't1',
    },
    {
      id: 'c3',
      title: 'CS Excellence (Draft)',
      description: 'Customer service standards — draft for review.',
      materialIds: ['m3'],
      questions: [],
      minScore: 80,
      status: 'Draft',
      openDate: null,
      closeDate: null,
      synced: false,
      format: 'multiple',
      teamId: 't2',
    },
  ];

  const attempts = [
    {
      id: 'att1',
      userId: 'u1',
      courseId: 'c1',
      score: 90,
      passed: true,
      openedAt: '2026-06-15T10:30:00Z',
      completedAt: '2026-06-15T11:00:00Z',
      durationSeconds: 1800,
      answers: { q1: 2, q2: 2, q3: 0, q4: 2, q5: 1 },
      timestamp: '2026-06-15T11:00:00Z',
    },
    {
      id: 'att2',
      userId: 'u2',
      courseId: 'c1',
      score: 100,
      passed: true,
      openedAt: '2026-06-14T08:00:00Z',
      completedAt: '2026-06-14T08:25:00Z',
      durationSeconds: 1500,
      answers: { q1: 2, q2: 2, q3: 0, q4: 2, q5: 1 },
      timestamp: '2026-06-14T08:25:00Z',
    },
    {
      id: 'att3',
      userId: 'u3',
      courseId: 'c1',
      score: 60,
      passed: false,
      openedAt: '2026-06-13T14:00:00Z',
      completedAt: '2026-06-13T14:20:00Z',
      durationSeconds: 1200,
      answers: { q1: 0, q2: 2, q3: 1, q4: 2, q5: 1 },
      timestamp: '2026-06-13T14:20:00Z',
    },
  ];

  saveUsers(users);
  saveTeams(teams);
  saveMaterials(materials);
  saveCourses(courses);
  saveAttempts(attempts);
  saveSettings({ geminiApiKey: '' });
  localStorage.setItem(KEYS.initialized, 'true');
}

export function ensureSeed() {
  if (!localStorage.getItem(KEYS.initialized)) {
    seedData();
  } else {
    const users = getUsers();
    const admin = users.find((u) => u.email === 'diniseprilia@ninjavan.co');
    if (!admin) {
      users.unshift({
        id: 'u_admin',
        name: 'Dinis Eprilia',
        email: 'diniseprilia@ninjavan.co',
        password: 'NextGen2026!',
        role: 'Admin',
        teamIds: ['t1', 't2'],
        lastLogin: null,
      });
      saveUsers(users);
      const teams = getTeams();
      teams.forEach((t) => {
        if (!t.members.includes('u_admin')) t.members.push('u_admin');
      });
      saveTeams(teams);
    } else if (admin.role !== 'Admin') {
      admin.role = 'Admin';
      saveUsers(users);
    }
  }
}

export function findUserByIdentity(identity) {
  const q = identity.trim().toLowerCase();
  return getUsers().find(
    (u) =>
      u.email?.toLowerCase() === q ||
      u.name?.toLowerCase() === q ||
      u.id === identity
  );
}

export function getUserById(id) {
  return getUsers().find((u) => u.id === id);
}

export function getLatestAttempt(userId, courseId) {
  const attempts = getAttempts()
    .filter((a) => a.userId === userId && a.courseId === courseId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return attempts[0] || null;
}

export function getAllAttemptsForUserCourse(userId, courseId) {
  return getAttempts()
    .filter((a) => a.userId === userId && a.courseId === courseId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export function applyCourseScheduleStatuses() {
  const today = new Date().toISOString().slice(0, 10);
  const courses = getCourses();
  let changed = false;
  courses.forEach((c) => {
    if (c.status === 'Draft') return;
    if (c.closeDate && c.closeDate <= today) {
      if (c.status !== 'Closed') {
        c.status = 'Closed';
        changed = true;
      }
    } else if (c.status === 'Closed') {
      c.status = 'Open';
      changed = true;
    }
  });
  if (changed) saveCourses(courses);
}

export function getCoursesForUser(user) {
  applyCourseScheduleStatuses();
  const canMgmt = user?.role === 'Master' || user?.role === 'Admin';
  return getCourses().filter((c) => {
    if (c.status === 'Draft' && !canMgmt) return false;
    return true;
  });
}

export function getCoursesForAnalytics() {
  applyCourseScheduleStatuses();
  return getCourses().filter((c) => c.status !== 'Draft');
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
    getAttempts().filter((a) => a.completedAt && a.userId === userId)
  );
}

export function getUserAverageScoreForTeam(userId, teamId) {
  const teamCourseIds = new Set(
    getCourses().filter((c) => c.teamId === teamId).map((c) => c.id)
  );
  if (!teamCourseIds.size) return 0;
  return averageLatestPerCourse(
    getAttempts().filter(
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

export function getGlobalLeaderboard(limit = 3) {
  const users = getUsers();
  return users
    .map((u) => ({ user: u, score: getUserAverageScore(u.id) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getTeamLeaderboard(teamId, limit = 3, scoreFn) {
  const team = getTeams().find((t) => t.id === teamId);
  if (!team) return [];
  const resolveScore = scoreFn || ((uid) => getUserAverageScoreForTeam(uid, teamId));
  return team.members
    .map((uid) => {
      const user = getUserById(uid);
      return user ? { user, score: resolveScore(uid) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function isTop3Global(userId) {
  const top = getGlobalLeaderboard(3);
  return top.some((x) => x.user.id === userId);
}

export function isTop3Team(userId, teamId) {
  const top = getTeamLeaderboard(teamId, 3);
  return top.some((x) => x.user.id === userId);
}

export { KEYS };
