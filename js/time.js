var DEBUG = false;

const TIMEZONE = 'Africa/Maputo';

function todayLocal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function yesterdayLocal() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

function todayDayOfWeek() {
  return new Date(todayLocal() + 'T12:00:00').getDay();
}

function nDaysAgoLocal(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

// Returns the most recent date before today where day-of-week is in activeDays
function prevScheduledDate(activeDays) {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(todayLocal() + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const dow = new Date(dateStr + 'T12:00:00').getDay();
    if (activeDays.includes(dow)) return dateStr;
  }
  return null;
}
