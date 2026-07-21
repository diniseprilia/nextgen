import { ensureSeed, getSettings, saveSettings } from './storage.js';
import { getCourses, getCoursesForUser, getCoursesForAnalytics, loadCourses, createCourse, updateCourse, deleteCourse, refreshCourses } from './courses-api.js';
import { getAttempts, getLatestAttempt, getCourseProgressStatus, getAllAttemptsForUserCourse, getUserAverageScore, getUserAverageScoreForTeam, loadAttempts, createAttempt, updateAttempt, refreshAttempts, refreshAttemptsForCourse } from './attempts-api.js';
import { getUsers, getTeams, getUserById, loadUsersAndTeams, getAccessibleTeams, getInvitableTeams, userHasTeams, inviteUserToTeam, removeTeamMember, updateUserRole, promoteToAdmin, demoteAdmin, createTeam, deleteTeam, searchUsers, getGlobalLeaderboard, getTeamLeaderboard, isTop3Global, isTop3Team } from './users-api.js';
import { refreshMaterials, loadMaterials, getMaterialsList, createMaterial, updateMaterial, deleteMaterial, getDownloadUrl, getPreviewUrl, getContentUrl, fetchMaterialTextsForGeneration, isUrlMaterial, isFileMaterial, formatBytes, isApiAvailable, ALLOWED_MATERIAL_EXTENSIONS, UNSUPPORTED_FILE_ERROR } from './materials-api.js';
import { logout, getCurrentUser, checkSession, refreshCurrentUser, setCurrentUser, isMasterOrAdmin, isAdmin, canManageAdmins, canInviteUsers, formatLastLogin, initAuth, renderAuth0SignInButton, getAuthConfig } from './auth.js';
import { generateQuestions, scoreAttempt, formatDuration, normalizeFormats, isShortAnswerQuestion, isAnswerCorrect } from './quiz.js';
import { drawBarChart, drawProgressRings, drawLineChart } from './charts.js';
import { parsePath, syncUrl, getPathForNav, resolveTeamId } from './router.js';

let currentUser = null;
let selectedTeamId = null;
let analyticsTeamId = null;
let quizState = null;
let timerInterval = null;
let activeTeamTab = 'courses';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const PAGE_TITLES = {
  '#page-dashboard': 'Dashboard',
  '#page-team': 'Team Board',
  '#page-analytics': 'Analytics',
  '#page-users': 'Users & Roles',
  '#page-settings': 'Settings',
  '#page-quiz': 'Course',
  '#page-course-result': 'Course Result',
  '#page-course-intro': 'Course',
  '#page-course-mgmt-review': 'Course Review',
};

const NAV_ICON = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  team: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
  analytics: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',
  users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>',
};

const ADMIN_PAGES = new Set(['#page-users', '#page-settings']);

const scoreOf = (userId) => getUserAverageScore(userId);
const teamScoreOf = (teamId) => (userId) => getUserAverageScoreForTeam(userId, teamId, getCourses());

function canAccessPage(page) {
  if (page === '#page-analytics') return isMasterOrAdmin(currentUser);
  if (ADMIN_PAGES.has(page)) return isAdmin(currentUser);
  return true;
}

function getMgmtNavLinks() {
  if (!isMasterOrAdmin(currentUser)) return [];
  const links = [{ page: '#page-analytics', label: 'Analytics', icon: NAV_ICON.analytics }];
  if (isAdmin(currentUser)) {
    links.push(
      { page: '#page-users', label: 'Users & Roles', icon: NAV_ICON.users },
      { page: '#page-settings', label: 'Settings', icon: NAV_ICON.settings },
    );
  }
  return links;
}

function showView(id) {
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function showPage(pageId) {
  $$('.page').forEach((p) => p.classList.add('hidden'));
  $(pageId).classList.remove('hidden');
  $$('.ng-nav-item').forEach((l) => l.classList.toggle('active', l.dataset.page === pageId));
  const title = PAGE_TITLES[pageId] || 'NextGen';
  $('#page-title').textContent = title;
}

function showToast(message) {
  const toast = $('#ng-toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoader(show, text = 'Loading…') {
  $('#loader-text').textContent = text;
  $('#ng-loader').classList.toggle('show', show);
}

function statusBadge(status) {
  if (status.includes('Passed')) return 'ng-badge--success';
  if (status.includes('Failed')) return 'ng-badge--error';
  if (status === 'In progress') return 'ng-badge--warning';
  return 'ng-badge--muted';
}

function appAlert(message) {
  return new Promise((resolve) => {
    const dlg = $('#dialog-alert');
    $('#dialog-alert-message').textContent = message;
    const onClose = () => { dlg.removeEventListener('close', onClose); resolve(); };
    dlg.addEventListener('close', onClose);
    $('#dialog-alert-ok').onclick = () => dlg.close();
    dlg.showModal();
  });
}

function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const dlg = $('#dialog-confirm');
    $('#dialog-confirm-title').textContent = title;
    $('#dialog-confirm-message').textContent = message;
    dlg.showModal();
    const onClose = () => { dlg.removeEventListener('close', onClose); resolve(dlg.returnValue === 'confirm'); };
    dlg.addEventListener('close', onClose);
    $('#dialog-cancel').onclick = () => dlg.close('cancel');
    $('#dialog-confirm-btn').onclick = () => dlg.close('confirm');
  });
}

function applyRoleClasses() {
  if (!currentUser) {
    delete document.body.dataset.role;
    return;
  }
  document.body.dataset.role = currentUser.role === 'Admin' ? 'admin'
    : currentUser.role === 'Master' ? 'master' : 'rookie';
}

function switchTeamTab(tabName, { updateUrl = true, skipHistory = false } = {}) {
  const tabMap = { management: 'courses' };
  tabName = tabMap[tabName] || tabName;
  activeTeamTab = tabName;
  $$('#team-tabs .ng-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tabName));
  ['courses', 'mates', 'materials'].forEach((name) => {
    const panel = $(`#team-tab-${name}`);
    if (panel) panel.classList.toggle('hidden', name !== tabName);
  });
  const matesActions = $('#mates-tab-actions');
  const matActions = $('#materials-tab-actions');
  if (matesActions) matesActions.classList.toggle('hidden', tabName !== 'mates' || !isMasterOrAdmin(currentUser));
  if (matActions) matActions.classList.toggle('hidden', tabName !== 'materials' || !isMasterOrAdmin(currentUser));

  switch (tabName) {
    case 'courses': renderTeamCourses().catch(console.error); break;
    case 'mates': renderTeamMates(); break;
    case 'materials': renderMaterials().catch(console.error); break;
  }

  if (updateUrl && !$('#page-team')?.classList.contains('hidden')) {
    syncRouteUrl('#page-team', { teamTab: tabName, replace: skipHistory });
  }
}

function buildNav() {
  const mainLinks = [
    { page: '#page-dashboard', label: 'Dashboard', icon: NAV_ICON.dashboard },
    { page: '#page-team', label: 'Team Board', icon: NAV_ICON.team },
  ];
  const mgmtLinks = getMgmtNavLinks();
  const nav = $('#sidebar-nav');

  const teams = getAccessibleTeams(currentUser);
  nav.innerHTML = mainLinks.map(({ page, label, icon }) =>
    `<a class="ng-nav-item" href="${getPathForNav(page, { teamId: selectedTeamId, teams })}" data-page="${page}">${icon}${label}</a>`).join('') +
    (mgmtLinks.length ? `<div class="ng-sidebar-label">Management</div>` +
      mgmtLinks.map(({ page, label, icon }) =>
        `<a class="ng-nav-item" href="${getPathForNav(page, { teamId: page === '#page-analytics' ? analyticsTeamId || selectedTeamId : null, teams })}" data-page="${page}">${icon}${label}</a>`).join('') : '');

  nav.querySelectorAll('.ng-nav-item').forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();
      if (el.dataset.page === '#page-team') navigateToTeamTab('courses');
      else if (el.dataset.page === '#page-analytics') navigate('#page-analytics', { teamId: selectedTeamId });
      else navigate(el.dataset.page);
    };
  });
}

function syncRouteUrl(page, { teamTab, replace = false } = {}) {
  const teams = getAccessibleTeams(currentUser);
  let teamId = null;
  if (page === '#page-team') teamId = selectedTeamId;
  if (page === '#page-analytics') teamId = analyticsTeamId;
  syncUrl(page, { teamTab, teamId, teams }, { replace });
}

function navigate(page, { teamTab, teamId, replace = false, skipHistory = false } = {}) {
  if (!canAccessPage(page)) page = '#page-dashboard';
  const teams = getAccessibleTeams(currentUser);
  if (page === '#page-team' && teamId) selectedTeamId = teamId;
  if (page === '#page-analytics') {
    analyticsTeamId = teamId || analyticsTeamId || selectedTeamId || teams[0]?.id || null;
  }
  showPage(page);
  switch (page) {
    case '#page-dashboard': renderDashboard().catch(console.error); break;
    case '#page-team':
      if (teamTab) activeTeamTab = teamTab;
      renderTeamBoard({ initialTab: activeTeamTab });
      break;
    case '#page-analytics': renderAnalytics().catch(console.error); break;
    case '#page-users': renderUsers(); break;
    case '#page-settings': renderSettings(); break;
  }
  if (!skipHistory) {
    syncRouteUrl(page, { teamTab: page === '#page-team' ? activeTeamTab : null, replace });
  }
}

function navigateToTeamTab(teamTab, { replace = false, skipHistory = false } = {}) {
  activeTeamTab = teamTab;
  navigate('#page-team', { teamTab, teamId: selectedTeamId, replace, skipHistory });
}

function applyRouteFromLocation({ replace = false, syncHistory = false } = {}) {
  const route = parsePath(window.location.pathname);
  const teams = getAccessibleTeams(currentUser);
  if (route.teamTab) activeTeamTab = route.teamTab;
  if (route.page === '#page-team') {
    selectedTeamId = resolveTeamId(route, teams);
  } else if (route.page === '#page-analytics') {
    analyticsTeamId = resolveTeamId(route, teams);
  }
  navigate(route.page, {
    teamTab: route.teamTab,
    teamId: route.page === '#page-analytics' ? analyticsTeamId : selectedTeamId,
    replace,
    skipHistory: true,
  });
  if (syncHistory) {
    syncRouteUrl(route.page, { teamTab: route.teamTab, replace: true });
  }
}

function enterApp() {
  currentUser = getCurrentUser();
  if (!currentUser) { showLogin(); return; }
  showView('#view-app');
  applyRoleClasses();
  buildNav();
  $('#user-chip').innerHTML = `<span class="ng-user-name">${currentUser.name}</span><span class="ng-avatar">${currentUser.name[0]}</span>`;
  showLoader(true, 'Loading…');
  Promise.all([loadUsersAndTeams(), loadMaterials(), loadCourses(), loadAttempts()])
    .then(async () => {
      currentUser = (await refreshCurrentUser()) || currentUser;
      setCurrentUser(currentUser);
      applyRouteFromLocation({ replace: true, syncHistory: true });
      buildNav();
    })
    .finally(() => showLoader(false));
}

async function showLogin() {
  showView('#view-login');
  currentUser = null;
  applyRoleClasses();
  $('#login-error').classList.add('hidden');
  const originHint = $('#login-origin-hint');
  if (originHint) {
    const origin = window.location.origin;
    const authConfig = getAuthConfig();
    const callback = authConfig?.callbackUrl || `${origin}/api/auth/oauth/callback`;
    originHint.innerHTML = `Developer: add this URL in Auth0 → Application → Settings → <strong>Allowed Callback URLs</strong>:<br><code>${callback}</code><br>And <strong>Allowed Logout URLs</strong>: <code>${origin}</code>`;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      originHint.classList.remove('hidden');
    } else {
      originHint.classList.add('hidden');
    }
  }
  renderAuth0SignInButton(
    $('#auth0-signin-btn'),
    () => enterApp(),
    (err) => {
      $('#login-error').textContent = err;
      $('#login-error').classList.remove('hidden');
    },
  );
}

async function renderDashboard(skipDataRefresh = false) {
  if (!userHasTeams(currentUser)) {
    $('#global-gamification').innerHTML = `
      <section class="ng-hero">
        <div class="ng-hero-inner">
          <div class="ng-hero-badge">👋 Welcome aboard</div>
          <h2>Hello, ${currentUser.name.split(' ')[0]}!</h2>
          <p>Your account is ready. Ask your Master to invite you to a team — once you're on a team, courses and progress tracking will appear here.</p>
        </div>
      </section>`;
    $('#dashboard-metrics').innerHTML = `
      <article class="ng-metric"><div class="ng-metric-icon ng-metric-icon--red">📚</div><div class="ng-metric-value">0</div><div class="ng-metric-label">Courses completed</div></article>
      <article class="ng-metric"><div class="ng-metric-icon ng-metric-icon--blue">🎯</div><div class="ng-metric-value">—</div><div class="ng-metric-label">Average score</div></article>
      <article class="ng-metric"><div class="ng-metric-icon ng-metric-icon--gold">⏱</div><div class="ng-metric-value">0</div><div class="ng-metric-label">Hours studied this week</div></article>
      <article class="ng-metric"><div class="ng-metric-icon ng-metric-icon--green">🏅</div><div class="ng-metric-value">—</div><div class="ng-metric-label">Global rank</div></article>`;
    drawBarChart($('#chart-completion'), ['No data yet'], [0]);
    drawProgressRings($('#chart-progress'), [{ label: '—', value: 0 }]);
    drawLineChart($('#chart-hours'), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], [0, 0, 0, 0, 0, 0, 0]);
    $('#team-progress-section').innerHTML = `<p class="muted" style="margin-top:var(--ng-space-4);">${formatLastLogin(currentUser.lastLogin)}</p>`;
    return;
  }

  if (!skipDataRefresh) {
    try {
      await refreshAttempts();
      await refreshCourses();
    } catch {
      /* use cached data */
    }
  }

  const userTeamIds = new Set(currentUser.teamIds || []);
  const elite = isTop3Global(currentUser.id, scoreOf);
  const rank = getGlobalRank();
  const courses = getCourses().filter((c) => c.status === 'Open' && userTeamIds.has(c.teamId));
  const completed = courses.filter((c) => getCourseProgressStatus(currentUser.id, c.id).status.includes('Passed')).length;
  const avgScore = calcAvgScore();
  const hours = calcWeeklyHours();
  const inProgress = courses.filter((c) => getCourseProgressStatus(currentUser.id, c.id).status === 'In progress').length;

  $('#global-gamification').innerHTML = `
    <section class="ng-hero">
      <div class="ng-hero-inner">
        <div class="ng-hero-badge">${elite ? '👑 Elite Elite Status!' : '📈 The Climb Continues!'}</div>
        <h2>Good morning, ${currentUser.name.split(' ')[0]}!</h2>
        <p>${elite
    ? 'Phenomenal! Out of all users on the platform, you have climbed into the top 3. You are demonstrating true NextGen excellence.'
    : "Every step forward counts! You didn't make the global top 3 this time, but you are well on your way. Keep up the momentum and stay focused."}</p>
        <div class="ng-hero-actions">
          <button type="button" class="ng-btn ng-btn--brand" data-go-team>View Team Board</button>
        </div>
      </div>
    </section>`;
  $('#global-gamification [data-go-team]').onclick = () => navigateToTeamTab('courses');

  $('#dashboard-metrics').innerHTML = `
    <article class="ng-metric"><div class="ng-metric-icon ng-metric-icon--red">📚</div><div class="ng-metric-value">${completed}</div><div class="ng-metric-label">Courses completed</div><div class="ng-metric-trend ng-metric-trend--up">of ${courses.length} open</div></article>
    <article class="ng-metric"><div class="ng-metric-icon ng-metric-icon--blue">🎯</div><div class="ng-metric-value">${avgScore}%</div><div class="ng-metric-label">Average score</div></article>
    <article class="ng-metric"><div class="ng-metric-icon ng-metric-icon--gold">⏱</div><div class="ng-metric-value">${hours}</div><div class="ng-metric-label">Hours studied this week</div></article>
    <article class="ng-metric"><div class="ng-metric-icon ng-metric-icon--green">🏅</div><div class="ng-metric-value">#${rank}</div><div class="ng-metric-label">Global rank</div></article>`;

  const completionLabels = courses.map((c) => c.title.slice(0, 12));
  const completionValues = courses.map((c) => {
    const { status } = getCourseProgressStatus(currentUser.id, c.id);
    if (status.includes('Passed')) return 100;
    if (status === 'In progress') return 50;
    return 0;
  });
  drawBarChart($('#chart-completion'), completionLabels.length ? completionLabels : ['No courses'], completionValues.length ? completionValues : [0]);

  const progressItems = courses.slice(0, 4).map((c) => {
    const { status } = getCourseProgressStatus(currentUser.id, c.id);
    let val = 0;
    if (status.includes('Passed')) val = 100;
    else if (status.includes('Failed')) val = 60;
    else if (status === 'In progress') val = 40;
    return { label: c.title.slice(0, 10), value: val };
  });
  drawProgressRings($('#chart-progress'), progressItems.length ? progressItems : [{ label: 'Start', value: 0 }]);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hoursData = days.map((_, i) => Math.max(0, Math.round(hours / 7) + (i % 3) - 1));
  drawLineChart($('#chart-hours'), days, hoursData);

  $('#team-progress-section').innerHTML = `<p class="muted" style="margin-top:var(--ng-space-4);">Last login: ${formatLastLogin(currentUser.lastLogin)}</p>`;
}

function getGlobalRank() {
  const board = getGlobalLeaderboard(100, scoreOf);
  const idx = board.findIndex((x) => x.user.id === currentUser.id);
  return idx >= 0 ? idx + 1 : board.length + 1;
}

function calcAvgScore() {
  const attempts = getAttempts().filter((a) => a.userId === currentUser.id && a.completedAt);
  if (!attempts.length) return 0;
  return Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length);
}

function calcWeeklyHours() {
  const attempts = getAttempts().filter((a) => a.userId === currentUser.id && a.durationSeconds);
  if (!attempts.length) return 0;
  return Math.round(attempts.reduce((s, a) => s + (a.durationSeconds || 0), 0) / 3600 * 10) / 10;
}

function renderTeamBoard({ initialTab } = {}) {
  const teams = getAccessibleTeams(currentUser);
  const sel = $('#team-selector');
  const tabs = $('#team-tabs');

  if (!teams.length) {
    sel.innerHTML = '';
    selectedTeamId = null;
    $('#team-performance-hero').innerHTML = `
      <section class="ng-empty-state" style="text-align:center;padding:var(--ng-space-8);">
        <h2 style="margin-bottom:var(--ng-space-3);">No team yet</h2>
        <p class="muted">You don't have a team yet. Please ask your Master to invite you to the team.</p>
      </section>`;
    if (tabs) tabs.classList.add('hidden');
    ['#team-tab-courses', '#team-tab-mates', '#team-tab-materials'].forEach((id) => {
      const el = $(id);
      if (el) { el.innerHTML = ''; el.classList.add('hidden'); }
    });
    return;
  }

  if (tabs) tabs.classList.remove('hidden');
  if (!selectedTeamId || !teams.some((t) => t.id === selectedTeamId)) {
    selectedTeamId = teams[0].id;
  }

  sel.innerHTML = teams.map((t) => `<option value="${t.id}" ${t.id === selectedTeamId ? 'selected' : ''}>${t.name}</option>`).join('');
  sel.onchange = () => {
    selectedTeamId = sel.value;
    syncRouteUrl('#page-team', { teamTab: activeTeamTab, replace: true });
    buildNav();
    renderTeamPerformanceHero();
    switchTeamTab(activeTeamTab, { updateUrl: false });
  };

  renderTeamPerformanceHero();

  $$('#team-tabs .ng-tab').forEach((tab) => {
    tab.onclick = () => {
      navigateToTeamTab(tab.dataset.tab);
    };
  });

  const tabToShow = initialTab || activeTeamTab || 'courses';
  switchTeamTab(tabToShow, { updateUrl: false });
}

function renderTeamPerformanceHero() {
  const hero = $('#team-performance-hero');
  if (!selectedTeamId) {
    hero.innerHTML = '<p class="muted">Select a team to view performance.</p>';
    return;
  }

  const top = getTeamLeaderboard(selectedTeamId, 3, teamScoreOf(selectedTeamId));
  const inTop3 = isTop3Team(currentUser.id, selectedTeamId, teamScoreOf(selectedTeamId));
  const gamification = inTop3
    ? `<div class="ng-gamification-badge"><div class="emoji">🏆</div><h3>NextGen Lead Pack!</h3><p>"Incredible effort! You've secured a spot in the Top 3 of your team leaderboard."</p></div>`
    : `<div class="ng-gamification-badge"><div class="emoji">💪</div><h3>Keep Pushing, NextGen!</h3><p>"You're making great progress! The leaderboard is tight — don't give up."</p></div>`;

  const podiumOrder = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0], null] : top.length === 1 ? [null, top[0], null] : [];
  const podiumHtml = podiumOrder.map((entry, idx) => {
    if (!entry) return '<div class="ng-podium-item" style="visibility:hidden"></div>';
    const initials = entry.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2);
    const isYou = entry.user.id === currentUser.id;
    const crown = idx === 1 ? '<span class="ng-podium-crown">👑</span>' : '';
    const medals = ['🥈', '🥇', '🥉'];
    return `<div class="ng-podium-item">${crown}<div class="ng-podium-avatar">${initials}</div><div class="ng-podium-name">${entry.user.name}${isYou ? ' (You)' : ''}</div><div class="ng-podium-score">${medals[idx] || ''} ${entry.score} pts</div><div class="ng-podium-pedestal"></div></div>`;
  }).join('');

  const allTeamScores = getTeamLeaderboard(selectedTeamId, 20, teamScoreOf(selectedTeamId));
  const scoreBars = allTeamScores.map((x) => {
    const isYou = x.user.id === currentUser.id;
    return `<div class="ng-score-row ${isYou ? 'ng-score-row--you' : ''}"><span>${x.user.name.split(' ')[0]}${isYou ? ' ⭐' : ''}</span><div class="ng-score-track"><div class="ng-score-fill" style="width:${x.score}%"></div></div><span>${x.score}</span></div>`;
  }).join('');

  hero.innerHTML = `
    <section class="ng-team-hero"><div class="ng-team-hero-inner">
      <h2>Team Performance</h2>${gamification}
      <div class="ng-podium">${podiumHtml || '<p class="muted">No scores yet.</p>'}</div>
      ${allTeamScores.length ? `<div class="ng-score-bars">${scoreBars}</div>` : ''}
    </div></section>`;
}

async function refreshPerformanceViews() {
  try {
    await refreshAttempts();
    await refreshCourses();
  } catch {
    /* use cached data */
  }
  if (!$('#page-analytics')?.classList.contains('hidden')) {
    const courseId = $('#analytics-course-select')?.value;
    if (courseId) {
      await refreshAttemptsForCourse(courseId);
      renderAnalyticsResults();
    } else {
      renderAnalyticsResults();
    }
  }
  if (!$('#page-dashboard')?.classList.contains('hidden')) await renderDashboard(true);
  if (!$('#page-team')?.classList.contains('hidden')) {
    renderTeamPerformanceHero();
    await renderTeamCourses(true);
  }
}

async function renderTeamCourses(skipDataRefresh = false) {
  if (!skipDataRefresh) {
    try {
      await refreshCourses();
    } catch {
      /* use cached courses */
    }
  }
  const panel = $('#team-tab-courses');
  const canMgmt = isMasterOrAdmin(currentUser);
  const courses = getCoursesForUser(currentUser, selectedTeamId);

  const toolbar = canMgmt
    ? `<div class="ng-tab-panel-actions"><button type="button" class="ng-btn ng-btn--dark" id="btn-add-course">+ Create course</button></div>`
    : '';

  const rows = courses.map((c) => {
    const { status, attempt } = getCourseProgressStatus(currentUser.id, c.id);
    const opened = attempt?.openedAt ? new Date(attempt.openedAt).toLocaleDateString() : '—';
    const score = attempt?.completedAt ? `${attempt.score}%` : '—';
    const isClosed = c.status === 'Closed';
    const canAttempt = !isClosed && c.status === 'Open';
    const canRetry = status.includes('Failed');
    const canStart = status === 'Not started' || status === 'In progress' || canRetry;
    let learnerAction = '';
    if (status.includes('Passed') && attempt?.completedAt) {
      learnerAction = `<button type="button" class="ng-btn-link" data-view-result="${c.id}">View</button>`;
    } else if (canAttempt && canRetry && attempt?.completedAt) {
      learnerAction = `<button type="button" class="ng-btn-link" data-start-quiz="${c.id}">Re-attempt</button>`;
    } else if (canAttempt && status === 'In progress') {
      learnerAction = `<button type="button" class="ng-btn-link" data-start-quiz="${c.id}">Continue</button>`;
    } else if (canAttempt && canStart) {
      learnerAction = `<button type="button" class="ng-btn-link" data-intro-quiz="${c.id}">Start</button>`;
    }

    const statusCell = canMgmt
      ? `<span class="ng-badge ${c.status === 'Open' ? 'ng-badge--success' : c.status === 'Draft' ? 'ng-badge--warning' : 'ng-badge--muted'}">${c.status}</span><br><span class="muted">${status}</span>`
      : isClosed
        ? `<span class="ng-badge ng-badge--muted">Closed</span>${attempt?.completedAt ? `<br><span class="muted">${status}</span>` : ''}`
        : `<span class="ng-badge ${statusBadge(status)}">${status}</span>`;

    const mgmtActions = canMgmt ? `<div class="ng-course-mgmt-actions">
        <button type="button" class="ng-btn-link" data-mgmt-view="${c.id}">Review</button>
        <button type="button" class="ng-btn-link" data-edit-course="${c.id}">Edit</button>
      </div>` : '';

    return `<tr>
      <td><strong>${c.title}</strong><br><span class="muted">${c.description || ''}</span></td>
      <td>${statusCell}</td>
      <td>${opened}</td><td>${score}</td>
      <td>${learnerAction}${mgmtActions ? (learnerAction ? '<br>' : '') + mgmtActions : ''}</td></tr>`;
  }).join('') || `<tr><td colspan="5">No courses available.</td></tr>`;

  panel.innerHTML = `${toolbar}<div class="ng-table-wrap"><table class="ng-table data-table"><thead><tr>
    <th>Course</th><th>Status</th><th>Attempt at</th><th>Score</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;

  panel.querySelectorAll('[data-view-result]').forEach((btn) => btn.onclick = () => showCourseResult(btn.dataset.viewResult));
  panel.querySelectorAll('[data-intro-quiz]').forEach((btn) => btn.onclick = () => showCourseIntro(btn.dataset.introQuiz, 'start'));
  panel.querySelectorAll('[data-start-quiz]').forEach((btn) => {
    btn.onclick = () => {
      const { status } = getCourseProgressStatus(currentUser.id, btn.dataset.startQuiz);
      if (status.includes('Failed')) showCourseIntro(btn.dataset.startQuiz, 'reattempt');
      else startQuiz(btn.dataset.startQuiz);
    };
  });
  if (canMgmt) {
    $('#btn-add-course')?.addEventListener('click', () => openCourseDialog(null));
    panel.querySelectorAll('[data-mgmt-view]').forEach((btn) => btn.onclick = () => showCourseMgmtReview(btn.dataset.mgmtView));
    panel.querySelectorAll('[data-edit-course]').forEach((btn) => btn.onclick = () => openCourseDialog(btn.dataset.editCourse));
  }
}

function showCourseResult(courseId) {
  const course = getCourses().find((c) => c.id === courseId);
  const attempt = getLatestAttempt(currentUser.id, courseId);
  if (!course || !attempt?.completedAt) return appAlert('No completed attempt found.');
  showPage('#page-course-result');
  $('#page-title').textContent = 'Course Result';
  $('#course-result-breadcrumb').innerHTML = `<a href="#" data-back-team>Team Board</a> › <span>${course.title}</span>`;
  $('#course-result-breadcrumb [data-back-team]').onclick = (e) => { e.preventDefault(); navigateToTeamTab('courses'); };

  const correct = course.questions.filter((q) => isAnswerCorrect(q, attempt.answers?.[q.id])).length;
  const answers = course.questions.map((q) => {
    const ok = isAnswerCorrect(q, attempt.answers?.[q.id]);
    let chosen;
    let correctAns;
    if (isShortAnswerQuestion(q)) {
      chosen = attempt.answers?.[q.id] || '—';
      correctAns = q.correctAnswer || '—';
    } else {
      chosen = q.options?.[attempt.answers?.[q.id]] || '—';
      correctAns = q.options?.[q.correctAnswer] || '—';
    }
    return `<li class="ng-answer-item ${ok ? 'correct' : 'incorrect'}">${ok ? '✓' : '✗'} ${q.question.slice(0, 80)} — <strong>${ok ? correctAns : `You: ${chosen} · Correct: ${correctAns}`}</strong></li>`;
  }).join('');

  $('#course-result-content').innerHTML = `
    <div class="ng-course-header"><div class="ng-course-header-top"><div><h2>${course.title}</h2><p class="muted">${course.description || ''}</p></div>
    <span class="ng-badge ${attempt.passed ? 'ng-badge--success' : 'ng-badge--error'}">Completed (${attempt.passed ? 'Pass' : 'Fail'})</span></div>
    <div class="ng-course-meta"><span>Attempted: ${new Date(attempt.completedAt).toLocaleDateString()}</span><span>Duration: ${formatDuration(attempt.durationSeconds)}</span></div></div>
    <div class="ng-result-grid">
      <div class="ng-result-stat"><div class="value">${attempt.score}%</div><div class="label">Your score</div></div>
      <div class="ng-result-stat"><div class="value">${correct}/${course.questions.length}</div><div class="label">Correct</div></div>
      <div class="ng-result-stat"><div class="value">${getAllAttemptsForUserCourse(currentUser.id, courseId).length}</div><div class="label">Attempts</div></div>
    </div>
    <div class="ng-panel"><div class="ng-panel-header"><h3>Answer summary</h3></div><ul class="ng-answer-list">${answers}</ul></div>
    <button type="button" class="ng-btn ng-btn--outline" data-back-team style="margin-top:var(--ng-space-5);">← Back to Team Board</button>`;
  $('#course-result-content [data-back-team]').onclick = () => navigateToTeamTab('courses');
}

function showCourseIntro(courseId, mode) {
  const course = getCourses().find((c) => c.id === courseId);
  if (!course) return;
  if (course.status === 'Closed' && !isMasterOrAdmin(currentUser)) {
    return appAlert('This course is closed and no longer accepts attempts.');
  }
  if (course.status === 'Draft' && !isMasterOrAdmin(currentUser)) {
    return appAlert('Course is draft.');
  }
  showPage('#page-course-intro');
  $('#page-title').textContent = mode === 'reattempt' ? 'Re-attempt Course' : 'Start Course';
  $('#course-intro-breadcrumb').innerHTML = `<a href="#" data-back-team>Team Board</a> › <span>${course.title}</span>`;
  $('#course-intro-breadcrumb [data-back-team]').onclick = (e) => { e.preventDefault(); navigateToTeamTab('courses'); };

  const warn = mode === 'reattempt' ? `<div class="ng-alert ng-alert--warning">Re-attempt uses the same questions unless the course was synced by Master/Admin.</div>` : `<div class="ng-alert ng-alert--info">You can close the course anytime — progress saves as In progress.</div>`;

  $('#course-intro-content').innerHTML = `
    <div class="ng-hero" style="margin-bottom:var(--ng-space-5);"><div class="ng-hero-inner"><div class="ng-hero-badge">📚 ${course.status}</div><h2>${course.title}</h2><p>${course.description || ''}</p></div></div>
    <div class="ng-intro-card"><h3>${mode === 'reattempt' ? 'Ready to try again?' : 'Before you begin'}</h3>
    <ul class="ng-intro-list"><li>📄 ${course.questions?.length || 0} questions</li><li>🎯 Pass mark: ${course.minScore}%</li><li>📚 Materials: ${course.materialIds?.length || 0} linked</li></ul>
    ${warn}
    <div style="display:flex;gap:var(--ng-space-3);margin-top:var(--ng-space-5);">
      <button type="button" class="ng-btn ng-btn--brand" data-begin-quiz>Start Course</button>
      <button type="button" class="ng-btn ng-btn--outline" data-back-team>Back</button>
    </div></div>`;
  $('#course-intro-content [data-begin-quiz]').onclick = () => startQuiz(courseId);
  $('#course-intro-content [data-back-team]').onclick = () => navigateToTeamTab('courses');
}

function showCourseMgmtReview(courseId) {
  if (!isMasterOrAdmin(currentUser)) { navigateToTeamTab('courses'); return; }
  const course = getCourses().find((c) => c.id === courseId);
  if (!course) return;
  showPage('#page-course-mgmt-review');
  $('#page-title').textContent = 'Course Review';
  $('#course-mgmt-breadcrumb').innerHTML = `<a href="#" data-back-courses>Courses</a> › <span>${course.title}</span>`;
  $('#course-mgmt-breadcrumb [data-back-courses]').onclick = (e) => { e.preventDefault(); navigateToTeamTab('courses'); };

  const questions = (course.questions || []).map((q, i) => `
    <div class="ng-question-review"><strong>Q${i + 1}.</strong> ${q.question}<div class="correct-answer">✓ Correct: ${q.options?.[q.correctAnswer] || q.correctAnswer}</div></div>`).join('');

  $('#course-mgmt-review-content').innerHTML = `
    <div class="ng-course-header"><div class="ng-course-header-top"><div><h2>${course.title}</h2><p class="muted">${course.description || ''}</p></div>
    <span class="ng-badge ng-badge--success">${course.status}</span></div>
    <div class="ng-course-meta"><span>${course.questions?.length || 0} questions</span><span>Min: ${course.minScore}%</span></div></div>
    <div class="ng-toolbar"><button type="button" class="ng-btn ng-btn--outline" data-edit-course>Edit course</button></div>
    <div class="ng-panel"><div class="ng-panel-header"><h3>Generated questions</h3><span>Showing correct answers</span></div>${questions || '<p class="muted">No questions yet. Use Edit course to generate questions.</p>'}</div>
    <button type="button" class="ng-btn ng-btn--outline" data-back-courses>← Back</button>`;

  $('#course-mgmt-review-content [data-edit-course]').onclick = () => openCourseDialog(courseId);
  $('#course-mgmt-review-content [data-back-courses]').onclick = () => navigateToTeamTab('courses');
}

function renderTeamMates() {
  const list = $('#mates-list');
  const team = getTeams().find((t) => t.id === selectedTeamId);
  const actions = $('#mates-tab-actions');
  const canEdit = isMasterOrAdmin(currentUser);
  if (actions) {
    actions.classList.toggle('hidden', !canEdit);
    actions.innerHTML = canEdit ? `<button type="button" class="ng-btn ng-btn--dark" id="btn-add-mate">+ Invite teammate</button>` : '';
    $('#btn-add-mate')?.addEventListener('click', () => openInviteDialog(selectedTeamId), { once: true });
  }
  if (!team) { list.innerHTML = '<p class="muted">Select a team.</p>'; return; }

  const rows = team.members.map((mid) => {
    const u = getUserById(mid);
    if (!u) return '';
    const score = getTeamLeaderboard(selectedTeamId, 50, teamScoreOf(selectedTeamId)).find((x) => x.user.id === u.id)?.score ?? '—';
    const roleCell = canEdit && u.id !== currentUser.id
      ? `<select class="ng-table-select" data-role-user="${u.id}">${['Rookie', 'Master', ...(canManageAdmins(currentUser) ? ['Admin'] : [])].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>`
      : `<span class="ng-badge ng-badge--muted">${u.role}</span>`;
    return `<tr><td><strong>${u.name}${u.id === currentUser.id ? ' (You)' : ''}</strong></td><td>${roleCell}</td><td><strong>${score}</strong></td>
      ${canEdit ? `<td>${u.id !== currentUser.id ? `<button type="button" class="ng-btn-link" data-remove-member="${u.id}">Remove</button>` : ''}</td>` : ''}</tr>`;
  }).join('');

  list.innerHTML = `<div class="ng-table-wrap"><table class="ng-table data-table"><thead><tr>
    <th>Name</th><th>Role</th><th>Score</th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;

  if (canEdit) {
    list.querySelectorAll('[data-role-user]').forEach((sel) => {
      sel.onchange = async () => {
        try {
          await updateUserRole(sel.dataset.roleUser, sel.value);
          currentUser = (await refreshCurrentUser()) || currentUser;
          applyRoleClasses();
          renderTeamMates();
        } catch (err) {
          appAlert(err.message);
        }
      };
    });
    list.querySelectorAll('[data-remove-member]').forEach((btn) => {
      btn.onclick = async () => {
        if (!await confirmDialog('Remove member', 'Remove this user from the team?')) return;
        try {
          await removeTeamMember(selectedTeamId, btn.dataset.removeMember);
          renderTeamMates();
        } catch (err) {
          appAlert(err.message);
        }
      };
    });
  }
}

function openMaterialView(materialId) {
  openMaterialViewAsync(materialId).catch(console.error);
}

async function openMaterialViewAsync(materialId) {
  const m = getMaterialsList().find((x) => x.id === materialId);
  if (!m) return;
  if (isUrlMaterial(m)) {
    window.open(m.sourceUrl, '_blank', 'noopener');
    showToast('Opening external material…');
    return;
  }
  const dlg = $('#dialog-material-view');
  const fileMeta = m.file
    ? `<span>📄 ${m.file.extension?.toUpperCase() || 'FILE'} · ${formatBytes(m.file.sizeBytes)}</span>`
    : '<span>📄 File</span>';
  $('#material-view-title').textContent = m.title;
  $('#material-view-meta').innerHTML = `${fileMeta}<span>Group: ${m.group}</span><span>Updated: ${new Date(m.updatedAt).toLocaleDateString()}</span>`;

  const body = $('#material-view-body');
  const ext = (m.file?.extension || '').toLowerCase();
  const isPdf = ext === 'pdf' || m.file?.mimeType === 'application/pdf';
  const officeExts = new Set(['doc', 'docx', 'ppt', 'pptx']);

  if (!m.content?.trim() && isApiAvailable() && isFileMaterial(m)) {
    try {
      const res = await fetch(getContentUrl(m.id), { credentials: 'include' });
      if (res.ok) {
        const { content } = await res.json();
        if (content?.trim()) m.content = content;
      }
    } catch {
      /* preview without extracted text */
    }
  }

  if (isPdf && isApiAvailable() && isFileMaterial(m)) {
    body.className = 'ng-file-preview ng-file-preview--embed';
    body.innerHTML = `<iframe src="${getPreviewUrl(m.id)}" title="${m.title}"></iframe>`;
  } else if (officeExts.has(ext) && m.content?.trim()) {
    body.className = 'ng-file-preview';
    body.textContent = m.content.trim();
  } else if (officeExts.has(ext) && isApiAvailable() && isFileMaterial(m)) {
    body.className = 'ng-file-preview';
    body.textContent = `Text preview is not available. Use Download to open ${m.file?.originalName || 'the file'}.`;
  } else if (m.content?.trim()) {
    body.className = 'ng-file-preview';
    body.textContent = m.content.trim();
  } else {
    body.className = 'ng-file-preview';
    body.textContent = `Preview is not available for this file type. Use Download to open ${m.file?.originalName || 'the file'}.`;
  }

  const downloadBtn = isApiAvailable() && isFileMaterial(m)
    ? `<a href="${getDownloadUrl(m.id)}" class="ng-btn ng-btn--brand" download>⬇ Download file</a>`
    : `<button type="button" class="ng-btn ng-btn--brand" id="mat-download-btn">⬇ Download file</button>`;
  $('#material-view-footer').innerHTML = `
    <button type="button" class="ng-btn ng-btn--outline" id="mat-view-close-btn">Close</button>
    ${downloadBtn}`;
  $('#mat-view-close-btn').onclick = () => dlg.close();
  $('#material-view-close').onclick = () => dlg.close();
  const legacyBtn = $('#mat-download-btn');
  if (legacyBtn) {
    legacyBtn.onclick = () => {
      const blob = new Blob([m.content || ''], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${m.title.replace(/\s+/g, '_')}.txt`;
      a.click();
    };
  }
  dlg.showModal();
}

async function renderMaterials(skipDataRefresh = false) {
  if (!skipDataRefresh) {
    try {
      await refreshMaterials();
    } catch {
      /* use cached materials */
    }
  }
  const list = $('#materials-list');
  const materials = getMaterialsList(selectedTeamId);
  const canEdit = isMasterOrAdmin(currentUser);
  const apiNote = isApiAvailable()
    ? ''
    : '<p class="muted" style="margin-bottom:var(--ng-space-4);">API offline — showing local cache. Start the server to sync with MongoDB.</p>';

  list.innerHTML = `${apiNote}${canEdit ? '' : '<p class="muted" style="margin-bottom:var(--ng-space-4);">View material library (read-only)</p>'}
  <div class="ng-table-wrap"><table class="ng-table data-table"><thead><tr>
    <th>Material</th><th>Group</th><th>Type</th><th>Updated</th><th></th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>
    ${materials.map((m) => {
    const isLink = isUrlMaterial(m);
    return `<tr><td><strong>${m.title}</strong></td><td>${m.group}</td>
      <td><span class="ng-badge ng-badge--muted">${isLink ? 'Link' : 'File'}</span></td>
      <td>${new Date(m.updatedAt).toLocaleDateString()}</td>
      <td><button type="button" class="ng-btn-link" data-view-material="${m.id}">View</button></td>
      ${canEdit ? `<td><button type="button" class="ng-btn-link" data-edit-material="${m.id}">Edit</button>
      <button type="button" class="ng-btn-link" style="color:var(--ng-error);" data-del-material="${m.id}">Delete</button></td>` : ''}</tr>`;
  }).join('') || '<tr><td colspan="6">No materials yet.</td></tr>'}
  </tbody></table></div>`;

  list.querySelectorAll('[data-view-material]').forEach((btn) => btn.onclick = () => openMaterialView(btn.dataset.viewMaterial));
  if (canEdit) {
    list.querySelectorAll('[data-edit-material]').forEach((btn) => btn.onclick = () => openMaterialDialog(btn.dataset.editMaterial));
    list.querySelectorAll('[data-del-material]').forEach((btn) => {
      btn.onclick = async () => {
        if (!await confirmDialog('Delete material', 'This will permanently remove the material from the database. This cannot be undone.')) return;
        try {
          showLoader(true, 'Deleting…');
          await deleteMaterial(btn.dataset.delMaterial);
          await refreshMaterials();
          renderMaterials(true);
          showToast('✓ Material deleted');
        } catch (err) {
          await appAlert(err.message || 'Failed to delete material');
        } finally {
          showLoader(false);
        }
      };
    });
  }
}

function getCourseFormatsFromForm(form) {
  return [...form.querySelectorAll('input[name="formats"]:checked')].map((el) => el.value);
}

function isCourseFormReadyForGenerate(form) {
  const title = form.title.value.trim();
  const description = form.description.value.trim();
  const minScore = form.minScore.value;
  const materialIds = [...form.materialIds.selectedOptions];
  const formats = getCourseFormatsFromForm(form);
  const questionCount = Number(form.questionCount.value);
  return Boolean(
    title && description && minScore !== '' && materialIds.length > 0
    && formats.length > 0 && questionCount > 0
  );
}

function hasCourseGeneratedQuestions(form) {
  if (form.dataset.pendingQuestions) return true;
  if (form.dataset.editId) {
    const c = getCourses().find((x) => x.id === form.dataset.editId);
    return Boolean(c?.questions?.length);
  }
  return false;
}

function updateCourseFormButtons(form) {
  const ready = isCourseFormReadyForGenerate(form);
  const hasQuestions = hasCourseGeneratedQuestions(form);
  const generateBtn = $('#course-generate-btn');
  const publishBtn = $('#course-publish-btn');
  if (generateBtn) generateBtn.disabled = !ready;
  if (publishBtn) publishBtn.disabled = !ready || !hasQuestions || !form.openDate.value;
}

function bindCourseFormValidation(form) {
  const onChange = () => updateCourseFormButtons(form);
  if (!form.dataset.validationBound) {
    form.dataset.validationBound = '1';
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
  }
  updateCourseFormButtons(form);
}

function setCourseFormatsOnForm(form, course) {
  const formats = normalizeFormats(course?.formats || course?.format);
  form.querySelectorAll('input[name="formats"]').forEach((el) => { el.checked = formats.includes(el.value); });
}

function updateSelectedMaterialsList() {
  const sel = $('#course-materials-select');
  const list = $('#course-materials-selected');
  if (!sel || !list) return;
  list.innerHTML = [...sel.selectedOptions].map((opt) => {
    const mat = getMaterialsList().find((m) => m.id === opt.value);
    return `<li class="selected-material-chip"><span>${mat?.title || opt.textContent}</span><button type="button" data-deselect-material="${opt.value}">×</button></li>`;
  }).join('');
  list.querySelectorAll('[data-deselect-material]').forEach((btn) => {
    btn.onclick = () => {
      const opt = [...sel.options].find((o) => o.value === btn.dataset.deselectMaterial);
      if (opt) opt.selected = false;
      updateSelectedMaterialsList();
      const form = $('#course-form');
      if (form) updateCourseFormButtons(form);
    };
  });
}

function setMaterialSourceFields(sourceType) {
  const isUrl = sourceType === 'url';
  $('#material-file-fields')?.classList.toggle('hidden', isUrl);
  $('#material-url-fields')?.classList.toggle('hidden', !isUrl);
  const fileInput = $('#material-file');
  const urlInput = $('#material-form')?.sourceUrl;
  if (fileInput) fileInput.required = !isUrl;
  if (urlInput) urlInput.required = isUrl;
}

function openMaterialDialog(id) {
  const dlg = $('#dialog-material');
  const form = $('#material-form');
  form.reset();
  delete form.dataset.editId;
  $('#material-dialog-title').textContent = id ? 'Edit Material' : 'Add Material';
  if (id) {
    const m = getMaterialsList().find((x) => x.id === id);
    if (m) {
      form.title.value = m.title;
      form.group.value = m.group;
      const sourceType = isUrlMaterial(m) ? 'url' : 'file';
      form.sourceType.value = sourceType;
      form.sourceUrl.value = m.sourceUrl || '';
      form.dataset.editId = id;
      setMaterialSourceFields(sourceType);
    }
  } else {
    form.sourceType.value = 'file';
    setMaterialSourceFields('file');
  }
  dlg.showModal();
}

function openCourseDialog(id) {
  if (!isMasterOrAdmin(currentUser)) return;
  const dlg = $('#dialog-course');
  const form = $('#course-form');
  form.reset();
  delete form.dataset.pendingQuestions;
  $('#course-review').classList.add('hidden');
  $('#course-dialog-title').textContent = id ? 'Edit Course' : 'Create Course';
  $('#course-delete-btn').style.display = id ? '' : 'none';

  const matSel = $('#course-materials-select');
  const teamMaterials = getMaterialsList(selectedTeamId);
  matSel.innerHTML = teamMaterials.map((m) => `<option value="${m.id}">${m.title}</option>`).join('');
  matSel.onchange = () => { updateSelectedMaterialsList(); updateCourseFormButtons(form); };

  if (id) {
    const c = getCourses().find((x) => x.id === id);
    if (c) {
      form.title.value = c.title;
      form.description.value = c.description || '';
      form.minScore.value = c.minScore;
      form.openDate.value = c.openDate || '';
      form.closeDate.value = c.closeDate || '';
      setCourseFormatsOnForm(form, c);
      form.questionCount.value = c.questionCount || c.questions?.length || 5;
      [...matSel.options].forEach((o) => { o.selected = c.materialIds?.includes(o.value); });
      form.dataset.editId = id;
      if (c.questions?.length && !c.openDate) {
        form.openDate.value = new Date().toISOString().slice(0, 10);
      }
      updateSelectedMaterialsList();
      renderCourseReview(c);
    }
  } else {
    delete form.dataset.editId;
    setCourseFormatsOnForm(form, { formats: ['multiple'] });
    updateSelectedMaterialsList();
  }
  bindCourseFormValidation(form);
  dlg.showModal();
}

function renderCourseReview(course) {
  const el = $('#course-review');
  if (!course.questions?.length) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<h4>Review Questions (${course.questions.length})</h4>` +
    course.questions.map((q, i) => {
      if (isShortAnswerQuestion(q)) {
        return `<div class="question-review"><strong>Q${i + 1}.</strong> ${q.question}
          <p class="correct-answer">Expected answer: ${q.correctAnswer}</p></div>`;
      }
      return `<div class="question-review"><strong>Q${i + 1}.</strong> ${q.question}
        <ul>${q.options.map((o, j) => `<li${j === q.correctAnswer ? ' class="correct-answer"' : ''}>${o}</li>`).join('')}</ul></div>`;
    }).join('');
}

async function handleCourseGenerate(form) {
  if (!isCourseFormReadyForGenerate(form)) {
    await appAlert('Please fill in title, description, min score, materials, question formats, and question count.');
    return null;
  }
  const materialIds = [...form.materialIds.selectedOptions].map((o) => o.value);
  const texts = await fetchMaterialTextsForGeneration(materialIds);
  if (!texts.length) {
    await appAlert('Could not load content from the selected materials. For file uploads, ensure the API server is running.');
    return null;
  }
  const btn = $('#course-generate-btn');
  btn.disabled = true;
  showLoader(true, 'Generating questions…');
  try {
    const questionCount = Number(form.questionCount.value);
    const questions = await generateQuestions(texts, getCourseFormatsFromForm(form), questionCount);
    if (!questions.length) {
      await appAlert('Could not generate questions from the selected materials.');
      return null;
    }
    return questions;
  } finally {
    showLoader(false);
    updateCourseFormButtons(form);
  }
}

async function saveCourseFromForm(form, forceStatus) {
  if (!isCourseFormReadyForGenerate(form)) {
    await appAlert('Please fill in all required fields.');
    return;
  }
  if (!selectedTeamId) {
    await appAlert('Select a team on Team Board before saving a course.');
    return;
  }
  const materialIds = [...form.materialIds.selectedOptions].map((o) => o.value);
  const formats = getCourseFormatsFromForm(form);
  const questionCount = Number(form.questionCount.value);
  let questions = form.dataset.pendingQuestions ? JSON.parse(form.dataset.pendingQuestions) : [];
  if (form.dataset.editId) {
    const existing = getCourses().find((c) => c.id === form.dataset.editId);
    if (!questions.length) questions = existing?.questions || [];
  }

  const today = new Date().toISOString().slice(0, 10);
  let status = forceStatus || 'Draft';
  let openDate = form.openDate.value || null;
  const closeDate = form.closeDate.value || null;

  if (status === 'Open') {
    if (!questions.length) {
      await appAlert('Generate questions before publishing.');
      return;
    }
    openDate = openDate || today;
  }

  if (forceStatus !== 'Draft') {
    if (closeDate && closeDate <= today) status = 'Closed';
    else if (status !== 'Draft') status = 'Open';
  }

  const data = {
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    materialIds,
    minScore: Number(form.minScore.value),
    status,
    openDate,
    closeDate,
    formats,
    format: formats[0],
    questionCount,
    questions,
    synced: Boolean(form.dataset.pendingQuestions || questions.length),
    teamId: selectedTeamId,
  };

  try {
    showLoader(true, 'Saving course…');
    if (form.dataset.editId) {
      await updateCourse(form.dataset.editId, data);
    } else {
      await createCourse(data);
    }
    delete form.dataset.pendingQuestions;
    $('#dialog-course').close();
    renderTeamCourses();
    showToast(status === 'Open' ? '✓ Course published' : '✓ Course saved');
  } catch (err) {
    await appAlert(err.message || 'Failed to save course');
  } finally {
    showLoader(false);
  }
}

async function renderAnalytics() {
  try {
    await refreshCourses();
  } catch {
    /* use cached courses */
  }
  const courseSel = $('#analytics-course-select');
  const teamSel = $('#analytics-team-select');
  const teams = getAccessibleTeams(currentUser);
  const initialTeamId = analyticsTeamId || teams[0]?.id;
  teamSel.innerHTML = teams.map((t) => `<option value="${t.id}" ${t.id === initialTeamId ? 'selected' : ''}>${t.name}</option>`).join('');
  if (initialTeamId) analyticsTeamId = initialTeamId;

  populateAnalyticsCourseSelect(initialTeamId, courseSel.value);

  teamSel.onchange = async () => {
    analyticsTeamId = teamSel.value;
    syncRouteUrl('#page-analytics', { replace: true });
    buildNav();
    populateAnalyticsCourseSelect(analyticsTeamId);
    const courseId = courseSel.value;
    if (courseId) await refreshAttemptsForCourse(courseId);
    renderAnalyticsResults();
  };
  courseSel.onchange = async () => {
    await refreshAttemptsForCourse(courseSel.value);
    renderAnalyticsResults();
  };

  const courseId = courseSel.value;
  if (courseId) {
    await refreshAttemptsForCourse(courseId);
  }
  renderAnalyticsResults();
}

function populateAnalyticsCourseSelect(teamId, previousCourseId) {
  const courseSel = $('#analytics-course-select');
  const courses = getCoursesForAnalytics(teamId);
  courseSel.innerHTML = courses.length
    ? courses.map((c) => `<option value="${c.id}">${c.title}${c.status === 'Closed' ? ' (Closed)' : ''}</option>`).join('')
    : '<option value="">No courses</option>';
  if (previousCourseId && courses.some((c) => c.id === previousCourseId)) {
    courseSel.value = previousCourseId;
  }
}

function renderAnalyticsResults() {
  const courseId = $('#analytics-course-select').value;
  const course = getCourses().find((c) => c.id === courseId);
  const panel = $('#analytics-results');
  if (!course) { panel.innerHTML = '<p class="muted">No course selected.</p>'; return; }
  const team = getTeams().find((t) => t.id === analyticsTeamId) || getTeams()[0];
  panel.innerHTML = `<div class="ng-table-wrap"><table class="ng-table data-table"><thead><tr>
    <th>Team member</th><th>Progress</th><th>Attempts</th><th>Time</th><th>Last Attempt Time</th><th></th></tr></thead><tbody>
    ${(team?.members || []).map((uid) => {
    const u = getUserById(uid);
    const attempts = getAllAttemptsForUserCourse(uid, courseId);
    const { status } = getCourseProgressStatus(uid, courseId);
    const prog = attempts.length ? status : '—';
    const sortedAttempts = [...attempts].sort((a, b) => {
      const tA = new Date(a.completedAt || a.updatedAt || a.timestamp || a.openedAt || a.createdAt || 0);
      const tB = new Date(b.completedAt || b.updatedAt || b.timestamp || b.openedAt || b.createdAt || 0);
      return tB - tA;
    });
    const latestAttempt = sortedAttempts[0];
    const lastAttemptDate = latestAttempt ? (latestAttempt.completedAt || latestAttempt.updatedAt || latestAttempt.timestamp || latestAttempt.openedAt || latestAttempt.createdAt) : null;
    const lastAttemptTimeDisplay = lastAttemptDate ? new Date(lastAttemptDate).toLocaleString() : '—';
    return `<tr><td>${u?.name || uid}</td><td><span class="ng-badge ${statusBadge(prog)}">${prog}</span></td>
      <td>${attempts.filter((a) => a.completedAt).length}</td><td>${formatDuration(attempts.reduce((s, a) => s + (a.durationSeconds || 0), 0))}</td>
      <td>${lastAttemptTimeDisplay}</td>
      <td><button type="button" class="ng-btn-link" data-history="${uid}">Answer history</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
  panel.querySelectorAll('[data-history]').forEach((btn) => btn.onclick = () => showAttemptHistory(btn.dataset.history, courseId));
}

function showAttemptHistory(userId, courseId) {
  const attempts = getAllAttemptsForUserCourse(userId, courseId);
  $('#attempt-history-content').innerHTML = attempts.length ? attempts.map((a, i) => `
    <div class="question-review"><strong>Attempt ${i + 1}</strong> — ${a.score}% · ${a.passed ? 'Pass' : a.completedAt ? 'Fail' : 'In progress'}
    <pre class="muted" style="font-size:11px;overflow:auto;">${JSON.stringify(a.answers, null, 2)}</pre></div>`).join('') : '<p class="muted">No attempts.</p>';
  $('#dialog-attempt-history').showModal();
}

function renderAnalyticsQuestions() {
  const courseId = $('#analytics-course-select').value;
  const course = getCourses().find((c) => c.id === courseId);
  const panel = $('#analytics-questions');
  if (!course?.questions?.length) { panel.innerHTML = '<p class="muted">No questions.</p>'; return; }
  const attempts = getAttempts().filter((a) => a.courseId === courseId && a.completedAt);
  const stats = course.questions.map((q) => {
    let correct = 0, fail = 0, totalTime = 0;
    attempts.forEach((a) => {
      if (isAnswerCorrect(q, a.answers?.[q.id])) correct++;
      else if (a.answers?.[q.id] !== undefined) fail++;
      totalTime += (a.durationSeconds || 0) / (course.questions.length || 1);
    });
    const total = attempts.length || 1;
    return { q, rate: correct / total, failRate: fail / total, avgTime: totalTime / total };
  });
  const pick = (arr, fn) => [...arr].sort((a, b) => fn(b) - fn(a)).slice(0, 1)[0];
  panel.innerHTML = `<div class="ng-stat-cards">
    <div class="ng-stat-mini"><h4>Most fail</h4><p>${pick(stats, (s) => s.failRate)?.q.question.slice(0, 50) || 'N/A'}…</p></div>
    <div class="ng-stat-mini"><h4>Most correct</h4><p>${pick(stats, (s) => s.rate)?.q.question.slice(0, 50) || 'N/A'}…</p></div>
    <div class="ng-stat-mini"><h4>Take longer</h4><p>${pick(stats, (s) => s.avgTime)?.q.question.slice(0, 50) || 'N/A'}…</p></div>
    <div class="ng-stat-mini"><h4>Take shorter</h4><p>${[...stats].sort((a, b) => a.avgTime - b.avgTime)[0]?.q.question.slice(0, 50) || 'N/A'}…</p></div>
  </div>`;
}

function teamNamesForUser(user) {
  return (user.teamIds || [])
    .map((tid) => getTeams().find((t) => t.id === tid)?.name || tid)
    .join(', ') || '—';
}

function renderUsers() {
  const isAdm = canManageAdmins(currentUser);
  const canInvite = canInviteUsers(currentUser);
  const canAddTeam = canInvite;
  $('#btn-invite-user')?.classList.toggle('hidden', !canInvite);
  $('#btn-add-team')?.classList.toggle('hidden', !canAddTeam);

  $$('#users-segments .ng-superadmin-only').forEach((el) => el.classList.toggle('hidden', !isAdm));

  $$('#users-segments .ng-segment').forEach((seg) => {
    seg.onclick = () => {
      $$('#users-segments .ng-segment').forEach((s) => s.classList.remove('active'));
      seg.classList.add('active');
      ['teams', 'users', 'admins'].forEach((id) => {
        const el = $(`#users-seg-${id}`);
        if (el) el.classList.toggle('hidden', seg.dataset.seg !== id);
      });
    };
  });

  $('#teams-management').innerHTML = `<div class="ng-table-wrap"><table class="ng-table data-table"><thead><tr><th>Team</th><th>Members</th><th>Master</th><th></th></tr></thead><tbody>
    ${getTeams().map((t) => {
    const master = t.members.map(getUserById).find((u) => u?.role === 'Master' || u?.role === 'Admin');
    const canManage = isAdm || (currentUser.role === 'Master' && currentUser.teamIds?.includes(t.id));
    return `<tr><td><strong>${t.name}</strong></td><td>${t.members.length}</td><td>${master?.name || '—'}</td>
      <td>${canManage ? `<button type="button" class="ng-btn-link" data-del-team="${t.id}" style="color:var(--ng-error);">Remove</button>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div>`;

  $('#teams-management').querySelectorAll('[data-del-team]').forEach((btn) => {
    btn.onclick = async () => {
      if (!await confirmDialog('Delete team', 'Remove this team?')) return;
      try {
        await deleteTeam(btn.dataset.delTeam);
        renderUsers();
      } catch (err) {
        appAlert(err.message);
      }
    };
  });

  $('#users-list').innerHTML = `<div class="ng-table-wrap"><table class="ng-table data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Teams</th><th>Last Login Time</th></tr></thead><tbody>
    ${getUsers().map((u) => `<tr><td>${u.name}</td><td>${u.email}</td><td><span class="ng-badge ng-badge--muted">${u.role}</span></td><td>${teamNamesForUser(u)}</td><td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '—'}</td></tr>`).join('')}
  </tbody></table></div>`;

  if (isAdm) {
    $('#admins-list').innerHTML = `<div class="ng-table-wrap"><table class="ng-table data-table"><thead><tr><th>Name</th><th>Email</th><th></th></tr></thead><tbody>
      ${getUsers().filter((u) => u.role === 'Admin').map((u) => `<tr><td>${u.name}</td><td>${u.email}</td>
      <td>${u.id !== currentUser.id ? `<button type="button" class="ng-btn-link" data-demote="${u.id}" style="color:var(--ng-error);">Remove</button>` : 'You'}</td></tr>`).join('')}
    </tbody></table></div>`;
    $('#admins-list').querySelectorAll('[data-demote]').forEach((btn) => {
      btn.onclick = async () => {
        if (!await confirmDialog('Remove Admin', 'Demote to Master?')) return;
        try {
          await demoteAdmin(btn.dataset.demote);
          renderUsers();
        } catch (err) {
          appAlert(err.message);
        }
      };
    });
  }
}

function setupUserSearch({ inputId, resultsId, hiddenId, selectedId, onSelect }) {
  const input = $(inputId);
  const results = $(resultsId);
  const hidden = $(hiddenId);
  const selected = $(selectedId);
  let debounce = null;

  input.oninput = () => {
    clearTimeout(debounce);
    hidden.value = '';
    selected.classList.add('hidden');
    const q = input.value.trim();
    if (!q) { results.innerHTML = ''; return; }
    debounce = setTimeout(async () => {
      try {
        const users = await searchUsers(q);
        results.innerHTML = users.length
          ? users.map((u) => `<button type="button" class="invite-user-option" data-user-id="${u.id}" data-user-name="${u.name}" data-user-email="${u.email}"><strong>${u.name}</strong><br><span class="muted">${u.email}</span></button>`).join('')
          : '<p class="muted">No registered users found.</p>';
        results.querySelectorAll('.invite-user-option').forEach((btn) => {
          btn.onclick = () => {
            hidden.value = btn.dataset.userId;
            selected.textContent = `Selected: ${btn.dataset.userName} (${btn.dataset.userEmail})`;
            selected.classList.remove('hidden');
            results.innerHTML = '';
            input.value = btn.dataset.userName;
            onSelect?.(btn.dataset);
          };
        });
      } catch (err) {
        results.innerHTML = `<p class="error-text">${err.message}</p>`;
      }
    }, 250);
  };
}

function openInviteDialog(preselectedTeamId = null) {
  const dlg = $('#dialog-invite');
  const form = $('#invite-form');
  form.reset();
  $('#invite-user-id').value = '';
  $('#invite-selected-user').classList.add('hidden');
  $('#invite-user-results').innerHTML = '';
  $('#invite-team-select').innerHTML = getInvitableTeams(currentUser)
    .map((t) => `<option value="${t.id}" ${t.id === preselectedTeamId ? 'selected' : ''}>${t.name}</option>`)
    .join('');
  setupUserSearch({
    inputId: '#invite-user-search',
    resultsId: '#invite-user-results',
    hiddenId: '#invite-user-id',
    selectedId: '#invite-selected-user',
  });
  dlg.showModal();
}

function openPromoteAdminDialog() {
  const dlg = $('#dialog-promote-admin');
  const form = $('#promote-admin-form');
  form.reset();
  $('#promote-user-id').value = '';
  $('#promote-selected-user').classList.add('hidden');
  $('#promote-user-results').innerHTML = '';
  setupUserSearch({
    inputId: '#promote-user-search',
    resultsId: '#promote-user-results',
    hiddenId: '#promote-user-id',
    selectedId: '#promote-selected-user',
  });
  dlg.showModal();
}

function renderSettings() {
  $('#gemini-api-key').value = getSettings().geminiApiKey || '';
}

function getResumeQuestionIndex(questions, answers, savedIndex) {
  if (typeof savedIndex === 'number' && savedIndex >= 0 && savedIndex < questions.length) {
    return savedIndex;
  }
  const firstUnanswered = questions.findIndex((q) => answers[q.id] === undefined);
  if (firstUnanswered === -1) return Math.max(0, questions.length - 1);
  return firstUnanswered;
}

function startQuiz(courseId) {
  const course = getCourses().find((c) => c.id === courseId);
  if (!course || course.status === 'Closed') return appAlert('Course is closed and no longer accepts attempts.');
  if (course.status === 'Draft' && !isMasterOrAdmin(currentUser)) return appAlert('Course is draft.');

  let questions = course.questions || [];
  const latest = getLatestAttempt(currentUser.id, courseId);
  const inProgress = getAttempts().find((a) => a.userId === currentUser.id && a.courseId === courseId && !a.completedAt);

  if (inProgress) {
    const answers = { ...inProgress.answers };
    quizState = {
      course,
      attempt: inProgress,
      questions,
      qIndex: getResumeQuestionIndex(questions, answers, inProgress.qIndex),
      answers,
      startedAt: Date.now(),
    };
    showQuizPage(course);
  } else {
    const failed = latest && !latest.passed;
    if (failed && !course.synced && latest.answers) {
      questions = course.questions.filter((q) => latest.answers[q.id] !== undefined);
    }
    const attemptData = {
      userId: currentUser.id,
      courseId,
      score: 0,
      passed: false,
      openedAt: new Date().toISOString(),
      completedAt: null,
      durationSeconds: latest?.durationSeconds || 0,
      answers: {},
      qIndex: 0,
      timestamp: new Date().toISOString(),
    };
    createAttempt(attemptData).then((attempt) => {
      quizState = { course, attempt, questions, qIndex: 0, answers: {}, startedAt: Date.now() };
      showQuizPage(course);
    }).catch((err) => appAlert(err.message || 'Failed to start quiz'));
  }
}

function showQuizPage(course) {
  showPage('#page-quiz');
  $('#page-title').textContent = course.title;
  $('#quiz-breadcrumb').innerHTML = `<a href="#" data-back-team>Team Board</a> › <span>${course.title}</span>`;
  $('#quiz-breadcrumb [data-back-team]').onclick = (e) => { e.preventDefault(); closeQuizCourse(); };
  startTimer();
  renderQuizQuestion();
}

async function persistQuizProgress() {
  if (!quizState) return;
  const { attempt, answers, startedAt, qIndex } = quizState;
  const data = {
    durationSeconds: (attempt.durationSeconds || 0) + Math.floor((Date.now() - startedAt) / 1000),
    answers: { ...answers },
    qIndex,
    openedAt: new Date().toISOString(),
    completedAt: null,
  };
  try {
    const updated = await updateAttempt(attempt.id, data);
    quizState.attempt = updated;
    quizState.startedAt = Date.now();
  } catch (err) {
    console.warn('Failed to save quiz progress:', err.message);
  }
}

async function closeQuizCourse() {
  if (!quizState) { navigateToTeamTab('courses'); return; }
  if (!await confirmDialog('Close course?', 'Progress will be saved as In progress.')) return;
  persistQuizProgress();
  clearInterval(timerInterval);
  quizState = null;
  navigateToTeamTab('courses');
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!quizState) return;
    const elapsed = Math.floor((Date.now() - quizState.startedAt) / 1000);
    const el = document.getElementById('quiz-timer-display');
    if (el) el.textContent = '⏱ ' + formatDuration((quizState.attempt.durationSeconds || 0) + elapsed);
  }, 1000);
}

function renderQuizQuestion() {
  const { course, questions, qIndex, answers } = quizState;
  const q = questions[qIndex];
  const content = $('#quiz-content');
  if (!q) return finishQuiz();

  const pct = (qIndex / questions.length) * 100;
  const shortAnswer = isShortAnswerQuestion(q);
  const answerBlock = shortAnswer
    ? `<div class="ng-quiz-short-answer">
        <input type="text" class="ng-input" id="quiz-short-input" placeholder="Type your answer…"
          value="${answers[q.id] !== undefined ? String(answers[q.id]).replace(/"/g, '&quot;') : ''}" />
      </div>`
    : `<div class="ng-quiz-options">${q.options.map((opt, i) => `
      <label class="ng-quiz-option ${answers[q.id] === i ? 'selected' : ''}">
        <input type="radio" name="quiz-opt" value="${i}" ${answers[q.id] === i ? 'checked' : ''} />
        <span>${opt}</span></label>`).join('')}</div>`;

  content.innerHTML = `
    <div class="ng-quiz-progress"><span>Question ${qIndex + 1} of ${questions.length}</span>
    <div class="ng-quiz-progress-bar"><div class="ng-quiz-progress-fill" style="width:${pct}%"></div></div>
    <span class="ng-quiz-timer" id="quiz-timer-display">⏱ 00:00</span></div>
    <p class="ng-quiz-question">${q.question}</p>
    ${answerBlock}
    <div class="ng-quiz-footer">
      <button type="button" class="ng-btn ng-btn--outline" id="btn-close-quiz-inline">Close Course</button>
      <div style="display:flex;gap:var(--ng-space-3);">
        ${qIndex > 0 ? '<button type="button" class="ng-btn ng-btn--outline" id="quiz-prev">Previous</button>' : ''}
        <button type="button" class="ng-btn ng-btn--brand" id="quiz-next">${qIndex === questions.length - 1 ? 'Submit' : 'Next'}</button>
      </div></div>`;

  if (shortAnswer) {
    const input = $('#quiz-short-input');
    input.oninput = () => { answers[q.id] = input.value; };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') $('#quiz-next').click();
    };
  } else {
    content.querySelectorAll('.ng-quiz-option input').forEach((input) => {
      input.onchange = () => { answers[q.id] = Number(input.value); renderQuizQuestion(); };
    });
  }
  $('#btn-close-quiz-inline').onclick = () => closeQuizCourse();
  $('#quiz-prev')?.addEventListener('click', () => { quizState.qIndex--; renderQuizQuestion(); });
  $('#quiz-next').onclick = () => {
    if (shortAnswer) {
      const val = $('#quiz-short-input')?.value?.trim();
      if (!val) return appAlert('Type your answer.');
      answers[q.id] = val;
    } else if (answers[q.id] === undefined) {
      return appAlert('Select an answer.');
    }
    if (qIndex < questions.length - 1) { quizState.qIndex++; renderQuizQuestion(); }
    else finishQuiz();
  };
}

async function finishQuiz() {
  clearInterval(timerInterval);
  const { course, attempt, questions, answers, startedAt } = quizState;
  const durationSeconds = (attempt.durationSeconds || 0) + Math.floor((Date.now() - startedAt) / 1000);
  const { score } = scoreAttempt(questions, answers);
  const passed = score >= course.minScore;
  const completedAt = new Date().toISOString();

  try {
    await updateAttempt(attempt.id, {
      durationSeconds,
      answers,
      score,
      passed,
      completedAt,
      timestamp: completedAt,
    });
    if (isMasterOrAdmin(currentUser)) {
      await refreshAttemptsForCourse(course.id);
    }
  } catch (err) {
    console.warn('Failed to save quiz result:', err.message);
  }

  await refreshPerformanceViews();

  $('#quiz-content').innerHTML = `
    <h2 style="margin-bottom:var(--ng-space-4);">${passed ? '🎉 Passed!' : '📚 Keep Learning'}</h2>
    <div class="ng-result-grid">
      <div class="ng-result-stat"><div class="value">${score}%</div><div class="label">Score</div></div>
      <div class="ng-result-stat"><div class="value">${course.minScore}%</div><div class="label">Required</div></div>
      <div class="ng-result-stat"><div class="value">${formatDuration(durationSeconds)}</div><div class="label">Time</div></div>
    </div>
    <button type="button" class="ng-btn ng-btn--brand" id="quiz-done">Back to Team Board</button>`;
  $('#quiz-done').onclick = () => { quizState = null; navigateToTeamTab('courses'); };
}

function bindEvents() {
  $('#login-form')?.addEventListener('submit', (e) => e.preventDefault());

  $('#btn-logout').onclick = async () => {
    await logout();
    window.history.replaceState({}, '', '/');
    await initAuth();
    showLogin();
  };

  window.addEventListener('popstate', () => {
    if (!currentUser || $('#view-app')?.classList.contains('hidden')) return;
    applyRouteFromLocation();
  });

  $('#btn-save-settings').onclick = () => {
    saveSettings({ geminiApiKey: $('#gemini-api-key').value.trim() });
    showToast('✓ Settings saved');
  };

  $('#toggle-api-key').onclick = () => {
    const input = $('#gemini-api-key');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('#toggle-api-key').textContent = show ? 'Hide' : 'Show';
  };

  $('#btn-add-material').onclick = () => openMaterialDialog(null);

  $$('#material-form input[name="sourceType"]').forEach((radio) => {
    radio.addEventListener('change', () => setMaterialSourceFields(radio.value));
  });

  $('#material-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const sourceType = form.sourceType.value;
    const title = form.title.value.trim();
    const group = form.group.value.trim();
    const sourceUrl = form.sourceUrl?.value?.trim() || '';
    const file = $('#material-file')?.files?.[0];

    if (sourceType === 'file' && file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_MATERIAL_EXTENSIONS.includes(ext)) {
        await appAlert(UNSUPPORTED_FILE_ERROR);
        return;
      }
    }
    if (sourceType === 'url' && !sourceUrl) {
      await appAlert('Source URL is required for external link materials.');
      return;
    }
    if (sourceType === 'file' && !form.dataset.editId && !file) {
      await appAlert('Please select a file to upload.');
      return;
    }
    if (!selectedTeamId) {
      await appAlert('Select a team on Team Board before adding materials.');
      return;
    }

    try {
      showLoader(true, form.dataset.editId ? 'Saving…' : 'Uploading…');
      if (form.dataset.editId) {
        await updateMaterial(form.dataset.editId, {
          title, group, sourceUrl, file: file || undefined,
        });
      } else {
        await createMaterial({
          title, group, sourceType, sourceUrl, file, createdBy: currentUser?.id, teamId: selectedTeamId,
        });
      }
      await refreshMaterials();
      form.closest('dialog').close();
      renderMaterials(true);
      showToast('✓ Material saved');
    } catch (err) {
      await appAlert(err.message || 'Failed to save material');
    } finally {
      showLoader(false);
    }
  });

  $('#material-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = $('#material-form');
    if (!form.title.value) form.title.value = file.name.replace(/\.[^.]+$/, '');
  });

  $('#course-form-cancel').onclick = () => $('#dialog-course').close();
  $('#course-save-draft').onclick = () => saveCourseFromForm($('#course-form'), 'Draft');
  $('#course-delete-btn').onclick = async () => {
    const form = $('#course-form');
    if (!form.dataset.editId || !await confirmDialog('Delete course', 'Delete permanently?')) return;
    try {
      showLoader(true, 'Deleting…');
      await deleteCourse(form.dataset.editId);
      $('#dialog-course').close();
      renderTeamCourses();
      showToast('✓ Course removed');
    } catch (err) {
      await appAlert(err.message || 'Failed to delete course');
    } finally {
      showLoader(false);
    }
  };

  $('#course-generate-btn').onclick = async () => {
    const form = $('#course-form');
    const questions = await handleCourseGenerate(form);
    if (!questions) return;
    form.dataset.pendingQuestions = JSON.stringify(questions);
    renderCourseReview({ questions });
    if (!form.openDate.value) form.openDate.value = new Date().toISOString().slice(0, 10);
    updateCourseFormButtons(form);
  };

  $('#course-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const today = new Date().toISOString().slice(0, 10);
    if (!form.openDate.value) form.openDate.value = today;
    saveCourseFromForm(form, 'Open');
  });

  $('#btn-invite-user').onclick = () => openInviteDialog();
  $('#invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = $('#invite-user-id').value;
    const teamId = $('#invite-team-select').value;
    if (!userId) { await appAlert('Select a user to invite.'); return; }
    try {
      await inviteUserToTeam(teamId, userId);
      e.target.closest('dialog').close();
      renderUsers();
      showToast('✓ User invited to team');
    } catch (err) {
      await appAlert(err.message);
    }
  });

  $('#btn-add-user').onclick = () => openPromoteAdminDialog();
  $('#promote-admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = $('#promote-user-id').value;
    if (!userId) { await appAlert('Select a user to promote.'); return; }
    try {
      await promoteToAdmin(userId);
      e.target.closest('dialog').close();
      renderUsers();
      showToast('✓ User promoted to Admin');
    } catch (err) {
      await appAlert(err.message);
    }
  });

  $('#btn-add-team').onclick = () => {
    const dlg = $('#dialog-team');
    $('#team-form').reset();
    dlg.showModal();
  };
  $('#team-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;
    try {
      const team = await createTeam(name);
      selectedTeamId = team.id;
      e.target.closest('dialog').close();
      renderUsers();
      showToast('✓ Team created');
    } catch (err) {
      await appAlert(err.message);
    }
  });
}

async function init() {
  ensureSeed();
  bindEvents();
  const auth = await initAuth();
  if (checkSession()) enterApp();
  else {
    showLogin();
    if (auth.error && $('#login-error')) {
      $('#login-error').textContent = auth.error;
      $('#login-error').classList.remove('hidden');
    }
  }
}

init();
