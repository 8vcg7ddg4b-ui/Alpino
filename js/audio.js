// Every sound is synthesised with the Web Audio API at runtime. That keeps the
// game a single self-contained folder - no audio files to ship, nothing to
// fetch (which a strict CSP would block anyway), and it still works offline.

let ctx = null;
let master = null;
let muted = false;
let marchHandle = null;
let marchGain = null;

const STORAGE_KEY = 'spqr.muted';

try {
  muted = localStorage.getItem(STORAGE_KEY) === '1';
} catch (err) {
  muted = false;
}

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  return ctx;
}

// Browsers start the context suspended until a real user gesture; the start
// button is that gesture.
export function unlockAudio() {
  const context = ensureContext();
  if (context && context.state === 'suspended') context.resume().catch(() => {});
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch (err) {
    /* storage may be unavailable in a private window - sound still toggles */
  }
  if (master) master.gain.value = muted ? 0 : 0.5;
  if (muted) stopMarch();
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

let noiseBuffer = null;
function getNoise(context) {
  if (noiseBuffer) return noiseBuffer;
  const length = context.sampleRate * 1.2;
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// A shaped burst of noise: the backbone of footsteps, impacts and stone work.
function noiseBurst(context, when, { duration = 0.18, gain = 0.4, frequency = 900, q = 1, type = 'bandpass', destination = null } = {}) {
  const source = context.createBufferSource();
  source.buffer = getNoise(context);
  source.playbackRate.value = 0.8 + Math.random() * 0.4;

  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(gain, when + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  source.connect(filter).connect(envelope).connect(destination || master);
  source.start(when);
  source.stop(when + duration + 0.02);
}

function tone(context, when, { frequency = 440, duration = 0.3, gain = 0.25, type = 'triangle', slideTo = null } = {}) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + duration);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(gain, when + 0.02);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(envelope).connect(master);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function play(builder) {
  if (muted) return;
  const context = ensureContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});
  builder(context, context.currentTime);
}

export const sfx = {
  select: () => play((c, t) => tone(c, t, { frequency: 620, duration: 0.09, gain: 0.12, type: 'square' })),

  denied: () => play((c, t) => tone(c, t, { frequency: 150, duration: 0.22, gain: 0.2, type: 'sawtooth', slideTo: 90 })),

  // Iron on shield, then a low thud of bodies meeting.
  clash: () => play((c, t) => {
    for (let i = 0; i < 7; i++) {
      const at = t + i * 0.075 + Math.random() * 0.03;
      noiseBurst(c, at, { duration: 0.2, gain: 0.32, frequency: 2200 + Math.random() * 1800, q: 3 });
    }
    noiseBurst(c, t, { duration: 0.5, gain: 0.42, frequency: 160, q: 0.7, type: 'lowpass' });
    tone(c, t + 0.04, { frequency: 130, duration: 0.45, gain: 0.22, type: 'sawtooth', slideTo: 60 });
  }),

  recruit: () => play((c, t) => {
    noiseBurst(c, t, { duration: 0.13, gain: 0.3, frequency: 3200, q: 4 });
    tone(c, t + 0.02, { frequency: 880, duration: 0.22, gain: 0.16, type: 'triangle' });
    tone(c, t + 0.1, { frequency: 1320, duration: 0.2, gain: 0.12, type: 'triangle' });
  }),

  // A horn call for mustering troops.
  raise: () => play((c, t) => {
    tone(c, t, { frequency: 294, duration: 0.34, gain: 0.2, type: 'sawtooth' });
    tone(c, t + 0.16, { frequency: 440, duration: 0.42, gain: 0.2, type: 'sawtooth' });
  }),

  disband: () => play((c, t) => {
    tone(c, t, { frequency: 440, duration: 0.36, gain: 0.16, type: 'triangle', slideTo: 220 });
    noiseBurst(c, t + 0.05, { duration: 0.3, gain: 0.16, frequency: 700, q: 1 });
  }),

  wallBuy: () => play((c, t) => {
    for (let i = 0; i < 3; i++) {
      noiseBurst(c, t + i * 0.12, { duration: 0.24, gain: 0.32, frequency: 420, q: 1.4, type: 'lowpass' });
    }
  }),

  wallDone: () => play((c, t) => {
    [523, 659, 784].forEach((f, i) => tone(c, t + i * 0.11, { frequency: f, duration: 0.4, gain: 0.16 }));
  }),

  endTurn: () => play((c, t) => {
    noiseBurst(c, t, { duration: 0.34, gain: 0.34, frequency: 190, q: 0.8, type: 'lowpass' });
    noiseBurst(c, t + 0.18, { duration: 0.34, gain: 0.28, frequency: 190, q: 0.8, type: 'lowpass' });
  }),

  undo: () => play((c, t) => tone(c, t, { frequency: 300, duration: 0.26, gain: 0.16, type: 'sine', slideTo: 620 })),

  // Casting off: creaking timber, water, and a boatswain's whistle.
  embark: () => play((c, t) => {
    noiseBurst(c, t, { duration: 0.55, gain: 0.26, frequency: 900, q: 0.6, type: 'lowpass' });
    tone(c, t + 0.06, { frequency: 180, duration: 0.4, gain: 0.14, type: 'sawtooth', slideTo: 120 });
    tone(c, t + 0.3, { frequency: 760, duration: 0.34, gain: 0.13, type: 'sine', slideTo: 1180 });
  }),

  capture: () => play((c, t) => {
    [392, 523, 659, 784].forEach((f, i) => tone(c, t + i * 0.1, { frequency: f, duration: 0.45, gain: 0.17, type: 'sawtooth' }));
  }),

  victory: () => play((c, t) => {
    [392, 523, 659, 880].forEach((f, i) => tone(c, t + i * 0.16, { frequency: f, duration: 0.7, gain: 0.2, type: 'sawtooth' }));
  }),

  defeat: () => play((c, t) => {
    [392, 330, 262, 196].forEach((f, i) => tone(c, t + i * 0.22, { frequency: f, duration: 0.8, gain: 0.2, type: 'triangle' }));
  }),
};

// Der Tritt der Kolonne, solange ein Heer unterwegs ist.
//
// Die Schritte werden der Audiouhr ein Stück voraus eingeplant und nicht erst
// in dem Moment angestoßen, in dem sie zu hören sein sollen. Während des
// Marsches rendert der Haupt-Thread die Karte; ein Timer, der genau dann
// feuern müsste, kommt dabei ins Stocken, und der Ton hängt hörbar nach.
// Der Timer weckt hier nur den Planer - wann ein Schritt fällt, entscheidet
// allein die Uhr des Audiokontexts.
const MARCH_INTERVAL = 0.26;   // Sekunden zwischen zwei Tritten
const MARCH_LOOKAHEAD = 0.45;  // so weit im Voraus wird eingeplant
const MARCH_TICK = 110;        // so oft schaut der Planer nach (ms)

export function startMarch() {
  if (muted) return;
  const context = ensureContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});
  stopMarch();

  // Alle Tritte laufen über einen eigenen Regler. Beim Abbrechen wird der
  // zugedreht, damit auch die schon eingeplanten Schritte verstummen.
  marchGain = context.createGain();
  marchGain.gain.value = 1;
  marchGain.connect(master);
  const bus = marchGain;

  let step = 0;
  let nextAt = context.currentTime + 0.02;

  const schedule = () => {
    if (bus !== marchGain) return;
    while (nextAt < context.currentTime + MARCH_LOOKAHEAD) {
      // Lag der Takt zurück (verdeckter Tab, langer Ruckler), wird er auf die
      // Gegenwart gesetzt statt einen Schwall Schritte nachzuholen.
      if (nextAt < context.currentTime) nextAt = context.currentTime + 0.02;
      const strong = step % 2 === 0;
      noiseBurst(context, nextAt, {
        duration: 0.14,
        gain: strong ? 0.26 : 0.17,
        frequency: strong ? 240 : 340,
        q: 1.1,
        type: 'lowpass',
        destination: bus,
      });
      nextAt += MARCH_INTERVAL;
      step++;
    }
  };
  schedule();
  marchHandle = setInterval(schedule, MARCH_TICK);
}

export function stopMarch() {
  if (marchHandle !== null) {
    clearInterval(marchHandle);
    marchHandle = null;
  }
  if (marchGain && ctx) {
    const bus = marchGain;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0, now + 0.06);
    // Erst abklemmen, wenn auch der letzte eingeplante Tritt vorbei ist.
    setTimeout(() => bus.disconnect(), 1200);
  }
  marchGain = null;
}
