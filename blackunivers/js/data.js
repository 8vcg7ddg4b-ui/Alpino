// --- Die Zahlen des Spiels ------------------------------------------------
// Alles, was gilt, bevor die erste Flotte fliegt: Fraktionen, Schiffsklassen,
// Sternsysteme, Ausbauten, Schilde, Technik. Wer eine Regel sucht, sucht sie
// hier; die anderen Dateien rechnen nur damit.
import { colOfX, rowOfY } from './starchart.js';

export const GAME_NAME = 'Black Univers';
export const GAME_VERSION = '1.0.0';

// Der Feldzug beginnt im Jahr der Schlacht von McAuliffe: 2654. Ein Zug ist
// ein Monat, zwölf Züge ein Jahr.
export const START_YEAR = 2654;
export const TURNS_PER_YEAR = 12;
export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function calendarOfTurn(turn) {
  const t = Math.max(1, turn) - 1;
  return {
    year: START_YEAR + Math.floor(t / TURNS_PER_YEAR),
    month: MONTH_NAMES[t % TURNS_PER_YEAR],
    monthIndex: t % TURNS_PER_YEAR,
  };
}

export const STARTING_CREDITS = 2600;
export const MAX_MOVEMENT = 5;
export const MORALE_START = 62;
export const MORALE_MAX = 100;
export const DEFAULT_PLAYER_FACTION = 'confed';

// --- Fraktionen -----------------------------------------------------------
// `kind` entscheidet, welche Schiffe eine Fraktion baut: terranische Werften
// bauen anders als die Klanwerften von Kilrah, und der Nephilim-Schwarm baut
// überhaupt nicht, er wächst.
export const FACTIONS = [
  {
    id: 'confed',
    name: 'Terranische Konföderation',
    short: 'Konföderation',
    adjective: 'terranisch',
    kind: 'terran',
    color: '#5b8fd6',
    colorDark: '#1f3c66',
    accent: '#cfe2ff',
    emblem: 'confed',
    fleetPrefix: 'Konföderations',
    homeSystem: 'Sol',
    doctrine: 'Träger und Trägerstaffeln. Die Konföderation gewinnt Räume, '
      + 'indem sie Flugdecks vorschiebt.',
    strength: 'Träger sind billiger, Jäger starten mit mehr Erfahrung.',
  },
  {
    id: 'kilrathi',
    name: 'Kilrathi-Imperium',
    short: 'Imperium',
    adjective: 'kilrathisch',
    kind: 'kilrathi',
    color: '#c8503a',
    colorDark: '#5a1c12',
    accent: '#ffd8a8',
    emblem: 'kilrathi',
    fleetPrefix: 'Klan',
    homeSystem: 'Kilrah',
    doctrine: 'Der Klan sucht das Gefecht. Angriff ist Ehre, Verteidigung ist '
      + 'Aufschub.',
    strength: 'Jäger und Klauenkrieger schlagen härter, Rückzug kostet Moral.',
  },
  {
    id: 'borderworlds',
    name: 'Union der Grenzwelten',
    short: 'Grenzwelten',
    adjective: 'grenzweltlich',
    kind: 'terran',
    color: '#3fa88f',
    colorDark: '#12463c',
    accent: '#cdf3e9',
    emblem: 'borderworlds',
    fleetPrefix: 'Unions',
    homeSystem: 'Tyr',
    doctrine: 'Wer wenig hat, fliegt weiter. Zusammengeflickte Staffeln, die '
      + 'jeden Sprungpunkt kennen.',
    strength: 'Mehr Bewegung, geringere Unterhaltskosten.',
  },
  {
    id: 'landreich',
    name: 'Freie Republik Landreich',
    short: 'Landreich',
    adjective: 'landreichisch',
    kind: 'terran',
    color: '#d0a636',
    colorDark: '#5c4410',
    accent: '#ffeeb8',
    emblem: 'landreich',
    fleetPrefix: 'Republik',
    homeSystem: 'Landreich',
    doctrine: 'Kaperfahrt als Staatsform. Was der Republik fehlt, nimmt sie '
      + 'sich beim Imperium.',
    strength: 'Beute aus Gefechten und erobertem Raum fällt höher aus.',
  },
  {
    id: 'firekka',
    name: 'Firekkanische Konföderation',
    short: 'Firekka',
    adjective: 'firekkanisch',
    kind: 'firekkan',
    color: '#a674d4',
    colorDark: '#3d2159',
    accent: '#eddcff',
    emblem: 'firekka',
    fleetPrefix: 'Nest',
    homeSystem: 'Firekka',
    doctrine: 'Das Nest verteidigt sich in der Höhe. Leichte Schwingen, viele '
      + 'davon, und keine Furcht vor dem Sturz.',
    strength: 'Sehr billige Jäger, starke Planetenverteidigung.',
  },
  {
    id: 'nephilim',
    name: 'Nephilim-Schwarm',
    short: 'Schwarm',
    adjective: 'nephilisch',
    kind: 'nephilim',
    color: '#3ec9b0',
    colorDark: '#0d4a44',
    accent: '#d3fff7',
    emblem: 'nephilim',
    fleetPrefix: 'Schwarm',
    homeSystem: null,
    isInvader: true,
    doctrine: 'Der Schwarm handelt nicht. Er kommt durch das Tor und frisst '
      + 'den Raum.',
    strength: 'Nicht spielbar. Er kommt von allein.',
  },
  {
    id: 'neutral',
    name: 'Unabhängige Welten',
    short: 'Unabhängige',
    adjective: 'unabhängig',
    kind: 'terran',
    color: '#8b93a1',
    colorDark: '#2f343c',
    accent: '#e3e7ee',
    emblem: 'neutral',
    fleetPrefix: 'Freihandels',
    homeSystem: null,
    isNeutral: true,
    doctrine: 'Konzerne, Freihäfen und Bergbaugilden. Sie kämpfen nicht, sie '
      + 'rechnen.',
    strength: '',
  },
];

export function playableFactions() {
  return FACTIONS.filter((f) => !f.isNeutral && !f.isInvader);
}
export function factionProfile(id) {
  return FACTIONS.find((f) => f.id === id) || FACTIONS[FACTIONS.length - 1];
}
export function factionKind(id) {
  return factionProfile(id).kind;
}

// --- Der Raum selbst ------------------------------------------------------
export const TILE_TYPES = {
  VOID: 'leere',
  NEBULA: 'nebel',
  ASTEROIDS: 'asteroiden',
  RADIATION: 'strahlung',
  RIFT: 'graben',
};

export const TILE_LABELS = {
  leere: 'Offener Raum',
  nebel: 'Nebelbank',
  asteroiden: 'Asteroidenfeld',
  strahlung: 'Strahlungszone',
  graben: 'Gravitationsgraben',
};

// Der Graben ist die eine Sorte Feld, durch die kein Sprung geht.
export function tileImpassable(type) {
  return type === TILE_TYPES.RIFT;
}

export function tileMoveCost(type) {
  switch (type) {
    case TILE_TYPES.NEBULA: return 2;
    case TILE_TYPES.ASTEROIDS: return 3;
    case TILE_TYPES.RADIATION: return 2;
    default: return 1;
  }
}

// Nebel verbirgt: was tiefer als das hier steckt, sieht man aus der Ferne
// nicht mehr, sondern erst, wenn man daneben steht.
export const NEBULA_HIDES = true;
export const SENSOR_RANGE = 6;
export const SENSOR_RANGE_NEBULA = 2;
// Wer im Asteroidenfeld oder in der Strahlung steht, verliert Maschinen.
export const HAZARD_ATTRITION = { asteroiden: 3, strahlung: 4 };

// --- Rollen und Schiffsklassen -------------------------------------------
// Die Rollen sind ein Kreis: Jäger fangen Bomber, Bomber knacken
// Großkampfschiffe, Großkampfschiffe zerfetzen Jäger. Träger tragen keine
// Waffe, die zählt - sie machen die Jäger daneben stärker.
export const ROLE_JAEGER = 'jaeger';
export const ROLE_BOMBER = 'bomber';
export const ROLE_KORVETTE = 'korvette';
export const ROLE_KREUZER = 'kreuzer';
export const ROLE_TRAEGER = 'traeger';
export const ROLE_MARINES = 'marines';
export const WATCH_ROLE = 'wache';

export const UNIT_ROLES = [
  ROLE_JAEGER, ROLE_BOMBER, ROLE_KORVETTE, ROLE_KREUZER, ROLE_TRAEGER, ROLE_MARINES,
];

export const ROLE_LABELS = {
  jaeger: 'Jägerstaffel',
  bomber: 'Bomberstaffel',
  korvette: 'Korvette',
  kreuzer: 'Kreuzer',
  traeger: 'Träger',
  marines: 'Landungstruppen',
  wache: 'Planetenwache',
};

export const ROLE_SHORT = {
  jaeger: 'Jäger', bomber: 'Bomber', korvette: 'Korvette',
  kreuzer: 'Kreuzer', traeger: 'Träger', marines: 'Truppen', wache: 'Wache',
};

// Wer schlägt wen. Der Faktor gilt für den Angreifer der Zeile gegen den
// Verteidiger der Spalte.
export const ROLE_MATCHUP = {
  jaeger: { jaeger: 1, bomber: 1.6, korvette: 0.9, kreuzer: 0.5, traeger: 1.2, marines: 1.4, wache: 0.8 },
  bomber: { jaeger: 0.6, bomber: 1, korvette: 1.5, kreuzer: 1.8, traeger: 1.7, marines: 1.1, wache: 1.2 },
  korvette: { jaeger: 1.3, bomber: 1.1, korvette: 1, kreuzer: 0.7, traeger: 1.3, marines: 1.2, wache: 1 },
  kreuzer: { jaeger: 1.5, bomber: 1.2, korvette: 1.4, kreuzer: 1, traeger: 1.5, marines: 1.3, wache: 1.2 },
  traeger: { jaeger: 0.4, bomber: 0.4, korvette: 0.5, kreuzer: 0.4, traeger: 0.5, marines: 0.5, wache: 0.4 },
  marines: { jaeger: 0.3, bomber: 0.4, korvette: 0.5, kreuzer: 0.5, traeger: 0.8, marines: 1, wache: 1.8 },
  wache: { jaeger: 1.1, bomber: 1.2, korvette: 0.9, kreuzer: 0.6, traeger: 1, marines: 1.6, wache: 1 },
};

// Die Grundwerte einer Rolle. `staffel` ist die Zahl der Maschinen oder
// Schiffe, aus denen ein Verband besteht; sie schmilzt im Gefecht.
const ROLE_BASE = {
  jaeger: { cost: 260, time: 2, attack: 9, armour: 6, staffel: 12, upkeep: 22 },
  bomber: { cost: 340, time: 3, attack: 13, armour: 7, staffel: 8, upkeep: 30 },
  korvette: { cost: 420, time: 3, attack: 16, armour: 14, staffel: 3, upkeep: 38 },
  kreuzer: { cost: 720, time: 5, attack: 26, armour: 26, staffel: 2, upkeep: 62 },
  traeger: { cost: 1150, time: 7, attack: 10, armour: 34, staffel: 1, upkeep: 96 },
  marines: { cost: 300, time: 2, attack: 7, armour: 9, staffel: 6, upkeep: 24 },
  wache: { cost: 0, time: 0, attack: 8, armour: 10, staffel: 10, upkeep: 0 },
};

// Die Namen sind das, was eine Fraktion von der anderen unterscheidet, ehe
// man ihre Zahlen kennt.
const SHIP_NAMES = {
  terran: {
    jaeger: 'Rapier-Staffel', bomber: 'Broadsword-Staffel',
    korvette: 'Gilgamesch-Korvette', kreuzer: 'Tallahassee-Kreuzer',
    traeger: 'Bengal-Träger', marines: 'Marineinfanterie', wache: 'Planetenwache',
  },
  kilrathi: {
    jaeger: 'Dralthi-Schwarm', bomber: 'Paktahn-Bomber',
    korvette: 'Kamekh-Korvette', kreuzer: 'Fralthi-Kreuzer',
    traeger: 'Snakeir-Träger', marines: 'Klauenkrieger', wache: 'Klanwache',
  },
  firekkan: {
    jaeger: 'Firekka-Schwingen', bomber: 'Feuerspeer-Bomber',
    korvette: 'Nestkorvette', kreuzer: 'Klippenkreuzer',
    traeger: 'Hortträger', marines: 'Krallenschar', wache: 'Nestwache',
  },
  nephilim: {
    jaeger: 'Moray-Schwarm', bomber: 'Manta-Brut',
    korvette: 'Squid-Korvette', kreuzer: 'Kraken-Kreuzer',
    traeger: 'Leviathan', marines: 'Brutkrieger', wache: 'Brutwache',
  },
};

// Fraktionseigene Namen, wo die Werft eine eigene Sprache spricht.
const NAME_OVERRIDES = {
  borderworlds: {
    jaeger: 'Banshee-Staffel', bomber: 'Avenger-Staffel',
    korvette: 'Kormoran-Korvette', kreuzer: 'Plunkett-Kreuzer',
    traeger: 'Grenzwelt-Träger', marines: 'Grenzmiliz', wache: 'Bürgerwehr',
  },
  landreich: {
    jaeger: 'Sabre-Staffel', bomber: 'Longbow-Staffel',
    korvette: 'Kaperkorvette', kreuzer: 'Kruger-Kreuzer',
    traeger: 'Karl-der-Große-Träger', marines: 'Freikorps', wache: 'Hafenwache',
  },
};

// Was eine Fraktion baut. Die Rollenwerte sind für alle gleich; was sich
// unterscheidet, sind die Aufschläge der Doktrin - und die Namen.
const FACTION_MODS = {
  confed: { traeger: { cost: 0.85 }, jaeger: { attack: 1.05 } },
  kilrathi: { jaeger: { attack: 1.15 }, marines: { attack: 1.2 }, kreuzer: { armour: 0.95 } },
  borderworlds: { jaeger: { upkeep: 0.8 }, korvette: { upkeep: 0.8 }, bomber: { upkeep: 0.8 } },
  landreich: { korvette: { attack: 1.1 }, jaeger: { cost: 0.92 } },
  firekka: { jaeger: { cost: 0.7, attack: 0.9 }, wache: { attack: 1.4 }, kreuzer: { cost: 1.15 } },
  nephilim: { jaeger: { attack: 1.1, cost: 0.8 }, kreuzer: { armour: 1.2 } },
  neutral: {},
};

export function unitDefs(factionId) {
  const kind = factionKind(factionId);
  const names = { ...SHIP_NAMES[kind], ...(NAME_OVERRIDES[factionId] || {}) };
  const mods = FACTION_MODS[factionId] || {};
  const out = {};
  for (const role of [...UNIT_ROLES, WATCH_ROLE]) {
    const base = ROLE_BASE[role];
    const m = mods[role] || {};
    out[role] = {
      role,
      name: names[role],
      label: ROLE_LABELS[role],
      cost: Math.round(base.cost * (m.cost || 1)),
      time: base.time,
      attack: Math.round(base.attack * (m.attack || 1) * 10) / 10,
      armour: Math.round(base.armour * (m.armour || 1) * 10) / 10,
      staffel: base.staffel,
      upkeep: Math.round(base.upkeep * (m.upkeep || 1)),
    };
  }
  return out;
}

export function unitDef(factionId, role) {
  return unitDefs(factionId)[role];
}

export function shipName(factionId, role) {
  const kind = factionKind(factionId);
  const names = { ...SHIP_NAMES[kind], ...(NAME_OVERRIDES[factionId] || {}) };
  return names[role] || ROLE_LABELS[role];
}

// Erfahrung wird in Balken auf dem Staffelwappen gezeigt: aus Neulingen
// werden Veteranen, aus Veteranen Asse.
export function experienceStars(exp) {
  return Math.max(0, Math.min(3, Math.floor((exp || 0) / 34)));
}
export const EXPERIENCE_LABELS = ['Neulinge', 'Erfahren', 'Veteranen', 'Asse'];
export function experienceLabel(exp) {
  return EXPERIENCE_LABELS[experienceStars(exp)];
}

// Nur Werften bauen Großes. Ohne Orbitalwerft gibt es Jäger, Bomber und
// Truppen - Kreuzer und Träger brauchen den Ring über dem Planeten.
export const ROLE_REQUIRES = {
  korvette: { building: 'werft', level: 1 },
  kreuzer: { building: 'werft', level: 2 },
  traeger: { building: 'werft', level: 3 },
};

// --- Sternsysteme ---------------------------------------------------------
// Die Systeme liegen an ihren Chartkoordinaten, so wie die Städte in Pax
// Aeterna an ihren Längen- und Breitengraden liegen: Sol liegt im Westen,
// Kilrah im Osten, und dazwischen liegt der Krieg. `size` läuft von 1
// (Außenposten) bis 5 (Hauptwelt).
export const SYSTEM_DEFS = [
  // Sol-Sektor - das Herz der Konföderation
  { name: 'Sol', x: 6, y: 28, factionId: 'confed', capital: true, size: 5, world: 'Terra' },
  { name: 'Proxima', x: 11, y: 31, factionId: 'confed', size: 3 },
  { name: 'Sirius', x: 9, y: 21, factionId: 'confed', size: 3 },
  { name: 'Zentauri', x: 14, y: 26, factionId: 'confed', size: 3 },
  { name: 'Speradon', x: 18, y: 33, factionId: 'confed', size: 3 },
  { name: 'Torgo', x: 21, y: 24, factionId: 'confed', size: 2 },
  { name: 'Tartarus', x: 25, y: 31, factionId: 'confed', size: 2 },
  // Vega-Sektor - wo der Krieg 2654 beginnt
  { name: 'Vega', x: 27, y: 22, factionId: 'confed', size: 4 },
  { name: 'McAuliffe', x: 24, y: 18, factionId: 'confed', size: 2 },
  { name: 'Enyo', x: 30, y: 26, factionId: 'confed', size: 2 },
  { name: 'Brimstone', x: 33, y: 29, factionId: 'confed', size: 2 },
  { name: 'Rostov', x: 31, y: 16, factionId: 'neutral', size: 2 },
  { name: 'Venedig', x: 28, y: 33, factionId: 'neutral', size: 2 },
  { name: 'Port Hedland', x: 36, y: 18, factionId: 'confed', size: 2 },
  { name: 'Kurasawa', x: 39, y: 21, factionId: 'confed', size: 3 },
  { name: 'Ayers Rock', x: 42, y: 24, factionId: 'neutral', size: 1 },
  // Enigma-Sektor
  { name: 'Olympus', x: 50, y: 19, factionId: 'confed', size: 3 },
  { name: 'Enigma', x: 57, y: 13, factionId: 'confed', size: 3 },
  { name: 'Novaya Kiew', x: 54, y: 24, factionId: 'confed', size: 2 },
  { name: 'Tanhauser', x: 60, y: 17, factionId: 'kilrathi', size: 2 },
  { name: 'Delius', x: 49, y: 9, factionId: 'confed', size: 2 },
  { name: 'Loki', x: 45, y: 6, factionId: 'kilrathi', size: 2 },
  { name: 'Hyperion', x: 66, y: 13, factionId: 'kilrathi', size: 2 },
  // Firekka-Rand
  { name: 'Firekka', x: 40, y: 4, factionId: 'firekka', capital: true, size: 3 },
  { name: 'Ku’kara', x: 44, y: 2, factionId: 'firekka', size: 2 },
  { name: 'Freya', x: 37, y: 8, factionId: 'firekka', size: 2 },
  { name: 'Alcor', x: 31, y: 6, factionId: 'neutral', size: 2 },
  // Grenzwelten
  { name: 'Locanda', x: 44, y: 28, factionId: 'confed', size: 3 },
  { name: 'Tamayo', x: 47, y: 32, factionId: 'borderworlds', size: 2 },
  { name: 'Orsini', x: 41, y: 34, factionId: 'borderworlds', size: 2 },
  { name: 'Tyr', x: 52, y: 36, factionId: 'borderworlds', capital: true, size: 3 },
  { name: 'Circe', x: 47, y: 38, factionId: 'borderworlds', size: 2 },
  { name: 'Masa', x: 56, y: 33, factionId: 'borderworlds', size: 2 },
  { name: 'Silenos', x: 59, y: 40, factionId: 'borderworlds', size: 2 },
  { name: 'Hellespont', x: 62, y: 35, factionId: 'neutral', size: 2 },
  { name: 'Niwen', x: 63, y: 29, factionId: 'neutral', size: 2 },
  { name: 'Tesla', x: 58, y: 28, factionId: 'neutral', size: 2 },
  { name: 'Blackmane', x: 65, y: 26, factionId: 'confed', size: 2 },
  // Kilrah-Sektor - der Klanraum
  { name: 'Kilrah', x: 94, y: 6, factionId: 'kilrathi', capital: true, size: 5, world: 'Kilrah' },
  { name: 'Sar Hariti', x: 97, y: 12, factionId: 'kilrathi', size: 2 },
  { name: 'N’Tanya', x: 88, y: 14, factionId: 'kilrathi', size: 2 },
  { name: 'H’hrass', x: 91, y: 19, factionId: 'kilrathi', size: 2 },
  { name: 'Hari', x: 82, y: 7, factionId: 'kilrathi', size: 2 },
  { name: 'Vukar Tag', x: 79, y: 13, factionId: 'kilrathi', size: 4 },
  { name: 'Baka Kar', x: 85, y: 22, factionId: 'kilrathi', size: 4 },
  { name: 'K’tithrak Mang', x: 71, y: 9, factionId: 'kilrathi', size: 4 },
  { name: 'Pasqual', x: 74, y: 21, factionId: 'kilrathi', size: 2 },
  { name: 'Ghorah Khar', x: 65, y: 21, factionId: 'kilrathi', size: 3 },
  { name: 'Ariel', x: 69, y: 17, factionId: 'kilrathi', size: 2 },
  { name: 'Ras Nik’hra', x: 77, y: 5, factionId: 'kilrathi', size: 2 },
  { name: 'Kabla Meth', x: 89, y: 27, factionId: 'kilrathi', size: 2 },
  // Landreich
  { name: 'Landreich', x: 84, y: 44, factionId: 'landreich', capital: true, size: 3 },
  { name: 'Höllenloch', x: 76, y: 38, factionId: 'landreich', size: 2 },
  { name: 'Oecumene', x: 88, y: 49, factionId: 'landreich', size: 2 },
  { name: 'Krugers Ankerplatz', x: 80, y: 49, factionId: 'landreich', size: 2 },
  { name: 'Tiamat', x: 71, y: 45, factionId: 'neutral', size: 1 },
  // Gemini-Sektor - Freihäfen, Gilden und Schmuggler
  { name: 'New Detroit', x: 22, y: 44, factionId: 'neutral', size: 3 },
  { name: 'Troja', x: 14, y: 42, factionId: 'neutral', size: 2 },
  { name: 'Perry', x: 18, y: 50, factionId: 'neutral', size: 2 },
  { name: 'Oxford', x: 26, y: 48, factionId: 'neutral', size: 2 },
  { name: 'Palan', x: 31, y: 52, factionId: 'neutral', size: 2 },
  { name: 'Junction', x: 20, y: 46, factionId: 'neutral', size: 1 },
  { name: 'Basque', x: 11, y: 49, factionId: 'neutral', size: 2 },
  { name: 'Nitir', x: 34, y: 48, factionId: 'neutral', size: 2 },
  { name: 'Xytani', x: 7, y: 45, factionId: 'neutral', size: 1 },
  { name: 'Caliban', x: 38, y: 43, factionId: 'neutral', size: 2 },
];

// Wie groß ein System ist, entscheidet, was es tragen kann: Menschen,
// Steuern, Werften. Der Rang wächst mit der Bevölkerung.
export const SIZE_TIERS = [
  { size: 1, label: 'Außenposten', population: 4, populationCapital: 8, populationNeutral: 3, income: 9, watch: 4, buildSlots: 1 },
  { size: 2, label: 'Kolonie', population: 22, populationCapital: 34, populationNeutral: 16, income: 19, watch: 8, buildSlots: 2 },
  { size: 3, label: 'Randwelt', population: 70, populationCapital: 105, populationNeutral: 52, income: 34, watch: 14, buildSlots: 3 },
  { size: 4, label: 'Kernwelt', population: 240, populationCapital: 320, populationNeutral: 180, income: 56, watch: 22, buildSlots: 4 },
  { size: 5, label: 'Hauptwelt', population: 620, populationCapital: 820, populationNeutral: 400, income: 84, watch: 32, buildSlots: 5 },
];

export function sizeTier(size) {
  return SIZE_TIERS.find((t) => t.size === Math.max(1, Math.min(5, size || 2)));
}
export const DEFAULT_SYSTEM_SIZE = 2;

// Die Planetenwache wächst mit der Bevölkerung, nicht mit dem Willen des
// Spielers: eine Hauptwelt hat immer Männer auf den Geschützen.
export function watchTarget(system, faction) {
  const tier = sizeTier(system.size);
  const base = tier.watch;
  const bonus = faction && faction.isNeutral ? 0 : 2;
  return Math.max(2, base + bonus + (system.capital ? 6 : 0));
}

// --- Planetenschilde (die Mauern dieser Karte) ---------------------------
export const SHIELD_LEVELS = [
  { level: 0, name: 'ohne Schild', bonus: 1, cost: 0, time: 0 },
  { level: 1, name: 'Deflektornetz', bonus: 1.25, cost: 420, time: 3 },
  { level: 2, name: 'Planetenschild', bonus: 1.6, cost: 900, time: 5 },
  { level: 3, name: 'Kampfschild', bonus: 2.1, cost: 1600, time: 7 },
  { level: 4, name: 'Zitadellenschild', bonus: 2.8, cost: 2600, time: 9 },
];
export const MAX_SHIELD_LEVEL = 4;
export function shieldInfo(level) {
  return SHIELD_LEVELS[Math.max(0, Math.min(MAX_SHIELD_LEVEL, level || 0))];
}
export function startingShieldLevel(def) {
  if (def.capital) return 3;
  if (def.size >= 4) return 2;
  if (def.size >= 3) return 1;
  return 0;
}
// Ohne Landungstruppen nimmt niemand eine Welt mit stehendem Schild. Die
// Bomber drücken ihn herunter, die Truppen gehen hinein.
export const SHIELD_BREAK_PER_BOMBER = 0.22;

// --- Ausbauten ------------------------------------------------------------
export const BUILDING_DEFS = {
  werft: {
    id: 'werft', name: 'Orbitalwerft', maxLevel: 3,
    levels: [
      { cost: 700, time: 4, note: 'Korvetten' },
      { cost: 1400, time: 6, note: 'Kreuzer' },
      { cost: 2400, time: 8, note: 'Träger' },
    ],
    desc: 'Ein Ring über dem Planeten. Stufe für Stufe kommen größere Kiele hinein.',
  },
  bergbau: {
    id: 'bergbau', name: 'Bergbauring', maxLevel: 3,
    levels: [
      { cost: 500, time: 3, note: '+60 Kredits' },
      { cost: 950, time: 4, note: '+130 Kredits' },
      { cost: 1700, time: 6, note: '+220 Kredits' },
    ],
    desc: 'Erz aus den Monden und dem Gürtel. Zahlt jeden Zug.',
    income: [18, 40, 70],
  },
  handel: {
    id: 'handel', name: 'Handelsstation', maxLevel: 2,
    levels: [
      { cost: 560, time: 3, note: 'Handelsrouten' },
      { cost: 1100, time: 5, note: 'doppelter Ertrag' },
    ],
    desc: 'Docks für Frachter. Erst mit ihr trägt eine Handelsroute etwas ein.',
  },
  sensor: {
    id: 'sensor', name: 'Sensorphalanx', maxLevel: 2,
    levels: [
      { cost: 400, time: 2, note: '+3 Sicht' },
      { cost: 800, time: 4, note: '+6 Sicht' },
    ],
    desc: 'Horcht in den Nebel. Wer sie hat, sieht die Flotte kommen.',
    sight: [3, 6],
  },
  geschuetz: {
    id: 'geschuetz', name: 'Geschützplattformen', maxLevel: 3,
    levels: [
      { cost: 450, time: 3, note: '+25% Verteidigung' },
      { cost: 900, time: 4, note: '+50%' },
      { cost: 1500, time: 6, note: '+80%' },
    ],
    desc: 'Schwere Türme im Orbit. Sie fliegen nicht, aber sie treffen.',
    defence: [0.25, 0.5, 0.8],
  },
  akademie: {
    id: 'akademie', name: 'Flugakademie', maxLevel: 2,
    levels: [
      { cost: 620, time: 4, note: 'neue Staffeln erfahren' },
      { cost: 1300, time: 6, note: 'neue Staffeln veteran' },
    ],
    desc: 'Simulatoren und Ausbilder. Was hier startet, startet nicht als Neuling.',
    experience: [34, 68],
  },
  terraformer: {
    id: 'terraformer', name: 'Terraformer', maxLevel: 2,
    levels: [
      { cost: 800, time: 5, note: 'schnelleres Wachstum' },
      { cost: 1600, time: 7, note: 'Aufstieg im Rang' },
    ],
    desc: 'Atmosphäre, Wasser, Böden. Aus einem Außenposten wird eine Welt.',
    growth: [1.6, 2.4],
  },
};

export const BUILDING_ORDER = ['werft', 'bergbau', 'handel', 'sensor', 'geschuetz', 'akademie', 'terraformer'];

export function buildingDef(id) {
  return BUILDING_DEFS[id];
}
export function buildingName(id) {
  const d = BUILDING_DEFS[id];
  return d ? d.name : id;
}
export function buildingLevelInfo(id, level) {
  const d = BUILDING_DEFS[id];
  if (!d) return null;
  return d.levels[Math.max(0, Math.min(d.levels.length - 1, (level || 0)))];
}

// --- Technik --------------------------------------------------------------
// Drei Linien, vier Stufen. Forschung kostet Kredits und einen Zug Geduld;
// sie gilt für das ganze Reich, nicht für ein System.
export const TECH_LINES = {
  triebwerke: {
    id: 'triebwerke', name: 'Triebwerke', icon: 'engine',
    desc: 'Sprungrechner und Schubdüsen. Jede Stufe gibt allen Flotten mehr Bewegung.',
    steps: [
      { cost: 700, note: '+1 Bewegung' },
      { cost: 1500, note: '+2 Bewegung' },
      { cost: 2800, note: '+3 Bewegung, Sprungpunkte kostenlos' },
    ],
  },
  waffen: {
    id: 'waffen', name: 'Waffen', icon: 'gun',
    desc: 'Massentreiber, Neutronenkanonen, Torpedos. Jede Stufe erhöht den Angriff.',
    steps: [
      { cost: 800, note: '+10% Angriff' },
      { cost: 1700, note: '+22% Angriff' },
      { cost: 3000, note: '+36% Angriff' },
    ],
  },
  schilde: {
    id: 'schilde', name: 'Schilde', icon: 'shield',
    desc: 'Phasenschilde und Panzerplatten. Jede Stufe erhöht die Panzerung.',
    steps: [
      { cost: 800, note: '+10% Panzerung' },
      { cost: 1700, note: '+22% Panzerung' },
      { cost: 3000, note: '+36% Panzerung' },
    ],
  },
};
export const TECH_ORDER = ['triebwerke', 'waffen', 'schilde'];
export const MAX_TECH_LEVEL = 3;

export function techStep(lineId, level) {
  const line = TECH_LINES[lineId];
  if (!line) return null;
  return line.steps[Math.max(0, Math.min(line.steps.length - 1, level))];
}
export function techAttackBonus(level) {
  return [0, 0.1, 0.22, 0.36][Math.max(0, Math.min(3, level || 0))];
}
export function techArmourBonus(level) {
  return [0, 0.1, 0.22, 0.36][Math.max(0, Math.min(3, level || 0))];
}
export function techMoveBonus(level) {
  return [0, 1, 2, 3][Math.max(0, Math.min(3, level || 0))];
}

// --- Große Werke ----------------------------------------------------------
// Sie liegen fest auf der Karte und gehören dem, der das System hält.
export const GREAT_WORKS = [
  { id: 'sprungtor', system: 'Sol', name: 'Das Sprungtor von Sol', effect: 'Alle eigenen Flotten bewegen sich einen Punkt weiter.', icon: 'gate' },
  { id: 'werften', system: 'Vega', name: 'Die Werften von Vega', effect: 'Bauzeiten sinken um ein Viertel.', icon: 'yard' },
  { id: 'basar', system: 'New Detroit', name: 'Der Große Basar', effect: '+70 Kredits je Zug.', icon: 'market' },
  { id: 'klauenhalle', system: 'Kilrah', name: 'Die Klauenhalle', effect: 'Eigene Verbände greifen 15% stärker an.', icon: 'claw' },
  { id: 'nesthort', system: 'Firekka', name: 'Der Nesthort', effect: 'Moral steigt schneller, Verluste treffen weniger.', icon: 'nest' },
  { id: 'horchposten', system: 'Enigma', name: 'Der Horchposten Enigma', effect: 'Sicht +4 im ganzen Reich.', icon: 'ear' },
];

// --- Handel ---------------------------------------------------------------
export const TRADE_GOODS = [
  'Titan', 'Deuterium', 'Pharmazeutika', 'Wasser', 'Getreide', 'Erz',
  'Luxusgüter', 'Bauholz', 'Brennstoffzellen', 'Handelswaren',
];
export const TRADE_ROUTE_BASE = 22;
export const TRADE_ROUTE_MAX = 4;

// --- Sieg -----------------------------------------------------------------
// Wie in Pax Aeterna: der kurze Sieg über die feindliche Hauptwelt, der lange
// über die Zahl der Systeme.
export const VICTORY_SYSTEMS = 28;
export const RIVAL_OF = {
  confed: 'kilrathi',
  kilrathi: 'confed',
  borderworlds: 'confed',
  landreich: 'kilrathi',
  firekka: 'kilrathi',
};

// Sonstige Stellschrauben, die mehrere Dateien brauchen.
export const CREDITS_PER_POPULATION = 0.06;
export const UPKEEP_FREE_UNITS = 6;
// Der Grundhaushalt: Steuern, Anleihen, Kriegskredite. Auch ein Reich mit
// drei Welten hat eine Kasse.
export const BASE_INCOME = 90;
export const BLOCKADE_INCOME_LOSS = 0.6;
export const SIEGE_ATTRITION = 4;
export const PIRATE_SPAWN_CHANCE = 0.16;
export const NEPHILIM_FIRST_TURN = 60;
export const REINFORCE_COST_FACTOR = 0.45;
export const JUMP_POINT_COST = 1;
export const DEFAULT_TACTIC = { angriff: 'zange', verteidigung: 'schildwall' };

// Die Schlachtordnungen: sie verschieben, was eine Rolle im Gefecht wert ist.
export const TACTICS = {
  zange: { id: 'zange', name: 'Zangenangriff', kind: 'angriff', desc: 'Jäger umfassen, Bomber stoßen durch die Mitte.', mods: { jaeger: 1.2, bomber: 1.15, kreuzer: 0.9 } },
  keil: { id: 'keil', name: 'Panzerkeil', kind: 'angriff', desc: 'Großkampfschiffe voran, alles andere im Windschatten.', mods: { kreuzer: 1.3, korvette: 1.15, jaeger: 0.85 } },
  schwarm: { id: 'schwarm', name: 'Schwarmangriff', kind: 'angriff', desc: 'Alles gleichzeitig, ohne Ordnung. Viel Verlust, viel Wirkung.', mods: { jaeger: 1.35, bomber: 1.1, traeger: 0.7 } },
  torpedolauf: { id: 'torpedolauf', name: 'Torpedolauf', kind: 'angriff', desc: 'Bomber zuerst; die Jäger halten nur die Abfangjäger fern.', mods: { bomber: 1.45, jaeger: 0.9, marines: 1.1 } },
  schildwall: { id: 'schildwall', name: 'Schildwall', kind: 'verteidigung', desc: 'Enge Formation um die Träger. Nichts kommt durch.', mods: { kreuzer: 1.2, traeger: 1.4, jaeger: 1.05 } },
  jagdschirm: { id: 'jagdschirm', name: 'Jagdschirm', kind: 'verteidigung', desc: 'Jäger weit vorn, Bomber werden abgefangen.', mods: { jaeger: 1.3, bomber: 0.9 } },
  minengang: { id: 'minengang', name: 'Minengang', kind: 'verteidigung', desc: 'Rückzug ins Trümmerfeld; der Angreifer verliert Maschinen.', mods: { korvette: 1.2, jaeger: 1.1 }, hazard: 0.12 },
  hinterhalt: { id: 'hinterhalt', name: 'Nebelhinterhalt', kind: 'verteidigung', desc: 'Aus der Bank heraus, erst schießen, dann sehen.', mods: { jaeger: 1.25, bomber: 1.2 }, needsNebula: true },
};
export const ATTACK_TACTICS = ['zange', 'keil', 'schwarm', 'torpedolauf'];
export const DEFENCE_TACTICS = ['schildwall', 'jagdschirm', 'minengang', 'hinterhalt'];

// Die Systemliste als Nachschlagewerk mit Feldkoordinaten.
export const SYSTEM_TILES = SYSTEM_DEFS.map((def) => ({
  ...def,
  col: colOfX(def.x),
  row: rowOfY(def.y),
}));

export function systemDefByName(name) {
  return SYSTEM_TILES.find((s) => s.name === name) || null;
}
