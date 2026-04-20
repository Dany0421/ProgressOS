var DEBUG = false;

let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function isMuted() {
  return localStorage.getItem('sound_muted') === 'true';
}

function setMuted(bool) {
  localStorage.setItem('sound_muted', bool ? 'true' : 'false');
}

function playNote(freq, startTime, duration, ctx, gainNode) {
  const osc = ctx.createOscillator();
  osc.connect(gainNode);
  osc.frequency.value = freq;
  osc.type = 'sine';
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playTick() {
  if (isMuted()) return;
  try {
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);
    playNote(880, ctx.currentTime, 0.08, ctx, gain);
  } catch (err) {
    if (DEBUG) console.error('playTick failed', err);
  }
}

function playLevelUpChime() {
  if (isMuted()) return;
  try {
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    playNote(523.25, t,        0.12, ctx, gain); // C5
    playNote(659.25, t + 0.12, 0.12, ctx, gain); // E5
    playNote(783.99, t + 0.24, 0.18, ctx, gain); // G5
  } catch (err) {
    if (DEBUG) console.error('playLevelUpChime failed', err);
  }
}

function playStreakMilestone() {
  if (isMuted()) return;
  try {
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.1;
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    playNote(440, t,        0.1, ctx, gain);
    playNote(554, t + 0.1,  0.1, ctx, gain);
    playNote(659, t + 0.2,  0.15, ctx, gain);
  } catch (err) {
    if (DEBUG) console.error('playStreakMilestone failed', err);
  }
}
