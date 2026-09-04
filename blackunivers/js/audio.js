// --- Klang ----------------------------------------------------------------
// Alles wird gerechnet, nichts geladen: Funksprüche, Triebwerke, Laser,
// Einschläge und das Titelstück entstehen im Browser aus Oszillatoren. So
// bleibt das Spiel eine Handvoll Textdateien und klingt trotzdem.
let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let musicOn = true;
let sfxOn = true;
let themeTimer = null;
let themeStep = 0;
let marchNode = null;
// Das Titelstück liegt als Datei vor: „Black Hull Directive". Der Synthesizer
// weiter unten bleibt als Rückfall stehen - ohne Datei klingt das Spiel
// trotzdem.
let themeEl = null;
let themeVolume = 0.55;
let themeFade = null;

function ensure() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = musicOn ? 0.34 : 0;
  musicGain.connect(master);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = sfxOn ? 0.5 : 0;
  sfxGain.connect(master);
  return ctx;
}

// Der erste Klick schaltet den Klang frei - Browser lassen Ton erst nach
// einer Handlung des Nutzers zu.
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
  return !!c;
}

export function setMusicEnabled(on) {
  musicOn = !!on;
  if (musicGain) musicGain.gain.value = musicOn ? 0.34 : 0;
  if (!musicOn) stopTheme();
  else if (themeAudio() && themeAudio().paused) startTheme();
}
export function setSfxEnabled(on) {
  sfxOn = !!on;
  if (sfxGain) sfxGain.gain.value = sfxOn ? 0.5 : 0;
}
export function isMusicEnabled() { return musicOn; }
export function isSfxEnabled() { return sfxOn; }

function tone({ freq = 440, type = 'sine', dur = 0.2, gain = 0.3, at = 0, glide = null, detune = 0 }) {
  const c = ensure();
  if (!c || !sfxOn) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t0 + dur);
  if (detune) osc.detune.value = detune;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.03, dur / 3));
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env);
  env.connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.3, gain = 0.3, at = 0, band = 900, q = 1 }) {
  const c = ensure();
  if (!c || !sfxOn) return;
  const t0 = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = band;
  filter.Q.value = q;
  const env = c.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(env);
  env.connect(sfxGain);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// Die Klänge des Spiels. Jeder ist mit zwei, drei Stimmen gebaut - mehr
// braucht es nicht, damit ein Laser wie ein Laser klingt.
export const sfx = {
  klick() { tone({ freq: 640, type: 'square', dur: 0.05, gain: 0.12 }); },
  wechsel() {
    tone({ freq: 380, type: 'triangle', dur: 0.09, gain: 0.16 });
    tone({ freq: 570, type: 'triangle', dur: 0.12, gain: 0.12, at: 0.05 });
  },
  fehler() {
    tone({ freq: 200, type: 'sawtooth', dur: 0.18, gain: 0.18, glide: 120 });
  },
  funk() {
    // Der Ruf des Ersten Offiziers: zwei kurze Töne wie eine Bordanlage.
    tone({ freq: 880, type: 'sine', dur: 0.08, gain: 0.14 });
    tone({ freq: 1180, type: 'sine', dur: 0.1, gain: 0.12, at: 0.1 });
  },
  triebwerk() {
    noise({ dur: 0.55, gain: 0.14, band: 260, q: 0.7 });
    tone({ freq: 90, type: 'sawtooth', dur: 0.5, gain: 0.1, glide: 150 });
  },
  sprung() {
    // Sprungpunkt: ein Aufheulen, dann Stille.
    tone({ freq: 140, type: 'sawtooth', dur: 0.7, gain: 0.2, glide: 1400 });
    noise({ dur: 0.5, gain: 0.12, band: 1800, q: 0.6, at: 0.2 });
  },
  laser() {
    tone({ freq: 1600, type: 'square', dur: 0.09, gain: 0.16, glide: 420 });
  },
  torpedo() {
    tone({ freq: 300, type: 'sawtooth', dur: 0.35, gain: 0.18, glide: 90 });
    noise({ dur: 0.3, gain: 0.1, band: 500 });
  },
  treffer() {
    noise({ dur: 0.22, gain: 0.26, band: 700, q: 0.8 });
    tone({ freq: 120, type: 'triangle', dur: 0.2, gain: 0.16, glide: 60 });
  },
  explosion() {
    noise({ dur: 0.9, gain: 0.34, band: 220, q: 0.5 });
    tone({ freq: 80, type: 'sawtooth', dur: 0.7, gain: 0.2, glide: 30 });
  },
  schild() {
    tone({ freq: 520, type: 'sine', dur: 0.3, gain: 0.16, glide: 260 });
    noise({ dur: 0.25, gain: 0.08, band: 2400, q: 2 });
  },
  eroberung() {
    [0, 0.12, 0.26].forEach((at, i) => tone({
      freq: [392, 523, 659][i], type: 'triangle', dur: 0.4, gain: 0.18, at,
    }));
  },
  verlust() {
    [0, 0.14, 0.3].forEach((at, i) => tone({
      freq: [392, 330, 262][i], type: 'triangle', dur: 0.45, gain: 0.18, at,
    }));
  },
  zug() {
    tone({ freq: 300, type: 'sine', dur: 0.14, gain: 0.14 });
    tone({ freq: 450, type: 'sine', dur: 0.2, gain: 0.12, at: 0.1 });
  },
};

// Ein laufendes Triebwerksgeräusch, solange eine Flotte über die Karte
// zieht - es wird gestartet und gestoppt, nicht getaktet.
export function startEngine() {
  const c = ensure();
  if (!c || !sfxOn || marchNode) return;
  const src = c.createBufferSource();
  const len = Math.floor(c.sampleRate * 1.5);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 280;
  const env = c.createGain();
  env.gain.value = 0.0001;
  env.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.2);
  src.connect(filter);
  filter.connect(env);
  env.connect(sfxGain);
  src.start();
  marchNode = { src, env };
}

export function stopEngine() {
  if (!marchNode || !ctx) return;
  const { src, env } = marchNode;
  marchNode = null;
  env.gain.cancelScheduledValues(ctx.currentTime);
  env.gain.setValueAtTime(env.gain.value, ctx.currentTime);
  env.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
  setTimeout(() => { try { src.stop(); } catch (err) { /* schon aus */ } }, 400);
}

// --- Das Titelstück als Aufnahme ----------------------------------------
// Gefunden wird es über ein <audio>-Element im Dokument. Im gebündelten
// Artefakt steckt dieselbe Aufnahme als Datenadresse darin - so klingt die
// eine Datei genauso wie das Spiel aus dem Verzeichnis.
export const THEME_TITLE = 'Black Hull Directive';

function themeAudio() {
  if (themeEl !== null) return themeEl;
  themeEl = (typeof document !== 'undefined' && document.getElementById('themeAudio')) || null;
  if (themeEl) {
    themeEl.loop = true;
    themeEl.volume = 0;
    themeEl.addEventListener('error', () => { themeEl = null; });
  }
  return themeEl;
}

function fadeTo(target, ms = 900, onDone = null) {
  const el = themeAudio();
  if (!el) return;
  if (themeFade) clearInterval(themeFade);
  const from = el.volume;
  const start = Date.now();
  themeFade = setInterval(() => {
    const t = Math.min(1, (Date.now() - start) / ms);
    el.volume = Math.max(0, Math.min(1, from + (target - from) * t));
    if (t >= 1) {
      clearInterval(themeFade);
      themeFade = null;
      if (onDone) onDone();
    }
  }, 40);
}

// Wie laut das Stück steht: im Startbild vorn, im Feldzug hinter den
// Meldungen. Es läuft weiter, wenn der Feldzug beginnt - nur leiser.
export function setMusicScene(scene) {
  themeVolume = scene === 'feldzug' ? 0.3 : 0.55;
  if (musicOn && themeAudio() && !themeAudio().paused) fadeTo(themeVolume, 1400);
}

// --- Der Synthesizer als Rückfall ---------------------------------------
// „Schwarzes Feuer": ein Marsch in d-moll. Blech aus Sägezähnen, ein Bass
// darunter, dazu ein Schlag auf die Zwei und Vier. Er läuft in Schleife,
// solange das Startbild steht.
const A = 440;
function note(name) {
  // Notenname wie 'd4' oder 'as4' in Hertz.
  const map = { c: -9, cs: -8, d: -7, ds: -6, e: -5, f: -4, fs: -3, g: -2, gs: -1, a: 0, as: 1, b: 2, h: 2 };
  const m = /^([a-h]s?)(\d)$/.exec(name);
  if (!m) return 440;
  const semi = map[m[1]] ?? 0;
  const octave = Number(m[2]);
  return A * Math.pow(2, (semi + (octave - 4) * 12) / 12);
}

// Die Melodie: Takt für Takt, jede Zeile ein Viertel.
const THEME = [
  // Aufschlag: die Konföderation startet
  ['d3', 'd4', 'a4'], null, ['d4', 'f4'], null,
  ['a3', 'a4', 'e5'], null, ['f4', 'a4'], null,
  ['g3', 'g4', 'd5'], null, ['as4', 'd5'], null,
  ['a3', 'a4', 'cs5'], null, ['e4', 'a4'], null,
  // Zweiter Teil: höher, drängender
  ['d3', 'd5', 'f5'], null, ['e5', 'g5'], null,
  ['f3', 'f5', 'a5'], null, ['g5', 'as5'], null,
  ['g3', 'd5', 'g5'], null, ['f5', 'a5'], null,
  ['a3', 'e5', 'a5'], ['a3'], ['d5', 'a5'], null,
];

function playChord(freqs, at, dur) {
  const c = ensure();
  if (!c || !musicOn) return;
  const t0 = c.currentTime + at;
  freqs.forEach((n, i) => {
    const f = note(n);
    const osc = c.createOscillator();
    const env = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = i === 0 ? 'sawtooth' : 'sawtooth';
    osc.frequency.value = f;
    osc.detune.value = (i - 1) * 6;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(i === 0 ? 600 : 2200, t0);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(i === 0 ? 0.26 : 0.14, t0 + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filter);
    filter.connect(env);
    env.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}

function playDrum(at, strong) {
  const c = ensure();
  if (!c || !musicOn) return;
  const t0 = c.currentTime + at;
  const len = Math.floor(c.sampleRate * (strong ? 0.22 : 0.12));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = strong ? 180 : 3200;
  filter.Q.value = strong ? 0.8 : 1.6;
  const env = c.createGain();
  env.gain.setValueAtTime(strong ? 0.3 : 0.14, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + (strong ? 0.22 : 0.12));
  src.connect(filter);
  filter.connect(env);
  env.connect(musicGain);
  src.start(t0);
  src.stop(t0 + 0.3);
}

const BEAT = 0.42;

// Gibt zurück, ob das Stück wirklich losgelaufen ist - das weiß erst das
// Versprechen aus `play()`, denn ein Browser darf jederzeit ablehnen.
export function startTheme() {
  if (!musicOn) return Promise.resolve(false);
  const el = themeAudio();
  if (el) {
    const promise = el.play();
    fadeTo(themeVolume, 1600);
    if (promise && promise.then) {
      return promise.then(() => true).catch(() => {
        try { el.pause(); } catch (err) { /* schon aus */ }
        return false;
      });
    }
    return Promise.resolve(!el.paused);
  }
  startSynthTheme();
  return Promise.resolve(isMusicAudible());
}

// Läuft gerade wirklich Musik? Beim Stück fragt man das Element, beim
// Synthesizer den Klangzustand - ein angehaltener Klangraum ist stumm,
// auch wenn der Takt zählt.
export function isMusicAudible() {
  if (!musicOn) return false;
  const el = themeAudio();
  if (el) return !el.paused && !el.ended;
  return !!themeTimer && !!ctx && ctx.state === 'running';
}

export function stopTheme() {
  const el = themeAudio();
  if (el) {
    fadeTo(0, 700, () => { try { el.pause(); } catch (err) { /* schon aus */ } });
  }
  stopSynthTheme();
}

export function isThemePlaying() {
  const el = themeAudio();
  if (el) return !el.paused;
  return !!themeTimer;
}

function startSynthTheme() {
  const c = ensure();
  if (!c || !musicOn || themeTimer) return;
  themeStep = 0;
  const tick = () => {
    if (!musicOn) { stopTheme(); return; }
    const chord = THEME[themeStep % THEME.length];
    if (chord) playChord(chord, 0, BEAT * 1.7);
    playDrum(0, themeStep % 4 === 0);
    if (themeStep % 4 === 2) playDrum(BEAT / 2, false);
    themeStep += 1;
  };
  tick();
  themeTimer = setInterval(tick, BEAT * 1000);
}

function stopSynthTheme() {
  if (themeTimer) clearInterval(themeTimer);
  themeTimer = null;
}

// Ein kurzer Fanfarenstoß beim Fraktionswechsel im Auswahlbildschirm - jede
// Flagge hat ihren eigenen Dreiklang.
const FANFARES = {
  confed: ['d4', 'a4', 'd5'],
  kilrathi: ['c4', 'ds4', 'as4'],
  borderworlds: ['e4', 'a4', 'cs5'],
  landreich: ['g3', 'd4', 'g4'],
  firekka: ['a4', 'e5', 'a5'],
  nephilim: ['as3', 'e4', 'gs4'],
  neutral: ['f4', 'a4', 'c5'],
};

export function playFanfare(factionId) {
  const chord = FANFARES[factionId] || FANFARES.neutral;
  chord.forEach((n, i) => tone({
    freq: note(n), type: 'sawtooth', dur: 0.5, gain: 0.16, at: i * 0.09,
  }));
}

// Für die Prüfung im Einstellungsfenster: klingt überhaupt etwas?
export function audioProbe() {
  const c = ensure();
  return {
    verfuegbar: !!c,
    zustand: c ? c.state : 'kein Audio',
    musik: musicOn,
    klang: sfxOn,
  };
}


// --- Musik ohne Zutun -----------------------------------------------------
// Browser lassen Ton erst nach einer Handlung des Nutzers zu. Damit trotzdem
// niemand erst einen Knopf suchen muss, wird der Klick hier selbst besorgt:
// ein ausgelöster Klick beim Start (den manche Browser gelten lassen), ein
// Pulsschlag, der es immer wieder versucht, und ein Netz aus Lauschern, das
// die allererste echte Handlung abfängt - Zeiger, Taste, Rad, Berührung.
let autostartTimer = null;
let autostartStop = null;

export function autostartMusic(isReady = () => true) {
  stopMusicAutostart();
  if (typeof window === 'undefined') return;
  const gestures = ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend', 'wheel'];
  let tries = 0;

  const done = () => {
    stopMusicAutostart();
  };

  const attempt = () => {
    if (!musicOn || !isReady()) return;
    if (isMusicAudible()) { done(); return; }
    unlockAudio();
    const p = startTheme();
    if (p && p.then) p.then((ok) => { if (ok) done(); });
  };

  const onGesture = () => { attempt(); };
  for (const name of gestures) {
    window.addEventListener(name, onGesture, { capture: true, passive: true });
  }
  autostartStop = () => {
    for (const name of gestures) window.removeEventListener(name, onGesture, { capture: true });
    autostartStop = null;
  };

  // Der Puls: alle drei Viertelsekunden ein neuer Versuch, zwei Minuten lang.
  // Kommt der Ton vorher, hört er von selbst auf zu klopfen.
  autostartTimer = setInterval(() => {
    tries += 1;
    attempt();
    if (tries > 160) { clearInterval(autostartTimer); autostartTimer = null; }
  }, 750);

  attempt();
  // Der Klick, den sonst der Nutzer machen müsste. Wo er zählt, läuft die
  // Musik sofort; wo nicht, kostet er nichts.
  try {
    const ev = new MouseEvent('click', { bubbles: false, cancelable: true, view: window });
    document.documentElement.dispatchEvent(ev);
  } catch (err) { /* dann eben nicht */ }
  attempt();
}

export function stopMusicAutostart() {
  if (autostartTimer) clearInterval(autostartTimer);
  autostartTimer = null;
  if (autostartStop) autostartStop();
}
