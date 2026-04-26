var DEBUG = false;

var _tasks = [];
var _filter = 'all';
var _userId = null;
var _todayXP = 0;

document.addEventListener('DOMContentLoaded', async () => {
  const session = await checkSession();
  if (!session) return;
  _userId = session.user.id;
  if (typeof applyMatchDayTheme === 'function') applyMatchDayTheme(_userId);

  try {
    await Promise.all([_loadTasks(), _loadTodayXP()]);
    _renderAll();
    _wireFAB();
  } catch (err) {
    if (DEBUG) console.error('tasks init', err);
    toast('Could not load tasks', 'error');
  }
});

async function _loadTasks() {
  const today = todayLocal();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', _userId)
    .or(`due_date.eq.${today},and(due_date.lt.${today},completed.eq.false)`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  _tasks = data || [];
}

async function _loadTodayXP() {
  const { data, error } = await supabase
    .from('xp_events')
    .select('xp_amount')
    .eq('user_id', _userId)
    .eq('event_date', todayLocal())
    .eq('category', 'tasks');
  if (error) throw error;
  _todayXP = (data || []).reduce((sum, e) => sum + e.xp_amount, 0);
}

function _renderAll() {
  _renderDateHeader();
  _renderXPPill();
  _renderFilterBar();
  _renderTasks();
}

function _renderDateHeader() {
  const el = document.getElementById('date-header');
  if (el) el.textContent = formatDate(todayLocal());
}

function _renderXPPill() {
  const el = document.getElementById('xp-pill');
  if (!el) return;
  el.textContent = `${_todayXP} / 250 XP`;
  el.className = 'xp-pill mono';
  if (_todayXP >= 250) el.classList.add('xp-pill--capped');
  else if (_todayXP >= 200) el.classList.add('xp-pill--near');
}

function _getFiltered() {
  const today = todayLocal();
  switch (_filter) {
    case 'pending':  return _tasks.filter(t => !t.completed && t.due_date === today);
    case 'done':     return _tasks.filter(t => t.completed);
    case 'carried':  return _tasks.filter(t => !t.completed && t.due_date < today);
    default:         return _tasks;
  }
}

function _renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  bar.textContent = '';
  const today = todayLocal();

  const filters = [
    { key: 'all',     label: 'All',          count: _tasks.length },
    { key: 'pending', label: 'Pending',       count: _tasks.filter(t => !t.completed && t.due_date === today).length },
    { key: 'done',    label: 'Done',          count: _tasks.filter(t => t.completed).length },
    { key: 'carried', label: 'Carried Over',  count: _tasks.filter(t => !t.completed && t.due_date < today).length },
  ];

  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (_filter === f.key ? ' filter-btn--active' : '');
    btn.textContent = f.count > 0 ? `${f.label} (${f.count})` : f.label;
    btn.addEventListener('click', () => {
      _filter = f.key;
      _renderFilterBar();
      _renderTasks();
    });
    bar.appendChild(btn);
  });
}

function _renderTasks() {
  const list = document.getElementById('task-list');
  if (!list) return;
  list.textContent = '';

  const filtered = _getFiltered();
  if (filtered.length === 0) {
    list.appendChild(_createEmptyState());
    return;
  }
  filtered.forEach(task => list.appendChild(_createTaskCard(task)));
}

function _createEmptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state';

  const title = document.createElement('p');
  title.className = 'empty-state-title';
  const sub = document.createElement('p');
  sub.className = 'empty-state-sub';

  if (_filter === 'done') {
    title.textContent = 'Nothing done yet.';
    sub.textContent = 'Complete a task to see it here.';
  } else if (_filter === 'carried') {
    title.textContent = 'No carried tasks.';
    sub.textContent = "You're on top of things.";
  } else {
    title.textContent = 'All clear. Beast mode.';
    sub.textContent = `Today's haul: ${_todayXP} XP`;
  }

  el.appendChild(title);
  el.appendChild(sub);
  return el;
}

function _nextDueDate(recurrence) {
  const d = new Date(todayLocal() + 'T12:00:00');
  d.setDate(d.getDate() + (recurrence === 'weekly' ? 7 : 1));
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function _createTaskCard(task) {
  const today = todayLocal();
  const isCarried = !task.completed && task.due_date < today;
  const xpMap = { low: 10, medium: 20, high: 35 };
  const xpAmount = xpMap[task.priority] || 20;

  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' task-card--done' : '');
  card.dataset.taskId = task.id;

  let pressTimer = null;
  card.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => { haptic([10, 20]); _openTaskOptions(task); }, 500);
  }, { passive: true });
  card.addEventListener('touchend', () => clearTimeout(pressTimer));
  card.addEventListener('touchmove', () => clearTimeout(pressTimer));

  const check = document.createElement('button');
  check.className = 'task-check' + (task.completed ? ' task-check--done' : '');
  check.setAttribute('aria-label', task.completed ? 'Completed' : 'Mark complete');
  if (!task.completed) {
    check.addEventListener('click', () => _completeTask(task, card));
  }
  card.appendChild(check);

  const body = document.createElement('div');
  body.className = 'task-body';

  const titleRow = document.createElement('div');
  titleRow.className = 'task-title-row';

  const titleEl = document.createElement('span');
  titleEl.className = 'task-title';
  titleEl.textContent = task.title;
  titleRow.appendChild(titleEl);

  if (isCarried) {
    const carried = document.createElement('span');
    carried.className = 'badge badge--carried';
    carried.textContent = 'carried';
    titleRow.appendChild(carried);
  }
  body.appendChild(titleRow);

  const metaRow = document.createElement('div');
  metaRow.className = 'task-meta';

  const priority = document.createElement('span');
  priority.className = `badge badge--${task.priority}`;
  priority.textContent = task.priority;
  metaRow.appendChild(priority);

  if (task.recurrence && task.recurrence !== 'none') {
    const recBadge = document.createElement('span');
    recBadge.className = 'badge badge--recurring';
    recBadge.textContent = task.recurrence === 'daily' ? '↻ daily' : '↻ weekly';
    metaRow.appendChild(recBadge);
  }

  if (!task.completed) {
    const xpEl = document.createElement('span');
    xpEl.className = 'task-xp mono';
    xpEl.textContent = `+${xpAmount} XP`;
    metaRow.appendChild(xpEl);
  }

  body.appendChild(metaRow);
  card.appendChild(body);
  return card;
}

async function _completeTask(task, cardEl) {
  const checkBtn = cardEl.querySelector('.task-check');
  if (checkBtn) checkBtn.disabled = true;

  haptic(15);
  playTick();

  try {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', task.id);
    if (error) throw error;

    cardEl.classList.add('task-card--completing');

    const xpMap = { low: 10, medium: 20, high: 35 };
    const xpAmount = xpMap[task.priority] || 20;
    const result = await awardXP(_userId, xpAmount, 'tasks', `Task: ${task.title}`);

    if (result && result.awarded > 0) {
      floatXP(cardEl, result.awarded);
      _todayXP = Math.min(250, _todayXP + result.awarded);
      _renderXPPill();
    }

    if (typeof checkDailyChallenges === 'function') checkDailyChallenges(_userId).catch(() => {});

    if (typeof checkAchievements === 'function') {
      checkAchievements(_userId, { type: 'task_complete', meta: { priority: task.priority } })
        .then(unlocks => { if (unlocks && unlocks.length) processUnlocks(_userId, unlocks); });
    }

    task.completed = true;

    if (task.recurrence && task.recurrence !== 'none') {
      const nextDate = _nextDueDate(task.recurrence);
      await supabase.from('tasks').insert({
        user_id:    _userId,
        title:      task.title,
        priority:   task.priority,
        recurrence: task.recurrence,
        due_date:   nextDate
      });
    }

    setTimeout(async () => {
      await _checkAllDoneBonus();
      await _loadTasks();
      _renderFilterBar();
      _renderTasks();
    }, 700);

  } catch (err) {
    if (DEBUG) console.error('completeTask failed', err);
    if (checkBtn) checkBtn.disabled = false;
    cardEl.classList.remove('task-card--completing');
    toast('Could not complete task', 'error');
  }
}

async function _checkAllDoneBonus() {
  const today = todayLocal();
  const todayTasks = _tasks.filter(t => t.due_date === today);
  if (todayTasks.length === 0) return;
  if (todayTasks.some(t => !t.completed)) return;

  const { data } = await supabase
    .from('xp_events')
    .select('id')
    .eq('user_id', _userId)
    .eq('event_date', today)
    .eq('category', 'bonus')
    .ilike('description', 'All tasks done%')
    .limit(1);

  if (data && data.length > 0) return;

  const result = await awardXP(_userId, 50, 'bonus', 'All tasks done — daily bonus');
  if (result && result.awarded > 0) {
    toast('All tasks done — +50 XP bonus');
    _todayXP = Math.min(250, _todayXP + 50);
    _renderXPPill();
  }
}

function _openTaskOptions(task) {
  const today = todayLocal();
  const isCarried = !task.completed && task.due_date < today;

  const content = document.createElement('div');
  content.className = 'settings-content';

  const nameEl = document.createElement('p');
  nameEl.className = 'sheet-option-label';
  nameEl.textContent = task.title;
  content.appendChild(nameEl);

  if (isCarried) {
    const rescheduleBtn = document.createElement('button');
    rescheduleBtn.className = 'btn-outline';
    rescheduleBtn.textContent = 'Move to today';
    rescheduleBtn.addEventListener('click', async () => {
      await _rescheduleTask(task);
      hideBottomSheet();
    });
    content.appendChild(rescheduleBtn);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger-outline';
  deleteBtn.textContent = 'Delete task';
  deleteBtn.addEventListener('click', async () => {
    await _deleteTask(task);
    hideBottomSheet();
  });
  content.appendChild(deleteBtn);

  showBottomSheet(content, 'Task options');
}

async function _rescheduleTask(task) {
  try {
    const { error } = await supabase.from('tasks')
      .update({ due_date: todayLocal() })
      .eq('id', task.id);
    if (error) throw error;
    task.due_date = todayLocal();
    await _loadTasks();
    _renderFilterBar();
    _renderTasks();
    haptic(15);
    toast('Moved to today');
  } catch (err) {
    if (DEBUG) console.error('rescheduleTask failed', err);
    toast('Could not reschedule task', 'error');
  }
}

async function _deleteTask(task) {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) throw error;
    _tasks = _tasks.filter(t => t.id !== task.id);
    _renderFilterBar();
    _renderTasks();
    haptic(15);
  } catch (err) {
    if (DEBUG) console.error('deleteTask failed', err);
    toast('Could not delete task', 'error');
  }
}

function _wireFAB() {
  const fab = document.getElementById('fab-add');
  if (fab) fab.addEventListener('click', _openAddSheet);
}

function _openAddSheet() {
  const content = document.createElement('div');
  content.className = 'sheet-form';

  const titleLabel = document.createElement('label');
  titleLabel.className = 'form-label';
  titleLabel.setAttribute('for', 'new-task-title');
  titleLabel.textContent = 'Task';

  const titleInput = document.createElement('input');
  titleInput.className = 'form-input';
  titleInput.type = 'text';
  titleInput.id = 'new-task-title';
  titleInput.placeholder = 'What needs to be done?';
  titleInput.maxLength = 200;
  titleInput.autocomplete = 'off';

  const priorityLabel = document.createElement('p');
  priorityLabel.className = 'form-label';
  priorityLabel.textContent = 'Priority';

  const priorityGroup = document.createElement('div');
  priorityGroup.className = 'priority-group';

  let selectedPriority = 'medium';

  ['low', 'medium', 'high'].forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'priority-btn priority-btn--' + p + (p === 'medium' ? ' priority-btn--active' : '');
    btn.textContent = p;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      selectedPriority = p;
      priorityGroup.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('priority-btn--active'));
      btn.classList.add('priority-btn--active');
    });
    priorityGroup.appendChild(btn);
  });

  const recurLabel = document.createElement('p');
  recurLabel.className = 'form-label';
  recurLabel.textContent = 'Recurrence';

  const recurGroup = document.createElement('div');
  recurGroup.className = 'priority-group';

  let selectedRecurrence = 'none';

  ['none', 'daily', 'weekly'].forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'priority-btn' + (r === 'none' ? ' priority-btn--active priority-btn--medium' : '');
    btn.textContent = r;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      selectedRecurrence = r;
      recurGroup.querySelectorAll('.priority-btn').forEach(b => {
        b.classList.remove('priority-btn--active', 'priority-btn--medium');
      });
      btn.classList.add('priority-btn--active', 'priority-btn--medium');
    });
    recurGroup.appendChild(btn);
  });

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn-primary';
  submitBtn.type = 'button';
  submitBtn.textContent = 'Add Task';

  submitBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    await _addTask(title, selectedPriority, selectedRecurrence);
    hideBottomSheet();
  });

  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });

  content.appendChild(titleLabel);
  content.appendChild(titleInput);
  content.appendChild(priorityLabel);
  content.appendChild(priorityGroup);
  content.appendChild(recurLabel);
  content.appendChild(recurGroup);
  content.appendChild(submitBtn);

  showBottomSheet(content, 'New Task');
  setTimeout(() => titleInput.focus(), 350);
}

async function _addTask(title, priority, recurrence = 'none') {
  try {
    const { error } = await supabase.from('tasks').insert({
      user_id: _userId,
      title,
      priority,
      recurrence,
      due_date: todayLocal()
    });
    if (error) throw error;
    await _loadTasks();
    _renderFilterBar();
    _renderTasks();
    haptic(15);
  } catch (err) {
    if (DEBUG) console.error('addTask failed', err);
    toast('Could not add task', 'error');
  }
}
