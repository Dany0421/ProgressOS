var DEBUG = false;

var _widgetUserId = null;

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
    if (!events || events.length === 0) return;

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
    self.textContent = 'BARÇA';
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
