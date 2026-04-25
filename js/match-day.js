var DEBUG = false;

const F1_PALETTES = {
  ferrari:       { primary: '#DC0000', secondary: '#000000', accent: '#FFF200' },
  mercedes:      { primary: '#00D2BE', secondary: '#000000', accent: '#C0C0C0' },
  mclaren:       { primary: '#FF8700', secondary: '#1F2A3B', accent: '#9EDDEF' },
  redbull:       { primary: '#3671C6', secondary: '#B6282F', accent: '#FCB614' },
  aston_martin:  { primary: '#006F62', secondary: '#CEDC00', accent: '#000000' },
  alpine:        { primary: '#0093CC', secondary: '#FF87BC', accent: '#FFFFFF' },
  williams:      { primary: '#64C4FF', secondary: '#00A0DE', accent: '#FFFFFF' },
  rb:            { primary: '#6692FF', secondary: '#1660AD', accent: '#FFFFFF' },
  haas:          { primary: '#B6BABD', secondary: '#E10600', accent: '#000000' },
  kick_sauber:   { primary: '#00E700', secondary: '#000000', accent: '#FFFFFF' }
};
const FOOTBALL_PALETTE = { primary: '#A50044', secondary: '#004D98', accent: '#FFD166' };

async function getActiveMatchDayEvent(userId) {
  const today = todayLocal();
  try {
    const { data, error } = await supabase.from('events')
      .select('id, sport, event_date, kickoff_time, settled')
      .eq('user_id', userId).eq('event_date', today)
      .order('kickoff_time', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const unsettled = data.find(e => !e.settled);
    return unsettled || null;
  } catch (err) {
    if (DEBUG) console.error('getActiveMatchDayEvent failed', err);
    return null;
  }
}

async function applyMatchDayTheme(userId) {
  const event = await getActiveMatchDayEvent(userId);
  if (!event) { removeMatchDayTheme(); return; }

  let palette = FOOTBALL_PALETTE;
  if (event.sport === 'f1') {
    try {
      const { data: prof } = await supabase.from('profiles').select('f1_team').eq('id', userId).single();
      const team = prof && prof.f1_team;
      palette = team && F1_PALETTES[team] ? F1_PALETTES[team]
                                          : { primary: '#CC0000', secondary: '#111', accent: '#FFF' };
    } catch (err) {
      if (DEBUG) console.error('f1_team fetch failed', err);
    }
  }

  document.body.classList.add('match-day', 'match-day--' + event.sport);
  document.body.style.setProperty('--match-primary', palette.primary);
  document.body.style.setProperty('--match-secondary', palette.secondary);
  document.body.style.setProperty('--match-accent', palette.accent);
}

function removeMatchDayTheme() {
  document.body.classList.remove('match-day', 'match-day--football', 'match-day--f1');
  document.body.style.removeProperty('--match-primary');
  document.body.style.removeProperty('--match-secondary');
  document.body.style.removeProperty('--match-accent');
}
