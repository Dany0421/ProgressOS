var DEBUG = false;

var _userId = null;
var _userEmail = null;
var _profile = null;
var _xpEvents = [];
var _focusTasks = [];
var _stats = { tasksDone: 0, activeStreaks: 0, activeProjects: 0 };
var _activeTitleName = null;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await checkSession();
  if (!session) return;
  _userId = session.user.id;
  _userEmail = session.user.email;

  try {
    await _loadAll();
    _renderPlayerCard();
    _renderStats();
    initMatchWidget(_userId);
    if (typeof initDailyChallenges === 'function') initDailyChallenges(_userId);
    if (typeof renderPastUnsettledNudges === 'function') renderPastUnsettledNudges(_userId);
    if (typeof applyMatchDayTheme === 'function') applyMatchDayTheme(_userId);
    _renderHeatmap();
    _renderFocus();
    _renderFeed();
    _wireFAB();
    _checkOnboarding();
  } catch (err) {
    if (DEBUG) console.error('dashboard init', err);
    toast('Could not load dashboard', 'error');
  }
});

// ---- Data ----

async function _loadAll() {
  const today = todayLocal();
  const thirtyDaysAgo = _daysAgo(29);

  const [profileRes, tasksDoneRes, streaksRes, projectsRes, xpRes, focusRes] = await Promise.all([
    supabase.from('profiles').select('username, total_xp, current_level, created_at, onboarding_completed, active_title, challenge_streak').eq('id', _userId).single(),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', _userId).eq('completed', true).eq('due_date', today),
    supabase.from('habits').select('*', { count: 'exact', head: true }).eq('user_id', _userId).gt('current_streak', 0),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', _userId).eq('status', 'active'),
    supabase.from('xp_events').select('event_date, xp_amount, category, description, created_at').eq('user_id', _userId).gte('event_date', thirtyDaysAgo).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('user_id', _userId).eq('completed', false).lte('due_date', today).order('due_date')
  ]);

  if (profileRes.error) throw profileRes.error;

  _profile = profileRes.data;
  _xpEvents = xpRes.data || [];
  _stats.tasksDone = tasksDoneRes.count || 0;
  _stats.activeStreaks = streaksRes.count || 0;
  _stats.activeProjects = projectsRes.count || 0;

  _activeTitleName = null;
  if (_profile.active_title) {
    try {
      const { data } = await supabase.from('achievements').select('name').eq('id', _profile.active_title).single();
      if (data && data.name) _activeTitleName = data.name;
    } catch (err) {
      if (DEBUG) console.error('active_title fetch failed', err);
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  _focusTasks = (focusRes.data || [])
    .sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1))
    .slice(0, 3);
}

function _daysAgo(n) {
  const d = new Date(todayLocal() + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

// ---- Profile refresh hook (called by profile.js on close) ----

async function _refreshPlayerCardAfterProfile() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('active_title, username')
      .eq('id', _userId).single();
    if (error) throw error;
    _profile.active_title = data.active_title;
    _profile.username = data.username;
    _activeTitleName = null;
    if (data.active_title) {
      const { data: ach } = await supabase.from('achievements').select('name').eq('id', data.active_title).single();
      if (ach && ach.name) _activeTitleName = ach.name;
    }
    _renderPlayerCard();
  } catch (err) {
    if (DEBUG) console.error('refreshPlayerCardAfterProfile failed', err);
  }
}

// ---- Player Card ----

function _renderPlayerCard() {
  const el = document.getElementById('player-card');
  if (!el) return;
  el.textContent = '';
  el.className = 'player-card';

  const level = _profile.current_level || 1;
  const totalXP = _profile.total_xp || 0;
  const levelStart = xpForLevel(level);
  const levelEnd = xpForLevel(level + 1);
  const progress = totalXP - levelStart;
  const range = levelEnd - levelStart;
  const pct = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100;

  // Top row: avatar + info + gear
  const topRow = document.createElement('div');
  topRow.className = 'player-card-top';

  const avatar = document.createElement('div');
  avatar.className = 'player-avatar';
  const initials = (_profile.username || 'U').charAt(0).toUpperCase();
  avatar.textContent = initials;
  const colour = levelAvatarColour(level);
  if (colour) avatar.classList.add(`avatar--${colour}`);

  const info = document.createElement('div');
  info.className = 'player-info';

  const name = document.createElement('p');
  name.className = 'player-name';
  name.textContent = _profile.username || 'Player';
  info.appendChild(name);

  if (_activeTitleName) {
    const titleEl = document.createElement('p');
    titleEl.className = 'player-title mono';
    titleEl.textContent = _activeTitleName.toUpperCase();
    info.appendChild(titleEl);
  }

  const lvl = document.createElement('p');
  lvl.className = 'player-level mono';
  lvl.textContent = `LVL ${level}`;
  info.appendChild(lvl);

  const gear = document.createElement('button');
  gear.className = 'icon-btn';
  gear.id = 'settings-btn';
  gear.setAttribute('aria-label', 'Settings');
  const gearIcon = document.createElement('i');
  gearIcon.setAttribute('data-lucide', 'settings');
  gear.appendChild(gearIcon);
  gear.addEventListener('click', (e) => {
    e.stopPropagation();
    openSettings();
  });

  const badge = levelBadge(level);
  if (badge) {
    const wrap = document.createElement('div');
    wrap.className = `avatar-badge-wrap avatar-badge-wrap--${badge}`;
    wrap.appendChild(avatar);
    topRow.appendChild(wrap);
  } else {
    topRow.appendChild(avatar);
  }
  topRow.appendChild(info);
  topRow.appendChild(gear);
  el.appendChild(topRow);

  el.classList.add('player-card--tappable');
  if (!el.dataset.clickBound) {
    el.addEventListener('click', () => {
      if (typeof openProfile === 'function') openProfile();
    });
    el.dataset.clickBound = '1';
  }

  // XP label
  const xpLabel = document.createElement('p');
  xpLabel.className = 'xp-progress-label mono';
  xpLabel.textContent = `${totalXP.toLocaleString()} / ${levelEnd.toLocaleString()} XP`;
  el.appendChild(xpLabel);

  // XP bar
  const track = document.createElement('div');
  track.className = 'xp-bar-track';
  const fill = document.createElement('div');
  fill.className = 'xp-bar-fill';
  fill.id = 'xp-bar-fill';
  track.appendChild(fill);
  el.appendChild(track);

  lucide.createIcons();

  // Animate bar after paint
  requestAnimationFrame(() => setTimeout(() => { fill.style.width = `${pct}%`; }, 30));
}

// ---- Mini Stats ----

function _renderStats() {
  const el = document.getElementById('stats-row');
  if (!el) return;
  el.textContent = '';

  const items = [
    { value: _stats.tasksDone,    label: 'Tasks\ndone today' },
    { value: _stats.activeStreaks, label: 'Active\nstreaks' },
    { value: _stats.activeProjects, label: 'Projects\nactive' }
  ];

  items.forEach(({ value, label }) => {
    const card = document.createElement('div');
    card.className = 'stat-card';

    const val = document.createElement('p');
    val.className = 'stat-value mono';
    val.textContent = value;
    card.appendChild(val);

    const lbl = document.createElement('p');
    lbl.className = 'stat-label';
    lbl.textContent = label;
    card.appendChild(lbl);

    el.appendChild(card);
  });
}

// ---- Heatmap ----

function _renderHeatmap() {
  const section = document.getElementById('heatmap-section');
  if (!section) return;
  section.textContent = '';

  const heading = document.createElement('h2');
  heading.className = 'dashboard-section-title';
  heading.textContent = 'Last 30 Days';
  section.appendChild(heading);

  // Build XP by day map (positive XP only)
  const xpByDay = {};
  _xpEvents.forEach(e => {
    if (e.xp_amount > 0) {
      xpByDay[e.event_date] = (xpByDay[e.event_date] || 0) + e.xp_amount;
    }
  });

  const grid = document.createElement('div');
  grid.className = 'heatmap';

  for (let i = 29; i >= 0; i--) {
    const dateStr = _daysAgo(i);
    const xp = xpByDay[dateStr] || 0;

    const cell = document.createElement('div');
    cell.className = 'heatmap-cell ' + _heatmapClass(xp);
    cell.setAttribute('aria-label', `${dateStr}: ${xp} XP`);

    cell.addEventListener('click', () => _showHeatmapPopup(dateStr, xp));
    grid.appendChild(cell);
  }

  section.appendChild(grid);
}

function _heatmapClass(xp) {
  if (xp === 0)   return '';
  if (xp <= 50)   return 'heatmap-cell--dim';
  if (xp <= 150)  return 'heatmap-cell--med';
  if (xp <= 300)  return 'heatmap-cell--bright';
  return 'heatmap-cell--full';
}

function _showHeatmapPopup(dateStr, totalXP) {
  const dayEvents = _xpEvents.filter(e => e.event_date === dateStr && e.xp_amount > 0);
  const byCategory = {};
  dayEvents.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.xp_amount;
  });

  const content = document.createElement('div');
  content.className = 'settings-content';

  const dateEl = document.createElement('p');
  dateEl.className = 'sheet-option-label';
  dateEl.textContent = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  content.appendChild(dateEl);

  if (totalXP === 0) {
    const none = document.createElement('p');
    none.className = 'detail-empty';
    none.textContent = 'No XP earned this day.';
    content.appendChild(none);
  } else {
    const total = document.createElement('p');
    total.className = 'heatmap-popup-total mono';
    total.textContent = `${totalXP} XP total`;
    content.appendChild(total);

    const cats = ['tasks', 'habits', 'projects', 'bonus'];
    cats.forEach(cat => {
      if (!byCategory[cat]) return;
      const row = document.createElement('div');
      row.className = 'settings-stat-row';

      const lbl = document.createElement('span');
      lbl.className = 'settings-stat-label';
      lbl.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      row.appendChild(lbl);

      const val = document.createElement('span');
      val.className = 'settings-stat-value';
      val.textContent = `+${byCategory[cat]} XP`;
      row.appendChild(val);

      content.appendChild(row);
    });
  }

  showBottomSheet(content, dateStr === todayLocal() ? 'Today' : 'That Day');
}

// ---- Today's Focus ----

function _renderFocus() {
  const section = document.getElementById('focus-section');
  if (!section) return;
  section.textContent = '';

  const heading = document.createElement('h2');
  heading.className = 'dashboard-section-title';
  heading.textContent = "Today's Focus";
  section.appendChild(heading);

  if (_focusTasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'detail-empty';
    empty.textContent = 'All clear. Nothing pending.';
    section.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'focus-list';

  _focusTasks.forEach(task => {
    const row = document.createElement('div');
    row.className = 'focus-task';

    const check = document.createElement('button');
    check.className = 'focus-check';
    check.setAttribute('aria-label', 'Complete task');
    check.addEventListener('click', () => _completeFocusTask(task, row));
    row.appendChild(check);

    const title = document.createElement('span');
    title.className = 'focus-task-title';
    title.textContent = task.title;
    row.appendChild(title);

    const badge = document.createElement('span');
    badge.className = `badge badge--${task.priority}`;
    badge.textContent = task.priority;
    row.appendChild(badge);

    list.appendChild(row);
  });

  section.appendChild(list);
}

async function _completeFocusTask(task, rowEl) {
  const checkEl = rowEl.querySelector('.focus-check');
  if (checkEl) checkEl.disabled = true;
  haptic(15);
  playTick();

  try {
    const { error } = await supabase.from('tasks').update({
      completed: true,
      completed_at: new Date().toISOString()
    }).eq('id', task.id);
    if (error) throw error;

    const xpMap = { low: 10, medium: 20, high: 35 };
    const xp = xpMap[task.priority] || 20;
    const result = await awardXP(_userId, xp, 'tasks', `Task: ${task.title}`);
    if (result && result.awarded > 0) floatXP(rowEl, result.awarded);

    rowEl.classList.add('focus-task--done');
    haptic([10, 30, 10]);

    setTimeout(() => {
      rowEl.style.opacity = '0';
      rowEl.style.transform = 'translateX(16px)';
      setTimeout(() => rowEl.remove(), 300);
    }, 700);

    if (task.due_date === todayLocal()) {
      _stats.tasksDone++;
      const valEl = document.querySelectorAll('.stat-value')[0];
      if (valEl) valEl.textContent = _stats.tasksDone;
    }

  } catch (err) {
    if (DEBUG) console.error('completeFocusTask failed', err);
    if (checkEl) checkEl.disabled = false;
    toast('Could not complete task', 'error');
  }
}

// ---- XP Feed ----

function _renderFeed() {
  const section = document.getElementById('feed-section');
  if (!section) return;
  section.textContent = '';

  const heading = document.createElement('h2');
  heading.className = 'dashboard-section-title';
  heading.textContent = 'XP Feed';
  section.appendChild(heading);

  const last5 = _xpEvents.slice(0, 5);

  if (last5.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'detail-empty';
    empty.textContent = 'No activity yet.';
    section.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'feed-list';

  last5.forEach(event => {
    const row = document.createElement('div');
    row.className = 'feed-event';

    const xp = document.createElement('span');
    xp.className = 'feed-xp mono' + (event.xp_amount < 0 ? ' feed-xp--negative' : '');
    xp.textContent = (event.xp_amount >= 0 ? '+' : '') + event.xp_amount;
    row.appendChild(xp);

    const right = document.createElement('div');
    right.className = 'feed-right';

    const desc = document.createElement('span');
    desc.className = 'feed-desc';
    desc.textContent = event.description;
    right.appendChild(desc);

    const time = document.createElement('span');
    time.className = 'feed-time';
    time.textContent = _formatEventTime(event.created_at);
    right.appendChild(time);

    row.appendChild(right);
    list.appendChild(row);
  });

  section.appendChild(list);
}

function _formatEventTime(isoString) {
  const localDate = new Date(isoString).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const time = new Date(isoString).toLocaleTimeString('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' });
  if (localDate === todayLocal()) return `Today ${time}`;
  if (localDate === yesterdayLocal()) return `Yesterday ${time}`;
  return new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: TIMEZONE }) + ` ${time}`;
}

// ---- Settings ----

function openSettings() {
  const content = document.createElement('div');

  // Profile
  const profile = document.createElement('div');
  profile.className = 'settings-profile';

  const uname = document.createElement('p');
  uname.className = 'settings-profile-name';
  uname.textContent = _profile.username || 'Player';
  profile.appendChild(uname);

  const email = document.createElement('p');
  email.className = 'settings-profile-email';
  email.textContent = _userEmail || '';
  profile.appendChild(email);

  content.appendChild(profile);

  // Toggles
  const toggleSection = document.createElement('div');
  toggleSection.className = 'settings-section';

  toggleSection.appendChild(_buildSettingRow('Sound', !isMuted(), (on) => setMuted(!on)));
  toggleSection.appendChild(_buildSettingRow('Haptics', localStorage.getItem('haptic_muted') !== 'true', (on) => {
    localStorage.setItem('haptic_muted', on ? 'false' : 'true');
  }));

  content.appendChild(toggleSection);

  // Stats (static from loaded data)
  const statsSection = document.createElement('div');
  statsSection.className = 'settings-section';

  const created = new Date(_profile.created_at);
  const createdStr = created.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  statsSection.appendChild(_buildStatRow('Account created', createdStr));
  statsSection.appendChild(_buildStatRow('Total XP', (_profile.total_xp || 0).toLocaleString()));

  const longestStreakRow = _buildStatRow('Longest streak', '—');
  statsSection.appendChild(longestStreakRow);

  content.appendChild(statsSection);

  // Events entry
  const navSection = document.createElement('div');
  navSection.className = 'settings-section';

  const eventsRow = document.createElement('button');
  eventsRow.className = 'settings-nav-row';
  eventsRow.type = 'button';
  const eventsIcon = document.createElement('i');
  eventsIcon.setAttribute('data-lucide', 'calendar');
  eventsRow.appendChild(eventsIcon);
  const eventsLabel = document.createElement('span');
  eventsLabel.className = 'settings-nav-label';
  eventsLabel.textContent = 'Events';
  eventsRow.appendChild(eventsLabel);
  const eventsChev = document.createElement('i');
  eventsChev.setAttribute('data-lucide', 'chevron-right');
  eventsChev.className = 'settings-nav-chev';
  eventsRow.appendChild(eventsChev);
  eventsRow.addEventListener('click', () => {
    hideBottomSheet();
    setTimeout(() => {
      if (typeof openEventsView === 'function') openEventsView();
    }, 200);
  });
  navSection.appendChild(eventsRow);

  content.appendChild(navSection);

  // Logout
  const danger = document.createElement('div');
  danger.className = 'settings-danger';

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-danger-outline';
  logoutBtn.textContent = 'Log out';
  logoutBtn.addEventListener('click', () => logout());
  danger.appendChild(logoutBtn);

  content.appendChild(danger);

  showBottomSheet(content, 'Settings');

  // Load longest streak async
  supabase.from('habits')
    .select('longest_streak')
    .eq('user_id', _userId)
    .order('longest_streak', { ascending: false })
    .limit(1)
    .then(({ data }) => {
      const val = data && data[0] ? data[0].longest_streak : 0;
      const el = longestStreakRow.querySelector('.settings-stat-value');
      if (el) el.textContent = `${val}d`;
    });
}

function _buildSettingRow(label, isOn, onChange) {
  const row = document.createElement('div');
  row.className = 'setting-row';

  const lbl = document.createElement('span');
  lbl.className = 'setting-label';
  lbl.textContent = label;
  row.appendChild(lbl);

  const toggle = document.createElement('button');
  toggle.className = 'toggle-switch' + (isOn ? ' toggle-switch--on' : '');
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(isOn));
  const thumb = document.createElement('span');
  thumb.className = 'toggle-switch-thumb';
  toggle.appendChild(thumb);

  toggle.addEventListener('click', () => {
    const nowOn = toggle.classList.toggle('toggle-switch--on');
    toggle.setAttribute('aria-checked', String(nowOn));
    onChange(nowOn);
  });

  row.appendChild(toggle);
  return row;
}

function _buildStatRow(label, value) {
  const row = document.createElement('div');
  row.className = 'settings-stat-row';

  const lbl = document.createElement('span');
  lbl.className = 'settings-stat-label';
  lbl.textContent = label;
  row.appendChild(lbl);

  const val = document.createElement('span');
  val.className = 'settings-stat-value mono';
  val.textContent = value;
  row.appendChild(val);

  return row;
}

// ---- Onboarding ----

function _checkOnboarding() {
  if (_profile.onboarding_completed === false) {
    _showOnboardingModal();
  }
}

function _showOnboardingModal() {
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';

  const card = document.createElement('div');
  card.className = 'onboarding-card';

  const title = document.createElement('h1');
  title.className = 'onboarding-title';
  title.textContent = `Welcome, ${_profile.username || 'Player'}.`;
  card.appendChild(title);

  const pillars = document.createElement('div');
  pillars.className = 'onboarding-pillars';

  const pillarData = [
    { icon: 'check-square', heading: 'Tasks', body: 'Complete daily tasks, earn XP, and chain bonuses for clearing your list.' },
    { icon: 'repeat',       heading: 'Habits', body: 'Build streaks. Reach milestones. Freeze your streak so life doesn\'t break it.' },
    { icon: 'folder-open',  heading: 'Projects', body: 'Log deep work sessions. Earn XP for every 30 minutes of focus.' }
  ];

  pillarData.forEach(({ icon, heading, body }) => {
    const pillar = document.createElement('div');
    pillar.className = 'onboarding-pillar';

    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', icon);
    pillar.appendChild(iconEl);

    const h = document.createElement('p');
    h.className = 'onboarding-pillar-heading';
    h.textContent = heading;
    pillar.appendChild(h);

    const p = document.createElement('p');
    p.className = 'onboarding-pillar-body';
    p.textContent = body;
    pillar.appendChild(p);

    pillars.appendChild(pillar);
  });

  card.appendChild(pillars);

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = "Let's go.";
  btn.addEventListener('click', async () => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 400);
    haptic(15);
    try {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', _userId);
    } catch (err) {
      if (DEBUG) console.error('onboarding update failed', err);
    }
  });
  card.appendChild(btn);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  lucide.createIcons();

  requestAnimationFrame(() => setTimeout(() => overlay.classList.add('onboarding-overlay--visible'), 30));
}

// ---- FAB — quick add task ----

function _wireFAB() {
  const fab = document.getElementById('fab-add');
  if (fab) fab.addEventListener('click', _openQuickAddTask);
}

function _openQuickAddTask() {
  const content = document.createElement('div');
  content.className = 'sheet-form';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.setAttribute('for', 'quick-task-title');
  label.textContent = 'Task';

  const input = document.createElement('input');
  input.className = 'form-input';
  input.type = 'text';
  input.id = 'quick-task-title';
  input.placeholder = "What needs to get done?";
  input.maxLength = 200;
  input.autocomplete = 'off';

  const priorityLabel = document.createElement('p');
  priorityLabel.className = 'form-label';
  priorityLabel.textContent = 'Priority';

  const priorityGroup = document.createElement('div');
  priorityGroup.className = 'priority-group';

  let selectedPriority = 'medium';
  const priorities = [
    { key: 'low', label: 'Low' },
    { key: 'medium', label: 'Med' },
    { key: 'high', label: 'High' }
  ];

  priorities.forEach(({ key, label: pLabel }) => {
    const btn = document.createElement('button');
    btn.className = `priority-btn priority-btn--${key}` + (key === 'medium' ? ' priority-btn--active' : '');
    btn.type = 'button';
    btn.textContent = pLabel;
    btn.addEventListener('click', () => {
      selectedPriority = key;
      priorityGroup.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('priority-btn--active'));
      btn.classList.add('priority-btn--active');
    });
    priorityGroup.appendChild(btn);
  });

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn-primary';
  submitBtn.type = 'button';
  submitBtn.textContent = 'Add Task';

  submitBtn.addEventListener('click', async () => {
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding…';

    try {
      const { error } = await supabase.from('tasks').insert({
        user_id: _userId,
        title,
        priority: selectedPriority,
        due_date: todayLocal()
      });
      if (error) throw error;
      haptic(15);
      hideBottomSheet();
    } catch (err) {
      if (DEBUG) console.error('quickAddTask failed', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Task';
      toast('Could not add task', 'error');
    }
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });

  content.appendChild(label);
  content.appendChild(input);
  content.appendChild(priorityLabel);
  content.appendChild(priorityGroup);
  content.appendChild(submitBtn);

  showBottomSheet(content, 'Quick Task');
  setTimeout(() => input.focus(), 350);
}
