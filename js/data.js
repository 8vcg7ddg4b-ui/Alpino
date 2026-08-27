export const MAP_COLS = 44;
export const MAP_ROWS = 28;

export const TILE_TYPES = {
  plains: { cost: 1, defense: 0, elevation: 0, color: '#8fae5a', deco: null },
  forest: { cost: 2, defense: 1, elevation: 0.35, color: '#4c7a3f', deco: 'tree' },
  hills: { cost: 2, defense: 2, elevation: 1, color: '#b3a06b', deco: null },
  mountain: { cost: 99, defense: 3, elevation: 2.6, color: '#8a8a8a', deco: 'peak', impassable: true },
  // Impassable on foot; a fleet crosses it at the sea cost below.
  water: { cost: 99, defense: 0, elevation: -0.4, color: '#3f6fa8', deco: null, impassable: true },
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
    // Every free man is a warrior: Germanic settlements raise and sustain a
    // far larger levy than a city that relies on a professional army.
    garrisonFactor: 1.2,
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

// Coordinates are hand-placed on the Europe/Mediterranean landmass built by
// mapgen.js. `size` picks the tier above; capitals are the seat of a faction
// and are fortified from the first turn.
export const CITY_DEFS = [
  { name: 'Roma', col: 22, row: 17, factionId: 'rom', capital: true, size: 'large' },
  { name: 'Capua', col: 21, row: 20, factionId: 'rom', capital: false, size: 'city' },
  { name: 'Arretium', col: 24, row: 15, factionId: 'rom', capital: false, size: 'city' },
  { name: 'Karthago', col: 16, row: 25, factionId: 'karthago', capital: true, size: 'large' },
  { name: 'Utica', col: 12, row: 25, factionId: 'karthago', capital: false, size: 'city' },
  { name: 'Tingis', col: 6, row: 25, factionId: 'karthago', capital: false, size: 'city' },
  { name: 'Leptis Magna', col: 25, row: 25, factionId: 'karthago', capital: false, size: 'village' },
  { name: 'Alesia', col: 10, row: 3, factionId: 'gallier', capital: true, size: 'large' },
  { name: 'Bibracte', col: 10, row: 6, factionId: 'gallier', capital: false, size: 'city' },
  { name: 'Lutetia', col: 6, row: 1, factionId: 'gallier', capital: false, size: 'city' },
  { name: 'Tolosa', col: 6, row: 7, factionId: 'gallier', capital: false, size: 'village' },
  { name: 'Athen', col: 33, row: 19, factionId: 'griechen', capital: true, size: 'large' },
  { name: 'Sparta', col: 34, row: 15, factionId: 'griechen', capital: false, size: 'city' },
  { name: 'Pergamon', col: 36, row: 13, factionId: 'griechen', capital: false, size: 'city' },
  { name: 'Ephesos', col: 38, row: 11, factionId: 'griechen', capital: false, size: 'village' },
  // Germania: the wide northern mainland east of Gaul, beyond the Alps.
  { name: 'Mattium', col: 23, row: 2, factionId: 'germanen', capital: true, size: 'large' },
  { name: 'Treva', col: 19, row: 1, factionId: 'germanen', capital: false, size: 'city' },
  { name: 'Asciburgium', col: 26, row: 3, factionId: 'germanen', capital: false, size: 'village' },
  { name: 'Aliso', col: 20, row: 3, factionId: 'germanen', capital: false, size: 'village' },
  { name: 'Massilia', col: 19, row: 9, factionId: 'neutral', capital: false, size: 'large' },
  { name: 'Syrakus', col: 22, row: 24, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Numantia', col: 8, row: 15, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Corduba', col: 10, row: 17, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Gades', col: 7, row: 19, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Vindobona', col: 30, row: 2, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Argentorate', col: 14, row: 4, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Carnuntum', col: 27, row: 1, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Kyrene', col: 30, row: 25, factionId: 'neutral', capital: false, size: 'village' },
  // Island settlements: only reachable by sea, which is what fleets are for.
  { name: 'Caralis', col: 19, row: 15, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Rhodos', col: 37, row: 19, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Knossos', col: 36, row: 23, factionId: 'neutral', capital: false, size: 'village' },
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

export const WALL_COST = 350;
export const WALL_BUILD_TURNS = 5;
// Completed walls multiply the defenders' defensive power.
export const WALL_DEFENCE_MULTIPLIER = 1.6;

export const MAX_MOVEMENT = 6;

// --- Seefahrt -------------------------------------------------------------
// An army takes ship in one of its own coastal settlements. At sea it travels
// further than on foot, but it fights badly: rowing benches are no battle
// line, and troops wading ashore meet a prepared enemy.
export const SHIP_COST = 250;
export const NAVAL_MOVEMENT = 10;
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
