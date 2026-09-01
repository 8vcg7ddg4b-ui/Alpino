// Spieleinstellungen: was der Spieler festlegen darf, wie es gespeichert wird
// und wie das Einstellungsfenster daraus entsteht.
//
// Jede Einstellung hier tut auch wirklich etwas - es gibt keinen Schalter, der
// nur gut aussieht. Der Ton steht mit im Fenster, wird aber weiter von
// audio.js verwaltet, damit es dafür nur eine Wahrheit gibt.

const SETTINGS_STORAGE_KEY = 'spqr.settings';

export const SETTINGS = [
  {
    key: 'battlePreview',
    label: 'Kampfvorschau vor dem Angriff',
    help: 'Zeigt Siegchance und erwartete Verluste, bevor der Angriff ausgeführt wird.',
    type: 'toggle',
    fallback: true,
  },
  {
    key: 'battleView',
    label: 'Schlacht in 3D verfolgen',
    help: 'Ein eigenes Fenster zeigt den Verlauf der Schlacht. Der Ausgang steht '
      + 'vorher fest und ändert sich dadurch nicht.',
    type: 'choice',
    options: [['fragen', 'jedes Mal fragen'], ['immer', 'immer zusehen'], ['nie', 'nie']],
    fallback: 'fragen',
  },
  {
    key: 'marchSpeed',
    label: 'Marschgeschwindigkeit',
    help: 'Wie schnell Armeen über die Karte ziehen.',
    type: 'choice',
    options: [['normal', 'normal'], ['fast', 'schnell'], ['off', 'ohne Animation']],
    fallback: 'normal',
  },
  {
    key: 'startMapMode',
    label: 'Karte beim Spielstart',
    help: 'Mit 🗺 lässt sich jederzeit umschalten.',
    type: 'choice',
    options: [['terrain', 'Gelände'], ['tactical', 'Taktisch']],
    fallback: 'terrain',
  },
  {
    key: 'aiStance',
    label: 'Verhalten der Gegner',
    help: 'Wie günstig ein Kampf ausgehen muss, damit die KI ihn überhaupt eingeht.',
    type: 'choice',
    options: [['cautious', 'vorsichtig'], ['balanced', 'ausgewogen'], ['bold', 'draufgängerisch']],
    fallback: 'balanced',
  },
  {
    key: 'weatherEffects',
    label: 'Wettereffekte anzeigen',
    help: 'Regen, Schnee und Sandsturm auf der Karte. Die Regeln gelten in jedem Fall.',
    type: 'toggle',
    fallback: true,
  },
  {
    key: 'wildlife',
    label: 'Leben auf der Karte',
    help: 'Fischschwärme und Wale im Meer, Möwen über der Küste, Rotwild an den '
      + 'Waldrändern. Auf die Regeln hat es keinen Einfluss; wer eine ruhige Karte '
      + 'will, schaltet es ab.',
    type: 'toggle',
    fallback: true,
  },
  {
    key: 'music',
    label: 'Titelmusik',
    help: 'Das Stück im Startbildschirm und bei der Fraktionswahl. Auf der Karte bleibt es still.',
    type: 'toggle',
    fallback: true,
  },
  {
    key: 'chronicle',
    label: 'Bilder der Chronik wechseln',
    help: 'Die Chronik der Republik im Hauptmenü läuft von selbst weiter; sonst blättert man mit ‹ ›.',
    type: 'toggle',
    fallback: true,
  },
];

const SETTING_DEFAULTS = Object.fromEntries(SETTINGS.map((s) => [s.key, s.fallback]));
let settingValues = { ...SETTING_DEFAULTS };

// Storage throws in a private window and in some embedded views, and a game
// that cannot remember a preference should still start.
function readStored() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeStored() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingValues));
  } catch (err) { /* nothing to do about it, and nothing depends on it */ }
}

export function loadSettings() {
  const stored = readStored();
  if (stored) {
    for (const setting of SETTINGS) {
      const value = stored[setting.key];
      const valid = setting.type === 'toggle'
        ? typeof value === 'boolean'
        : setting.options.some(([key]) => key === value);
      if (valid) settingValues[setting.key] = value;
    }
  }
  return settingValues;
}

export function getSetting(key) {
  return settingValues[key];
}

export function setSetting(key, value) {
  settingValues[key] = value;
  writeStored();
  return value;
}

export function resetSettings() {
  settingValues = { ...SETTING_DEFAULTS };
  writeStored();
  return settingValues;
}

// How much of a march is actually animated. Zero means the army simply stands
// where it arrived.
export const MARCH_SPEED_FACTORS = { normal: 1, fast: 2.2, off: 0 };

// How sure of winning the AI has to be before it will fight at all.
export const AI_STANCE_THRESHOLDS = { cautious: 0.68, balanced: 0.5, bold: 0.34 };

function escapeSetting(text) {
  return String(text).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

// One row per setting, plus the sound row the caller supplies the state for.
export function settingsHTML(soundOn) {
  const rows = SETTINGS.map((setting) => {
    const value = settingValues[setting.key];
    const control = setting.type === 'toggle'
      ? `<button class="set-toggle ${value ? 'on' : 'off'}" data-key="${setting.key}"
          role="switch" aria-checked="${value}">
          <span class="set-knob"></span><span class="set-state">${value ? 'an' : 'aus'}</span>
        </button>`
      : `<div class="set-choice" role="radiogroup" aria-label="${escapeSetting(setting.label)}">${
        setting.options.map(([key, label]) => `<button data-key="${setting.key}" data-value="${key}"
            class="${key === value ? 'active' : ''}" role="radio"
            aria-checked="${key === value}">${escapeSetting(label)}</button>`).join('')}</div>`;
    return `<div class="set-row">
      <div class="set-label">${escapeSetting(setting.label)}
        <small>${escapeSetting(setting.help)}</small></div>
      ${control}
    </div>`;
  }).join('');

  return `
    <h2 class="report-title">Einstellungen</h2>
    <div class="set-list">
      <div class="set-row">
        <div class="set-label">Ton<small>Marsch, Schlacht, Rekrutierung, Musik – alles zur Laufzeit erzeugt.</small></div>
        <button class="set-toggle ${soundOn ? 'on' : 'off'}" data-key="sound"
          role="switch" aria-checked="${soundOn}">
          <span class="set-knob"></span><span class="set-state">${soundOn ? 'an' : 'aus'}</span>
        </button>
      </div>
      ${rows}
    </div>
    <div class="set-actions">
      <button id="settingsReset" class="set-reset">Auf Standard zurücksetzen</button>
    </div>`;
}
