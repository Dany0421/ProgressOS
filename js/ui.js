var DEBUG = false;

function toast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('toast--visible'));

  setTimeout(() => {
    el.classList.remove('toast--visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3000);
}

function haptic(pattern = 15) {
  if (localStorage.getItem('haptic_muted') === 'true') return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function showBottomSheet(contentEl, title = '') {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';

  const header = document.createElement('div');
  header.className = 'sheet-header';

  if (title) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'sheet-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'sheet-close';
  closeBtn.setAttribute('aria-label', 'Close');
  const closeIcon = document.createElement('i');
  closeIcon.setAttribute('data-lucide', 'x');
  closeBtn.appendChild(closeIcon);
  closeBtn.addEventListener('click', hideBottomSheet);
  header.appendChild(closeBtn);

  sheet.appendChild(header);
  sheet.appendChild(contentEl);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  lucide.createIcons();

  requestAnimationFrame(() => overlay.classList.add('sheet-overlay--visible'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideBottomSheet();
  });
}

function hideBottomSheet() {
  const overlay = document.querySelector('.sheet-overlay');
  if (!overlay) return;
  overlay.classList.remove('sheet-overlay--visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

function floatXP(element, amount) {
  if (!element || !amount) return;
  const rect = element.getBoundingClientRect();

  const el = document.createElement('div');
  el.className = 'xp-float';
  el.textContent = `+${amount} XP`;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top + window.scrollY}px`;
  document.body.appendChild(el);

  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function showLevelUp(newLevel) {
  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const inner = document.createElement('div');
  inner.className = 'levelup-inner';

  const label = document.createElement('p');
  label.className = 'levelup-label';
  label.textContent = 'LEVEL UP';
  inner.appendChild(label);

  const num = document.createElement('div');
  num.className = 'levelup-number';
  num.textContent = newLevel;
  inner.appendChild(num);

  const barWrap = document.createElement('div');
  barWrap.className = 'levelup-bar-wrap';
  const barTrack = document.createElement('div');
  barTrack.className = 'levelup-bar-track';
  const barFill = document.createElement('div');
  barFill.className = 'levelup-bar-fill';
  barTrack.appendChild(barFill);
  barWrap.appendChild(barTrack);

  const barLabel = document.createElement('p');
  barLabel.className = 'levelup-bar-label mono';
  barLabel.textContent = `LVL ${newLevel}`;
  barWrap.appendChild(barLabel);
  inner.appendChild(barWrap);

  const sub = document.createElement('p');
  sub.className = 'levelup-sub';
  sub.textContent = 'Keep going.';
  inner.appendChild(sub);

  const btn = document.createElement('button');
  btn.className = 'levelup-btn';
  btn.textContent = 'Continue';
  btn.addEventListener('click', () => {
    overlay.classList.remove('levelup-overlay--visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  });
  inner.appendChild(btn);

  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) btn.click();
  });

  haptic([30, 50, 30]);

  // Sequence: fade in → bounce number → fill bar → show button
  requestAnimationFrame(() => {
    setTimeout(() => {
      overlay.classList.add('levelup-overlay--visible');
      num.classList.add('levelup-number--pop');

      setTimeout(() => {
        barFill.style.width = '100%';
      }, 350);

      setTimeout(() => {
        btn.classList.add('levelup-btn--visible');
      }, 900);
    }, 20);
  });
}
