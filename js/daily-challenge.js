var DEBUG = false;

async function initDailyChallenges(userId) {
  try {
    const today = todayLocal();
    const hasEventToday = await _dcHasUnsettledEventToday(userId, today);
    await supabase.rpc('generate_daily_challenges', {
      p_user_id: userId,
      p_date: today,
      p_has_event_today: hasEventToday
    });
    const challenges = await _dcFetchToday(userId, today);
    _dcRender(userId, challenges, today);
  } catch (err) {
    if (DEBUG) console.error('initDailyChallenges failed', err);
  }
}

async function checkDailyChallenges(userId) {
  try {
    const today = todayLocal();
    const challenges = await _dcFetchToday(userId, today);
    const incomplete = challenges.filter(c => !c.completed);
    if (!incomplete.length) return;

    for (const c of incomplete) {
      const satisfied = await _dcConditionMet(userId, c, today);
      if (satisfied) await _dcComplete(userId, c, today);
    }

    const updated = await _dcFetchToday(userId, today);
    _dcRender(userId, updated, today);
  } catch (err) {
    if (DEBUG) console.error('checkDailyChallenges failed', err);
  }
}

async function _dcHasUnsettledEventToday(userId, today) {
  try {
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_date', today)
      .limit(10);
    if (!events || !events.length) return false;
    const { data: settled } = await supabase
      .from('event_results')
      .select('event_id')
      .in('event_id', events.map(e => e.id));
    const settledIds = new Set((settled || []).map(r => r.event_id));
    return events.some(e => !settledIds.has(e.id));
  } catch (err) {
    return false;
  }
}

async function _dcFetchToday(userId, today) {
  const { data, error } = await supabase.rpc('get_today_challenges', {
    p_user_id: userId,
    p_date: today
  });
  if (error) throw error;
  return data || [];
}

async function _dcConditionMet(userId, challenge, today) {
  try {
    const datePrefix = today + 'T00:00:00+02:00';

    if (challenge.category === 'tasks') {
      const { count } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', datePrefix);
      return (count || 0) >= challenge.target_value;
    }

    if (challenge.category === 'habits') {
      const { count } = await supabase
        .from('habit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed_date', today);
      return (count || 0) >= challenge.target_value;
    }

    if (challenge.category === 'projects') {
      const { data } = await supabase
        .from('project_sessions')
        .select('duration_minutes')
        .eq('user_id', userId)
        .gte('started_at', datePrefix);
      const total = (data || []).reduce((s, r) => s + (r.duration_minutes || 0), 0);
      return total >= challenge.target_value;
    }

    if (challenge.category === 'combo') {
      const [tRes, hRes, pRes] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('completed', true).gte('completed_at', datePrefix),
        supabase.from('habit_logs').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('completed_date', today),
        supabase.from('project_sessions').select('duration_minutes')
          .eq('user_id', userId).gte('started_at', datePrefix)
      ]);
      const tasksDone = tRes.count || 0;
      const habitsDone = hRes.count || 0;
      const projMin = (pRes.data || []).reduce((s, r) => s + (r.duration_minutes || 0), 0);
      if (challenge.tier === 'legendary') {
        return tasksDone >= 3 && habitsDone >= challenge.target_value && projMin >= 30;
      }
      return tasksDone >= 2;
    }

    return false;
  } catch (err) {
    if (DEBUG) console.error('_dcConditionMet failed', err);
    return false;
  }
}

async function _dcComplete(userId, challenge, today) {
  try {
    const comebackBonus = window._comebackBonus === true;
    const { data, error } = await supabase.rpc('complete_challenge', {
      p_user_id: userId,
      p_challenge_id: challenge.id,
      p_date: today,
      p_comeback_bonus: comebackBonus
    });
    if (error) throw error;
    if (data.already_completed) return;

    if (comebackBonus) window._comebackBonus = false;

    haptic([10, 30, 10]);
    const bonusLabel = data.comeback_bonus ? ' · COMEBACK ×2' : '';
    toast(`Challenge complete! +${data.awarded} XP${bonusLabel}`, 'success');

    if (typeof checkAchievements === 'function') {
      const triggers = [];
      if (challenge.tier === 'legendary') triggers.push({ type: 'legendary_challenge' });
      if (data.streak >= 7)   triggers.push({ type: 'challenge_streak', meta: { streak: data.streak } });
      if (data.streak >= 30)  triggers.push({ type: 'challenge_streak_30' });
      if (data.streak >= 100) triggers.push({ type: 'challenge_streak_100' });
      for (const t of triggers) {
        const unlocks = await checkAchievements(userId, t).catch(() => null);
        if (unlocks && unlocks.length) await processUnlocks(userId, unlocks);
      }
    }
  } catch (err) {
    if (DEBUG) console.error('_dcComplete failed', err);
  }
}

function _dcRender(userId, challenges, today) {
  const section = document.getElementById('challenge-section');
  if (!section) return;
  section.textContent = '';

  const header = document.createElement('div');
  header.className = 'challenge-header';

  const title = document.createElement('h2');
  title.className = 'dashboard-section-title';
  title.textContent = 'Daily Challenge';
  header.appendChild(title);

  section.appendChild(header);

  // Load streak async and inject pill
  supabase.from('profiles').select('challenge_streak').eq('id', userId).single()
    .then(({ data }) => {
      if (!data || !data.challenge_streak) return;
      const streakEl = document.createElement('span');
      streakEl.className = 'challenge-streak mono';
      streakEl.textContent = '🔥 ' + data.challenge_streak + 'd';
      header.appendChild(streakEl);
    });

  if (!challenges || challenges.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'detail-empty';
    empty.textContent = 'Come back tomorrow for new challenges.';
    section.appendChild(empty);
    return;
  }

  const tierOrder = ['easy', 'hard', 'legendary'];
  const sorted = challenges.slice().sort((a, b) =>
    tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
  );
  const xpMap = { easy: 50, hard: 150, legendary: 300 };

  sorted.forEach(c => {
    const card = document.createElement('div');
    card.className = 'challenge-card challenge-card--' + c.tier + (c.completed ? ' challenge-card--done' : '');

    const tierLabel = document.createElement('span');
    tierLabel.className = 'challenge-tier mono';
    tierLabel.textContent = c.tier.toUpperCase();
    card.appendChild(tierLabel);

    const desc = document.createElement('p');
    desc.className = 'challenge-desc';
    desc.textContent = c.description;
    card.appendChild(desc);

    const xpBadge = document.createElement('span');
    xpBadge.className = 'challenge-xp mono';
    xpBadge.textContent = c.completed
      ? '+' + c.xp_awarded + ' XP ✓'
      : '+' + (xpMap[c.tier] || 50) + ' XP';
    card.appendChild(xpBadge);

    section.appendChild(card);
  });
}
