var DEBUG = false;

var _eventsViewEl = null;
var _eventsViewUserId = null;

async function openEventsView() {
  try {
    const session = await supabase.auth.getSession();
    const userId = session && session.data && session.data.session && session.data.session.user.id;
    if (!userId) return;
    _eventsViewUserId = userId;
    const [upcoming, past] = await Promise.all([
      fetchUpcomingEvents(userId),
      fetchPastEvents(userId)
    ]);
    _renderEventsView({ upcoming, past });
  } catch (err) {
    if (DEBUG) console.error('openEventsView failed', err);
    toast('Could not open events', 'error');
  }
}

function _renderEventsView({ upcoming, past }) {
  _destroyEventsView();
  const view = document.createElement('div');
  view.className = 'events-view';
  view.id = 'events-view';
  _eventsViewEl = view;

  const header = document.createElement('header');
  header.className = 'detail-header';
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-back';
  backBtn.setAttribute('aria-label','Back');
  const backIcon = document.createElement('i');
  backIcon.setAttribute('data-lucide','arrow-left');
  backBtn.appendChild(backIcon);
  backBtn.addEventListener('click', closeEventsView);
  const title = document.createElement('h1');
  title.className = 'detail-title';
  title.textContent = 'Events';
  header.appendChild(backBtn);
  header.appendChild(title);
  view.appendChild(header);

  const body = document.createElement('div');
  body.className = 'events-body';
  body.appendChild(_renderSection('Upcoming', upcoming, { emptyMsg: 'No upcoming events. Add one.' }));
  body.appendChild(_renderSection('Past', past, { emptyMsg: 'Nothing here yet.' }));
  view.appendChild(body);

  const fab = document.createElement('button');
  fab.className = 'events-fab';
  fab.setAttribute('aria-label','Add event');
  const fabIcon = document.createElement('i');
  fabIcon.setAttribute('data-lucide','plus');
  fab.appendChild(fabIcon);
  fab.addEventListener('click', openEventCreateSheet);
  view.appendChild(fab);

  document.body.appendChild(view);
  if (window.lucide) lucide.createIcons();
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => view.classList.add('view--visible'));
}

function _renderSection(label, rows, opts) {
  const section = document.createElement('section');
  section.className = 'events-section';
  const h = document.createElement('h2');
  h.className = 'events-section-heading mono';
  h.textContent = label.toUpperCase();
  section.appendChild(h);
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'events-empty';
    empty.textContent = opts.emptyMsg;
    section.appendChild(empty);
    return section;
  }
  rows.forEach(ev => section.appendChild(_renderEventRow(ev)));
  return section;
}

function _renderEventRow(ev) {
  const row = document.createElement('button');
  row.className = 'event-row';
  row.type = 'button';
  row.dataset.eventId = ev.id;

  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', ev.sport === 'football' ? 'goal' : 'flag');
  icon.className = 'event-row-icon';
  row.appendChild(icon);

  const info = document.createElement('div');
  info.className = 'event-row-info';
  const title = document.createElement('p');
  title.className = 'event-row-title';
  title.textContent = ev.sport === 'football'
    ? 'Barça vs ' + (ev.opponent || '—')
    : (ev.gp_name || '—');
  info.appendChild(title);

  const sub = document.createElement('p');
  sub.className = 'event-row-sub mono';
  const comp = ev.sport === 'football' ? (ev.competition || '') : 'F1';
  sub.textContent = `${comp} · ${ev.event_date} · ${ev.kickoff_time.slice(0,5)}`;
  info.appendChild(sub);

  row.appendChild(info);

  if (ev.settled) {
    const badge = document.createElement('span');
    badge.className = 'event-row-badge mono';
    badge.textContent = 'SETTLED';
    row.appendChild(badge);
  }

  let longPressed = false;
  let pressTimer = null;
  const clearTimer = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };

  row.addEventListener('click', (e) => {
    if (longPressed) { longPressed = false; e.preventDefault(); return; }
    if (typeof openMatchDetail === 'function') openMatchDetail(ev.id);
  });

  row.addEventListener('pointerdown', () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      longPressed = true;
      if (navigator.vibrate) navigator.vibrate(20);
      _openEventOptionsSheet(ev);
    }, 600);
  });
  row.addEventListener('pointerup', clearTimer);
  row.addEventListener('pointerleave', clearTimer);
  row.addEventListener('pointercancel', clearTimer);

  return row;
}

function _openEventOptionsSheet(ev) {
  const content = document.createElement('div');
  content.className = 'settings-content';

  const name = document.createElement('p');
  name.className = 'sheet-option-label';
  name.textContent = ev.sport === 'football'
    ? 'Barça vs ' + (ev.opponent || '—')
    : (ev.gp_name || 'F1 event');
  content.appendChild(name);

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger-outline';
  delBtn.textContent = 'Delete event';
  delBtn.addEventListener('click', async () => {
    const ok = await deleteEvent(ev.id);
    hideBottomSheet();
    if (ok) openEventsView();
  });
  content.appendChild(delBtn);

  showBottomSheet(content, 'Event options');
}

function closeEventsView() {
  if (!_eventsViewEl) return;
  _eventsViewEl.classList.remove('view--visible');
  const el = _eventsViewEl;
  el.addEventListener('transitionend', () => {
    if (el.parentNode) el.parentNode.removeChild(el);
    document.body.style.overflow = '';
  }, { once: true });
  _eventsViewEl = null;
}

function _destroyEventsView() {
  if (_eventsViewEl && _eventsViewEl.parentNode) {
    _eventsViewEl.parentNode.removeChild(_eventsViewEl);
  }
  _eventsViewEl = null;
}

// ---- Event creation flow ----

function openEventCreateSheet() {
  const form = document.createElement('div');
  form.className = 'sheet-form';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.textContent = 'Sport';
  form.appendChild(label);

  const row = document.createElement('div');
  row.className = 'sport-picker-row';

  const footballBtn = document.createElement('button');
  footballBtn.type = 'button';
  footballBtn.className = 'sport-pick sport-pick--football';
  footballBtn.textContent = '⚽ FOOTBALL';
  footballBtn.addEventListener('click', () => {
    hideBottomSheet();
    setTimeout(_openFootballForm, 220);
  });
  row.appendChild(footballBtn);

  const f1Btn = document.createElement('button');
  f1Btn.type = 'button';
  f1Btn.className = 'sport-pick sport-pick--f1';
  f1Btn.textContent = '🏁 F1';
  f1Btn.addEventListener('click', () => {
    hideBottomSheet();
    setTimeout(_openF1Form, 220);
  });
  row.appendChild(f1Btn);

  form.appendChild(row);
  showBottomSheet(form, 'New event');
}

function _makeFormInput(form, id, labelText, placeholder, maxLen, type, value) {
  const lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.setAttribute('for', id);
  lbl.textContent = labelText;
  form.appendChild(lbl);
  const inp = document.createElement('input');
  inp.id = id;
  inp.className = 'form-input';
  inp.type = type || 'text';
  if (maxLen) inp.maxLength = maxLen;
  if (placeholder) inp.placeholder = placeholder;
  if (value != null && value !== '') inp.value = value;
  form.appendChild(inp);
  return inp;
}

function _openFootballForm() {
  const form = document.createElement('div');
  form.className = 'sheet-form';

  const venueLabel = document.createElement('label');
  venueLabel.className = 'form-label';
  venueLabel.textContent = 'Barça plays';
  form.appendChild(venueLabel);

  const venueRow = document.createElement('div');
  venueRow.className = 'priority-group';
  let selectedVenue = 'home';
  ['home','away','neutral'].forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'priority-btn' + (v === selectedVenue ? ' priority-btn--active' : '');
    b.textContent = v.toUpperCase();
    b.addEventListener('click', () => {
      selectedVenue = v;
      venueRow.querySelectorAll('.priority-btn').forEach(x => x.classList.remove('priority-btn--active'));
      b.classList.add('priority-btn--active');
    });
    venueRow.appendChild(b);
  });
  form.appendChild(venueRow);

  const opp = _makeFormInput(form, 'ev-opp', 'Opponent', 'Real Madrid', 100, 'text', '');
  const comp = _makeFormInput(form, 'ev-comp', 'Competition', 'LaLiga, UCL, Copa...', 50, 'text', '');
  const customLbl = _makeFormInput(form, 'ev-label', 'Custom label (optional)', 'El Clásico, Final...', 50, 'text', '');
  const dateInput = _makeFormInput(form, 'ev-date', 'Date', '', null, 'date', todayLocal());
  const timeInput = _makeFormInput(form, 'ev-time', 'Kickoff (Maputo local)', '', null, 'time', '21:00');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-primary';
  btn.textContent = 'Save';
  btn.addEventListener('click', async () => {
    const opponent = opp.value.trim();
    const competition = comp.value.trim();
    if (!opponent) { toast('Opponent required', 'error'); return; }
    if (!competition) { toast('Competition required', 'error'); return; }
    btn.disabled = true;
    const ev = await createEvent(_eventsViewUserId, {
      sport: 'football',
      event_date: dateInput.value,
      kickoff_time: timeInput.value,
      home_status: selectedVenue,
      opponent,
      competition,
      custom_label: customLbl.value.trim() || null
    });
    if (!ev) { btn.disabled = false; return; }

    if (typeof checkAchievements === 'function') {
      checkAchievements(_eventsViewUserId, { type: 'event_created', meta: { event_id: ev.id } })
        .then(unlocks => { if (unlocks && unlocks.length) processUnlocks(_eventsViewUserId, unlocks); });
    }
    if (window._reloadMatchWidget) window._reloadMatchWidget();
    hideBottomSheet();
    toast('Event created');
    openEventsView();
  });
  form.appendChild(btn);

  showBottomSheet(form, 'New football match');
}

function _openF1Form() {
  const form = document.createElement('div');
  form.className = 'sheet-form';

  const gp = _makeFormInput(form, 'ev-gp', 'GP name', 'Monaco GP', 80, 'text', '');
  const dateInput = _makeFormInput(form, 'ev-f1-date', 'Date', '', null, 'date', todayLocal());
  const timeInput = _makeFormInput(form, 'ev-f1-time', 'Race start (Maputo local)', '', null, 'time', '14:00');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-primary';
  btn.textContent = 'Save';
  btn.addEventListener('click', async () => {
    const gpName = gp.value.trim();
    if (!gpName) { toast('GP name required', 'error'); return; }
    btn.disabled = true;
    const ev = await createEvent(_eventsViewUserId, {
      sport: 'f1',
      event_date: dateInput.value,
      kickoff_time: timeInput.value,
      gp_name: gpName
    });
    if (!ev) { btn.disabled = false; return; }

    if (typeof checkAchievements === 'function') {
      checkAchievements(_eventsViewUserId, { type: 'event_created', meta: { event_id: ev.id } })
        .then(unlocks => { if (unlocks && unlocks.length) processUnlocks(_eventsViewUserId, unlocks); });
    }
    if (window._reloadMatchWidget) window._reloadMatchWidget();
    hideBottomSheet();
    toast('Event created');
    openEventsView();
  });
  form.appendChild(btn);

  showBottomSheet(form, 'New F1 race');
}
