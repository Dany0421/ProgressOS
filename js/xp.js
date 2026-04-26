var DEBUG = false;

function xpForLevel(n) {
  if (n <= 1) return 0;
  let total = 0;
  for (let i = 2; i <= n; i++) total += i * 150;
  return total;
}

function sessionXP(durationMinutes) {
  if (durationMinutes < 5) return 0;
  return Math.round(durationMinutes / 3);
}

async function awardXP(userId, amount, category, description) {
  try {
    const { data, error } = await supabase.rpc('award_xp', {
      p_user_id: userId,
      p_amount: amount,
      p_category: category,
      p_description: description,
      p_event_date: todayLocal()
    });
    if (error) throw error;

    if (data.capped) {
      if (data.bonus_day) toast("Bonus cap (500) reached. Crushing it.", 'success');
      else toast("Daily task cap reached. You're crushing it.");
      return data;
    }

    if (data.bonus_crossed_250) showBonusDay();
    if (data.bonus_cap_hit) showBonusCapHit();

    if (data.leveled_up) {
      playLevelUpChime();
      const rewards = await checkLevelRewards(userId, data.new_level);
      showLevelUp(data.new_level, rewards);
    }

    if (category !== 'achievement' && typeof checkAchievements === 'function') {
      _triggerAchievementChecks(userId, amount, category, data);
    }

    return data;
  } catch (err) {
    if (DEBUG) console.error('awardXP failed', err);
    toast('Could not award XP', 'error');
    return null;
  }
}

async function checkLevelRewards(userId, newLevel) {
  try {
    const { data, error } = await supabase.rpc('check_level_rewards', {
      p_user_id: userId,
      p_new_level: newLevel
    });
    if (error) throw error;
    return data.unlocked || [];
  } catch (err) {
    if (DEBUG) console.error('checkLevelRewards failed', err);
    return [];
  }
}

function levelAvatarColour(level) {
  if (level >= 300) return 'rainbow';
  if (level >= 100) return 'purple-pink';
  if (level >= 40)  return 'crimson-orange';
  if (level >= 20)  return 'indigo-violet';
  return null;
}

function levelBadge(level) {
  if (level >= 200) return 'glow';
  if (level >= 100) return 'diamond';
  if (level >= 50)  return 'gold';
  return null;
}

async function _triggerAchievementChecks(userId, amount, category, data) {
  try {
    const triggers = [{ type: 'xp_award', meta: { amount, category } }];
    if (data && data.bonus_crossed_250) triggers.push({ type: 'bonus_discovery' });
    if (data && data.bonus_cap_hit)     triggers.push({ type: 'bonus_cap_hit' });

    for (const t of triggers) {
      const unlocks = await checkAchievements(userId, t);
      if (unlocks && unlocks.length) await processUnlocks(userId, unlocks);
    }
  } catch (err) {
    if (DEBUG) console.error('_triggerAchievementChecks failed', err);
  }
}
