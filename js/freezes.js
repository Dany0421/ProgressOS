var DEBUG = false;

async function consumeFreeze(userId, habit, prevDay) {
  try {
    const { data, error } = await supabase.rpc('consume_freeze', {
      p_user_id:    userId,
      p_habit_id:   habit.id,
      p_prev_date:  prevDay,
      p_event_date: todayLocal()
    });
    if (error) throw error;

    if (!data.consumed) return false;

    habit.last_completed_date = prevDay;
    toast(`Streak saved with a freeze — ${data.freezes_remaining} remaining`);

    if (typeof checkAchievements === 'function') {
      checkAchievements(userId, { type: 'freeze_consumed', meta: { habit_id: habit.id } })
        .then(unlocks => { if (unlocks && unlocks.length) processUnlocks(userId, unlocks); });
    }

    return true;
  } catch (err) {
    if (DEBUG) console.error('consumeFreeze failed', err);
    return false;
  }
}

async function purchaseFreeze(userId) {
  try {
    const { data, error } = await supabase.rpc('purchase_freeze', {
      p_user_id:    userId,
      p_event_date: todayLocal()
    });
    if (error) throw error;

    if (!data.success) {
      toast(data.reason === 'insufficient_xp' ? 'Not enough XP' : 'Max freezes reached', 'error');
      return false;
    }

    return data;
  } catch (err) {
    if (DEBUG) console.error('purchaseFreeze failed', err);
    return false;
  }
}
