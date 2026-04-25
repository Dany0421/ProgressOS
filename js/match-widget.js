var DEBUG = false;

var _widgetUserId = null;

function selfTeamLabel(event) {
  return (event.self_team || 'BARÇA').toUpperCase();
}

window._reloadMatchWidget = function() {
  if (!_widgetUserId) return;
  const section = document.getElementById('match-widget-section');
  if (section) section.textContent = '';
  initMatchWidget(_widgetUserId);
};

async function initMatchWidget(userId) {
  _widgetUserId = userId;
  const section = document.getElementById('match-widget-section');
  if (!section) return;

  try {
    const events = await fetchTodayEvents(_widgetUserId);
    if (!events || events.length === 0) {
      const upcoming = await fetchUpcomingEvents(_widgetUserId);
      const next7 = upcoming.filter(e => {
        const d = new Date(e.event_date + 'T00:00:00+02:00');
        const diff = (d - new Date()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff < 7;
      });
      if (next7.length > 0) {
        section.appendChild(_renderNextUpCard(next7[0]));
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'widget-empty-add mono';
        btn.textContent = '+ ADD EVENT';
        btn.addEventListener('click', () => {
          if (typeof openEventsView === 'function') openEventsView();
        });
        section.appendChild(btn);
      }
      if (window.lucide) lucide.createIcons();
      return;
    }

    if (events.length === 1) {
      section.appendChild(_buildWidgetCard(events[0]));
    } else {
      const carousel = document.createElement('div');
      carousel.className = 'match-widget-carousel';
      events.forEach(ev => {
        const card = _buildWidgetCard(ev);
        card.classList.add('match-widget--in-carousel');
        carousel.appendChild(card);
      });
      section.appendChild(carousel);

      const dots = document.createElement('div');
      dots.className = 'match-widget-dots';
      events.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = 'match-widget-dot' + (i === 0 ? ' match-widget-dot--active' : '');
        dots.appendChild(dot);
      });
      section.appendChild(dots);

      const cards = Array.from(carousel.querySelectorAll('.match-widget-card'));
      const dotEls = Array.from(dots.querySelectorAll('.match-widget-dot'));
      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = cards.indexOf(entry.target);
            if (idx < 0) return;
            dotEls.forEach((d, i) => d.classList.toggle('match-widget-dot--active', i === idx));
          }
        });
      }, { root: carousel, threshold: [0.6] });
      cards.forEach(c => obs.observe(c));
    }
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    if (DEBUG) console.error('initMatchWidget failed', err);
  }
}

function _buildWidgetCard(event) {
  const card = document.createElement('div');
  card.className = 'match-widget-card';
  card.addEventListener('click', () => {
    if (typeof openMatchDetail === 'function') openMatchDetail(event.id);
  });

  // Top row: icon + competition + time
  const topRow = document.createElement('div');
  topRow.className = 'match-widget-top';

  const sportIcon = document.createElement('i');
  sportIcon.setAttribute('data-lucide', event.sport === 'f1' ? 'flag' : 'goal');
  sportIcon.className = 'match-widget-sport-icon';
  topRow.appendChild(sportIcon);

  const comp = document.createElement('span');
  comp.className = 'match-widget-comp mono';
  if (event.sport === 'f1') {
    comp.textContent = 'FORMULA 1';
  } else {
    const parts = [];
    if (event.custom_label) parts.push(event.custom_label.toUpperCase());
    if (event.competition) parts.push(event.competition.toUpperCase());
    comp.textContent = parts.join(' · ') || 'FOOTBALL';
  }
  topRow.appendChild(comp);

  const time = document.createElement('span');
  time.className = 'match-widget-time mono';
  time.textContent = (event.kickoff_time || '').slice(0, 5);
  topRow.appendChild(time);

  card.appendChild(topRow);

  // Content
  const result = event.event_results && event.event_results[0] ? event.event_results[0] : null;

  if (event.sport === 'football') {
    const teamsRow = document.createElement('div');
    teamsRow.className = 'match-widget-teams';

    const self = document.createElement('span');
    self.className = 'match-widget-team match-widget-team--self';
    self.textContent = selfTeamLabel(event);
    teamsRow.appendChild(self);

    const mid = document.createElement('span');
    mid.className = 'match-widget-vs mono';
    if (result && result.self_score != null && result.opponent_score != null) {
      mid.textContent = result.self_score + ' - ' + result.opponent_score;
      mid.classList.add('match-widget-score');
    } else {
      mid.textContent = 'VS';
    }
    teamsRow.appendChild(mid);

    const opp = document.createElement('span');
    opp.className = 'match-widget-team match-widget-team--opp';
    opp.textContent = (event.opponent || '').toUpperCase();
    teamsRow.appendChild(opp);

    card.appendChild(teamsRow);
  } else {
    const gp = document.createElement('p');
    gp.className = 'match-widget-gp';
    gp.textContent = event.gp_name || 'Race';
    card.appendChild(gp);

    if (result && result.p1) {
      const podium = document.createElement('p');
      podium.className = 'match-widget-podium mono';
      podium.textContent = 'P1 ' + result.p1.toUpperCase();
      card.appendChild(podium);
    }
  }

  // Status row
  const statusRow = document.createElement('div');
  statusRow.className = 'match-widget-status-row';
  statusRow.appendChild(_buildWidgetBadge(event));

  if (event.sport === 'football' && event.home_status) {
    const homeTag = document.createElement('span');
    homeTag.className = 'match-widget-home-tag mono';
    homeTag.textContent = event.home_status === 'home' ? '🏠 HOME'
                        : event.home_status === 'away' ? '✈️ AWAY'
                        : 'NEUTRAL';
    statusRow.appendChild(homeTag);
  }

  card.appendChild(statusRow);

  return card;
}

function _buildWidgetBadge(event) {
  const badge = document.createElement('span');
  badge.className = 'match-widget-badge';

  if (event.settled) {
    badge.classList.add('match-widget-badge--settled');
    badge.textContent = 'SETTLED';
  } else if (canSettle(event)) {
    badge.classList.add('match-widget-badge--settle');
    badge.textContent = 'ENTER RESULT ▸';
  } else if (isPredictionLocked(event)) {
    badge.classList.add('match-widget-badge--live');
    const mins = minutesSinceKickoff(event);
    badge.textContent = mins < 120 ? `LIVE ${mins}'` : 'IN PROGRESS';
  } else {
    badge.classList.add('match-widget-badge--upcoming');
    badge.textContent = 'UPCOMING';
  }

  return badge;
}

// ---- Phase 10: Next-up card ----

function _renderNextUpCard(event) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'match-nextup';

  const today = new Date(todayLocal() + 'T00:00:00+02:00');
  const evDate = new Date(event.event_date + 'T00:00:00+02:00');
  const days = Math.round((evDate - today) / (1000 * 60 * 60 * 24));

  const label = document.createElement('div');
  label.className = 'match-nextup-label mono';
  label.textContent = days === 1 ? 'TOMORROW' : 'IN ' + days + ' DAYS';
  card.appendChild(label);

  const title = document.createElement('div');
  title.className = 'match-nextup-title';
  title.textContent = event.sport === 'football'
    ? selfTeamLabel(event) + ' vs ' + (event.opponent || '—').toUpperCase()
    : (event.gp_name || '—');
  card.appendChild(title);

  card.addEventListener('click', () => {
    if (typeof openMatchDetail === 'function') openMatchDetail(event.id);
  });
  return card;
}

// ---- Phase 8: Past unsettled nudges ----

async function renderPastUnsettledNudges(userId) {
  const container = document.getElementById('match-nudge-slot');
  if (!container) return;
  container.textContent = '';

  const today = todayLocal();
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, sport, event_date, kickoff_time, opponent, gp_name, competition, custom_label, self_team')
      .eq('user_id', userId)
      .eq('settled', false)
      .lt('event_date', today)
      .gte('event_date', _daysAgo(7))
      .order('event_date', { ascending: false })
      .limit(3);
    if (error) throw error;
    if (!data || data.length === 0) return;
    data.forEach(ev => container.appendChild(_renderNudgeCard(ev)));
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    if (DEBUG) console.error('renderPastUnsettledNudges failed', err);
  }
}

function _daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function _renderNudgeCard(ev) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'match-nudge';

  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', ev.sport === 'football' ? 'goal' : 'flag');
  card.appendChild(icon);

  const msg = document.createElement('span');
  msg.className = 'match-nudge-msg';
  const yesterday = _daysAgo(1);
  const when = ev.event_date === yesterday ? 'yesterday' : ev.event_date;
  msg.textContent = ev.sport === 'football'
    ? selfTeamLabel(ev) + ' vs ' + (ev.opponent || '?').toUpperCase() + ' ' + when + ' — enter result'
    : (ev.gp_name || 'F1') + ' ' + when + ' — enter result';
  card.appendChild(msg);

  const chev = document.createElement('i');
  chev.setAttribute('data-lucide', 'chevron-right');
  card.appendChild(chev);

  card.addEventListener('click', () => {
    if (typeof openMatchDetail === 'function') openMatchDetail(ev.id);
  });
  return card;
}
