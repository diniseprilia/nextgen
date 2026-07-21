export const ROUTES = {
  dashboard: '/dashboard',
  teamboard: '/teamboard',
  teamCourses: '/teamboard/courses',
  teamTeammates: '/teamboard/teammates',
  teamMaterials: '/teamboard/materials',
  analytics: '/analytics',
  userandroles: '/userandroles',
  systemlogs: '/systemlogs',
  settings: '/settings',
};

const PAGE_TO_PATH = {
  '#page-dashboard': ROUTES.dashboard,
  '#page-users': ROUTES.userandroles,
  '#page-system-logs': ROUTES.systemlogs,
  '#page-settings': ROUTES.settings,
};

const TAB_SEGMENT_TO_TAB = {
  courses: 'courses',
  teammates: 'mates',
  materials: 'materials',
};

const TAB_TO_SEGMENT = {
  courses: 'courses',
  mates: 'teammates',
  materials: 'materials',
};

export function slugifyTeamName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function findTeamBySlug(teams, slug) {
  if (!slug || !teams?.length) return null;
  const normalized = slug.toLowerCase();
  return teams.find((t) => slugifyTeamName(t.name) === normalized) || null;
}

export function teamIdToSlug(teamId, teams) {
  const team = teams?.find((t) => t.id === teamId);
  return team ? slugifyTeamName(team.name) : null;
}

export function resolveTeamId(route, accessibleTeams) {
  if (!accessibleTeams?.length) return null;
  if (!route?.teamSlug) return accessibleTeams[0].id;
  const team = findTeamBySlug(accessibleTeams, route.teamSlug);
  if (team && accessibleTeams.some((t) => t.id === team.id)) return team.id;
  return accessibleTeams[0].id;
}

export function normalizePathname(pathname) {
  const path = (pathname || '/').split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

export function parsePath(pathname) {
  const path = normalizePathname(pathname);
  if (path === '/') return { page: '#page-dashboard' };
  if (path === ROUTES.dashboard) return { page: '#page-dashboard' };
  if (path === ROUTES.userandroles) return { page: '#page-users' };
  if (path === ROUTES.systemlogs) return { page: '#page-system-logs' };
  if (path === ROUTES.settings) return { page: '#page-settings' };

  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'analytics') {
    return { page: '#page-analytics', teamSlug: segments[1] || null };
  }

  if (segments[0] === 'teamboard') {
    if (segments.length === 1) {
      return { page: '#page-team', teamTab: 'courses', teamSlug: null };
    }
    const tabSegment = segments[1];
    const teamTab = TAB_SEGMENT_TO_TAB[tabSegment];
    if (teamTab) {
      return { page: '#page-team', teamTab, teamSlug: segments[2] || null };
    }
    return { page: '#page-team', teamTab: 'courses', teamSlug: null };
  }

  return { page: '#page-dashboard' };
}

export function buildPath(page, { teamTab, teamSlug } = {}) {
  if (page === '#page-team') {
    const segment = TAB_TO_SEGMENT[teamTab] || 'courses';
    const base = `/teamboard/${segment}`;
    return teamSlug ? `${base}/${teamSlug}` : base;
  }
  if (page === '#page-analytics') {
    return teamSlug ? `/analytics/${teamSlug}` : ROUTES.analytics;
  }
  return PAGE_TO_PATH[page] || ROUTES.dashboard;
}

export function syncUrl(page, { teamTab, teamId, teams } = {}, { replace = false } = {}) {
  const teamSlug = teamId ? teamIdToSlug(teamId, teams) : null;
  const path = buildPath(page, { teamTab, teamSlug });
  if (normalizePathname(window.location.pathname) === path) return;
  const state = { page, teamTab: teamTab || null, teamSlug };
  if (replace) {
    window.history.replaceState(state, '', path);
  } else {
    window.history.pushState(state, '', path);
  }
}

export function getPathForNav(page, { teamId, teams } = {}) {
  if (page === '#page-team') {
    const slug = teamId ? teamIdToSlug(teamId, teams) : null;
    return buildPath('#page-team', { teamTab: 'courses', teamSlug: slug });
  }
  if (page === '#page-analytics') {
    const slug = teamId ? teamIdToSlug(teamId, teams) : null;
    return buildPath('#page-analytics', { teamSlug: slug });
  }
  return PAGE_TO_PATH[page] || ROUTES.dashboard;
}
