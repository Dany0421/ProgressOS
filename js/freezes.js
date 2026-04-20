var DEBUG = false;

async function consumeFreeze(userId, habit, yesterday) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('freezes_available')
      .eq('id', userId)
      .single();
    if (error) throw error;
    if (data.freezes_available <= 0) return false;

    const [profileRes, habitRes] = await Promise.all([
      supabase.from('profiles')
        .update({ freezes_available: data.freezes_available - 1 })
        .eq('id', userId),
      supabase.from('habits')
        .update({ last_completed_date: yesterday })
        .eq('id', habit.id)
    ]);
    if (profileRes.error) throw profileRes.error;
    if (habitRes.error) throw habitRes.error;

    await supabase.from('xp_events').insert({
      user_id: userId,
      description: `Freeze consumed — streak saved for ${habit.title}`,
      xp_amount: 0,
      category: 'system',
      event_date: todayLocal()
    });

    habit.last_completed_date = yesterday;
    toast(`Streak saved with a freeze — ${data.freezes_available - 1} remaining`);
    return true;
  } catch (err) {
    if (DEBUG) console.error('consumeFreeze failed', err);
    return false;
  }
}

async function purchaseFreeze(userId, currentXP, currentFreezes) {
  try {
    const { error } = await supabase.from('profiles').update({
      total_xp: currentXP - 150,
      freezes_available: currentFreezes + 1
    }).eq('id', userId);
    if (error) throw error;

    await supabase.from('xp_events').insert({
      user_id: userId,
      description: 'Freeze purchased',
      xp_amount: -150,
      category: 'system',
      event_date: todayLocal()
    });

    return true;
  } catch (err) {
    if (DEBUG) console.error('purchaseFreeze failed', err);
    return false;
  }
}
