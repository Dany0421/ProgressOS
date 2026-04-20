const DEBUG = false;

function xpForLevel(n) {
  if (n <= 1) return 0;
  let total = 0;
  for (let i = 2; i <= n; i++) total += i * 150;
  return total;
}

function sessionXP(durationMinutes) {
  if (durationMinutes < 15) return 0;
  return Math.floor(durationMinutes / 30) * 5;
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
      toast("Daily task cap reached. You're crushing it.");
      return data;
    }

    if (data.leveled_up) {
      playLevelUpChime();
      showLevelUp(data.new_level);
    }

    return data;
  } catch (err) {
    if (DEBUG) console.error('awardXP failed', err);
    toast('Could not award XP', 'error');
    return null;
  }
}
