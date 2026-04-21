var DEBUG = false;

var _projects = [];
var _milestones = {};
var _userId = null;
var _activeProject = null;
var _timerInterval = null;
var _projectFilter = 'active_paused'; // 'active_paused' | 'completed'

const TIMER_KEY = 'progress_os_timer';

document.addEventListener('DOMContentLoaded', async () => {
  const session = await checkSession();
  if (!session) return;
  _userId = session.user.id;

  try {
    await _loadData();
    _renderProjectFilter();
    _renderList();
    _wireFAB();
    _wireBack();
  } catch (err) {
    if (DEBUG) console.error('projects init', err);
    toast('Could not load projects', 'error');
  }
});

// ---- Data ----

async function _loadData() {
  const [projRes, msRes] = await Promise.all([
    supabase.from('projects').select('*').eq('user_id', _userId).order('created_at', { ascending: false }),
    supabase.from('milestones').select('*').eq('user_id', _userId).order('created_at', { ascending: true })
  ]);
  if (projRes.error) throw projRes.error;
  if (msRes.error) throw msRes.error;

  _projects = projRes.data || [];

  _milestones = {};
  (msRes.data || []).forEach(ms => {
    if (!_milestones[ms.project_id]) {
      _milestones[ms.project_id] = { total: 0, completed: 0, list: [] };
    }
    _milestones[ms.project_id].total++;
    if (ms.completed) _milestones[ms.project_id].completed++;
    _milestones[ms.project_id].list.push(ms);
  });
}

// ---- List view ----

function _renderProjectFilter() {
  const bar = document.getElementById('project-filter-bar');
  if (!bar) return;
  bar.textContent = '';

  const tabs = [
    { key: 'active_paused', label: 'Active', count: _projects.filter(p => p.status !== 'completed').length },
    { key: 'completed',     label: 'Completed', count: _projects.filter(p => p.status === 'completed').length }
  ];

  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (_projectFilter === tab.key ? ' filter-btn--active' : '');
    btn.textContent = tab.count > 0 ? `${tab.label} (${tab.count})` : tab.label;
    btn.addEventListener('click', () => {
      _projectFilter = tab.key;
      _renderProjectFilter();
      _renderList();
    });
    bar.appendChild(btn);
  });
}

function _renderList() {
  const list = document.getElementById('project-list');
  if (!list) return;
  list.textContent = '';

  const timer = _getRunningTimer();
  const filtered = _projectFilter === 'completed'
    ? _projects.filter(p => p.status === 'completed')
    : _projects.filter(p => p.status !== 'completed');

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const title = document.createElement('p');
    title.className = 'empty-state-title';
    title.textContent = _projectFilter === 'completed' ? 'No completed projects.' : 'No projects yet.';
    const sub = document.createElement('p');
    sub.className = 'empty-state-sub';
    sub.textContent = _projectFilter === 'completed' ? 'Complete one to see it here.' : 'Start building.';
    empty.appendChild(title);
    empty.appendChild(sub);
    list.appendChild(empty);
    return;
  }

  filtered.forEach(p => list.appendChild(_createProjectCard(p, timer)));
  lucide.createIcons();
}

function _createProjectCard(project, timer) {
  const ms = _milestones[project.id] || { total: 0, completed: 0 };
  const isRunning = timer && timer.projectId === project.id;

  const card = document.createElement('div');
  card.className = 'project-card' + (isRunning ? ' project-card--running' : '');
  card.dataset.projectId = project.id;
  card.addEventListener('click', () => _openDetail(project));

  // Top row: name + status badge
  const topRow = document.createElement('div');
  topRow.className = 'project-card-top';

  const name = document.createElement('p');
  name.className = 'project-name';
  name.textContent = project.title;
  topRow.appendChild(name);

  const statusBadge = document.createElement('span');
  statusBadge.className = 'project-status project-status--' + project.status;
  statusBadge.textContent = project.status.charAt(0).toUpperCase() + project.status.slice(1);
  topRow.appendChild(statusBadge);
  card.appendChild(topRow);

  // Category pill
  if (project.category) {
    const cat = document.createElement('span');
    cat.className = 'project-category';
    cat.textContent = project.category;
    card.appendChild(cat);
  }

  // Milestone progress bar
  if (ms.total > 0) {
    const progWrap = document.createElement('div');
    progWrap.className = 'project-progress-wrap';

    const progLabel = document.createElement('span');
    progLabel.className = 'project-progress-label mono';
    progLabel.textContent = `${ms.completed}/${ms.total} milestones`;

    const bar = document.createElement('div');
    bar.className = 'project-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'project-progress-fill';
    fill.style.width = `${Math.round((ms.completed / ms.total) * 100)}%`;
    bar.appendChild(fill);

    progWrap.appendChild(progLabel);
    progWrap.appendChild(bar);
    card.appendChild(progWrap);
  }

  // Bottom meta: XP + time + running indicator
  const meta = document.createElement('div');
  meta.className = 'project-meta';

  const xp = document.createElement('span');
  xp.className = 'project-xp mono';
  xp.textContent = `+${project.total_xp_earned || 0} XP`;
  meta.appendChild(xp);

  const time = document.createElement('span');
  time.className = 'project-time mono';
  time.textContent = _formatMinutes(project.total_minutes_tracked || 0);
  meta.appendChild(time);

  if (isRunning) {
    const dot = document.createElement('span');
    dot.className = 'timer-running-dot';
    dot.textContent = '● RUNNING';
    meta.appendChild(dot);
  }

  card.appendChild(meta);
  return card;
}

function _formatMinutes(minutes) {
  if (!minutes) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ---- Timer localStorage ----

function _getRunningTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function _saveTimer(projectId) {
  localStorage.setItem(TIMER_KEY, JSON.stringify({ projectId, startedAt: new Date().toISOString() }));
}

function _clearTimer() {
  localStorage.removeItem(TIMER_KEY);
}

// ---- Detail view navigation ----

function _openDetail(project) {
  _activeProject = project;

  const listView = document.getElementById('projects-list-view');
  const detailView = document.getElementById('project-detail-view');
  const titleEl = document.getElementById('detail-title');
  if (titleEl) titleEl.textContent = project.title;

  _renderDetail();

  listView.classList.add('view--slide-left');
  detailView.classList.add('view--visible');
  detailView.scrollTop = 0;
}

function _closeDetail() {
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }

  const listView = document.getElementById('projects-list-view');
  const detailView = document.getElementById('project-detail-view');
  listView.classList.remove('view--slide-left');
  detailView.classList.remove('view--visible');

  _activeProject = null;

  _loadData().then(() => { _renderProjectFilter(); _renderList(); }).catch(() => {});
}

function _wireBack() {
  const btn = document.getElementById('btn-back');
  if (btn) btn.addEventListener('click', _closeDetail);
}

// ---- Detail render ----

function _renderDetail() {
  const content = document.getElementById('detail-content');
  if (!content) return;
  content.textContent = '';

  const project = _activeProject;

  if (project.description) {
    const desc = document.createElement('p');
    desc.className = 'detail-description';
    desc.textContent = project.description;
    content.appendChild(desc);
  }

  content.appendChild(_buildTimerSection());
  content.appendChild(_buildMilestonesSection());
  content.appendChild(_buildSessionsSection());
  content.appendChild(_buildNotesSection());

  const ms = _milestones[project.id] || { completed: 0 };
  if (project.status === 'active' && ms.completed > 0) {
    content.appendChild(_buildCompleteBtn());
  }

  lucide.createIcons();
}

// ---- Timer ----

function _buildTimerCard() {
  const timer = _getRunningTimer();
  const isRunning = timer && timer.projectId === _activeProject.id;

  const card = document.createElement('div');
  card.className = 'timer-card' + (isRunning ? ' timer-card--running' : '');
  card.id = 'timer-card';

  const display = document.createElement('div');
  display.className = 'timer-display mono';
  display.id = 'timer-display';
  display.textContent = isRunning ? _elapsedDisplay(new Date(timer.startedAt)) : '00:00:00';
  card.appendChild(display);

  const btn = document.createElement('button');
  btn.id = 'timer-btn';
  btn.className = isRunning ? 'timer-btn timer-btn--stop' : 'timer-btn timer-btn--start';
  btn.textContent = isRunning ? 'STOP' : 'START';
  btn.addEventListener('click', isRunning ? _stopTimer : _startTimer);
  card.appendChild(btn);

  if (isRunning) _startDisplayTick(new Date(timer.startedAt));

  return card;
}

function _buildTimerSection() {
  const section = document.createElement('div');
  section.className = 'detail-section';
  section.id = 'timer-section';
  section.appendChild(_buildTimerCard());
  return section;
}

function _refreshTimerCard() {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  const old = document.getElementById('timer-card');
  if (old) {
    const fresh = _buildTimerCard();
    old.replaceWith(fresh);
  }
}

function _elapsedDisplay(startDate) {
  const secs = Math.floor((Date.now() - startDate.getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function _startDisplayTick(startDate) {
  if (_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(() => {
    const display = document.getElementById('timer-display');
    if (display) display.textContent = _elapsedDisplay(startDate);
  }, 1000);
}

function _startTimer() {
  const running = _getRunningTimer();
  if (running) {
    const other = _projects.find(p => p.id === running.projectId);
    toast(`Timer already running${other ? ` — ${other.title}` : ''}`, 'error');
    return;
  }
  _saveTimer(_activeProject.id);
  haptic(15);
  _refreshTimerCard();
  toast('Session started');
}

async function _stopTimer() {
  const timer = _getRunningTimer();
  if (!timer || timer.projectId !== _activeProject.id) return;

  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const startedAt = new Date(timer.startedAt);
  const savedTimerData = timer;
  const endedAt = new Date();
  const durationMinutes = Math.floor((endedAt - startedAt) / 60000);
  const xpEarned = sessionXP(durationMinutes);

  _clearTimer();
  _refreshTimerCard();

  try {
    const { error: se } = await supabase.from('project_sessions').insert({
      project_id: _activeProject.id,
      user_id: _userId,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      xp_awarded: xpEarned
    });
    if (se) throw se;

    const newMinutes = (_activeProject.total_minutes_tracked || 0) + durationMinutes;
    const newXP = (_activeProject.total_xp_earned || 0) + xpEarned;

    const { error: pe } = await supabase.from('projects').update({
      total_minutes_tracked: newMinutes,
      total_xp_earned: newXP,
      last_session_at: endedAt.toISOString()
    }).eq('id', _activeProject.id);
    if (pe) throw pe;

    _activeProject.total_minutes_tracked = newMinutes;
    _activeProject.total_xp_earned = newXP;

    if (xpEarned > 0) {
      const result = await awardXP(_userId, xpEarned, 'projects', `Session: ${_activeProject.title}`);
      const btn = document.getElementById('timer-btn');
      if (result && result.awarded > 0 && btn) floatXP(btn, result.awarded);
    }

    haptic([10, 30, 10]);

    if (durationMinutes < 5) {
      toast(`Session saved (${durationMinutes}min — need 5min for XP)`);
    } else {
      toast(`+${xpEarned} XP — ${_formatMinutes(durationMinutes)}`);
    }

    await _loadRecentSessions();

  } catch (err) {
    if (DEBUG) console.error('stopTimer failed', err);
    localStorage.setItem(TIMER_KEY, JSON.stringify(savedTimerData));
    _refreshTimerCard();
    toast('Could not save session', 'error');
  }
}

// ---- Milestones ----

function _buildMilestonesSection() {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const heading = document.createElement('h2');
  heading.className = 'detail-section-title';
  heading.textContent = 'Milestones';
  section.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'milestone-list';
  list.id = 'milestone-list';

  const msList = (_milestones[_activeProject.id] || { list: [] }).list;

  if (msList.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'detail-empty';
    empty.textContent = 'No milestones yet.';
    list.appendChild(empty);
  } else {
    msList.forEach(ms => list.appendChild(_createMilestoneRow(ms)));
  }
  section.appendChild(list);

  // Inline add row
  const addRow = document.createElement('div');
  addRow.className = 'milestone-add-row';

  const input = document.createElement('input');
  input.className = 'form-input milestone-add-input';
  input.type = 'text';
  input.id = 'milestone-input';
  input.placeholder = 'Add milestone…';
  input.maxLength = 200;
  input.autocomplete = 'off';

  const addBtn = document.createElement('button');
  addBtn.className = 'milestone-add-btn';
  addBtn.setAttribute('aria-label', 'Add milestone');
  const plusIcon = document.createElement('i');
  plusIcon.setAttribute('data-lucide', 'plus');
  addBtn.appendChild(plusIcon);

  addBtn.addEventListener('click', async () => {
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    addBtn.disabled = true;
    await _addMilestone(title);
    input.value = '';
    addBtn.disabled = false;
    input.focus();
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });

  addRow.appendChild(input);
  addRow.appendChild(addBtn);
  section.appendChild(addRow);

  return section;
}

function _createMilestoneRow(ms) {
  const row = document.createElement('div');
  row.className = 'milestone-row' + (ms.completed ? ' milestone-row--done' : '');
  row.dataset.msId = ms.id;

  let pressTimer = null;
  row.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => { haptic([10, 20]); _openMilestoneOptions(ms); }, 500);
  }, { passive: true });
  row.addEventListener('touchend', () => clearTimeout(pressTimer));
  row.addEventListener('touchmove', () => clearTimeout(pressTimer));

  const title = document.createElement('span');
  title.className = 'milestone-title';
  title.textContent = ms.title;
  row.appendChild(title);

  const right = document.createElement('div');
  right.className = 'milestone-right';

  const xpEl = document.createElement('span');
  xpEl.className = 'milestone-xp mono';
  xpEl.textContent = ms.completed ? 'done' : '+40 XP';
  right.appendChild(xpEl);

  if (!ms.completed) {
    const btn = document.createElement('button');
    btn.className = 'milestone-complete-btn';
    btn.setAttribute('aria-label', 'Complete milestone');
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'check');
    btn.appendChild(icon);
    btn.addEventListener('click', () => _completeMilestone(ms, row, right));
    right.appendChild(btn);
  } else {
    const doneWrap = document.createElement('span');
    doneWrap.className = 'milestone-done-icon';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'check-circle');
    doneWrap.appendChild(icon);
    right.appendChild(doneWrap);
  }

  row.appendChild(right);
  return row;
}

async function _addMilestone(title) {
  try {
    const { data, error } = await supabase.from('milestones').insert({
      project_id: _activeProject.id,
      user_id: _userId,
      title
    }).select().single();
    if (error) throw error;

    if (!_milestones[_activeProject.id]) {
      _milestones[_activeProject.id] = { total: 0, completed: 0, list: [] };
    }
    _milestones[_activeProject.id].total++;
    _milestones[_activeProject.id].list.push(data);

    const list = document.getElementById('milestone-list');
    if (list) {
      const empty = list.querySelector('.detail-empty');
      if (empty) list.removeChild(empty);
      const row = _createMilestoneRow(data);
      list.appendChild(row);
      lucide.createIcons();
    }
    haptic(15);
  } catch (err) {
    if (DEBUG) console.error('addMilestone failed', err);
    toast('Could not add milestone', 'error');
  }
}

async function _completeMilestone(ms, rowEl, rightEl) {
  const btn = rightEl.querySelector('.milestone-complete-btn');
  if (btn) btn.disabled = true;
  haptic(15);

  try {
    const { error } = await supabase.from('milestones').update({
      completed: true,
      completed_at: new Date().toISOString()
    }).eq('id', ms.id);
    if (error) throw error;

    const result = await awardXP(_userId, 40, 'projects', `Milestone: ${ms.title}`);
    if (result && result.awarded > 0) {
      floatXP(rowEl, result.awarded);
      const newXP = (_activeProject.total_xp_earned || 0) + result.awarded;
      _activeProject.total_xp_earned = newXP;
      await supabase.from('projects').update({ total_xp_earned: newXP }).eq('id', _activeProject.id);
    }

    ms.completed = true;
    if (_milestones[_activeProject.id]) _milestones[_activeProject.id].completed++;

    rowEl.className = 'milestone-row milestone-row--done';
    rightEl.textContent = '';

    const xpEl = document.createElement('span');
    xpEl.className = 'milestone-xp mono';
    xpEl.textContent = 'done';
    rightEl.appendChild(xpEl);

    const doneWrap = document.createElement('span');
    doneWrap.className = 'milestone-done-icon';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'check-circle');
    doneWrap.appendChild(icon);
    rightEl.appendChild(doneWrap);
    lucide.createIcons();

    haptic([10, 30, 10]);
    toast('Milestone complete — +40 XP');

    // Show "Complete Project" button on first milestone done
    const msData = _milestones[_activeProject.id] || { completed: 0 };
    if (_activeProject.status === 'active' && msData.completed === 1) {
      const content = document.getElementById('detail-content');
      if (content && !document.getElementById('complete-project-wrap')) {
        content.appendChild(_buildCompleteBtn());
      }
    }

  } catch (err) {
    if (DEBUG) console.error('completeMilestone failed', err);
    if (btn) btn.disabled = false;
    toast('Could not complete milestone', 'error');
  }
}

function _openMilestoneOptions(ms) {
  const content = document.createElement('div');
  content.className = 'settings-content';

  const nameEl = document.createElement('p');
  nameEl.className = 'sheet-option-label';
  nameEl.textContent = ms.title;
  content.appendChild(nameEl);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger-outline';
  deleteBtn.textContent = 'Delete milestone';
  deleteBtn.addEventListener('click', async () => {
    await _deleteMilestone(ms);
    hideBottomSheet();
  });
  content.appendChild(deleteBtn);

  showBottomSheet(content, 'Milestone');
}

async function _deleteMilestone(ms) {
  try {
    const { error } = await supabase.from('milestones').delete().eq('id', ms.id);
    if (error) throw error;

    if (_milestones[_activeProject.id]) {
      _milestones[_activeProject.id].list = _milestones[_activeProject.id].list.filter(m => m.id !== ms.id);
      _milestones[_activeProject.id].total--;
      if (ms.completed) _milestones[_activeProject.id].completed--;
    }

    const row = document.querySelector(`[data-ms-id="${ms.id}"]`);
    if (row) row.remove();

    const list = document.getElementById('milestone-list');
    if (list && list.children.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'detail-empty';
      empty.textContent = 'No milestones yet.';
      list.appendChild(empty);
    }

    haptic(15);
  } catch (err) {
    if (DEBUG) console.error('deleteMilestone failed', err);
    toast('Could not delete milestone', 'error');
  }
}

// ---- Sessions ----

function _buildSessionsSection() {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const heading = document.createElement('h2');
  heading.className = 'detail-section-title';
  heading.textContent = 'Recent Sessions';
  section.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'session-list';
  list.id = 'session-list';

  const loading = document.createElement('p');
  loading.className = 'detail-empty';
  loading.textContent = 'Loading…';
  list.appendChild(loading);

  section.appendChild(list);
  _loadRecentSessions();
  return section;
}

async function _loadRecentSessions() {
  try {
    const { data, error } = await supabase
      .from('project_sessions')
      .select('*')
      .eq('project_id', _activeProject.id)
      .order('started_at', { ascending: false })
      .limit(5);
    if (error) throw error;

    const list = document.getElementById('session-list');
    if (!list) return;
    list.textContent = '';

    if (!data || data.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'detail-empty';
      empty.textContent = 'No sessions yet.';
      list.appendChild(empty);
      return;
    }

    data.forEach(session => {
      const row = document.createElement('div');
      row.className = 'session-row';

      const left = document.createElement('div');
      left.className = 'session-left';

      const dateEl = document.createElement('span');
      dateEl.className = 'session-date';
      dateEl.textContent = _formatSessionDate(session.started_at);
      left.appendChild(dateEl);

      const dur = document.createElement('span');
      dur.className = 'session-duration mono';
      dur.textContent = _formatMinutes(session.duration_minutes || 0);
      left.appendChild(dur);

      row.appendChild(left);

      const xpEl = document.createElement('span');
      xpEl.className = 'session-xp mono';
      xpEl.textContent = `+${session.xp_awarded} XP`;
      row.appendChild(xpEl);

      list.appendChild(row);
    });
  } catch (err) {
    if (DEBUG) console.error('loadSessions failed', err);
  }
}

function _formatSessionDate(isoString) {
  const localDate = new Date(isoString).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  if (localDate === todayLocal()) return 'Today';
  if (localDate === yesterdayLocal()) return 'Yesterday';
  return new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: TIMEZONE });
}

// ---- Notes ----

function _buildNotesSection() {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const heading = document.createElement('h2');
  heading.className = 'detail-section-title';
  heading.textContent = 'Notes';
  section.appendChild(heading);

  const textarea = document.createElement('textarea');
  textarea.className = 'notes-area';
  textarea.placeholder = 'Add notes…';
  textarea.maxLength = 2000;
  textarea.value = _activeProject.notes || '';

  textarea.addEventListener('blur', async () => {
    const newNotes = textarea.value.trim();
    if (newNotes === (_activeProject.notes || '').trim()) return;
    await _saveNotes(newNotes);
  });

  section.appendChild(textarea);
  return section;
}

async function _saveNotes(notes) {
  try {
    const { error } = await supabase.from('projects').update({ notes }).eq('id', _activeProject.id);
    if (error) throw error;
    _activeProject.notes = notes;
    toast('Notes saved');
  } catch (err) {
    if (DEBUG) console.error('saveNotes failed', err);
    toast('Could not save notes', 'error');
  }
}

// ---- Complete project ----

function _buildCompleteBtn() {
  const wrap = document.createElement('div');
  wrap.className = 'complete-project-wrap';
  wrap.id = 'complete-project-wrap';

  const btn = document.createElement('button');
  btn.className = 'btn-complete-project';
  btn.textContent = 'Complete Project (+200 XP)';
  btn.addEventListener('click', _completeProject);
  wrap.appendChild(btn);
  return wrap;
}

async function _completeProject() {
  try {
    const { error } = await supabase.from('projects').update({ status: 'completed' }).eq('id', _activeProject.id);
    if (error) throw error;

    const result = await awardXP(_userId, 200, 'projects', `Project complete: ${_activeProject.title}`);

    if (result && result.awarded > 0) {
      const btn = document.querySelector('.btn-complete-project');
      if (btn) floatXP(btn, result.awarded);
      const newXP = (_activeProject.total_xp_earned || 0) + result.awarded;
      _activeProject.total_xp_earned = newXP;
      await supabase.from('projects').update({ total_xp_earned: newXP }).eq('id', _activeProject.id);
    }

    _activeProject.status = 'completed';
    haptic([30, 50, 30]);
    toast('Project complete! +200 XP');

    await _loadData();
    _renderDetail();

  } catch (err) {
    if (DEBUG) console.error('completeProject failed', err);
    toast('Could not complete project', 'error');
  }
}

// ---- FAB / Add project ----

function _wireFAB() {
  const fab = document.getElementById('fab-add');
  if (fab) fab.addEventListener('click', _openAddSheet);
}

function _openAddSheet() {
  const content = document.createElement('div');
  content.className = 'sheet-form';

  const titleLabel = document.createElement('label');
  titleLabel.className = 'form-label';
  titleLabel.setAttribute('for', 'new-proj-title');
  titleLabel.textContent = 'Project name';

  const titleInput = document.createElement('input');
  titleInput.className = 'form-input';
  titleInput.type = 'text';
  titleInput.id = 'new-proj-title';
  titleInput.placeholder = 'What are you building?';
  titleInput.maxLength = 100;
  titleInput.autocomplete = 'off';

  const descLabel = document.createElement('label');
  descLabel.className = 'form-label';
  descLabel.setAttribute('for', 'new-proj-desc');
  descLabel.textContent = 'Description (optional)';

  const descInput = document.createElement('input');
  descInput.className = 'form-input';
  descInput.type = 'text';
  descInput.id = 'new-proj-desc';
  descInput.placeholder = 'One sentence about it';
  descInput.maxLength = 200;
  descInput.autocomplete = 'off';

  const catLabel = document.createElement('label');
  catLabel.className = 'form-label';
  catLabel.setAttribute('for', 'new-proj-cat');
  catLabel.textContent = 'Category (optional)';

  const catInput = document.createElement('input');
  catInput.className = 'form-input';
  catInput.type = 'text';
  catInput.id = 'new-proj-cat';
  catInput.placeholder = 'e.g. Web, Mobile, Design…';
  catInput.maxLength = 50;
  catInput.autocomplete = 'off';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn-primary';
  submitBtn.type = 'button';
  submitBtn.textContent = 'Add Project';

  submitBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding…';
    await _addProject(title, descInput.value.trim(), catInput.value.trim());
    hideBottomSheet();
  });

  titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') descInput.focus(); });
  descInput.addEventListener('keydown', e => { if (e.key === 'Enter') catInput.focus(); });
  catInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });

  content.appendChild(titleLabel);
  content.appendChild(titleInput);
  content.appendChild(descLabel);
  content.appendChild(descInput);
  content.appendChild(catLabel);
  content.appendChild(catInput);
  content.appendChild(submitBtn);

  showBottomSheet(content, 'New Project');
  setTimeout(() => titleInput.focus(), 350);
}

async function _addProject(title, description, category) {
  try {
    const { error } = await supabase.from('projects').insert({
      user_id: _userId,
      title,
      description: description || null,
      category: category || null
    });
    if (error) throw error;
    await _loadData();
    _renderList();
    haptic(15);
  } catch (err) {
    if (DEBUG) console.error('addProject failed', err);
    toast('Could not add project', 'error');
  }
}
