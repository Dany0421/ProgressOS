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

function showBonusDay() {
  const overlay = document.createElement('div');
  overlay.className = 'bonus-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const inner = document.createElement('div');
  inner.className = 'bonus-inner';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'bonus-eyebrow';
  eyebrow.textContent = '// SYSTEM ANOMALY //';
  inner.appendChild(eyebrow);

  const title = document.createElement('p');
  title.className = 'bonus-title';
  title.textContent = 'BONUS DAY';
  inner.appendChild(title);

  const num = document.createElement('div');
  num.className = 'bonus-number';
  num.setAttribute('data-text', '500');
  num.textContent = '500';
  inner.appendChild(num);

  const sub = document.createElement('p');
  sub.className = 'bonus-sub';
  sub.textContent = 'Task cap lifted for today. Go get it.';
  inner.appendChild(sub);

  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  const dismiss = () => {
    if (overlay._dismissed) return;
    overlay._dismissed = true;
    overlay.classList.remove('bonus-overlay--visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    setTimeout(() => overlay.remove(), 500);
  };
  overlay.addEventListener('click', dismiss);

  haptic([40, 60, 40, 60, 120]);

  requestAnimationFrame(() => {
    setTimeout(() => {
      overlay.classList.add('bonus-overlay--visible');
      eyebrow.classList.add('bonus-eyebrow--typing');
      setTimeout(() => title.classList.add('bonus-title--drop'), 450);
      setTimeout(() => num.classList.add('bonus-number--flash'), 900);
      setTimeout(() => sub.classList.add('bonus-sub--visible'), 1400);
      setTimeout(dismiss, 3500);
    }, 20);
  });
}

function showBonusCapHit() {
  const ribbon = document.createElement('div');
  ribbon.className = 'bonus-burst';
  ribbon.textContent = 'MAX — 500 XP';
  document.body.appendChild(ribbon);

  document.body.classList.add('bonus-glow');

  haptic([30, 60, 30, 60, 30]);

  requestAnimationFrame(() => {
    ribbon.classList.add('bonus-burst--visible');
  });

  setTimeout(() => {
    ribbon.classList.remove('bonus-burst--visible');
    ribbon.addEventListener('transitionend', () => ribbon.remove(), { once: true });
    setTimeout(() => ribbon.remove(), 500);
  }, 1800);

  setTimeout(() => document.body.classList.remove('bonus-glow'), 700);

  toast('Bonus cap hit. Dopamine saturated.', 'success');
}
