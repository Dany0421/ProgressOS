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

    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        toast('Enter your email and password', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Logging in...';

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = 'index.html';
      } catch (err) {
        if (DEBUG) console.error('login failed', err);
        toast(err.message || 'Login failed', 'error');
        btn.disabled = false;
        btn.textContent = 'Log in';
      }
    });
  });
}
