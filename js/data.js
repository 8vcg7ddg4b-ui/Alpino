export const MAP_COLS = 16;
export const MAP_ROWS = 12;

export const TILE_TYPES = {
  plains: { cost: 1, defense: 0, elevation: 0, color: '#8fae5a', deco: null },
  forest: { cost: 2, defense: 1, elevation: 0.35, color: '#4c7a3f', deco: '🌲' },
  hills: { cost: 2, defense: 2, elevation: 1, color: '#b3a06b', deco: '⛰️' },
  mountain: { cost: 99, defense: 3, elevation: 2.4, color: '#8a8a8a', deco: '🗻', impassable: true },
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
  { id: 'neutral', name: 'Unabhängig', color: '#7f7f7f', isPlayer: false, isNeutral: true },
];

export const CITY_DEFS = [
  { name: 'Roma', col: 2, row: 9, factionId: 'rom', capital: true },
  { name: 'Capua', col: 4, row: 10, factionId: 'rom', capital: false },
  { name: 'Karthago', col: 13, row: 2, factionId: 'karthago', capital: true },
  { name: 'Utica', col: 12, row: 4, factionId: 'karthago', capital: false },
  { name: 'Alesia', col: 2, row: 2, factionId: 'gallier', capital: true },
  { name: 'Bibracte', col: 4, row: 3, factionId: 'gallier', capital: false },
  { name: 'Massilia', col: 8, row: 6, factionId: 'neutral', capital: false },
];

export const MAX_MOVEMENT = 5;
export const STARTING_GOLD = 500;
export const INCOME_PER_CITY = 40;
// One garrison soldier is supportable per this many inhabitants.
export const GARRISON_POP_RATIO = 8;
export const RECRUIT_BATCH = 100;
export const GARRISON_REGEN_BATCH = 15;
