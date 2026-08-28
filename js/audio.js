// Jeder Ton wird zur Laufzeit mit der Web-Audio-API erzeugt. Das hält das
// Spiel bei einem einzigen Ordner - keine Klangdateien, nichts nachzuladen
// (was eine strenge Sicherheitsregel ohnehin blockieren würde), und offline
// funktioniert es genauso.
//
// Die Signalkette ist für alles dieselbe:
//
//   Quelle ─┬─► master ──────────────────► Kompressor ─► Ausgang
//           └─► Hall (Faltung) ─► nass ──►
//
// Der Kompressor fängt ab, dass gleichzeitige Ereignisse - Marschtritt,
// Zusammenstoß und Musik - übersteuern; der Hall gibt allen Klängen denselben
// Raum, und erst dadurch klingen synthetische Töne nicht mehr nach Piepser.

let ctx = null;
let master = null;      // trockenes Summensignal
let wetGain = null;     // Hallanteil
let compressor = null;
let musicBus = null;    // eigener Regler, damit die Musik getrennt schaltbar ist
let muted = false;
let musicEnabled = true;

const STORAGE_KEY = 'spqr.muted';
const MASTER_LEVEL = 0.42;

try {
  muted = localStorage.getItem(STORAGE_KEY) === '1';
} catch (err) {
  muted = false;
}

// Ein künstlicher Raum: Rauschen, das exponentiell ausklingt. Zwei Kanäle mit
// getrennten Zufallsläufen, sonst klingt der Hall in der Mitte des Kopfes.
function makeImpulse(context, seconds = 1.9, decay = 3.2) {
  const length = Math.floor(context.sampleRate * seconds);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Die ersten Millisekunden bleiben leise: der Direktschall kommt aus der
      // trockenen Kette, der Hall setzt kurz danach ein.
      const early = Math.min(1, t * 40);
      data[i] = (Math.random() * 2 - 1) * early * (1 - t) ** decay;
    }
  }
  return impulse;
}

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 24;
  compressor.ratio.value = 3.4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.22;
  compressor.connect(ctx.destination);

  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_LEVEL;
  master.connect(compressor);

  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx);
  wetGain = ctx.createGain();
  wetGain.gain.value = 0.26;
  master.connect(reverb);
  reverb.connect(wetGain);
  wetGain.connect(compressor);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);
  return ctx;
}

// Browser halten den Kontext angehalten, bis der Spieler wirklich etwas
// angeklickt hat; der Startknopf ist diese Geste.
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
    /* im privaten Fenster gibt es keinen Speicher - der Ton schaltet trotzdem */
  }
  if (master) master.gain.value = muted ? 0 : MASTER_LEVEL;
  if (muted) {
    stopMarch();
    stopTheme();
  }
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

// --- Bausteine -------------------------------------------------------------

let noiseBuffer = null;
function getNoise(context) {
  if (noiseBuffer) return noiseBuffer;
  const length = context.sampleRate * 1.2;
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// Ein geformter Rauschstoß: das Rückgrat von Schritten, Schlägen und Steinarbeit.
function noiseBurst(context, when, {
  duration = 0.18, gain = 0.4, frequency = 900, q = 1, type = 'bandpass',
  attack = 0.008, destination = null,
} = {}) {
  const source = context.createBufferSource();
  source.buffer = getNoise(context);
  source.playbackRate.value = 0.8 + Math.random() * 0.4;

  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(gain, when + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  source.connect(filter).connect(envelope).connect(destination || master);
  source.start(when);
  source.stop(when + duration + 0.02);
}

function tone(context, when, {
  frequency = 440, duration = 0.3, gain = 0.25, type = 'triangle', slideTo = null,
  attack = 0.02, destination = null,
} = {}) {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + duration);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(gain, when + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  osc.connect(envelope).connect(destination || master);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

// Ein Blasinstrument: zwei leicht gegeneinander verstimmte Sägezähne durch ein
// Tiefpassfilter, das sich mit dem Ton öffnet. Das Verstimmen macht aus einem
// dünnen Oszillator einen Chor, das Filter aus einem Summen ein Blech.
function brass(context, when, {
  frequency = 220, duration = 0.8, gain = 0.2, attack = 0.05, detune = 7,
  brightness = 5, destination = null,
} = {}) {
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(gain, when + attack);
  envelope.gain.setValueAtTime(gain, when + duration * 0.72);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(frequency * 1.6, when);
  filter.frequency.linearRampToValueAtTime(frequency * brightness, when + attack * 1.6);
  filter.frequency.exponentialRampToValueAtTime(frequency * 1.8, when + duration);

  for (const cents of [-detune, detune]) {
    const osc = context.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }
  filter.connect(envelope).connect(destination || master);
}

// Ein weicher Streicherteppich: dieselbe Idee, nur mit Dreieckschwingungen,
// langsamem Anschwellen und geschlossenem Filter.
function pad(context, when, {
  frequency = 220, duration = 2.4, gain = 0.09, destination = null,
} = {}) {
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(gain, when + duration * 0.35);
  envelope.gain.setValueAtTime(gain, when + duration * 0.7);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency * 6;

  for (const cents of [-9, 0, 9]) {
    const osc = context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }
  filter.connect(envelope).connect(destination || master);
}

// Kriegstrommel: ein Sinus, der im Fallen die Tonhöhe verliert, dazu ein
// Fellgeräusch obendrauf.
function drum(context, when, { gain = 0.5, pitch = 96, destination = null } = {}) {
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch, when);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.42, when + 0.18);

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(gain, when + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.45);

  osc.connect(envelope).connect(destination || master);
  osc.start(when);
  osc.stop(when + 0.5);
  noiseBurst(context, when, {
    duration: 0.09, gain: gain * 0.35, frequency: 1600, q: 0.8, destination,
  });
}

function play(builder) {
  if (muted) return;
  const context = ensureContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});
  builder(context, context.currentTime + 0.01);
}

// --- Die einzelnen Ereignisse ---------------------------------------------

export const sfx = {
  // Auswählen ist nur ein Klick: ein sehr kurzer, trockener Anschlag ohne
  // Tonhöhe. Ein Piepser wird bei jedem zweiten Handgriff zur Belästigung.
  select: () => play((c, t) => {
    noiseBurst(c, t, {
      duration: 0.035, gain: 0.3, frequency: 2600, q: 0.9, type: 'highpass', attack: 0.001,
    });
  }),

  denied: () => play((c, t) => {
    noiseBurst(c, t, { duration: 0.12, gain: 0.22, frequency: 300, q: 0.7, type: 'lowpass' });
    tone(c, t, { frequency: 132, duration: 0.26, gain: 0.16, type: 'triangle', slideTo: 88 });
  }),

  // Der Zusammenstoß in drei Schichten: der Aufprall zweier Linien, dann Eisen
  // auf Schild, darüber das Geschrei.
  clash: () => play((c, t) => {
    noiseBurst(c, t, { duration: 0.55, gain: 0.4, frequency: 150, q: 0.7, type: 'lowpass' });
    tone(c, t + 0.02, { frequency: 120, duration: 0.5, gain: 0.2, type: 'sawtooth', slideTo: 52 });
    for (let i = 0; i < 9; i++) {
      const at = t + 0.04 + i * 0.068 + Math.random() * 0.035;
      const pitch = 2400 + Math.random() * 2600;
      noiseBurst(c, at, { duration: 0.16, gain: 0.16, frequency: pitch, q: 6, attack: 0.001 });
      // Ein mitschwingender Oberton macht aus dem Rauschstoß erst Metall.
      tone(c, at, { frequency: pitch * 1.5, duration: 0.1, gain: 0.035, type: 'square' });
    }
    noiseBurst(c, t + 0.1, {
      duration: 0.75, gain: 0.13, frequency: 700, q: 0.9, attack: 0.2,
    });
  }),

  recruit: () => play((c, t) => {
    noiseBurst(c, t, { duration: 0.1, gain: 0.22, frequency: 3400, q: 5, attack: 0.001 });
    tone(c, t, { frequency: 1180, duration: 0.3, gain: 0.09, type: 'triangle' });
    tone(c, t + 0.09, { frequency: 1760, duration: 0.26, gain: 0.07, type: 'triangle' });
  }),

  // Der Hornruf zum Sammeln: eine steigende Quinte auf dem Blech.
  raise: () => play((c, t) => {
    brass(c, t, { frequency: 196, duration: 0.4, gain: 0.17 });
    brass(c, t + 0.22, { frequency: 294, duration: 0.66, gain: 0.19 });
  }),

  disband: () => play((c, t) => {
    brass(c, t, { frequency: 262, duration: 0.5, gain: 0.13, brightness: 3 });
    brass(c, t + 0.18, { frequency: 175, duration: 0.7, gain: 0.13, brightness: 2.4 });
  }),

  // Steinarbeit: drei Schläge Hammer auf Quader.
  wallBuy: () => play((c, t) => {
    for (let i = 0; i < 3; i++) {
      noiseBurst(c, t + i * 0.13, {
        duration: 0.2, gain: 0.26, frequency: 380, q: 1.6, type: 'lowpass', attack: 0.002,
      });
      noiseBurst(c, t + i * 0.13, { duration: 0.07, gain: 0.1, frequency: 2800, q: 3 });
    }
  }),

  wallDone: () => play((c, t) => {
    [262, 330, 392].forEach((f, i) => brass(c, t + i * 0.12, {
      frequency: f, duration: 0.7, gain: 0.14,
    }));
  }),

  // Rundenende: zwei Schläge auf die Kriegstrommel.
  endTurn: () => play((c, t) => {
    drum(c, t, { gain: 0.5 });
    drum(c, t + 0.26, { gain: 0.38, pitch: 84 });
  }),

  undo: () => play((c, t) => {
    tone(c, t, { frequency: 320, duration: 0.22, gain: 0.11, type: 'sine', slideTo: 640 });
  }),

  // Ablegen: knarrendes Holz, Wasser, und die Pfeife des Bootsmanns.
  embark: () => play((c, t) => {
    noiseBurst(c, t, { duration: 0.6, gain: 0.2, frequency: 800, q: 0.6, type: 'lowpass', attack: 0.1 });
    tone(c, t + 0.05, { frequency: 170, duration: 0.42, gain: 0.1, type: 'sawtooth', slideTo: 115 });
    tone(c, t + 0.3, { frequency: 780, duration: 0.36, gain: 0.09, type: 'sine', slideTo: 1240 });
  }),

  // Eine Stadt fällt: ein Dreiklang auf dem Blech über einem Trommelschlag.
  capture: () => play((c, t) => {
    drum(c, t, { gain: 0.42 });
    [196, 294, 392].forEach((f, i) => brass(c, t + i * 0.1, {
      frequency: f, duration: 0.9, gain: 0.15,
    }));
  }),

  victory: () => play((c, t) => {
    drum(c, t, { gain: 0.5 });
    [196, 262, 294, 392].forEach((f, i) => brass(c, t + i * 0.17, {
      frequency: f, duration: 1.3, gain: 0.16,
    }));
    brass(c, t + 0.68, { frequency: 523, duration: 1.8, gain: 0.17 });
  }),

  defeat: () => play((c, t) => {
    [392, 330, 262, 175].forEach((f, i) => brass(c, t + i * 0.3, {
      frequency: f, duration: 1.2, gain: 0.15, brightness: 2.6, attack: 0.12,
    }));
  }),
};

// --- Marschtritt -----------------------------------------------------------
// Die Schritte werden der Audiouhr ein Stück voraus eingeplant und nicht erst
// in dem Moment angestoßen, in dem sie zu hören sein sollen. Während des
// Marsches rendert der Haupt-Thread die Karte; ein Timer, der genau dann
// feuern müsste, kommt dabei ins Stocken, und der Ton hängt hörbar nach.
// Der Timer weckt hier nur den Planer - wann ein Schritt fällt, entscheidet
// allein die Uhr des Audiokontexts.

const MARCH_INTERVAL = 0.27;   // Sekunden zwischen zwei Tritten
const MARCH_LOOKAHEAD = 0.45;  // so weit im Voraus wird eingeplant
const MARCH_TICK = 110;        // so oft schaut der Planer nach (ms)

let marchHandle = null;
let marchGain = null;

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
      // Links, rechts: der schwere Tritt auf der Eins, dazu das Klirren der
      // Ausrüstung. Erst beides zusammen klingt nach marschierender Kolonne.
      const strong = step % 2 === 0;
      noiseBurst(context, nextAt, {
        duration: 0.13,
        gain: strong ? 0.24 : 0.15,
        frequency: strong ? 210 : 300,
        q: 1.1,
        type: 'lowpass',
        attack: 0.004,
        destination: bus,
      });
      if (strong) {
        noiseBurst(context, nextAt + 0.02, {
          duration: 0.07, gain: 0.05, frequency: 4200, q: 2.5, destination: bus,
        });
      }
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

// --- Titelmusik ------------------------------------------------------------
// Ein Stück in d-Moll, das sich in Takten selbst weiterschreibt: Bass und
// Blech tragen die Harmonie, ein Streicherteppich hält sie zusammen, die
// Trommel gibt den Schritt, und darüber läuft eine Melodie. Geplant wird wie
// beim Marschtritt Takt für Takt der Audiouhr voraus, damit die Musik nicht
// stockt, während der Browser die Karte aufbaut.

const TEMPO = 74;                       // Schläge je Minute
const BEAT = 60 / TEMPO;
const BAR = BEAT * 4;
const MUSIC_LOOKAHEAD = 1.5;            // Sekunden Vorlauf
const MUSIC_TICK = 250;                 // ms zwischen zwei Planungsläufen

const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Notenname wie 'A#3' oder 'Bb2' zu Frequenz.
function note(name) {
  const step = SEMITONES[name[0]];
  const sharp = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
  const octave = Number(name.slice(sharp ? 2 : 1));
  return 440 * 2 ** ((step + sharp - 9) / 12 + (octave - 4));
}

// Acht Takte: i – VI – III – VII, zweimal, beim zweiten Mal mit Melodie.
// Jeder Takt nennt Grundton, Dreiklang und die Melodietöne auf den Schlägen.
const PROGRESSION = [
  { root: 'D2', chord: ['D3', 'F3', 'A3'], melody: ['A4', null, 'F4', 'G4'] },
  { root: 'Bb1', chord: ['D3', 'F3', 'Bb3'], melody: ['F4', null, 'D4', 'F4'] },
  { root: 'F2', chord: ['C3', 'F3', 'A3'], melody: ['A4', 'G4', 'F4', null] },
  { root: 'C2', chord: ['C3', 'E3', 'G3'], melody: ['G4', null, 'E4', 'G4'] },
  { root: 'D2', chord: ['D3', 'F3', 'A3'], melody: ['D5', null, 'C5', 'A4'] },
  { root: 'Bb1', chord: ['D3', 'F3', 'Bb3'], melody: ['Bb4', 'A4', 'F4', null] },
  { root: 'F2', chord: ['C3', 'F3', 'A3'], melody: ['G4', null, 'A4', 'C5'] },
  { root: 'C2', chord: ['C3', 'E3', 'G3'], melody: ['D5', null, null, 'A4'] },
];

let musicHandle = null;
let musicBar = 0;
let musicNextAt = 0;

function scheduleBar(context, index, when) {
  const bar = PROGRESSION[index % PROGRESSION.length];
  // Der zweite Durchlauf ist der lautere: erst die Harmonie, dann das Blech.
  const loud = index % (PROGRESSION.length * 2) >= PROGRESSION.length;
  const bus = musicBus;

  pad(context, when, { frequency: note(bar.root) * 2, duration: BAR * 1.02, gain: 0.05, destination: bus });
  for (const tone3 of bar.chord) {
    pad(context, when, { frequency: note(tone3), duration: BAR * 1.02, gain: 0.038, destination: bus });
  }
  brass(context, when, {
    frequency: note(bar.root), duration: BAR * 0.92, gain: loud ? 0.15 : 0.1,
    attack: 0.08, brightness: loud ? 5 : 3.4, destination: bus,
  });

  // Der Schritt: schwer auf eins und drei, ein leiser Vorschlag vor der vier.
  drum(context, when, { gain: 0.34, destination: bus });
  drum(context, when + BEAT * 2, { gain: 0.24, pitch: 88, destination: bus });
  if (loud) drum(context, when + BEAT * 3.5, { gain: 0.16, pitch: 108, destination: bus });

  if (!loud) return;
  bar.melody.forEach((name, beat) => {
    if (!name) return;
    brass(context, when + beat * BEAT, {
      frequency: note(name), duration: BEAT * 1.7, gain: 0.11, attack: 0.06, brightness: 6,
      destination: bus,
    });
  });
}

export function setMusicEnabled(value) {
  musicEnabled = !!value;
  if (!musicEnabled) stopTheme();
}

export function isMusicEnabled() {
  return musicEnabled;
}

export function isThemePlaying() {
  return musicHandle !== null;
}

// Setzt die Musik in Gang. `fadeIn` ist die Zeit, über die sie aufblendet.
export function startTheme({ fadeIn = 2.5 } = {}) {
  if (muted || !musicEnabled || musicHandle !== null) return;
  const context = ensureContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});

  const now = context.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(0.0001, now);
  musicBus.gain.linearRampToValueAtTime(1, now + fadeIn);
  musicBar = 0;
  musicNextAt = now + 0.15;

  const schedule = () => {
    while (musicNextAt < context.currentTime + MUSIC_LOOKAHEAD) {
      if (musicNextAt < context.currentTime) musicNextAt = context.currentTime + 0.05;
      scheduleBar(context, musicBar, musicNextAt);
      musicNextAt += BAR;
      musicBar++;
    }
  };
  schedule();
  musicHandle = setInterval(schedule, MUSIC_TICK);
}

// Blendet die Musik aus und hört auf, neue Takte zu planen. Was schon in der
// Zukunft liegt, läuft still weiter aus.
export function stopTheme({ fadeOut = 3 } = {}) {
  if (musicHandle !== null) {
    clearInterval(musicHandle);
    musicHandle = null;
  }
  if (!musicBus || !ctx) return;
  const now = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(musicBus.gain.value, now);
  musicBus.gain.linearRampToValueAtTime(0.0001, now + fadeOut);
}
