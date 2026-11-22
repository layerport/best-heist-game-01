// audio.js — all sound is WebAudio oscillators, no audio files at all.
// The context is created on the first key or click, so browsers allow it.

// Create the sound engine. Every method is safe to call before the context
// exists (it just does nothing until the player first interacts).
function createSoundEngine() {
  const engine = {
    context: null,
    master: null,
    muted: false,
    lastStepAt: 0,
    lastAlarmBeepAt: 0,
  };

  // Build the AudioContext lazily, on a real user gesture.
  engine.ensure = function ensureAudioContext() {
    if (engine.context) {
      if (engine.context.state === 'suspended') engine.context.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      engine.context = new Ctor();
      engine.master = engine.context.createGain();
      engine.master.gain.value = 0.16;
      engine.master.connect(engine.context.destination);
    } catch (err) {
      engine.context = null;
    }
  };

  // One short tone: frequency slides from `from` to `to` over `seconds`.
  engine.tone = function playTone(from, to, seconds, type, volume) {
    if (!engine.context || engine.muted) return;
    try {
      const now = engine.context.currentTime;
      const osc = engine.context.createOscillator();
      const gain = engine.context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(from, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
      gain.gain.setValueAtTime(volume || 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      osc.connect(gain);
      gain.connect(engine.master);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    } catch (err) {
      // Sound is garnish; a failure here must never break the game.
    }
  };

  // A coin pickup: two bright notes, quick.
  engine.pickup = function soundPickup() {
    engine.tone(880, 880, 0.07, 'triangle', 0.5);
    setTimeout(() => engine.tone(1318, 1318, 0.1, 'triangle', 0.5), 60);
  };

  // The diamond: a little rising arpeggio.
  engine.loot = function soundLoot() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((note, i) => {
      setTimeout(() => engine.tone(note, note, 0.16, 'triangle', 0.55), i * 90);
    });
  };

  // A soft footstep tick, throttled so it never becomes a rattle.
  engine.step = function soundStep(nowMs) {
    if (!engine.context || engine.muted) return;
    if (nowMs - engine.lastStepAt < 260) return;
    engine.lastStepAt = nowMs;
    engine.tone(140, 90, 0.05, 'sine', 0.25);
  };

  // The alarm's warning beep while the meter is high, at most twice a second.
  engine.alarmBeep = function soundAlarmBeep(nowMs) {
    if (!engine.context || engine.muted) return;
    if (nowMs - engine.lastAlarmBeepAt < 500) return;
    engine.lastAlarmBeepAt = nowMs;
    engine.tone(980, 980, 0.09, 'square', 0.22);
  };

  // Smoke pellet: a low whoosh downwards.
  engine.smoke = function soundSmoke() {
    engine.tone(320, 90, 0.35, 'sine', 0.5);
  };

  // Noise-maker: a sharp clink that lures a guard.
  engine.noise = function soundNoise() {
    engine.tone(2400, 1800, 0.08, 'square', 0.3);
    setTimeout(() => engine.tone(1900, 1500, 0.08, 'square', 0.25), 90);
  };

  // Camera jammer: a quick electric zap.
  engine.jam = function soundJam() {
    engine.tone(180, 1400, 0.22, 'sawtooth', 0.25);
  };

  // Caught: a falling minor sting.
  engine.caught = function soundCaught() {
    engine.tone(392, 392, 0.18, 'sawtooth', 0.5);
    setTimeout(() => engine.tone(311, 311, 0.22, 'sawtooth', 0.5), 160);
    setTimeout(() => engine.tone(233, 155, 0.5, 'sawtooth', 0.55), 340);
  };

  // Clean getaway: a short major fanfare.
  engine.win = function soundWin() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((note, i) => {
      setTimeout(() => engine.tone(note, note, 0.22, 'triangle', 0.55), i * 110);
    });
  };

  // M toggles sound on and off.
  engine.toggleMute = function toggleMute() {
    engine.muted = !engine.muted;
    return engine.muted;
  };

  return engine;
}
