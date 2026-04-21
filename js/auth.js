var DEBUG = false;

async function checkSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    await checkAndGrantFreeze(session.user.id);
    lucide.createIcons();
    if (typeof checkPendingCelebration === 'function') {
      checkPendingCelebration(session.user.id);
    }
    return session;
  } catch (err) {
    if (DEBUG) console.error('checkSession failed', err);
    window.location.href = 'login.html';
    return null;
  }
}

async function logout() {
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch (err) {
    if (DEBUG) console.error('logout failed', err);
  }
  // Belt-and-suspenders: force-clear all Supabase tokens from localStorage
  // so getSession() on login.html never sees a stale session
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('sb-')) localStorage.removeItem(k);
  });
  window.location.replace('login.html');
}

async function checkAndGrantFreeze(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('freezes_available, last_freeze_grant_date')
      .eq('id', userId)
      .single();
    if (error) throw error;

    const today = todayLocal();
    const last = data.last_freeze_grant_date;
    const daysSinceLast = last ? daysBetween(last, today) : 999;

    if (daysSinceLast >= 14 && data.freezes_available < 3) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          freezes_available: data.freezes_available + 1,
          last_freeze_grant_date: today
        })
        .eq('id', userId);
      if (updateError) throw updateError;
      toast('❄️ Freeze earned — streak protection ready');
    }
  } catch (err) {
    if (DEBUG) console.error('checkAndGrantFreeze failed', err);
  }
}

// ---- Login page wiring ----
if (window.location.pathname.endsWith('login.html') || window.location.pathname === '/login') {
  document.addEventListener('DOMContentLoaded', () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = 'index.html';
    });

    lucide.createIcons();

    function _showAuthView(id) {
      document.querySelectorAll('.auth-view').forEach(el => {
        el.classList.add('auth-view--hidden');
        el.classList.remove('auth-view--entering');
      });
      const target = document.getElementById(id);
      if (!target) return;
      target.classList.remove('auth-view--hidden');
      void target.offsetWidth;
      target.classList.add('auth-view--entering');
    }

    function _buildSuccess(view, titleText, subText, btnText, onBack) {
      view.textContent = '';
      const wrap = document.createElement('div');
      wrap.className = 'auth-success';

      const iconEl = document.createElement('span');
      iconEl.className = 'auth-success-icon';
      iconEl.textContent = '✓';

      const titleEl = document.createElement('p');
      titleEl.className = 'auth-success-title';
      titleEl.textContent = titleText;

      const subEl = document.createElement('p');
      subEl.className = 'auth-success-sub';
      subEl.textContent = subText;

      const backBtn = document.createElement('button');
      backBtn.className = 'login-btn';
      backBtn.type = 'button';
      backBtn.textContent = btnText;
      backBtn.addEventListener('click', onBack);

      wrap.appendChild(iconEl);
      wrap.appendChild(titleEl);
      wrap.appendChild(subEl);
      wrap.appendChild(backBtn);
      view.appendChild(wrap);
    }

    document.querySelectorAll('.btn-eye').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        const icon = btn.querySelector('i[data-lucide]');
        if (icon) {
          icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
          lucide.createIcons();
        }
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });

    const loginForm = document.getElementById('login-form');
    const loginBtn  = document.getElementById('login-btn');

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        if (!email || !password) { toast('Enter your email and password', 'error'); return; }
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          window.location.href = 'index.html';
        } catch (err) {
          if (DEBUG) console.error('login failed', err);
          toast(err.message || 'Login failed', 'error');
          loginBtn.disabled = false;
          loginBtn.textContent = 'Log in';
        }
      });
    }

    document.getElementById('btn-show-signup')?.addEventListener('click', () => _showAuthView('view-signup'));
    document.getElementById('btn-show-forgot')?.addEventListener('click', () => _showAuthView('view-reset'));
    document.getElementById('btn-back-signup')?.addEventListener('click', () => _showAuthView('view-login'));
    document.getElementById('btn-back-reset')?.addEventListener('click',  () => _showAuthView('view-login'));

    const signupForm = document.getElementById('signup-form');
    const signupBtn  = document.getElementById('signup-btn');

    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirm  = document.getElementById('signup-confirm').value;
        if (!email || !password) { toast('Fill in all fields', 'error'); return; }
        if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
        if (password !== confirm) { toast('Passwords do not match', 'error'); return; }
        signupBtn.disabled = true;
        signupBtn.textContent = 'Creating account...';
        try {
          const { error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          const view = document.getElementById('view-signup');
          if (view) _buildSuccess(view, 'Check your email', 'We sent a confirmation link. Open it to activate your account.', 'Back to login', () => window.location.reload());
        } catch (err) {
          if (DEBUG) console.error('signup failed', err);
          toast(err.message || 'Could not create account', 'error');
          signupBtn.disabled = false;
          signupBtn.textContent = 'Create account';
        }
      });
    }

    const resetForm = document.getElementById('reset-form');
    const resetBtn  = document.getElementById('reset-btn');

    if (resetForm) {
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value.trim();
        if (!email) { toast('Enter your email', 'error'); return; }
        resetBtn.disabled = true;
        resetBtn.textContent = 'Sending...';
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login.html'
          });
          if (error) throw error;
          const view = document.getElementById('view-reset');
          if (view) _buildSuccess(view, 'Check your email', 'We sent a reset link. Follow it to set a new password.', 'Back to login', () => window.location.reload());
        } catch (err) {
          if (DEBUG) console.error('resetPassword failed', err);
          toast(err.message || 'Could not send reset email', 'error');
          resetBtn.disabled = false;
          resetBtn.textContent = 'Send reset link';
        }
      });
    }
  });
}
