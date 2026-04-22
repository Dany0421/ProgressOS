var DEBUG = false;

var _profileState = null;
var _profileViewEl = null;

async function openProfile() {
  try {
    const session = await supabase.auth.getSession();
    const userId = session && session.data && session.data.session && session.data.session.user.id;
    if (!userId) return;

    const today = todayLocal();
    const [profRes, habitsRes, tasksRes, projectsRes, daysRes, achState, totalDefsRes] = await Promise.all([
      supabase.from('profiles')
        .select('username, total_xp, current_level, tasks_xp, habits_xp, projects_xp, active_title, created_at')
        .eq('id', userId).single(),
      supabase.from('habits').select('longest_streak, total_completions').eq('user_id', userId),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed'),
      supabase.from('xp_events').select('event_date').eq('user_id', userId),
      fetchAchievementsState(userId),
      supabase.from('achievements').select('id', { count: 'exact', head: true })
    ]);

    if (profRes.error) throw profRes.error;

    const profile = profRes.data;
    const habits = habitsRes.data || [];
    const bestStreak = habits.reduce((m, h) => Math.max(m, h.longest_streak || 0), 0);
    const habitsCompleted = habits.reduce((s, h) => s + (h.total_completions || 0), 0);
    const tasksDone = tasksRes.count || 0;
    const projectsDone = projectsRes.count || 0;
    const daysActive = new Set((daysRes.data || []).map(r => r.event_date)).size;
    const totalAchievements = totalDefsRes.count || 0;

    _profileState = {
      userId,
      profile,
      stats: {
        totalXP: profile.total_xp || 0,
        daysActive,
        tasksDone,
        habitsCompleted,
        projectsDone,
        bestStreak
      },
      achievements: achState,
      totalAchievements
    };

    _renderProfileView();
  } catch (err) {
    if (DEBUG) console.error('openProfile failed', err);
    toast('Could not open profile', 'error');
  }
}

function _renderProfileView() {
  _destroyProfileView();

  const view = document.createElement('div');
  view.className = 'profile-view';
  view.id = 'profile-view';
  _profileViewEl = view;

  // Header
  const header = document.createElement('header');
  header.className = 'detail-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-back';
  backBtn.setAttribute('aria-label', 'Back');
  const backIcon = document.createElement('i');
  backIcon.setAttribute('data-lucide', 'arrow-left');
  backBtn.appendChild(backIcon);
  backBtn.addEventListener('click', closeProfile);

  const title = document.createElement('h1');
  title.className = 'detail-title';
  title.textContent = 'Profile';

  header.appendChild(backBtn);
  header.appendChild(title);
  view.appendChild(header);

  // Hero
  view.appendChild(_renderHero());

  // Stats grid
  view.appendChild(_renderStatsGrid());

  // Titles row
  view.appendChild(_renderTitlesRow());

  // Achievements progress + button
  view.appendChild(_renderAchievementsCta());

  document.body.appendChild(view);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    view.classList.add('view--visible');
  });
}

function _renderHero() {
  const { profile, achievements } = _profileState;
  const hero = document.createElement('div');
  hero.className = 'profile-hero';

  const avatar = document.createElement('div');
  avatar.className = 'profile-avatar--lg';
  avatar.textContent = (profile.username || 'U').charAt(0).toUpperCase();
  hero.appendChild(avatar);

  const nameRow = document.createElement('div');
  nameRow.className = 'profile-name-row';

  const name = document.createElement('h2');
  name.className = 'profile-name';
  name.textContent = profile.username || 'Player';
  nameRow.appendChild(name);

  const editBtn = document.createElement('button');
  editBtn.className = 'profile-name-edit-btn';
  editBtn.type = 'button';
  editBtn.setAttribute('aria-label', 'Change username');
  const editIcon = document.createElement('i');
  editIcon.setAttribute('data-lucide', 'pencil');
  editBtn.appendChild(editIcon);
  editBtn.addEventListener('click', _openUsernameSheet);
  nameRow.appendChild(editBtn);

  name.addEventListener('click', _openUsernameSheet);

  hero.appendChild(nameRow);

  // Active title (if any)
  const activeTitleId = profile.active_title;
  if (activeTitleId) {
    const def = achievements.definitions.find(d => d.id === activeTitleId);
    if (def) {
      const titleEl = document.createElement('p');
      titleEl.className = 'profile-title-label mono';
      titleEl.textContent = def.name.toUpperCase();
      hero.appendChild(titleEl);
    }
  }

  // Level + XP bar
  const level = profile.current_level || 1;
  const totalXP = profile.total_xp || 0;
  const levelStart = xpForLevel(level);
  const levelEnd = xpForLevel(level + 1);
  const range = levelEnd - levelStart;
  const progress = totalXP - levelStart;
  const pct = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100;

  const lvlRow = document.createElement('div');
  lvlRow.className = 'profile-level-row';

  const lvlLabel = document.createElement('span');
  lvlLabel.className = 'profile-level-label mono';
  lvlLabel.textContent = `LVL ${level}`;
  lvlRow.appendChild(lvlLabel);

  const xpLabel = document.createElement('span');
  xpLabel.className = 'profile-xp-label mono';
  xpLabel.textContent = `${totalXP.toLocaleString()} / ${levelEnd.toLocaleString()} XP`;
  lvlRow.appendChild(xpLabel);

  hero.appendChild(lvlRow);

  const track = document.createElement('div');
  track.className = 'xp-bar-track';
  const fill = document.createElement('div');
  fill.className = 'xp-bar-fill';
  track.appendChild(fill);
  hero.appendChild(track);

  requestAnimationFrame(() => setTimeout(() => { fill.style.width = `${pct}%`; }, 30));

  return hero;
}

function _openUsernameSheet() {
  if (!_profileState) return;
  const current = _profileState.profile.username || '';

  const form = document.createElement('div');
  form.className = 'sheet-form';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.setAttribute('for', 'username-input');
  label.textContent = 'Username';
  form.appendChild(label);

  const input = document.createElement('input');
  input.className = 'form-input';
  input.type = 'text';
  input.id = 'username-input';
  input.placeholder = '3 to 30 characters';
  input.maxLength = 30;
  input.autocomplete = 'off';
  input.value = current;
  form.appendChild(input);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn-primary';
  submitBtn.type = 'button';
  submitBtn.textContent = 'Save';
  form.appendChild(submitBtn);

  const submit = async () => {
    const value = (input.value || '').trim();
    if (value === current) { hideBottomSheet(); return; }
    if (value.length < 3 || value.length > 30) {
      toast('Username must be 3–30 characters', 'error');
      return;
    }

    submitBtn.disabled = true;
    try {
      const { error } = await supabase.from('profiles')
        .update({ username: value })
        .eq('id', _profileState.userId);

      if (error) {
        if (error.code === '23505') {
          toast('Username already taken', 'error');
        } else {
          toast('Could not update username', 'error');
          if (DEBUG) console.error('username update failed', error);
        }
        submitBtn.disabled = false;
        return;
      }

      _profileState.profile.username = value;
      hideBottomSheet();
      toast('Username updated');
      _renderProfileView();
    } catch (err) {
      if (DEBUG) console.error('username update threw', err);
      toast('Could not update username', 'error');
      submitBtn.disabled = false;
    }
  };

  submitBtn.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });

  showBottomSheet(form, 'Change username');
  setTimeout(() => { input.focus(); input.select(); }, 100);
}

function _renderStatsGrid() {
  const { stats } = _profileState;
  const grid = document.createElement('div');
  grid.className = 'profile-stats-grid';

  const cells = [
    { label: 'Total XP',         value: stats.totalXP.toLocaleString() },
    { label: 'Days active',      value: stats.daysActive.toString() },
    { label: 'Tasks done',       value: stats.tasksDone.toLocaleString() },
    { label: 'Habits completed', value: stats.habitsCompleted.toLocaleString() },
    { label: 'Projects done',    value: stats.projectsDone.toString() },
    { label: 'Best streak',      value: stats.bestStreak.toString() }
  ];

  cells.forEach(c => {
    const cell = document.createElement('div');
    cell.className = 'profile-stat-cell';
    const v = document.createElement('p');
    v.className = 'profile-stat-value mono';
    v.textContent = c.value;
    const l = document.createElement('p');
    l.className = 'profile-stat-label';
    l.textContent = c.label;
    cell.appendChild(v);
    cell.appendChild(l);
    grid.appendChild(cell);
  });

  return grid;
}

function _renderTitlesRow() {
  const { profile, achievements } = _profileState;
  const wrap = document.createElement('div');
  wrap.className = 'profile-titles-wrap';

  const heading = document.createElement('h3');
  heading.className = 'profile-section-heading mono';
  heading.textContent = 'TITLES';
  wrap.appendChild(heading);

  const scroll = document.createElement('div');
  scroll.className = 'title-scroll';

  const unlockedIds = new Set(achievements.unlocked.map(u => u.achievement_id));
  const titleDefs = achievements.definitions
    .filter(d => d.is_title && unlockedIds.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeId = profile.active_title || null;

  const nonePill = _makeTitlePill('None', null, activeId === null);
  scroll.appendChild(nonePill);

  titleDefs.forEach(def => {
    scroll.appendChild(_makeTitlePill(def.name, def.id, activeId === def.id));
  });

  if (titleDefs.length === 0) {
    const hint = document.createElement('p');
    hint.className = 'profile-titles-hint';
    hint.textContent = 'Unlock archetype achievements to earn titles.';
    wrap.appendChild(scroll);
    wrap.appendChild(hint);
    return wrap;
  }

  wrap.appendChild(scroll);
  return wrap;
}

function _makeTitlePill(label, titleId, isActive) {
  const pill = document.createElement('button');
  pill.className = 'title-pill' + (isActive ? ' title-pill--active' : '');
  pill.type = 'button';
  pill.textContent = label;
  pill.addEventListener('click', () => _selectTitle(titleId));
  return pill;
}

async function _selectTitle(titleId) {
  if (!_profileState) return;
  const currentActive = _profileState.profile.active_title || null;
  if (currentActive === titleId) return;

  haptic(15);
  const ok = await setActiveTitle(_profileState.userId, titleId);
  if (!ok) return;
  _profileState.profile.active_title = titleId;
  _renderProfileView();
  toast(titleId ? 'Title updated' : 'Title cleared');
}

function _renderAchievementsCta() {
  const { achievements, totalAchievements } = _profileState;
  const wrap = document.createElement('div');
  wrap.className = 'profile-ach-cta';

  const unlockedCount = achievements.unlocked.length;
  const total = totalAchievements || achievements.definitions.length || 1;
  const pct = Math.min(100, Math.round((unlockedCount / total) * 100));

  const progressWrap = document.createElement('div');
  progressWrap.className = 'ach-progress-wrap';

  const track = document.createElement('div');
  track.className = 'ach-progress-bar-track';
  const fill = document.createElement('div');
  fill.className = 'ach-progress-bar-fill';
  track.appendChild(fill);
  progressWrap.appendChild(track);

  const label = document.createElement('span');
  label.className = 'ach-progress-label mono';
  label.textContent = `${unlockedCount}/${total} UNLOCKED`;
  progressWrap.appendChild(label);

  wrap.appendChild(progressWrap);

  const btn = document.createElement('button');
  btn.className = 'btn-primary profile-ach-btn';
  btn.type = 'button';
  const btnText = document.createElement('span');
  btnText.textContent = 'Achievements';
  btn.appendChild(btnText);
  const arrow = document.createElement('i');
  arrow.setAttribute('data-lucide', 'arrow-right');
  btn.appendChild(arrow);
  btn.addEventListener('click', () => {
    if (typeof openAchievementsGallery === 'function') {
      openAchievementsGallery(_profileState.userId);
    }
  });
  wrap.appendChild(btn);

  requestAnimationFrame(() => setTimeout(() => { fill.style.width = `${pct}%`; }, 30));

  return wrap;
}

function closeProfile() {
  if (!_profileViewEl) return;
  _profileViewEl.classList.remove('view--visible');
  const el = _profileViewEl;
  el.addEventListener('transitionend', () => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, { once: true });
  _profileViewEl = null;

  if (typeof _refreshPlayerCardAfterProfile === 'function') {
    _refreshPlayerCardAfterProfile();
  }
}

function _destroyProfileView() {
  if (_profileViewEl && _profileViewEl.parentNode) {
    _profileViewEl.parentNode.removeChild(_profileViewEl);
  }
  _profileViewEl = null;
}
