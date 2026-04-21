var DEBUG = false;

var _galleryState = null;
var _galleryViewEl = null;
var _gallerySheetEl = null;

var GALLERY_FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'xp',        label: 'XP' },
  { id: 'streak',    label: 'Streak' },
  { id: 'volume',    label: 'Volume' },
  { id: 'rare',      label: 'Rare' },
  { id: 'trinity',   label: 'Trinity' },
  { id: 'archetype', label: 'Archetype' },
  { id: 'title',     label: 'Title' }
];

async function openAchievementsGallery(userId) {
  try {
    const uid = userId || (await supabase.auth.getSession()).data.session.user.id;
    const state = await fetchAchievementsState(uid);

    _galleryState = {
      userId: uid,
      defs: state.definitions || [],
      unlocked: state.unlocked || [],
      activeFilter: 'all'
    };

    _renderGallery();

    // Clear NEW dots after a short delay so user sees them briefly
    const newIds = _galleryState.unlocked.filter(u => !u.seen).map(u => u.achievement_id);
    if (newIds.length) {
      setTimeout(() => {
        markAchievementsSeen(uid, newIds);
      }, 900);
    }
  } catch (err) {
    if (DEBUG) console.error('openAchievementsGallery failed', err);
    toast('Could not open achievements', 'error');
  }
}

function _renderGallery() {
  _destroyGallery();

  const view = document.createElement('div');
  view.className = 'achievements-view';
  view.id = 'achievements-view';
  _galleryViewEl = view;

  // Header
  const header = document.createElement('header');
  header.className = 'detail-header';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn-back';
  backBtn.setAttribute('aria-label', 'Back');
  const backIcon = document.createElement('i');
  backIcon.setAttribute('data-lucide', 'arrow-left');
  backBtn.appendChild(backIcon);
  backBtn.addEventListener('click', closeAchievementsGallery);

  const title = document.createElement('h1');
  title.className = 'detail-title';
  title.textContent = 'Achievements';

  header.appendChild(backBtn);
  header.appendChild(title);
  view.appendChild(header);

  // Filter bar
  view.appendChild(_renderFilterBar());

  // Grid
  const gridWrap = document.createElement('div');
  gridWrap.className = 'ach-grid-wrap';
  gridWrap.id = 'ach-grid-wrap';
  view.appendChild(gridWrap);
  _renderGrid(gridWrap);

  document.body.appendChild(view);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => view.classList.add('view--visible'));
}

function _renderFilterBar() {
  const bar = document.createElement('div');
  bar.className = 'filter-bar ach-filter-bar';

  GALLERY_FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (_galleryState.activeFilter === f.id ? ' filter-btn--active' : '');
    btn.type = 'button';
    btn.dataset.filter = f.id;
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      _galleryState.activeFilter = f.id;
      // Update active chip
      bar.querySelectorAll('.filter-btn').forEach(c => {
        c.classList.toggle('filter-btn--active', c.dataset.filter === f.id);
      });
      const gridWrap = document.getElementById('ach-grid-wrap');
      if (gridWrap) _renderGrid(gridWrap);
    });
    bar.appendChild(btn);
  });

  return bar;
}

function _renderGrid(container) {
  container.textContent = '';

  const { defs, unlocked, activeFilter } = _galleryState;
  const unlockedMap = new Map(unlocked.map(u => [u.achievement_id, u]));

  const filtered = activeFilter === 'all'
    ? defs
    : defs.filter(d => d.category === activeFilter);

  const sorted = filtered.slice().sort((a, b) => {
    // Unlocked first, then rarity desc, then name
    const aUn = unlockedMap.has(a.id) ? 0 : 1;
    const bUn = unlockedMap.has(b.id) ? 0 : 1;
    if (aUn !== bUn) return aUn - bUn;
    const rarityWeight = { legendary: 0, rare: 1, common: 2 };
    const ra = rarityWeight[a.rarity] ?? 3;
    const rb = rarityWeight[b.rarity] ?? 3;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  const grid = document.createElement('div');
  grid.className = 'ach-grid';

  if (sorted.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'ach-grid-empty';
    empty.textContent = 'Nothing here yet.';
    container.appendChild(empty);
    return;
  }

  sorted.forEach(def => {
    const row = unlockedMap.get(def.id);
    const isUnlocked = !!row;
    const isHiddenLocked = !isUnlocked && def.hidden;
    grid.appendChild(_makeCard(def, row, isUnlocked, isHiddenLocked));
  });

  container.appendChild(grid);
  if (window.lucide) lucide.createIcons();
}

function _makeCard(def, row, isUnlocked, isHiddenLocked) {
  const card = document.createElement('button');
  card.className = 'ach-card ach-ring--' + def.rarity;
  card.type = 'button';
  if (!isUnlocked) card.classList.add('ach-card--locked');
  if (isHiddenLocked) card.classList.add('ach-card--hidden');

  const iconWrap = document.createElement('div');
  iconWrap.className = 'ach-card-icon';
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', isHiddenLocked ? 'lock' : (def.icon || 'award'));
  iconWrap.appendChild(icon);
  card.appendChild(iconWrap);

  const nameEl = document.createElement('p');
  nameEl.className = 'ach-card-name';
  nameEl.textContent = isHiddenLocked ? '???' : def.name;
  card.appendChild(nameEl);

  if (isUnlocked && row && !row.seen) {
    const dot = document.createElement('span');
    dot.className = 'ach-new-dot';
    dot.setAttribute('aria-label', 'New');
    card.appendChild(dot);
  }

  card.addEventListener('click', () => _openDetail(def, row, isUnlocked, isHiddenLocked));
  return card;
}

function _openDetail(def, row, isUnlocked, isHiddenLocked) {
  _destroySheet();
  haptic(12);

  const overlay = document.createElement('div');
  overlay.className = 'ach-sheet-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) _closeSheet();
  });

  const sheet = document.createElement('div');
  sheet.className = 'ach-sheet ach-ring--' + def.rarity;

  const iconWrap = document.createElement('div');
  iconWrap.className = 'ach-sheet-icon';
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', isHiddenLocked ? 'lock' : (def.icon || 'award'));
  iconWrap.appendChild(icon);
  sheet.appendChild(iconWrap);

  const eyebrow = document.createElement('p');
  eyebrow.className = 'ach-sheet-eyebrow mono';
  eyebrow.textContent = (def.rarity || 'common').toUpperCase();
  sheet.appendChild(eyebrow);

  const name = document.createElement('h2');
  name.className = 'ach-sheet-name';
  name.textContent = isHiddenLocked ? 'Hidden achievement' : def.name;
  sheet.appendChild(name);

  const desc = document.createElement('p');
  desc.className = 'ach-sheet-desc';
  desc.textContent = isHiddenLocked
    ? 'Keep playing. You\'ll stumble into it.'
    : def.description;
  sheet.appendChild(desc);

  const meta = document.createElement('div');
  meta.className = 'ach-sheet-meta';

  if (isUnlocked && row) {
    const unlockedAt = new Date(row.unlocked_at);
    const dateStr = unlockedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const dateEl = document.createElement('span');
    dateEl.className = 'ach-sheet-meta-item mono';
    dateEl.textContent = 'Unlocked ' + dateStr;
    meta.appendChild(dateEl);
  }

  if (def.xp_reward && def.xp_reward > 0) {
    const xpEl = document.createElement('span');
    xpEl.className = 'ach-sheet-meta-item mono ach-sheet-xp';
    xpEl.textContent = '+' + def.xp_reward + ' XP';
    meta.appendChild(xpEl);
  }

  if (def.is_title) {
    const tagEl = document.createElement('span');
    tagEl.className = 'ach-sheet-meta-item mono ach-sheet-title-tag';
    tagEl.textContent = 'TITLE';
    meta.appendChild(tagEl);
  }

  if (meta.childNodes.length) sheet.appendChild(meta);

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  _gallerySheetEl = overlay;
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => overlay.classList.add('ach-sheet-overlay--visible'));
}

function _closeSheet() {
  if (!_gallerySheetEl) return;
  const el = _gallerySheetEl;
  el.classList.remove('ach-sheet-overlay--visible');
  el.addEventListener('transitionend', () => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, { once: true });
  _gallerySheetEl = null;
}

function _destroySheet() {
  if (_gallerySheetEl && _gallerySheetEl.parentNode) {
    _gallerySheetEl.parentNode.removeChild(_gallerySheetEl);
  }
  _gallerySheetEl = null;
}

function closeAchievementsGallery() {
  _closeSheet();
  if (!_galleryViewEl) return;
  _galleryViewEl.classList.remove('view--visible');
  const el = _galleryViewEl;
  el.addEventListener('transitionend', () => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, { once: true });
  _galleryViewEl = null;
  _galleryState = null;
}

function _destroyGallery() {
  _destroySheet();
  if (_galleryViewEl && _galleryViewEl.parentNode) {
    _galleryViewEl.parentNode.removeChild(_galleryViewEl);
  }
  _galleryViewEl = null;
}
