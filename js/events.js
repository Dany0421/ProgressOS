var DEBUG = false;

// ---- Fetchers ----

async function fetchUpcomingEvents(userId) {
  const today = todayLocal();
  try {
    const { data, error } = await supabase
      .from('events').select('*').eq('user_id', userId)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('kickoff_time', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    if (DEBUG) console.error('fetchUpcomingEvents failed', err);
    toast('Could not load events', 'error');
    return [];
  }
}

async function fetchPastEvents(userId, limit = 20) {
  const today = todayLocal();
  try {
    const { data, error } = await supabase
      .from('events').select('*').eq('user_id', userId)
      .lt('event_date', today)
      .order('event_date', { ascending: false })
      .order('kickoff_time', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    if (DEBUG) console.error('fetchPastEvents failed', err);
    return [];
  }
}

async function fetchTodayEvents(userId) {
  const today = todayLocal();
  try {
    const { data, error } = await supabase
      .from('events').select('*').eq('user_id', userId)
      .eq('event_date', today)
      .order('kickoff_time', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    if (DEBUG) console.error('fetchTodayEvents failed', err);
    return [];
  }
}

async function fetchEventWithPrediction(eventId) {
  try {
    const [evRes, predRes, resRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('event_predictions').select('*').eq('event_id', eventId).maybeSingle(),
      supabase.from('event_results').select('*').eq('event_id', eventId).maybeSingle()
    ]);
    if (evRes.error) throw evRes.error;
    return { event: evRes.data, prediction: predRes.data || null, result: resRes.data || null };
  } catch (err) {
    if (DEBUG) console.error('fetchEventWithPrediction failed', err);
    toast('Could not load match', 'error');
    return null;
  }
}

// ---- Mutations ----

async function createEvent(userId, fields) {
  try {
    const payload = Object.assign({ user_id: userId }, fields);
    const { data, error } = await supabase.from('events').insert(payload).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    if (DEBUG) console.error('createEvent failed', err);
    toast('Could not create event', 'error');
    return null;
  }
}

async function savePrediction(userId, eventId, fields) {
  try {
    const payload = Object.assign(
      { event_id: eventId, user_id: userId, updated_at: new Date().toISOString() }, fields);
    const { error } = await supabase.from('event_predictions')
      .upsert(payload, { onConflict: 'event_id' });
    if (error) throw error;
    return true;
  } catch (err) {
    if (DEBUG) console.error('savePrediction failed', err);
    toast('Could not save predictions', 'error');
    return false;
  }
}

async function deleteEvent(eventId) {
  try {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) throw error;
    return true;
  } catch (err) {
    if (DEBUG) console.error('deleteEvent failed', err);
    toast('Could not delete event', 'error');
    return false;
  }
}

async function settleEvent(eventId, resultFields) {
  try {
    const { data, error } = await supabase.rpc('settle_event', {
      p_event_id: eventId, p_result: resultFields
    });
    if (error) throw error;
    return data;
  } catch (err) {
    if (DEBUG) console.error('settleEvent failed', err);
    toast('Could not settle event', 'error');
    return null;
  }
}

// ---- Lock state helpers ----

function isPredictionLocked(event) {
  const today = todayLocal();
  if (event.event_date < today) return true;
  if (event.event_date > today) return false;
  const now = new Date();
  const mpNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Maputo' }));
  const hh = String(mpNow.getHours()).padStart(2,'0');
  const mm = String(mpNow.getMinutes()).padStart(2,'0');
  const ss = String(mpNow.getSeconds()).padStart(2,'0');
  return `${hh}:${mm}:${ss}` >= event.kickoff_time;
}

function canSettle(event) {
  const koMs = new Date(`${event.event_date}T${event.kickoff_time}+02:00`).getTime();
  return Date.now() >= koMs + 90 * 60 * 1000;
}

function minutesSinceKickoff(event) {
  const koMs = new Date(`${event.event_date}T${event.kickoff_time}+02:00`).getTime();
  return Math.max(0, Math.floor((Date.now() - koMs) / 60000));
}
