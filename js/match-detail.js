var DEBUG = false;

var _matchState = null;
var _matchViewEl = null;

async function openMatchDetail(eventId) {
  try {
    const state = await fetchEventWithPrediction(eventId);
    if (!state) return;
    _matchState = state;
    _renderMatchDetail();
  } catch (err) {
    if (DEBUG) console.error('openMatchDetail failed', err);
    toast('Could not open match', 'error');
  }
}

function _renderMatchDetail() {
  _destroyMatchDetail();
  const { event, prediction, result } = _matchState;

  const view = document.createElement('div');
  view.className = 'match-view';
  view.id = 'match-view';
  _matchViewEl = view;

  const header = document.createElement('header');
  header.className = 'detail-header';
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-back';
  backBtn.setAttribute('aria-label', 'Back');
  const backIcon = document.createElement('i');
  backIcon.setAttribute('data-lucide', 'arrow-left');
  backBtn.appendChild(backIcon);
  backBtn.addEventListener('click', closeMatchDetail);
  const title = document.createElement('h1');
  title.className = 'detail-title';
  title.textContent = 'Match';
  header.appendChild(backBtn);
  header.appendChild(title);
  view.appendChild(header);

  view.appendChild(_renderHero(event, result));

  const locked = isPredictionLocked(event);
  const settleable = canSettle(event);
  const settled = event.settled && result;

  let state;
  if (settled) state = 'settled';
  else if (settleable) state = 'ready-to-settle';
  else if (locked) state = 'live';
  else state = 'pre-game';

  view.appendChild(_renderStateSection(state, event, prediction, result));
  view.appendChild(_renderFooter(state, event, prediction, result));

  document.body.appendChild(view);
  document.body.style.overflow = 'hidden';
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(() => view.classList.add('view--visible'));
}

function closeMatchDetail() {
  if (!_matchViewEl) return;
  _matchViewEl.classList.remove('view--visible');
  const el = _matchViewEl;
  el.addEventListener('transitionend', () => {
    if (el.parentNode) el.parentNode.removeChild(el);
    document.body.style.overflow = '';
  }, { once: true });
  _matchViewEl = null;
}

function _destroyMatchDetail() {
  if (_matchViewEl && _matchViewEl.parentNode) {
    _matchViewEl.parentNode.removeChild(_matchViewEl);
  }
  _matchViewEl = null;
}

// ---- Hero ----

function _renderHero(event, result) {
  const hero = document.createElement('div');
  hero.className = 'match-hero';

  const badge = document.createElement('div');
  badge.className = 'match-comp-badge mono';
  if (event.sport === 'football') {
    const parts = [];
    if (event.custom_label) parts.push(event.custom_label.toUpperCase());
    if (event.competition) parts.push(event.competition.toUpperCase());
    badge.textContent = parts.join(' · ') || 'FOOTBALL';
  } else {
    badge.textContent = 'F1';
  }
  hero.appendChild(badge);

  const row = document.createElement('div');
  row.className = 'match-teams-row';

  if (event.sport === 'football') {
    row.appendChild(_makeTeamChip('B', 'BARÇA', 'self'));
    const mid = document.createElement('div');
    mid.className = 'match-mid';
    if (result) {
      const score = document.createElement('div');
      score.className = 'match-score mono';
      score.textContent = result.self_score + ' – ' + result.opponent_score;
      mid.appendChild(score);
    } else {
      const vs = document.createElement('span');
      vs.className = 'mono match-vs';
      vs.textContent = 'VS';
      mid.appendChild(vs);
    }
    row.appendChild(mid);
    row.appendChild(_makeTeamChip(
      (event.opponent || '?').charAt(0).toUpperCase(),
      (event.opponent || '').toUpperCase(),
      'opponent'));
  } else {
    const f1 = document.createElement('div');
    f1.className = 'match-f1-gp';
    f1.textContent = event.gp_name || '—';
    row.appendChild(f1);
  }
  hero.appendChild(row);

  const meta = document.createElement('div');
  meta.className = 'match-meta mono';
  let metaText = '';
  if (event.sport === 'football' && event.home_status) {
    const tag = event.home_status === 'home' ? '🏠 HOME'
              : event.home_status === 'away' ? '✈️ AWAY'
              : '· NEUTRAL';
    metaText += tag + ' · ';
  }
  const dateLabel = event.event_date === todayLocal() ? 'TODAY' : event.event_date;
  metaText += dateLabel + ' · ' + (event.kickoff_time || '').slice(0, 5);
  meta.textContent = metaText;
  hero.appendChild(meta);

  const sep = document.createElement('div');
  sep.className = 'match-sep';
  hero.appendChild(sep);

  return hero;
}

function _makeTeamChip(initial, name, kind) {
  const team = document.createElement('div');
  team.className = 'match-team';
  const crest = document.createElement('div');
  crest.className = 'match-crest match-crest--' + kind;
  crest.textContent = initial;
  team.appendChild(crest);
  const n = document.createElement('span');
  n.className = 'match-team-name';
  n.textContent = name;
  team.appendChild(n);
  return team;
}

// ---- State section dispatch ----

function _renderStateSection(state, event, prediction, result) {
  if (event.sport === 'football') return _renderFootballSection(state, event, prediction, result);
  return _renderF1Section(state, event, prediction, result);
}

function _renderFootballSection(state, event, prediction, result) {
  const section = document.createElement('div');
  section.className = 'pred-section';
  const h = document.createElement('div');
  h.className = 'pred-heading mono';
  h.textContent = state === 'settled' ? 'RESULT VS PREDICTION'
              : state === 'live' ? 'YOUR PREDICTIONS · LOCKED'
              : 'YOUR PREDICTIONS';
  section.appendChild(h);

  const p = prediction || {};

  if (state === 'pre-game') {
    section.appendChild(_scoreRowEditable(p));
    section.appendChild(_pillRowEditable('WINNER', 'winner',
      [['self', 'BARÇA'], ['draw', 'DRAW'], ['opponent', (event.opponent || 'OPPONENT').toUpperCase()]],
      p.pred_winner || null));
    section.appendChild(_pillRowEditable('1ST SCORER · TEAM', 'first_scorer_team',
      [['self', 'BARÇA'], ['opponent', (event.opponent || 'OPPONENT').toUpperCase()], ['none', 'NONE']],
      p.pred_first_scorer_team || null));
    section.appendChild(_textRowEditable('1ST SCORER · NAME', 'first_scorer_name',
      p.pred_first_scorer_name || '', 'Lewandowski'));
  } else if (state === 'live' || state === 'ready-to-settle') {
    section.appendChild(_pairRow('SCORE', (p.pred_self_score != null ? p.pred_self_score : '—') + ' – ' + (p.pred_opponent_score != null ? p.pred_opponent_score : '—')));
    section.appendChild(_pairRow('WINNER', _labelFor(p.pred_winner, event)));
    section.appendChild(_pairRow('1ST SCORER TEAM',
      p.pred_first_scorer_team === 'self' ? 'BARÇA'
      : p.pred_first_scorer_team === 'opponent' ? (event.opponent || '').toUpperCase()
      : p.pred_first_scorer_team === 'none' ? 'NONE' : '—'));
    section.appendChild(_pairRow('1ST SCORER NAME', p.pred_first_scorer_name || '—'));
  } else if (state === 'settled') {
    section.appendChild(_verdictRow('SCORE',
      result.self_score + ' – ' + result.opponent_score,
      result.self_score === p.pred_self_score && result.opponent_score === p.pred_opponent_score, 50));
    section.appendChild(_verdictRow('WINNER', _labelFor(result.winner, event), result.winner === p.pred_winner, 20));
    section.appendChild(_verdictRow('1ST SCORER TEAM',
      result.first_scorer_team === 'self' ? 'BARÇA'
       : result.first_scorer_team === 'opponent' ? (event.opponent || '').toUpperCase() : 'NONE',
      result.first_scorer_team === p.pred_first_scorer_team, 15));
    const nameCorrect = result.first_scorer_team === p.pred_first_scorer_team &&
      (result.first_scorer_name || '').trim().toLowerCase() === (p.pred_first_scorer_name || '').trim().toLowerCase();
    section.appendChild(_verdictRow('1ST SCORER NAME', result.first_scorer_name || '—', nameCorrect, 30));
  }

  return section;
}

function _labelFor(winner, event) {
  if (winner === 'self') return 'BARÇA';
  if (winner === 'draw') return 'DRAW';
  if (winner === 'opponent') return (event.opponent || 'OPPONENT').toUpperCase();
  return '—';
}

// ---- Footer ----

function _renderFooter(state, event, prediction, result) {
  const footer = document.createElement('div');
  footer.className = 'match-footer';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'match-btn mono';

  if (state === 'pre-game') {
    btn.classList.add('match-btn--save');
    btn.textContent = 'SAVE PREDICTIONS';
    btn.addEventListener('click', () => _savePredictionsFromDOM(event));
  } else if (state === 'live') {
    btn.classList.add('match-btn--live');
    btn.textContent = 'IN PROGRESS · ' + minutesSinceKickoff(event) + '\'';
    btn.disabled = true;
  } else if (state === 'ready-to-settle') {
    btn.classList.add('match-btn--settle');
    btn.textContent = 'ENTER RESULT →';
    btn.addEventListener('click', () => {
      if (typeof openSettleSheet === 'function') {
        openSettleSheet(event, prediction);
      } else {
        toast('Settlement coming soon', 'error');
      }
    });
  } else if (state === 'settled') {
    btn.classList.add('match-btn--settled');
    const awarded = result.total_xp_awarded || 0;
    const prefix = result.perfect ? 'PERFECT · ' : '';
    btn.textContent = prefix + '+' + awarded + ' XP EARNED';
    btn.disabled = true;
  }

  footer.appendChild(btn);
  return footer;
}

async function _savePredictionsFromDOM(event) {
  const view = _matchViewEl;
  if (!view) return;
  var fields = {};

  if (event.sport === 'football') {
    const self = view.querySelector('input[data-pred-key="self_score"]');
    const opp = view.querySelector('input[data-pred-key="opponent_score"]');
    const winnerRow = view.querySelector('[data-pred-key="winner"] .pred-pill--active');
    const teamRow = view.querySelector('[data-pred-key="first_scorer_team"] .pred-pill--active');
    const nameInput = view.querySelector('input[data-pred-key="first_scorer_name"]');

    if (self.value === '' || opp.value === '') { toast('Enter a score', 'error'); return; }
    if (!winnerRow) { toast('Pick a winner', 'error'); return; }
    if (!teamRow) { toast('Pick first-scorer team', 'error'); return; }
    if (teamRow.dataset.value !== 'none' && !nameInput.value.trim()) {
      toast('Enter first-scorer name', 'error'); return;
    }

    fields = {
      pred_self_score: parseInt(self.value, 10),
      pred_opponent_score: parseInt(opp.value, 10),
      pred_winner: winnerRow.dataset.value,
      pred_first_scorer_team: teamRow.dataset.value,
      pred_first_scorer_name: teamRow.dataset.value === 'none' ? null : nameInput.value.trim()
    };
  } else {
    const p1 = view.querySelector('input[data-pred-key="p1"]');
    const p2 = view.querySelector('input[data-pred-key="p2"]');
    const p3 = view.querySelector('input[data-pred-key="p3"]');
    const fl = view.querySelector('input[data-pred-key="fastest_lap"]');
    const rain = view.querySelector('input[data-pred-key="rain_pct"]');
    if (!p1.value.trim() || !p2.value.trim() || !p3.value.trim()) {
      toast('Enter all 3 podium drivers', 'error'); return;
    }
    if (!fl.value.trim()) { toast('Enter fastest lap driver', 'error'); return; }
    fields = {
      pred_p1: p1.value.trim(), pred_p2: p2.value.trim(), pred_p3: p3.value.trim(),
      pred_fastest_lap: fl.value.trim(),
      pred_rain_pct: rain && rain.value !== '' ? parseInt(rain.value, 10) : null
    };
  }

  const saveBtn = _matchViewEl ? _matchViewEl.querySelector('.match-btn--save') : null;
  if (saveBtn) saveBtn.disabled = true;

  try {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) { toast('Not signed in', 'error'); if (saveBtn) saveBtn.disabled = false; return; }
    const ok = await savePrediction(userId, event.id, fields);
    if (ok) {
      toast('Predictions saved');
      openMatchDetail(event.id);
    } else {
      if (saveBtn) saveBtn.disabled = false;
    }
  } catch (err) {
    if (DEBUG) console.error('_savePredictionsFromDOM failed', err);
    toast('Could not save predictions', 'error');
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ---- F1 section ----

function _renderF1Section(state, event, prediction, result) {
  const section = document.createElement('div');
  section.className = 'pred-section';
  const h = document.createElement('div');
  h.className = 'pred-heading mono';
  h.textContent = state === 'settled' ? 'RESULT VS PREDICTION'
              : state === 'live' ? 'YOUR PREDICTIONS · LOCKED'
              : 'YOUR PREDICTIONS';
  section.appendChild(h);

  const p = prediction || {};

  if (state === 'pre-game') {
    section.appendChild(_textRowEditable('P1 (WINNER)', 'p1', p.pred_p1 || '', 'Verstappen'));
    section.appendChild(_textRowEditable('P2', 'p2', p.pred_p2 || '', 'Leclerc'));
    section.appendChild(_textRowEditable('P3', 'p3', p.pred_p3 || '', 'Norris'));
    section.appendChild(_textRowEditable('FASTEST LAP', 'fastest_lap', p.pred_fastest_lap || '', 'Hamilton'));
    const rainRow = document.createElement('div');
    rainRow.className = 'pred-row pred-row--editable';
    const lbl = document.createElement('span');
    lbl.className = 'pred-label mono'; lbl.textContent = 'RAIN % (optional)';
    rainRow.appendChild(lbl);
    const rainInput = document.createElement('input');
    rainInput.type = 'number'; rainInput.min = 0; rainInput.max = 100;
    rainInput.className = 'form-input pred-text-input';
    rainInput.dataset.predKey = 'rain_pct';
    rainInput.placeholder = '0';
    if (p.pred_rain_pct != null) rainInput.value = p.pred_rain_pct;
    rainRow.appendChild(rainInput);
    section.appendChild(rainRow);
  } else if (state === 'live' || state === 'ready-to-settle') {
    section.appendChild(_pairRow('P1', p.pred_p1 || '—'));
    section.appendChild(_pairRow('P2', p.pred_p2 || '—'));
    section.appendChild(_pairRow('P3', p.pred_p3 || '—'));
    section.appendChild(_pairRow('FASTEST LAP', p.pred_fastest_lap || '—'));
    if (p.pred_rain_pct != null) section.appendChild(_pairRow('RAIN %', p.pred_rain_pct + '%'));
  } else if (state === 'settled') {
    const cmp = function(a, b) {
      return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
    };
    section.appendChild(_verdictRow('P1', result.p1 || '—', cmp(result.p1, p.pred_p1), 20));
    section.appendChild(_verdictRow('P2', result.p2 || '—', cmp(result.p2, p.pred_p2), 20));
    section.appendChild(_verdictRow('P3', result.p3 || '—', cmp(result.p3, p.pred_p3), 20));
    section.appendChild(_verdictRow('FASTEST LAP', result.fastest_lap || '—', cmp(result.fastest_lap, p.pred_fastest_lap), 25));
    const perfectPodium = cmp(result.p1, p.pred_p1) && cmp(result.p2, p.pred_p2) && cmp(result.p3, p.pred_p3);
    if (perfectPodium) section.appendChild(_verdictRow('PERFECT PODIUM', 'P1·P2·P3 ALL RIGHT', true, 30));
  }

  return section;
}

// ---- Row builder helpers ----

function _scoreRowEditable(p) {
  const row = document.createElement('div');
  row.className = 'pred-row pred-row--editable';
  const lbl = document.createElement('span');
  lbl.className = 'pred-label mono'; lbl.textContent = 'SCORE';
  row.appendChild(lbl);
  const wrap = document.createElement('div');
  wrap.className = 'score-input-wrap';
  const h = document.createElement('input');
  h.type = 'number'; h.min = 0; h.max = 20; h.className = 'score-input';
  h.dataset.predKey = 'self_score';
  if (p.pred_self_score != null) h.value = p.pred_self_score;
  const dash = document.createElement('span');
  dash.className = 'score-dash'; dash.textContent = '–';
  const a = document.createElement('input');
  a.type = 'number'; a.min = 0; a.max = 20; a.className = 'score-input';
  a.dataset.predKey = 'opponent_score';
  if (p.pred_opponent_score != null) a.value = p.pred_opponent_score;
  wrap.appendChild(h); wrap.appendChild(dash); wrap.appendChild(a);
  row.appendChild(wrap);
  return row;
}

function _pillRowEditable(labelText, predKey, options, active) {
  const row = document.createElement('div');
  row.className = 'pred-row pred-row--editable';
  const lbl = document.createElement('span');
  lbl.className = 'pred-label mono'; lbl.textContent = labelText;
  row.appendChild(lbl);
  const pills = document.createElement('div');
  pills.className = 'pred-pill-row';
  pills.dataset.predKey = predKey;
  options.forEach(function(opt) {
    var val = opt[0];
    var text = opt[1];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pred-pill' + (val === active ? ' pred-pill--active' : '');
    b.textContent = text;
    b.dataset.value = val;
    b.addEventListener('click', function() {
      pills.querySelectorAll('.pred-pill').forEach(function(x) { x.classList.remove('pred-pill--active'); });
      b.classList.add('pred-pill--active');
    });
    pills.appendChild(b);
  });
  row.appendChild(pills);
  return row;
}

function _textRowEditable(labelText, predKey, value, placeholder) {
  const row = document.createElement('div');
  row.className = 'pred-row pred-row--editable';
  const lbl = document.createElement('span');
  lbl.className = 'pred-label mono'; lbl.textContent = labelText;
  row.appendChild(lbl);
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'form-input pred-text-input';
  input.dataset.predKey = predKey;
  input.maxLength = 60; input.placeholder = placeholder;
  input.value = value;
  row.appendChild(input);
  return row;
}

function _pairRow(label, value) {
  const row = document.createElement('div');
  row.className = 'pred-row';
  const l = document.createElement('span');
  l.className = 'pred-label mono'; l.textContent = label;
  const v = document.createElement('span');
  v.className = 'pred-value'; v.textContent = value;
  row.appendChild(l); row.appendChild(v);
  return row;
}

function _verdictRow(label, value, correct, xp) {
  const row = document.createElement('div');
  row.className = 'pred-row pred-row--' + (correct ? 'correct' : 'wrong');
  const l = document.createElement('span');
  l.className = 'pred-label mono';
  l.textContent = label + ' ' + (correct ? '✓' : '✗');
  row.appendChild(l);
  const v = document.createElement('span');
  v.className = 'pred-value';
  v.textContent = value;
  if (correct) {
    const tag = document.createElement('span');
    tag.className = 'xp-tag mono';
    tag.textContent = '+' + xp;
    v.appendChild(tag);
  }
  row.appendChild(v);
  return row;
}
