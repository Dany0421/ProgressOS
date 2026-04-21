var DEBUG = false;

var _achievementOverlayQueue = [];
var _achievementOverlayBusy = false;

async function checkAchievements(userId, trigger) {
  try {
    const payload = trigger || { type: 'all' };
    const { data, error } = await supabase.rpc('check_achievements', {
      p_user_id: userId,
      p_trigger: payload
    });
    if (error) throw error;
    return (data && data.unlocked) || [];
  } catch (err) {
    if (DEBUG) console.error('checkAchievements failed', err);
    return [];
  }
}

async function processUnlocks(userId, unlocked) {
  if (!unlocked || !unlocked.length) return;
  for (const ach of unlocked) {
    try {
      if (ach.xp_reward && ach.xp_reward > 0) {
        await awardXP(userId, ach.xp_reward, 'achievement', 'Achievement: ' + ach.name);
      }
    } catch (err) {
      if (DEBUG) console.error('achievement XP award failed', err);
    }
    await showUnlockOverlay(ach);
  }
}

async function checkPendingCelebration(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('pending_achievement_celebration')
      .eq('id', userId)
      .single();
    if (error) throw error;
    const pendingId = profile && profile.pending_achievement_celebration;
    if (!pendingId) return;

    const { data: ach, error: achErr } = await supabase
      .from('achievements')
      .select('id, name, description, rarity, category, xp_reward, is_title, icon')
      .eq('id', pendingId)
      .single();
    if (achErr) throw achErr;

    await supabase.from('profiles')
      .update({ pending_achievement_celebration: null })
      .eq('id', userId);

    if (ach) await showUnlockOverlay(ach);
  } catch (err) {
    if (DEBUG) console.error('checkPendingCelebration failed', err);
  }
}

async function fetchAchievementsState(userId) {
  try {
    const [defsRes, userRes] = await Promise.all([
      supabase.from('achievements')
        .select('id, name, description, category, rarity, xp_reward, is_title, hidden, icon'),
      supabase.from('user_achievements')
        .select('achievement_id, unlocked_at, seen')
        .eq('user_id', userId)
    ]);
    if (defsRes.error) throw defsRes.error;
    if (userRes.error) throw userRes.error;
    return {
      definitions: defsRes.data || [],
      unlocked: userRes.data || []
    };
  } catch (err) {
    if (DEBUG) console.error('fetchAchievementsState failed', err);
    return { definitions: [], unlocked: [] };
  }
}

async function setActiveTitle(userId, titleId) {
  try {
    const { error } = await supabase.rpc('set_active_title', {
      p_user_id: userId,
      p_title_id: titleId
    });
    if (error) throw error;
    return true;
  } catch (err) {
    if (DEBUG) console.error('setActiveTitle failed', err);
    toast('Could not set title', 'error');
    return false;
  }
}

async function markAchievementsSeen(userId, ids) {
  try {
    const { error } = await supabase.rpc('mark_achievements_seen', {
      p_user_id: userId,
      p_ids: ids || null
    });
    if (error) throw error;
  } catch (err) {
    if (DEBUG) console.error('markAchievementsSeen failed', err);
  }
}

function showUnlockOverlay(ach) {
  return new Promise((resolve) => {
    _achievementOverlayQueue.push({ ach, resolve });
    _pumpAchievementQueue();
  });
}

function _pumpAchievementQueue() {
  if (_achievementOverlayBusy) return;
  const next = _achievementOverlayQueue.shift();
  if (!next) return;
  _achievementOverlayBusy = true;
  const done = () => {
    _achievementOverlayBusy = false;
    next.resolve();
    _pumpAchievementQueue();
  };
  const rarity = (next.ach.rarity || 'common').toLowerCase();
  if (rarity === 'legendary')    _showAchievementLegendary(next.ach, done);
  else if (rarity === 'rare')    _showAchievementModal(next.ach, done);
  else                           _showAchievementToast(next.ach, done);
}

function _makeIcon(name) {
  const i = document.createElement('i');
  i.setAttribute('data-lucide', name || 'award');
  return i;
}

function _showAchievementToast(ach, done) {
  const el = document.createElement('div');
  el.className = 'ach-toast ach-ring--common';
  el.setAttribute('role', 'status');

  const iconWrap = document.createElement('div');
  iconWrap.className = 'ach-toast-icon';
  iconWrap.appendChild(_makeIcon(ach.icon));
  el.appendChild(iconWrap);

  const txt = document.createElement('div');
  txt.className = 'ach-toast-text';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'ach-toast-eyebrow mono';
  eyebrow.textContent = 'UNLOCKED';
  txt.appendChild(eyebrow);

  const nameEl = document.createElement('p');
  nameEl.className = 'ach-toast-name';
  nameEl.textContent = ach.name;
  txt.appendChild(nameEl);

  el.appendChild(txt);

  if (ach.xp_reward && ach.xp_reward > 0) {
    const xpEl = document.createElement('span');
    xpEl.className = 'ach-toast-xp mono';
    xpEl.textContent = '+' + ach.xp_reward;
    el.appendChild(xpEl);
  }

  document.body.appendChild(el);
  if (window.lucide) lucide.createIcons();
  haptic(20);

  requestAnimationFrame(() => el.classList.add('ach-toast--visible'));
  setTimeout(() => {
    el.classList.remove('ach-toast--visible');
    el.addEventListener('transitionend', () => { el.remove(); done(); }, { once: true });
    setTimeout(() => { if (el.isConnected) { el.remove(); done(); } }, 500);
  }, 2200);
}

function _showAchievementModal(ach, done) {
  const overlay = document.createElement('div');
  overlay.className = 'ach-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const inner = document.createElement('div');
  inner.className = 'ach-modal ach-ring--rare';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'ach-modal-eyebrow mono';
  eyebrow.textContent = '// RARE UNLOCK //';
  inner.appendChild(eyebrow);

  const badge = document.createElement('div');
  badge.className = 'ach-modal-badge';
  badge.appendChild(_makeIcon(ach.icon));
  inner.appendChild(badge);

  const nameEl = document.createElement('h2');
  nameEl.className = 'ach-modal-name';
  nameEl.textContent = ach.name;
  inner.appendChild(nameEl);

  const desc = document.createElement('p');
  desc.className = 'ach-modal-desc';
  desc.textContent = ach.description;
  inner.appendChild(desc);

  if (ach.xp_reward && ach.xp_reward > 0) {
    const xp = document.createElement('p');
    xp.className = 'ach-modal-xp mono';
    xp.textContent = '+' + ach.xp_reward + ' XP';
    inner.appendChild(xp);
  }

  overlay.appendChild(inner);
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  haptic([25, 50, 25]);

  const dismiss = () => {
    if (overlay._dismissed) return;
    overlay._dismissed = true;
    overlay.classList.remove('ach-modal-overlay--visible');
    overlay.addEventListener('transitionend', () => { overlay.remove(); done(); }, { once: true });
    setTimeout(() => { if (overlay.isConnected) { overlay.remove(); done(); } }, 500);
  };
  overlay.addEventListener('click', dismiss);

  requestAnimationFrame(() => {
    overlay.classList.add('ach-modal-overlay--visible');
    setTimeout(() => badge.classList.add('ach-modal-badge--pulse'), 200);
    setTimeout(dismiss, 3000);
  });
}

function _showAchievementLegendary(ach, done) {
  const overlay = document.createElement('div');
  overlay.className = 'ach-legendary-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const inner = document.createElement('div');
  inner.className = 'ach-legendary-inner';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'ach-legendary-eyebrow mono';
  eyebrow.textContent = '// LEGENDARY //';
  inner.appendChild(eyebrow);

  const badge = document.createElement('div');
  badge.className = 'ach-legendary-badge ach-ring--legendary';
  badge.appendChild(_makeIcon(ach.icon));
  inner.appendChild(badge);

  const nameEl = document.createElement('h1');
  nameEl.className = 'ach-legendary-name';
  nameEl.textContent = ach.name;
  inner.appendChild(nameEl);

  const desc = document.createElement('p');
  desc.className = 'ach-legendary-desc';
  desc.textContent = ach.description;
  inner.appendChild(desc);

  if (ach.xp_reward && ach.xp_reward > 0) {
    const xp = document.createElement('p');
    xp.className = 'ach-legendary-xp mono';
    xp.textContent = '+' + ach.xp_reward + ' XP';
    inner.appendChild(xp);
  }

  const btn = document.createElement('button');
  btn.className = 'ach-legendary-btn';
  btn.textContent = 'Continue';
  inner.appendChild(btn);

  overlay.appendChild(inner);
  document.body.appendChild(overlay);
  if (window.lucide) lucide.createIcons();
  haptic([40, 60, 40, 60, 120]);

  const dismiss = () => {
    if (overlay._dismissed) return;
    overlay._dismissed = true;
    overlay.classList.remove('ach-legendary-overlay--visible');
    overlay.addEventListener('transitionend', () => { overlay.remove(); done(); }, { once: true });
    setTimeout(() => { if (overlay.isConnected) { overlay.remove(); done(); } }, 600);
  };

  btn.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });

  requestAnimationFrame(() => {
    overlay.classList.add('ach-legendary-overlay--visible');
    setTimeout(() => badge.classList.add('ach-legendary-badge--pulse'), 200);
    setTimeout(() => btn.classList.add('ach-legendary-btn--visible'), 1100);
  });
}
