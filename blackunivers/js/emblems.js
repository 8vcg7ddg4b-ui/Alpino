// --- Wappen ---------------------------------------------------------------
// Jede Fraktion hat ein Zeichen. Es steht im Auswahlbildschirm, im HUD, auf
// den Fahnen der Brücke und an den Flotten auf der Karte - gezeichnet, nicht
// als Bilddatei, damit es in jeder Größe scharf bleibt.
export function emblemSVG(id, { size = 64, color = '#cfe2ff', dark = '#0a1220' } = {}) {
  const body = EMBLEMS[id] || EMBLEMS.neutral;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `<g fill="none" stroke="${color}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">`
    + body(color, dark)
    + '</g></svg>';
}

const EMBLEMS = {
  // Konföderation: die geteilten Schwingen über dem Stern - das Zeichen der
  // terranischen Flotte.
  confed: (c) => `
    <path d="M50 16 L50 84" />
    <path d="M50 30 C34 26 22 34 14 46 C26 44 38 46 50 52" fill="${c}" fill-opacity="0.18" />
    <path d="M50 30 C66 26 78 34 86 46 C74 44 62 46 50 52" fill="${c}" fill-opacity="0.18" />
    <path d="M50 58 L40 78 L50 72 L60 78 Z" fill="${c}" fill-opacity="0.35" />
    <circle cx="50" cy="24" r="5" fill="${c}" fill-opacity="0.5" />`,
  // Kilrathi: die Klaue im Ring, das Sigil des Klans von Kilrah.
  kilrathi: (c) => `
    <circle cx="50" cy="50" r="33" />
    <path d="M30 30 C40 44 44 56 42 74" />
    <path d="M44 26 C54 42 58 56 56 76" />
    <path d="M58 28 C68 44 71 56 68 72" />
    <path d="M26 62 C38 68 56 72 74 66" stroke-opacity="0.7" />`,
  // Grenzwelten: der offene Ring mit dem Stern darin - eine Union ohne Mitte.
  borderworlds: (c) => `
    <path d="M50 14 A36 36 0 1 1 20 68" />
    <path d="M50 32 L56 46 L71 47 L59 56 L64 71 L50 62 L36 71 L41 56 L29 47 L44 46 Z"
      fill="${c}" fill-opacity="0.22" />`,
  // Landreich: Anker und Schwert gekreuzt, dazu die freie Krone.
  landreich: (c) => `
    <path d="M50 22 L50 78" />
    <path d="M32 40 L68 40" />
    <path d="M30 60 C36 76 64 76 70 60" />
    <path d="M50 78 L44 70 L56 70 Z" fill="${c}" fill-opacity="0.4" />
    <path d="M38 26 L50 16 L62 26" />`,
  // Firekka: die aufsteigende Schwinge über dem Nest.
  firekka: (c) => `
    <path d="M20 62 C34 40 44 30 50 20 C56 30 66 40 80 62" />
    <path d="M28 62 C38 52 44 46 50 36 C56 46 62 52 72 62" stroke-opacity="0.65" />
    <path d="M30 74 C40 68 60 68 70 74" />
    <circle cx="50" cy="76" r="4" fill="${c}" fill-opacity="0.5" />`,
  // Nephilim: der Schwarm als konzentrische Ringe mit Ranken.
  nephilim: (c) => `
    <circle cx="50" cy="50" r="12" fill="${c}" fill-opacity="0.25" />
    <circle cx="50" cy="50" r="24" stroke-opacity="0.75" />
    <path d="M50 26 C58 34 58 42 50 50 C42 42 42 34 50 26" />
    <path d="M74 50 C66 58 58 58 50 50 C58 42 66 42 74 50" />
    <path d="M50 74 C42 66 42 58 50 50 C58 58 58 66 50 74" />
    <path d="M26 50 C34 42 42 42 50 50 C42 58 34 58 26 50" />`,
  // Unabhängige: Waage und Frachtkiste - sie rechnen, sie kämpfen nicht.
  neutral: (c) => `
    <path d="M50 22 L50 34" />
    <path d="M28 34 L72 34" />
    <path d="M28 34 L20 52 L36 52 Z" fill="${c}" fill-opacity="0.2" />
    <path d="M72 34 L64 52 L80 52 Z" fill="${c}" fill-opacity="0.2" />
    <rect x="38" y="56" width="24" height="20" rx="2" fill="${c}" fill-opacity="0.15" />`,
};

// Kleine Zeichen für Menü und Schaltflächen: dieselbe Handschrift, weniger
// Striche.
export function iconSVG(name, { size = 22, color = 'currentColor' } = {}) {
  const body = ICONS[name] || ICONS.dot;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" `
    + `stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" `
    + 'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
}

const ICONS = {
  dot: '<circle cx="12" cy="12" r="3" />',
  fleet: '<path d="M4 16 L12 4 L20 16 L12 12 Z" /><path d="M8 19 L12 17 L16 19" />',
  system: '<circle cx="12" cy="12" r="5" /><ellipse cx="12" cy="12" rx="10" ry="3.6" />',
  shield: '<path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z" />',
  yard: '<rect x="4" y="9" width="16" height="10" rx="1" /><path d="M8 9 V5 H16 V9" /><path d="M4 14 H20" />',
  tech: '<circle cx="12" cy="12" r="3" /><path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22 M5 5 L8 8 M16 16 L19 19 M19 5 L16 8 M8 16 L5 19" />',
  diplomacy: '<path d="M7 10 C7 6 17 6 17 10 C17 14 7 14 7 10 Z" /><path d="M5 20 C7 16 17 16 19 20" />',
  chronicle: '<path d="M6 4 H16 A2 2 0 0 1 18 6 V20 H8 A2 2 0 0 1 6 18 Z" /><path d="M9 8 H15 M9 12 H15 M9 16 H13" />',
  turn: '<path d="M4 12 A8 8 0 1 1 12 20" /><path d="M4 8 V12 H8" />',
  credits: '<circle cx="12" cy="12" r="8" /><path d="M9 9 H15 M9 12 H15 M12 9 V16" />',
  jump: '<path d="M4 12 H10 M14 12 H20" /><circle cx="12" cy="12" r="2.5" /><path d="M12 5 V8 M12 16 V19" />',
  siege: '<circle cx="12" cy="12" r="4" /><path d="M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22" stroke-dasharray="2 2" />',
  gear: '<circle cx="12" cy="12" r="3.2" /><path d="M12 3 L13.4 5.6 L16.4 5 L16 8 L18.6 9.4 L16.6 11.6 L18.6 14 L16 15.4 L16.4 18.4 L13.4 17.8 L12 20.4 L10.6 17.8 L7.6 18.4 L8 15.4 L5.4 14 L7.4 11.6 L5.4 9.4 L8 8 L7.6 5 L10.6 5.6 Z" />',
  play: '<path d="M8 5 L19 12 L8 19 Z" />',
  book: '<path d="M4 5 C7 3 11 3 12 5 C13 3 17 3 20 5 V19 C17 17 13 17 12 19 C11 17 7 17 4 19 Z" />',
  star: '<path d="M12 4 L14.4 9.6 L20.4 10.2 L15.8 14 L17.2 20 L12 16.8 L6.8 20 L8.2 14 L3.6 10.2 L9.6 9.6 Z" />',
  eye: '<path d="M2 12 C5 7 9 5 12 5 C15 5 19 7 22 12 C19 17 15 19 12 19 C9 19 5 17 2 12 Z" /><circle cx="12" cy="12" r="3" />',
  target: '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1 V4 M12 20 V23 M1 12 H4 M20 12 H23" />',
};
