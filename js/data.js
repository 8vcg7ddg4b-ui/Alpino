// The grid comes from the geography, not the other way round: change the
// bounds or the tile size in geodata.js and everything here follows.
export { MAP_COLS, MAP_ROWS } from './geodata.js';

export const TILE_TYPES = {
  plains: { name: 'Ebene', cost: 1, defense: 0, elevation: 0, color: '#8fae5a', deco: null },
  forest: { name: 'Wald', cost: 2, defense: 1, elevation: 0.35, color: '#4c7a3f', deco: 'tree' },
  hills: { name: 'Hügel', cost: 2, defense: 2, elevation: 1, color: '#b3a06b', deco: null },
  desert: { name: 'Wüste', cost: 2, defense: 0, elevation: 0.08, color: '#d9c489', deco: null },
  mountain: {
    name: 'Gebirge', cost: 99, defense: 3, elevation: 2.6, color: '#8a8a8a',
    deco: 'peak', impassable: true,
  },
  // Impassable on foot; a fleet crosses it at the sea cost below.
  water: { name: 'Meer', cost: 99, defense: 0, elevation: -0.4, color: '#3f6fa8', deco: null, impassable: true },
};

export const UNIT_TYPES = {
  legionary: {
    key: 'legionary', name: 'Legionär', icon: '⚔️',
    attack: 6, defense: 9, hp: 100, cost: 100, upkeep: 0.05,
  },
  cavalry: {
    key: 'cavalry', name: 'Kavallerie', icon: '🐎',
    attack: 10, defense: 4, hp: 90, cost: 150, upkeep: 0.09,
  },
  archer: {
    key: 'archer', name: 'Bogenschütze', icon: '🏹',
    attack: 5, defense: 3, hp: 70, cost: 120, upkeep: 0.06, ranged: true,
  },
};

export const UNIT_ORDER = ['legionary', 'cavalry', 'archer'];

export const FACTIONS = [
  { id: 'rom', name: 'Rom', color: '#c0392b', isPlayer: true },
  { id: 'karthago', name: 'Karthago', color: '#2c3e8c', isPlayer: false },
  { id: 'gallier', name: 'Gallier', color: '#27632a', isPlayer: false },
  { id: 'griechen', name: 'Griechen', color: '#7a4fae', isPlayer: false },
  // The tribes field a great mass of foot: no siege train, few horse and
  // fewer bows, but more men in the line than anyone else brings.
  {
    id: 'germanen', name: 'Germanen', color: '#1c8f93', isPlayer: false,
    // Same manpower as anyone else, arranged the tribal way: a great mass of
    // foot, with horse and bows as an afterthought.
    startingArmy: { legionary: 360, cavalry: 100, archer: 80 },
    armyLabel: 'Heerhaufen',

  },
  { id: 'neutral', name: 'Unabhängig', color: '#7f7f7f', isPlayer: false, isNeutral: true },
];

// Three settlement sizes. Everything that scales with a settlement's standing -
// its people, the garrison it can raise and feed, its income and how large it
// is drawn on the map - comes from this table, so the tiers stay consistent.
export const SETTLEMENT_TIERS = {
  large: {
    key: 'large',
    label: 'Große Stadt',
    incomeFactor: 1.7,
    population: 5200,
    populationCapital: 6400,
    populationNeutral: 3600,
    modelScale: 1.35,
    garrison: { legionary: 220, cavalry: 60, archer: 90 },
    garrisonCapital: { legionary: 250, cavalry: 80, archer: 80 },
    garrisonNeutral: { legionary: 190, archer: 60 },
  },
  city: {
    key: 'city',
    label: 'Stadt',
    incomeFactor: 1,
    population: 3500,
    populationCapital: 6000,
    populationNeutral: 2000,
    modelScale: 1,
    garrison: { legionary: 150, archer: 80 },
    garrisonCapital: { legionary: 250, cavalry: 80, archer: 80 },
    garrisonNeutral: { legionary: 120 },
  },
  village: {
    key: 'village',
    label: 'Dorf',
    incomeFactor: 0.5,
    population: 1400,
    populationCapital: 2600,
    populationNeutral: 900,
    modelScale: 0.68,
    garrison: { legionary: 70 },
    garrisonCapital: { legionary: 140, archer: 40 },
    garrisonNeutral: { legionary: 45 },
  },
};

export const SETTLEMENT_ORDER = ['large', 'city', 'village'];
export const DEFAULT_SETTLEMENT_SIZE = 'city';

export function settlementTier(size) {
  return SETTLEMENT_TIERS[size] || SETTLEMENT_TIERS[DEFAULT_SETTLEMENT_SIZE];
}

// Settlements sit at the coordinates of the real towns; mapgen.js turns those
// into tiles. `size` picks a tier above; capitals are the seat of a faction
// and are fortified from the first turn.
export const CITY_DEFS = [
  // --- Rom: Italien -------------------------------------------------------
  { name: 'Roma', lon: 12.48, lat: 41.90, factionId: 'rom', capital: true, size: 'large' },
  { name: 'Capua', lon: 14.25, lat: 41.08, factionId: 'rom', capital: false, size: 'city' },
  { name: 'Arretium', lon: 11.88, lat: 43.46, factionId: 'rom', capital: false, size: 'city' },
  { name: 'Ravenna', lon: 12.20, lat: 44.42, factionId: 'rom', capital: false, size: 'village' },
  // --- Karthago: Nordafrika ----------------------------------------------
  { name: 'Karthago', lon: 10.32, lat: 36.85, factionId: 'karthago', capital: true, size: 'large' },
  { name: 'Hippo Regius', lon: 7.75, lat: 36.90, factionId: 'karthago', capital: false, size: 'city' },
  { name: 'Hadrumetum', lon: 10.64, lat: 35.83, factionId: 'karthago', capital: false, size: 'city' },
  { name: 'Cirta', lon: 6.61, lat: 36.37, factionId: 'karthago', capital: false, size: 'village' },
  { name: 'Tingis', lon: -5.81, lat: 35.78, factionId: 'karthago', capital: false, size: 'village' },
  { name: 'Leptis Magna', lon: 14.29, lat: 32.64, factionId: 'karthago', capital: false, size: 'village' },
  // --- Gallier ------------------------------------------------------------
  { name: 'Alesia', lon: 4.50, lat: 47.54, factionId: 'gallier', capital: true, size: 'large' },
  { name: 'Bibracte', lon: 4.03, lat: 46.75, factionId: 'gallier', capital: false, size: 'city' },
  { name: 'Lutetia', lon: 2.35, lat: 48.86, factionId: 'gallier', capital: false, size: 'city' },
  { name: 'Tolosa', lon: 1.44, lat: 43.60, factionId: 'gallier', capital: false, size: 'village' },
  { name: 'Burdigala', lon: -0.58, lat: 44.84, factionId: 'gallier', capital: false, size: 'village' },
  { name: 'Gesoriacum', lon: 1.61, lat: 50.73, factionId: 'gallier', capital: false, size: 'village' },
  // --- Griechen: Ägäis und Westkleinasien --------------------------------
  { name: 'Athen', lon: 23.73, lat: 37.98, factionId: 'griechen', capital: true, size: 'large' },
  { name: 'Sparta', lon: 22.43, lat: 37.07, factionId: 'griechen', capital: false, size: 'city' },
  { name: 'Pergamon', lon: 27.18, lat: 39.13, factionId: 'griechen', capital: false, size: 'city' },
  { name: 'Ephesos', lon: 27.34, lat: 37.94, factionId: 'griechen', capital: false, size: 'village' },
  { name: 'Rhodos', lon: 28.22, lat: 36.43, factionId: 'griechen', capital: false, size: 'village' },
  // --- Germanen: zwischen Rhein, Nordsee und Elbe ------------------------
  { name: 'Mattium', lon: 9.28, lat: 51.13, factionId: 'germanen', capital: true, size: 'large' },
  { name: 'Treva', lon: 9.99, lat: 53.55, factionId: 'germanen', capital: false, size: 'city' },
  { name: 'Asciburgium', lon: 6.63, lat: 51.45, factionId: 'germanen', capital: false, size: 'village' },
  { name: 'Calisia', lon: 18.08, lat: 51.76, factionId: 'germanen', capital: false, size: 'village' },
  { name: 'Amisia', lon: 7.20, lat: 53.35, factionId: 'germanen', capital: false, size: 'village' },
  // --- Unabhängig: Hispanien ---------------------------------------------
  { name: 'Gades', lon: -6.29, lat: 36.53, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Malaca', lon: -4.42, lat: 36.72, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Corduba', lon: -4.78, lat: 37.89, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Numantia', lon: -2.45, lat: 41.81, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Tarraco', lon: 1.25, lat: 41.12, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Olisipo', lon: -9.14, lat: 38.72, factionId: 'neutral', capital: false, size: 'village' },
  // --- Unabhängig: Gallien, Alpen, Italien -------------------------------
  { name: 'Massilia', lon: 5.37, lat: 43.30, factionId: 'neutral', capital: false, size: 'large' },
  { name: 'Argentorate', lon: 7.75, lat: 48.58, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Mediolanum', lon: 9.19, lat: 45.46, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Aquileia', lon: 13.37, lat: 45.77, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Tarentum', lon: 17.24, lat: 40.47, factionId: 'neutral', capital: false, size: 'village' },
  // --- Unabhängig: die Inseln --------------------------------------------
  { name: 'Syrakus', lon: 15.29, lat: 37.07, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Panormus', lon: 13.36, lat: 38.12, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Caralis', lon: 9.11, lat: 39.22, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Aleria', lon: 9.52, lat: 42.10, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Palma', lon: 2.65, lat: 39.57, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Knossos', lon: 25.16, lat: 35.30, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Salamis', lon: 33.90, lat: 35.18, factionId: 'neutral', capital: false, size: 'village' },
  // --- Unabhängig: Illyrien und die Donau --------------------------------
  { name: 'Salona', lon: 16.44, lat: 43.51, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Sirmium', lon: 19.61, lat: 44.97, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Vindobona', lon: 16.37, lat: 48.21, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Serdica', lon: 23.32, lat: 42.70, factionId: 'neutral', capital: false, size: 'village' },
  // --- Unabhängig: Makedonien, Thrakien, Osten ---------------------------
  { name: 'Thessalonike', lon: 22.94, lat: 40.64, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Byzantion', lon: 28.98, lat: 41.01, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Ankyra', lon: 32.86, lat: 39.93, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Antiochia', lon: 36.16, lat: 36.20, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Tyrus', lon: 35.20, lat: 33.27, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Hierosolyma', lon: 35.22, lat: 31.78, factionId: 'neutral', capital: false, size: 'city' },
  // --- Unabhängig: Ägypten, Kyrenaika, Schwarzes Meer --------------------
  { name: 'Kyrene', lon: 21.86, lat: 32.82, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Alexandria', lon: 29.92, lat: 31.20, factionId: 'neutral', capital: false, size: 'large' },
  { name: 'Olbia', lon: 31.90, lat: 46.63, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Chersonesos', lon: 33.49, lat: 44.61, factionId: 'neutral', capital: false, size: 'village' },
  // --- Unabhängig: Britannien --------------------------------------------
  { name: 'Londinium', lon: -0.13, lat: 51.51, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Eburacum', lon: -1.08, lat: 53.96, factionId: 'neutral', capital: false, size: 'village' },
];

// Morale and exhaustion scale a force's fighting power. Both are 0-100 and
// recover when an army rests, fastest inside a friendly city.
export const MORALE_MAX = 100;
export const MORALE_START = 85;
export const MORALE_AFTER_WIN = 12;
export const MORALE_AFTER_LOSS = -28;
export const MORALE_REST = 8;
export const MORALE_REST_IN_CITY = 16;
export const EXHAUSTION_PER_MOVE = 11;
export const EXHAUSTION_REST = -18;
export const EXHAUSTION_REST_IN_CITY = -34;
export const EXHAUSTION_PER_BATTLE = 18;
// Garrisons sit behind their own walls and are neither marched nor routed,
// so they fight at a fixed, solid standard.
export const GARRISON_MORALE = 90;
export const GARRISON_EXHAUSTION = 0;

// Fortifications are built up in three stages, each bought only once the one
// before it stands. Every stage multiplies the defenders' fighting power.
export const WALL_LEVELS = [
  {
    key: 'palisade', name: 'Holzpalisade', icon: '🪵',
    cost: 200, turns: 3, defence: 1.3,
    note: 'Ein Ring aus angespitzten Stämmen – schnell errichtet, gegen einen entschlossenen Sturm aber wenig.',
  },
  {
    key: 'greatPalisade', name: 'Große Holzpalisade', icon: '🪓',
    cost: 450, turns: 4, defence: 1.6,
    note: 'Doppelte Wand mit Wehrgang und hölzernen Türmen.',
  },
  {
    key: 'stone', name: 'Steinmauer', icon: '🧱',
    cost: 900, turns: 6, defence: 2.0,
    note: 'Quadermauer mit Rundtürmen – ohne Belagerung kaum zu nehmen.',
  },
];

export const MAX_WALL_LEVEL = WALL_LEVELS.length;
// Capitals are fortified from the first turn, but not to the last stage:
// there is still something left for their owner to build.
export const CAPITAL_WALL_LEVEL = 2;

// Level 0 is an open town; 1..3 index into WALL_LEVELS.
export function wallLevelInfo(level) {
  return level >= 1 && level <= WALL_LEVELS.length ? WALL_LEVELS[level - 1] : null;
}

export function wallLevelName(level) {
  const info = wallLevelInfo(level);
  return info ? info.name : 'keine Befestigung';
}

export function wallDefenceMultiplier(level) {
  const info = wallLevelInfo(level);
  return info ? info.defence : 1;
}

export const MAX_MOVEMENT = 9;

// --- Seefahrt -------------------------------------------------------------
// An army takes ship in one of its own coastal settlements. At sea it travels
// further than on foot, but it fights badly: rowing benches are no battle
// line, and troops wading ashore meet a prepared enemy.
export const SHIP_COST = 250;
export const NAVAL_MOVEMENT = 15;
export const SEA_MOVE_COST = 1;
export const EXHAUSTION_PER_SEA_MOVE = 5;
// Attacking straight off the ships.
export const AMPHIBIOUS_ATTACK_MULTIPLIER = 0.7;
// Being caught on the water with no room to form up.
export const SEA_DEFENCE_MULTIPLIER = 0.75;

// How many times a battle is played through for the forecast. Enough for a
// stable percentage, cheap enough to run on every click.
export const BATTLE_PREVIEW_SAMPLES = 60;

export const STARTING_GOLD = 500;
export const INCOME_PER_CITY = 40;
// One garrison soldier is supportable per this many inhabitants, before a
// faction's own levy tradition is taken into account.
export const GARRISON_POP_RATIO = 8;

export function factionGarrisonFactor(faction) {
  return (faction && faction.garrisonFactor) || 1;
}

// How large a garrison a settlement can hold and feed.
export function garrisonCapacity(city, faction) {
  return Math.floor((city.population / GARRISON_POP_RATIO) * factionGarrisonFactor(faction));
}
export const RECRUIT_BATCH = 100;
export const GARRISON_REGEN_BATCH = 15;
