var DEBUG = false;

var _habits = [];
var _userId = null;
var _profile = null;
var _selectedDow = null;
var _logsMap = {}; // { habitId: Set<date_string> } for last 7 days

document.addEventListener('DOMContentLoaded', async () => {
  const session = await checkSession();
  if (!session) return;
  _userId = session.user.id;
  if (typeof applyMatchDayTheme === 'function') applyMatchDayTheme(_userId);

  try {
    _selectedDow = todayDayOfWeek();
    await _loadData();
    await _checkStreaks();
    _renderAll();
    _wireFAB();
  } catch (err) {
    if (DEBUG) console.error('habits init', err);
    toast('Could not load habits', 'error');
  }
});

async function _loadData() {
  const sixDaysAgo = nDaysAgoLocal(6);
  const [habitsRes, profileRes, logsRes] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', _userId).order('created_at', { ascending: true }),
    supabase.from('profiles').select('freezes_available, total_xp').eq('id', _userId).single(),
    supabase.from('habit_logs').select('habit_id, completed_date').eq('user_id', _userId).gte('completed_date', sixDaysAgo)
  ]);
  if (habitsRes.error) throw habitsRes.error;
  if (profileRes.error) throw profileRes.error;
  if (logsRes.error) throw logsRes.error;
  _habits = habitsRes.data || [];
  _profile = profileRes.data;

  _logsMap = {};
  (logsRes.data || []).forEach(log => {
    if (!_logsMap[log.habit_id]) _logsMap[log.habit_id] = new Set();
    _logsMap[log.habit_id].add(log.completed_date);
  });
}

async function _checkStreaks() {
  const today = todayLocal();
  const todayDow = todayDayOfWeek();

  for (const habit of _habits) {
    const activeDays = habit.active_days || [0,1,2,3,4,5,6];
    if (!activeDays.includes(todayDow)) continue; // not scheduled today, skip

    const last = habit.last_completed_date;
    if (!last || last === today) continue;

    const prevDay = prevScheduledDate(activeDays);
    if (!prevDay || last >= prevDay) continue; // completed on last scheduled day, fine

    if (_profile.freezes_available > 0 && habit.current_streak >= 3) {
      const ok = await consumeFreeze(_userId, habit, prevDay);
      if (ok) _profile.freezes_available--;
    } else {
      await _breakStreak(habit);
    }
  }
}

async function _breakStreak(habit) {
  try {
    const { error } = await supabase.from('habits')
      .update({ current_streak: 0 })
      .eq('id', habit.id);
    if (error) throw error;

    await supabase.from('xp_events').insert({
      user_id: _userId,
      description: `Streak broken — ${habit.title}`,
      xp_amount: 0,
      category: 'system',
      event_date: todayLocal()
    });

    habit.current_streak = 0;
  } catch (err) {
    if (DEBUG) console.error('breakStreak failed', err);
  }
}

function _renderAll() {
  _renderHeader();
  _renderHabits();
}

function _renderHeader() {
  const dateEl = document.getElementById('habits-date');
  if (dateEl) dateEl.textContent = formatDate(todayLocal());
  _renderFreezeCount();
  _updateBuyButton();
  _renderDayFilter();
}

function _renderDayFilter() {
  const container = document.getElementById('habits-day-filter');
  if (!container) return;
  container.textContent = '';

  const todayDow = todayDayOfWeek();
  const dayDefs = [
    { label: 'Seg', dow: 1 }, { label: 'Ter', dow: 2 }, { label: 'Qua', dow: 3 },
    { label: 'Qui', dow: 4 }, { label: 'Sex', dow: 5 }, { label: 'Sab', dow: 6 },
    { label: 'Dom', dow: 0 }
  ];

  dayDefs.forEach(({ label, dow }) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (dow === _selectedDow ? ' filter-btn--active' : '');
    btn.textContent = dow === todayDow ? label + ' ·' : label;
    btn.addEventListener('click', () => {
      _selectedDow = dow;
      _renderDayFilter();
      _renderHabits();
    });
    container.appendChild(btn);
  });
}

function _renderFreezeCount() {
  const el = document.getElementById('freeze-count');
  if (!el) return;
  el.textContent = '';

  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', 'snowflake');
  el.appendChild(icon);

  const n = _profile.freezes_available;
  const text = document.createTextNode(` ${n} freeze${n !== 1 ? 's' : ''}`);
  el.appendChild(text);
  lucide.createIcons();
}

function _updateBuyButton() {
  const btn = document.getElementById('btn-buy-freeze');
  if (!btn) return;
  btn.disabled = _profile.total_xp < 150 || _profile.freezes_available >= 3;
}

function _renderHabits() {
  const list = document.getElementById('habit-list');
  if (!list) return;
  list.textContent = '';

  const filtered = _habits.filter(h => {
    const days = h.active_days || [0,1,2,3,4,5,6];
    return days.includes(_selectedDow);
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const title = document.createElement('p');
    title.className = 'empty-state-title';
    title.textContent = 'No habits this day.';
    const sub = document.createElement('p');
    sub.className = 'empty-state-sub';
    sub.textContent = 'Add one or pick another day.';
    empty.appendChild(title);
    empty.appendChild(sub);
    list.appendChild(empty);
    return;
  }

  filtered.forEach(habit => list.appendChild(_createHabitCard(habit)));
}

function _createHabitCard(habit) {
  const today = todayLocal();
  const isDone = habit.last_completed_date === today;

  const card = document.createElement('div');
  card.className = 'habit-card';
  card.dataset.habitId = habit.id;

  let pressTimer = null;
  card.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => { haptic([10, 20]); _openHabitOptions(habit); }, 500);
  }, { passive: true });
  card.addEventListener('touchend', () => clearTimeout(pressTimer));
  card.addEventListener('touchmove', () => clearTimeout(pressTimer));

  const body = document.createElement('div');
  body.className = 'habit-body';

  const name = document.createElement('p');
  name.className = 'habit-name';
  name.textContent = habit.title;
  body.appendChild(name);

  const streak = document.createElement('p');
  streak.className = 'habit-streak mono';
  const flameSpan = document.createElement('span');
  flameSpan.className = 'streak-flame';
  flameSpan.textContent = '🔥';
  streak.appendChild(flameSpan);
  const streakText = document.createElement('span');
  streakText.className = 'streak-text';
  streakText.textContent = ` ${habit.current_streak} day${habit.current_streak !== 1 ? 's' : ''}`;
  streak.appendChild(streakText);
  body.appendChild(streak);

  const milestones = document.createElement('div');
  milestones.className = 'habit-milestones';
  [7, 30, 100].forEach(n => {
    const badge = document.createElement('span');
    badge.className = 'milestone-badge' + (habit.current_streak >= n ? ' milestone-badge--unlocked' : '');
    badge.textContent = `${n}d`;
    milestones.appendChild(badge);
  });
  body.appendChild(milestones);

  // 7-day sparkline
  const sparkline = document.createElement('div');
  sparkline.className = 'habit-sparkline';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const isToday = (i === 0);
    const done = (_logsMap[habit.id] && _logsMap[habit.id].has(dateStr)) || (isToday && isDone);
    const dot = document.createElement('span');
    dot.className = 'spark-dot' + (done ? ' spark-dot--done' : '') + (isToday ? ' spark-dot--today' : '');
    sparkline.appendChild(dot);
  }
  body.appendChild(sparkline);

  if (habit.longest_streak > 0) {
    const best = document.createElement('p');
    best.className = 'habit-best mono';
    best.textContent = `best: ${habit.longest_streak}d`;
    body.appendChild(best);
  }

  card.appendChild(body);

  const right = document.createElement('div');
  right.className = 'habit-right';

  const toggle = document.createElement('button');
  toggle.className = 'habit-toggle' + (isDone ? ' habit-toggle--on' : '');
  toggle.setAttribute('aria-label', isDone ? 'Completed today' : 'Mark complete');
  toggle.setAttribute('aria-pressed', String(isDone));

  if (isDone) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'check');
    toggle.appendChild(icon);
    lucide.createIcons();
  }

  const isToday = _selectedDow === todayDayOfWeek();
  if (!isDone && isToday) {
    toggle.addEventListener('click', () => _completeHabit(habit, card, toggle, right));
  } else if (!isToday) {
    toggle.disabled = true;
  }

  const xpEl = document.createElement('span');
  xpEl.className = 'habit-xp mono';
  xpEl.textContent = isDone ? 'done' : '+15 XP';

  right.appendChild(toggle);
  right.appendChild(xpEl);
  card.appendChild(right);

  return card;
}

async function _completeHabit(habit, cardEl, toggleEl, rightEl) {
  toggleEl.disabled = true;
  haptic(15);
  playTick();

  const today = todayLocal();
  const yesterday = yesterdayLocal();
  const last = habit.last_completed_date;
  const newStreak = (last === yesterday || last === today) ? habit.current_streak + 1 : 1;
  const newLongest = Math.max(habit.longest_streak || 0, newStreak);

  try {
    const { error } = await supabase.from('habits').update({
      last_completed_date: today,
      current_streak: newStreak,
      longest_streak: newLongest,
      total_completions: (habit.total_completions || 0) + 1
    }).eq('id', habit.id);
    if (error) throw error;

    await supabase.from('habit_logs').insert({
      habit_id: habit.id,
      user_id: _userId,
      completed_date: today,
      xp_awarded: 15,
      streak_at_completion: newStreak
    });

    const result = await awardXP(_userId, 15, 'habits', `Habit: ${habit.title}`);
    if (result && result.awarded > 0) floatXP(toggleEl, result.awarded);

    await _checkMilestone(habit, newStreak);

    if (typeof checkAchievements === 'function') {
      checkAchievements(_userId, {
        type: 'habit_complete',
        meta: { habit_id: habit.id, new_streak: newStreak, longest_streak: newLongest }
      }).then(unlocks => { if (unlocks && unlocks.length) processUnlocks(_userId, unlocks); });
    }

    habit.last_completed_date = today;
    habit.current_streak = newStreak;
    habit.longest_streak = newLongest;

    // Keep logsMap + sparkline in sync without re-render
    if (!_logsMap[habit.id]) _logsMap[habit.id] = new Set();
    _logsMap[habit.id].add(today);
    const todayDot = cardEl.querySelector('.spark-dot--today');
    if (todayDot) todayDot.classList.add('spark-dot--done');

    toggleEl.classList.add('habit-toggle--on');
    toggleEl.textContent = '';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'check');
    toggleEl.appendChild(icon);
    lucide.createIcons();

    const xpEl = rightEl.querySelector('.habit-xp');
    if (xpEl) xpEl.textContent = 'done';

    cardEl.querySelectorAll('.milestone-badge').forEach((badge, i) => {
      if (newStreak >= [7, 30, 100][i]) badge.classList.add('milestone-badge--unlocked');
    });

    cardEl.classList.add('habit-card--pulse');
    const streakEl = cardEl.querySelector('.habit-streak');
    if (streakEl) {
      const streakTextEl = streakEl.querySelector('.streak-text');
      if (streakTextEl) streakTextEl.textContent = ` ${newStreak} day${newStreak !== 1 ? 's' : ''}`;
      streakEl.classList.add('habit-streak--bounce');
      setTimeout(() => streakEl.classList.remove('habit-streak--bounce'), 600);

      if ([7, 30, 100].includes(newStreak)) {
        const flameEl = streakEl.querySelector('.streak-flame');
        if (flameEl) {
          flameEl.classList.add('streak-flame--flicker');
          setTimeout(() => flameEl.classList.remove('streak-flame--flicker'), 1500);
        }
      }
    }
    setTimeout(() => cardEl.classList.remove('habit-card--pulse'), 600);

    haptic([10, 30, 10]);

  } catch (err) {
    if (DEBUG) console.error('completeHabit failed', err);
    toggleEl.disabled = false;
    toast('Could not complete habit', 'error');
  }
}

async function _checkMilestone(habit, newStreak) {
  const milestones = { 7: 50, 30: 150, 100: 500 };
  const xp = milestones[newStreak];
  if (!xp) return;

  const { data } = await supabase
    .from('xp_events')
    .select('id')
    .eq('user_id', _userId)
    .eq('category', 'bonus')
    .ilike('description', `Streak milestone ${newStreak}d — ${habit.title}%`)
    .limit(1);

  if (data && data.length > 0) return;

  const result = await awardXP(_userId, xp, 'bonus', `Streak milestone ${newStreak}d — ${habit.title}`);
  if (result && result.awarded > 0) {
    toast(`${newStreak}-day streak — +${xp} XP`);
    playStreakMilestone();
    haptic([30, 50, 30]);
  }
}

function _openHabitOptions(habit) {
  const content = document.createElement('div');
  content.className = 'settings-content';

  const nameEl = document.createElement('p');
  nameEl.className = 'sheet-option-label';
  nameEl.textContent = habit.title;
  content.appendChild(nameEl);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger-outline';
  deleteBtn.textContent = 'Delete habit';
  deleteBtn.addEventListener('click', async () => {
    await _deleteHabit(habit);
    hideBottomSheet();
  });
  content.appendChild(deleteBtn);

  showBottomSheet(content, 'Habit options');
}

async function _deleteHabit(habit) {
  try {
    const { error } = await supabase.from('habits').delete().eq('id', habit.id);
    if (error) throw error;
    _habits = _habits.filter(h => h.id !== habit.id);
    _renderHabits();
    haptic(15);
  } catch (err) {
    if (DEBUG) console.error('deleteHabit failed', err);
    toast('Could not delete habit', 'error');
  }
}

function _wireFAB() {
  const fab = document.getElementById('fab-add');
  if (fab) fab.addEventListener('click', _openAddSheet);

  const buyBtn = document.getElementById('btn-buy-freeze');
  if (buyBtn) buyBtn.addEventListener('click', _buyFreeze);
}

function _openAddSheet() {
  const content = document.createElement('div');
  content.className = 'sheet-form';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.setAttribute('for', 'new-habit-name');
  label.textContent = 'Habit';

  const input = document.createElement('input');
  input.className = 'form-input';
  input.type = 'text';
  input.id = 'new-habit-name';
  input.placeholder = 'What do you want to do daily?';
  input.maxLength = 200;
  input.autocomplete = 'off';

  const daysLabel = document.createElement('p');
  daysLabel.className = 'form-label';
  daysLabel.textContent = 'Days';

  const daysGroup = document.createElement('div');
  daysGroup.className = 'days-group';

  const dayDefs = [
    { label: 'Seg', dow: 1 }, { label: 'Ter', dow: 2 }, { label: 'Qua', dow: 3 },
    { label: 'Qui', dow: 4 }, { label: 'Sex', dow: 5 }, { label: 'Sab', dow: 6 },
    { label: 'Dom', dow: 0 }
  ];

  let selectedDays = [0,1,2,3,4,5,6]; // all by default

  dayDefs.forEach(({ label, dow }) => {
    const btn = document.createElement('button');
    btn.className = 'day-btn day-btn--active';
    btn.textContent = label;
    btn.type = 'button';
    btn.dataset.dow = dow;
    btn.addEventListener('click', () => {
      if (selectedDays.includes(dow)) {
        if (selectedDays.length === 1) return; // must have at least 1 day
        selectedDays = selectedDays.filter(d => d !== dow);
        btn.classList.remove('day-btn--active');
      } else {
        selectedDays.push(dow);
        btn.classList.add('day-btn--active');
      }
    });
    daysGroup.appendChild(btn);
  });

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn-primary';
  submitBtn.type = 'button';
  submitBtn.textContent = 'Add Habit';

  submitBtn.addEventListener('click', async () => {
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    await _addHabit(title, selectedDays);
    hideBottomSheet();
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });

  content.appendChild(label);
  content.appendChild(input);
  content.appendChild(daysLabel);
  content.appendChild(daysGroup);
  content.appendChild(submitBtn);

  showBottomSheet(content, 'New Habit');
  setTimeout(() => input.focus(), 350);
}

async function _addHabit(title, activeDays) {
  try {
    const { error } = await supabase.from('habits').insert({ user_id: _userId, title, active_days: activeDays });
    if (error) throw error;
    await _loadData();
    _renderHabits();
    haptic(15);
    const label = _activeDaysLabel(activeDays);
    toast(`Habit saved — ${label}`);
  } catch (err) {
    if (DEBUG) console.error('addHabit failed', err);
    toast('Could not add habit', 'error');
  }
}

function _activeDaysLabel(days) {
  if (days.length === 7) return 'every day';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [...days].sort((a, b) => a - b).map(d => names[d]).join(', ');
}

async function _buyFreeze() {
  if (_profile.total_xp < 150 || _profile.freezes_available >= 3) return;

  const result = await purchaseFreeze(_userId);
  if (!result) return; // error toast already shown inside purchaseFreeze

  _profile.total_xp = result.new_balance;
  _profile.freezes_available = result.freezes_available;

  toast(`Freeze purchased — ${_profile.freezes_available}/3 available`);
  haptic(15);
  _renderFreezeCount();
  _updateBuyButton();
}
