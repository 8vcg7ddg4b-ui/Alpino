// --- Einstellungen --------------------------------------------------------
// Was der Spieler dauerhaft festlegt. Alles liegt im Speicher des Browsers;
// ohne Speicher gelten die Vorgaben.
const KEY = 'blackunivers.settings.v1';

const DEFAULTS = {
  musik: true,
  klang: true,
  kiHaltung: 'normal',
  sternenstaub: true,
  bruecke: true,
  hilfslinien: true,
  flugtempo: 'normal',
  nebelnaehe: true,
};

export const AI_STANCE_VALUES = {
  zurueckhaltend: 0.7,
  normal: 1,
  aggressiv: 1.3,
  unbarmherzig: 1.6,
};

export const MARCH_SPEED_FACTORS = {
  langsam: 0.6,
  normal: 1,
  schnell: 1.8,
  sofort: 4,
};

let settings = { ...DEFAULTS };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    settings = { ...DEFAULTS };
  }
  return settings;
}

export function getSetting(name) {
  return settings[name];
}

export function setSetting(name, value) {
  settings[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (err) { /* Ohne Speicher gilt die Einstellung nur für diese Sitzung. */ }
  return value;
}

export function resetSettings() {
  settings = { ...DEFAULTS };
  try { localStorage.removeItem(KEY); } catch (err) { /* egal */ }
  return settings;
}

export function allSettings() {
  return { ...settings };
}

// Die Tafel im Menü: eine Zeile je Einstellung, mit Schaltern und Auswahl.
export function settingsHTML() {
  const row = (id, label, hint, control) => `
    <div class="set-row">
      <div class="set-text"><strong>${label}</strong><small>${hint}</small></div>
      <div class="set-ctrl">${control}</div>
    </div>`;
  const toggle = (id) => `<button class="set-toggle ${settings[id] ? 'on' : ''}" data-set="${id}"
    role="switch" aria-checked="${settings[id] ? 'true' : 'false'}"><span></span></button>`;
  const choice = (id, values) => `<div class="set-choice">${values.map((v) => `
    <button class="${settings[id] === v ? 'on' : ''}" data-set="${id}" data-value="${v}">${v}</button>`).join('')}</div>`;

  return `
    <div class="set-list">
      ${row('musik', 'Musik', '„Black Hull Directive" – im Startbild und im Feldzug', toggle('musik'))}
      ${row('klang', 'Klang', 'Funk, Triebwerke, Treffer', toggle('klang'))}
      ${row('bruecke', 'Brücke zeigen', 'Der Raum um den Holotisch. Aus: nur die Karte.', toggle('bruecke'))}
      ${row('sternenstaub', 'Sternenstaub', 'Der Hintergrund hinter der Karte', toggle('sternenstaub'))}
      ${row('hilfslinien', 'Hilfslinien', 'Raster, Reichweiten, Fluglinien', toggle('hilfslinien'))}
      ${row('nebelnaehe', 'Nebel verbirgt', 'Im Nebel sieht man nur, wer daneben steht', toggle('nebelnaehe'))}
      ${row('flugtempo', 'Flugtempo', 'Wie schnell Flotten über die Karte ziehen', choice('flugtempo', ['langsam', 'normal', 'schnell', 'sofort']))}
      ${row('kiHaltung', 'Haltung der Gegner', 'Wie scharf die anderen Reiche spielen', choice('kiHaltung', ['zurueckhaltend', 'normal', 'aggressiv', 'unbarmherzig']))}
    </div>
    <div class="set-foot"><button id="settingsReset" class="btn-ghost">Auf Vorgaben zurücksetzen</button></div>`;
}
