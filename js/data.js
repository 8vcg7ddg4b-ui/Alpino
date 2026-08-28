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

// Drei Waffengattungen, überall dieselben - damit bleiben die Regeln ein
// einziger Satz. Was sich unterscheidet, ist, wer sie füllt: die römische
// Legion ist nicht der dakische Falxträger, auch wenn beide "Fußvolk" sind.
export const UNIT_ROLES = ['infantry', 'cavalry', 'ranged'];

export const ROLE_LABELS = {
  infantry: 'Fußvolk',
  cavalry: 'Reiterei',
  ranged: 'Fernkampf',
  watch: 'Stadtwache',
  ships: 'Kriegsschiffe',
};

// Die Stadtwache ist keine Feldtruppe: sie wird nicht ausgehoben, sie zieht
// nicht mit, sie steht. Jede Siedlung hat sie von sich aus, und sie wächst
// mit der Bevölkerung nach. Deshalb steht sie neben den drei Waffengattungen
// und nicht unter ihnen.
export const WATCH_ROLE = 'watch';
export const GARRISON_ROLES = [...UNIT_ROLES, WATCH_ROLE];

// Kriegsschiffe sind die vierte Truppengattung, und die einzige, die nur zur
// See etwas ausrichtet: sie werden in einer Hafenstadt gebaut, stehen nie in
// einer Garnison und gehen nie an Land.
export const SHIP_ROLE = 'ships';
// Alles, was in einer Schlacht vorkommen kann - Feldtruppen, Stadtwache,
// Schiffe. Die Kampfrechnung geht über diese Liste.
export const COMBAT_ROLES = [...GARRISON_ROLES, SHIP_ROLE];

// Eine Schiffsbesatzung samt Rammsporn: zur See stark, an Land nichts, weshalb
// eine Flotte auch nie einen Fuß dorthin setzt.
// Gezählt werden Schiffe, nicht Männer: ein Rammsporn wiegt eine ganze
// Abteilung auf, deshalb stehen die Werte je Schiff so hoch.
export const SHIP_UNIT = {
  name: 'Kriegsschiffe', icon: '⛵', attack: 46, defense: 48, hp: 700,
  cost: 200, upkeep: 0.5,
};

// Auf der Mauer taugt sie, im offenen Feld wäre sie nichts - was sie nie ist.
export const WATCH_UNIT = {
  name: 'Stadtwache', icon: '🛡️', attack: 3, defense: 8, hp: 88, cost: 0, upkeep: 0,
};

// Ein Wächter je so vielen Einwohnern - die Sollstärke, auf die eine Wache
// nachwächst.
export const WATCH_POP_RATIO = 16;
// So viele Mann stellt eine Stadt je Runde nach: langsam genug, dass eine
// gestürmte Stadt nicht in zwei Runden wieder voll ist.
export const WATCH_GROWTH_MIN = 4;
export const WATCH_GROWTH_SHARE = 0.05;

export function watchTarget(city, faction) {
  const levy = factionGarrisonFactor(faction);
  return Math.round((city.population / WATCH_POP_RATIO) * levy);
}

export function watchGrowth(target) {
  return Math.max(WATCH_GROWTH_MIN, Math.round(target * WATCH_GROWTH_SHARE));
}

// attack   Angriffskraft je Mann
// defense  Verteidigungskraft je Mann
// hp       wie viel ein Mann aushält
// cost     Rekrutierungskosten je Trupp
// upkeep   Sold je Mann und Runde
export const FACTION_UNITS = {
  rom: {
    infantry: { name: 'Legionär', icon: '⚔️', attack: 6, defense: 10, hp: 105, cost: 110, upkeep: 0.055 },
    cavalry: { name: 'Equites', icon: '🐎', attack: 9, defense: 4, hp: 90, cost: 150, upkeep: 0.09 },
    ranged: { name: 'Veliten', icon: '🏹', attack: 5, defense: 3, hp: 70, cost: 115, upkeep: 0.06, ranged: true },
  },
  karthago: {
    infantry: { name: 'Libysche Speerträger', icon: '⚔️', attack: 6, defense: 9, hp: 100, cost: 100, upkeep: 0.05 },
    cavalry: { name: 'Numidische Reiter', icon: '🐎', attack: 11, defense: 3, hp: 85, cost: 145, upkeep: 0.09 },
    ranged: { name: 'Balearische Schleuderer', icon: '🪨', attack: 6, defense: 3, hp: 70, cost: 125, upkeep: 0.065, ranged: true },
  },
  gallier: {
    infantry: { name: 'Schwertkämpfer', icon: '🗡️', attack: 8, defense: 7, hp: 105, cost: 105, upkeep: 0.055 },
    cavalry: { name: 'Edle Reiter', icon: '🐎', attack: 10, defense: 4, hp: 90, cost: 150, upkeep: 0.09 },
    ranged: { name: 'Bogenschützen', icon: '🏹', attack: 4, defense: 3, hp: 70, cost: 105, upkeep: 0.05, ranged: true },
  },
  griechen: {
    infantry: { name: 'Hopliten', icon: '🛡️', attack: 5, defense: 12, hp: 100, cost: 115, upkeep: 0.06 },
    cavalry: { name: 'Thessalische Reiter', icon: '🐎', attack: 9, defense: 5, hp: 90, cost: 150, upkeep: 0.09 },
    ranged: { name: 'Peltasten', icon: '🏹', attack: 5, defense: 4, hp: 75, cost: 120, upkeep: 0.06, ranged: true },
  },
  germanen: {
    infantry: { name: 'Speerträger', icon: '⚔️', attack: 7, defense: 8, hp: 105, cost: 95, upkeep: 0.05 },
    cavalry: { name: 'Gefolgschaftsreiter', icon: '🐎', attack: 9, defense: 4, hp: 90, cost: 145, upkeep: 0.085 },
    ranged: { name: 'Wurfspeerträger', icon: '🎯', attack: 5, defense: 3, hp: 70, cost: 105, upkeep: 0.05, ranged: true },
  },
  britannier: {
    infantry: { name: 'Keltenkrieger', icon: '⚔️', attack: 7, defense: 8, hp: 100, cost: 100, upkeep: 0.05 },
    cavalry: { name: 'Streitwagen', icon: '🛞', attack: 12, defense: 4, hp: 95, cost: 165, upkeep: 0.1 },
    ranged: { name: 'Schleuderer', icon: '🪨', attack: 5, defense: 3, hp: 70, cost: 110, upkeep: 0.055, ranged: true },
  },
  iberer: {
    infantry: { name: 'Scutarii', icon: '⚔️', attack: 6, defense: 9, hp: 100, cost: 100, upkeep: 0.05 },
    cavalry: { name: 'Iberische Reiter', icon: '🐎', attack: 10, defense: 4, hp: 90, cost: 150, upkeep: 0.09 },
    ranged: { name: 'Caetrati', icon: '🎯', attack: 6, defense: 4, hp: 72, cost: 125, upkeep: 0.065, ranged: true },
  },
  daker: {
    infantry: { name: 'Falxträger', icon: '🪓', attack: 9, defense: 6, hp: 100, cost: 110, upkeep: 0.06 },
    cavalry: { name: 'Dakische Adelsreiter', icon: '🐎', attack: 10, defense: 6, hp: 95, cost: 165, upkeep: 0.095 },
    ranged: { name: 'Dakische Bogenschützen', icon: '🏹', attack: 5, defense: 3, hp: 70, cost: 110, upkeep: 0.055, ranged: true },
  },
  seleukiden: {
    infantry: { name: 'Silberschilde', icon: '🛡️', attack: 6, defense: 11, hp: 102, cost: 110, upkeep: 0.055 },
    // Die Elefanten stehen an der Stelle der Reiterei: wenige, teure, schwer
    // aufzuhaltende Tiere.
    cavalry: { name: 'Kriegselefanten', icon: '🐘', attack: 13, defense: 6, hp: 126, cost: 175, upkeep: 0.09 },
    ranged: { name: 'Kretische Bogenschützen', icon: '🏹', attack: 6, defense: 3, hp: 72, cost: 115, upkeep: 0.06, ranged: true },
  },
  ptolemaeer: {
    infantry: { name: 'Machimoi', icon: '⚔️', attack: 5, defense: 10, hp: 98, cost: 105, upkeep: 0.05 },
    cavalry: { name: 'Ptolemäische Reiter', icon: '🐎', attack: 9, defense: 5, hp: 92, cost: 150, upkeep: 0.09 },
    ranged: { name: 'Nubische Bogenschützen', icon: '🏹', attack: 7, defense: 3, hp: 70, cost: 120, upkeep: 0.062, ranged: true },
  },
  illyrer: {
    // Die Sica, das gekrümmte Messer der illyrischen Räuber: billig
    // aufzustellen und im Angriff gefährlich, in der Linie dünn.
    infantry: { name: 'Sicaträger', icon: '🗡️', attack: 8, defense: 6, hp: 96, cost: 95, upkeep: 0.05 },
    cavalry: { name: 'Illyrische Reiter', icon: '🐎', attack: 9, defense: 4, hp: 88, cost: 140, upkeep: 0.085 },
    ranged: { name: 'Illyrische Schleuderer', icon: '🪨', attack: 6, defense: 3, hp: 70, cost: 105, upkeep: 0.05, ranged: true },
  },
  sarmaten: {
    // Ein Reitervolk: das Fußvolk ist Beiwerk, die gepanzerte Lanzenreiterei
    // ist das Beste, was auf der Karte zu Pferde sitzt - und kostet danach.
    infantry: { name: 'Fußgefolge', icon: '⚔️', attack: 5, defense: 7, hp: 92, cost: 85, upkeep: 0.045 },
    cavalry: { name: 'Kataphrakten', icon: '🐎', attack: 11, defense: 7, hp: 102, cost: 190, upkeep: 0.12 },
    ranged: { name: 'Berittene Bogenschützen', icon: '🏹', attack: 7, defense: 3, hp: 76, cost: 140, upkeep: 0.08, ranged: true },
  },
  neutral: {
    infantry: { name: 'Stadtmiliz', icon: '⚔️', attack: 5, defense: 8, hp: 95, cost: 90, upkeep: 0.045 },
    cavalry: { name: 'Berittene Wache', icon: '🐎', attack: 8, defense: 4, hp: 85, cost: 140, upkeep: 0.085 },
    ranged: { name: 'Schleuderer', icon: '🪨', attack: 4, defense: 3, hp: 68, cost: 105, upkeep: 0.05, ranged: true },
  },
};

// Die Wache ist überall dieselbe: sie kommt aus der Stadt, nicht aus dem Heer.
export function unitDefs(factionId) {
  const defs = FACTION_UNITS[factionId] || FACTION_UNITS.neutral;
  if (defs[WATCH_ROLE]) return defs;
  return Object.assign(defs, { [WATCH_ROLE]: WATCH_UNIT, [SHIP_ROLE]: SHIP_UNIT });
}

export function unitDef(factionId, role) {
  return unitDefs(factionId)[role] || FACTION_UNITS.neutral[role];
}

// Wer gespielt wird, steht nicht in dieser Tabelle: jede Fraktion außer den
// Unabhängigen ist spielbar, ausgewählt wird sie beim Spielstart.
export const DEFAULT_PLAYER_FACTION = 'rom';

export const FACTIONS = [
  { id: 'rom', name: 'Rom', color: '#c0392b' },
  { id: 'karthago', name: 'Karthago', color: '#2c3e8c' },
  // Der keltische Ruf gründet auf dem Ansturm des Fußvolks mit dem langen
  // Schwert - viel Infanterie, wenig anderes.
  {
    id: 'gallier', name: 'Gallier', color: '#27632a',
    // Gallien liegt am Kreuzweg: Germanen im Osten, Iberer im Süden,
    // Britannier über dem Kanal. Ein einziges Heer kann nur an einer Front
    // stehen - deshalb hebt der Heerbann zwei aus.
    startingArmies: [
      { infantry: 300, cavalry: 80, ranged: 40 },
      { infantry: 260, cavalry: 70, ranged: 30 },
    ],
    armyLabel: 'Heerbann',
  },
  { id: 'griechen', name: 'Griechen', color: '#7a4fae' },
  // The tribes field a great mass of foot: no siege train, few horse and
  // fewer bows, but more men in the line than anyone else brings.
  {
    id: 'germanen', name: 'Germanen', color: '#1c8f93',
    // Same manpower as anyone else, arranged the tribal way: a great mass of
    // foot, with horse and bows as an afterthought.
    startingArmy: { infantry: 360, cavalry: 100, ranged: 80 },
    armyLabel: 'Heerhaufen',
  },
  // Auf der Insel, also von Anfang an auf Schiffe angewiesen. Ihre Stärke ist
  // der Streitwagen - im Spiel die Reiterei.
  {
    id: 'britannier', name: 'Britannier', color: '#d97b2e',
    startingArmy: { infantry: 300, cavalry: 150, ranged: 90 },
    armyLabel: 'Kriegsschar',
  },
  // Die iberischen Stämme kämpfen aus der Ferne: Schleuderer und Speerwerfer
  // statt geschlossener Linie.
  {
    id: 'iberer', name: 'Iberer', color: '#b5397f',
    startingArmy: { infantry: 250, cavalry: 100, ranged: 190 },
    armyLabel: 'Kriegerbund',
  },
  // Hinter den Karpaten, mit der Falx als Waffe und der Draco als Feldzeichen.
  {
    id: 'daker', name: 'Daker', color: '#8a9a2b',
    startingArmy: { infantry: 320, cavalry: 130, ranged: 90 },
    armyLabel: 'Falxheer',
  },
  // Das Seleukidenreich: die makedonische Phalanx des Ostens, dazu die
  // Kriegselefanten, für die es berühmt ist.
  {
    id: 'seleukiden', name: 'Seleukiden', color: '#d8b12a',
    // Das größte der Diadochenreiche, und das mit den längsten Grenzen: es
    // stellt zwei Heere auf, weil es an zwei Fronten zugleich steht.
    startingArmies: [
      { infantry: 230, cavalry: 90, ranged: 70 },
      { infantry: 190, cavalry: 60, ranged: 60 },
    ],
    armyLabel: 'Königsheer',
  },
  // Ägypten unter den Ptolemäern: viel Fußvolk aus dem Niltal und die besten
  // Bogenschützen des Spiels, dafür wenig Reiterei.
  {
    id: 'ptolemaeer', name: 'Ptolemäer', color: '#12b5b0',
    startingArmy: { infantry: 300, cavalry: 90, ranged: 150 },
    armyLabel: 'Nilheer',
  },
  // Die Stämme der Adriaküste, berüchtigt für ihre Kaperfahrten: billige,
  // angriffslustige Kriegerscharen und lauter Häfen.
  {
    id: 'illyrer', name: 'Illyrer', color: '#3aa0d6',
    startingArmy: { infantry: 320, cavalry: 90, ranged: 130 },
    armyLabel: 'Seeschar',
  },
  // Ein Reitervolk der Steppe nördlich des Schwarzen Meeres.
  {
    id: 'sarmaten', name: 'Sarmaten', color: '#a3672e',
    startingArmy: { infantry: 120, cavalry: 320, ranged: 100 },
    armyLabel: 'Reiterschwarm',
  },
  { id: 'neutral', name: 'Unabhängig', color: '#7f7f7f', isNeutral: true },
];

// Was auf dem Auswahlbildschirm über eine Fraktion steht: wo sie beginnt,
// womit sie kämpft und woran sie krankt. Die Einschätzung stammt aus den
// Testläufen über je 120 Runden, nicht aus dem Bauchgefühl.
export const FACTION_PROFILES = {
  rom: {
    difficulty: 'mittel',
    blurb: 'Vier Städte in Italien, kein Feind in acht Feldern und drei freie Städte vor der Tür.',
    strength: 'Legionäre sind das zäheste Fußvolk der Karte.',
    weakness: 'Ein kleines Reich: alles Weitere muss erobert werden.',
  },
  karthago: {
    difficulty: 'leicht',
    blurb: 'Sechs Städte an der afrikanischen Küste, jede einzelne am Meer.',
    strength: 'Numidische Reiter und Häfen ringsum – die See gehört dir.',
    weakness: 'Eine lange Küste ohne Tiefe: überall Front, nirgends Rückzug.',
  },
  gallier: {
    difficulty: 'schwer',
    blurb: 'Sechs Städte in Gallien – und als Einzige drei feindliche Nachbarn zugleich. Dafür hebt der Heerbann zwei Heere aus.',
    strength: 'Schwertkämpfer mit dem härtesten Angriff unter dem Fußvolk – und zwei Heere, um an zwei Fronten zu stehen.',
    weakness: 'Kein Hafen, wenig freies Land, Feinde an drei Seiten.',
  },
  griechen: {
    difficulty: 'mittel',
    blurb: 'Athen, Sparta, Pergamon: fünf Städte um die Ägäis, alle am Wasser.',
    strength: 'Hopliten – die beste Verteidigung im Spiel.',
    weakness: 'Über das Meer verstreut: jede Stadt steht für sich.',
  },
  germanen: {
    difficulty: 'schwer',
    blurb: 'Fünf Orte zwischen Rhein, Nordsee und Elbe, mitten im Herkynischen Wald.',
    strength: 'Der größte Heerhaufen und ein Wald, der jeden Angreifer bremst.',
    weakness: 'Arm, fast ohne Küste, ohne nennenswerte Reiterei.',
  },
  britannier: {
    difficulty: 'mittel',
    blurb: 'Die Insel gehört dir allein – niemand kommt ohne Schiffe herüber.',
    strength: 'Streitwagen: die stärkste Reiterei der Karte, und eine sichere Heimat.',
    weakness: 'Keine Große Stadt, das niedrigste Einkommen, und jeder Krieg beginnt mit einer Überfahrt.',
  },
  iberer: {
    difficulty: 'leicht',
    blurb: 'Nur drei Städte, aber ganz Hispanien liegt offen und unbesetzt vor dir.',
    strength: 'Caetrati und Schleuderer: mehr Fernkampf als jede andere Fraktion.',
    weakness: 'Zu Beginn wenig Einkommen und nur ein Ort am Meer.',
  },
  daker: {
    difficulty: 'mittel',
    blurb: 'Sarmizegetusa in den Karpaten, die Donau als Sprungbrett nach Süden.',
    strength: 'Die Falx schlägt härter zu als jedes andere Fußvolk, das Bergland deckt den Rücken.',
    weakness: 'Kein einziger Ort am Meer: Schiffe wirst du nie stellen können.',
  },
  seleukiden: {
    difficulty: 'schwer',
    blurb: 'Das größte Diadochenreich: sechs Städte von Kilikien bis an den Euphrat – und zwei Heere von Anfang an.',
    strength: 'Kriegselefanten und die Silberschilde-Phalanx.',
    weakness: 'Die längsten Grenzen der Karte und die Ptolemäer im Süden.',
  },
  ptolemaeer: {
    difficulty: 'leicht',
    blurb: 'Ägypten, Zypern, Koilesyrien und die Kyrenaika – sechs Städte um das reichste Tal der Welt.',
    strength: 'Nubische Bogenschützen, die besten der Karte, und billiges Fußvolk in Masse.',
    weakness: 'Kaum Reiterei, und Zypern hängt allein am Meer.',
  },
  illyrer: {
    difficulty: 'schwer',
    blurb: 'Vier Orte an der Adria, zwischen den Bergen und dem Meer eingeklemmt.',
    strength: 'Billige, angriffslustige Sicaträger – und jeder Ort liegt am Wasser.',
    weakness: 'Wenig Land, wenig Einkommen, und Rom, Griechen und Daker als Nachbarn.',
  },
  sarmaten: {
    difficulty: 'mittel',
    blurb: 'Die Steppe nördlich des Schwarzen Meeres: vier Orte, weite Wege und kaum ein Nachbar in Reichweite.',
    strength: 'Kataphrakten – die stärkste Reiterei der Karte – und berittene Bogenschützen dazu.',
    weakness: 'Teure Reiterei, schwaches Fußvolk und ein Land, das kaum etwas einbringt.',
  },
};

export function factionProfile(factionId) {
  return FACTION_PROFILES[factionId] || null;
}

// Alle spielbaren Fraktionen in der Reihenfolge der Tabelle.
export function playableFactions() {
  return FACTIONS.filter((f) => !f.isNeutral);
}

// Three settlement sizes. Everything that scales with a settlement's standing -
// its people, the garrison it can raise and feed, its income and how large it
// is drawn on the map - comes from this table, so the tiers stay consistent.
// Die Stärke der Wache steht nicht hier: sie folgt der Bevölkerung.
export const SETTLEMENT_TIERS = {
  large: {
    key: 'large',
    label: 'Große Stadt',
    incomeFactor: 1.7,
    population: 5200,
    populationCapital: 6400,
    populationNeutral: 3600,
    modelScale: 1.35,
  },
  city: {
    key: 'city',
    label: 'Stadt',
    incomeFactor: 1,
    population: 3500,
    populationCapital: 6000,
    populationNeutral: 2000,
    modelScale: 1,
  },
  village: {
    key: 'village',
    label: 'Dorf',
    incomeFactor: 0.5,
    population: 1400,
    populationCapital: 2600,
    populationNeutral: 900,
    modelScale: 0.68,
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
  { name: 'Corduba', lon: -4.78, lat: 37.89, factionId: 'iberer', capital: false, size: 'city' },
  { name: 'Numantia', lon: -2.45, lat: 41.81, factionId: 'iberer', capital: true, size: 'large' },
  { name: 'Tarraco', lon: 1.25, lat: 41.12, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Olisipo', lon: -9.14, lat: 38.72, factionId: 'iberer', capital: false, size: 'village' },
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
  { name: 'Salamis', lon: 33.90, lat: 35.18, factionId: 'ptolemaeer', capital: false, size: 'village' },
  // --- Unabhängig: Illyrien und die Donau --------------------------------
  { name: 'Sirmium', lon: 19.61, lat: 44.97, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Vindobona', lon: 16.37, lat: 48.21, factionId: 'neutral', capital: false, size: 'village' },
  { name: 'Serdica', lon: 23.32, lat: 42.70, factionId: 'neutral', capital: false, size: 'village' },
  // --- Illyrer: die Adriaküste zwischen Bergen und Meer -------------------
  { name: 'Scodra', lon: 19.51, lat: 42.07, factionId: 'illyrer', capital: true, size: 'city' },
  { name: 'Salona', lon: 16.44, lat: 43.51, factionId: 'illyrer', capital: false, size: 'city' },
  { name: 'Epidamnos', lon: 19.45, lat: 41.32, factionId: 'illyrer', capital: false, size: 'village' },
  { name: 'Narona', lon: 17.62, lat: 43.05, factionId: 'illyrer', capital: false, size: 'village' },
  // --- Sarmaten: die Steppe nördlich des Schwarzen Meeres ----------------
  { name: 'Tanais', lon: 39.28, lat: 47.21, factionId: 'sarmaten', capital: true, size: 'city' },
  { name: 'Olbia', lon: 31.90, lat: 46.63, factionId: 'sarmaten', capital: false, size: 'village' },
  { name: 'Gelonos', lon: 34.50, lat: 49.70, factionId: 'sarmaten', capital: false, size: 'village' },
  { name: 'Amadoka', lon: 34.50, lat: 48.00, factionId: 'sarmaten', capital: false, size: 'village' },
  // --- Daker: nördlich der Donau, in den Karpaten ------------------------
  { name: 'Sarmizegetusa', lon: 22.79, lat: 45.62, factionId: 'daker', capital: true, size: 'large' },
  { name: 'Napoca', lon: 23.60, lat: 46.77, factionId: 'daker', capital: false, size: 'city' },
  { name: 'Sucidava', lon: 24.26, lat: 43.78, factionId: 'daker', capital: false, size: 'village' },
  { name: 'Piroboridava', lon: 27.40, lat: 46.00, factionId: 'daker', capital: false, size: 'village' },
  // --- Unabhängig: Makedonien, Thrakien, Osten ---------------------------
  { name: 'Thessalonike', lon: 22.94, lat: 40.64, factionId: 'neutral', capital: false, size: 'city' },
  { name: 'Byzantion', lon: 28.98, lat: 41.01, factionId: 'neutral', capital: false, size: 'city' },

  // --- Seleukiden: Syrien, Kilikien und das Zweistromland ----------------
  { name: 'Antiochia', lon: 36.16, lat: 36.20, factionId: 'seleukiden', capital: true, size: 'large' },
  { name: 'Tarsos', lon: 34.90, lat: 36.92, factionId: 'seleukiden', capital: false, size: 'city' },
  { name: 'Ankyra', lon: 32.86, lat: 39.93, factionId: 'seleukiden', capital: false, size: 'village' },
  { name: 'Damaskus', lon: 36.30, lat: 33.51, factionId: 'seleukiden', capital: false, size: 'city' },
  { name: 'Edessa', lon: 38.79, lat: 37.15, factionId: 'seleukiden', capital: false, size: 'village' },
  { name: 'Dura Europos', lon: 40.73, lat: 34.75, factionId: 'seleukiden', capital: false, size: 'village' },
  // --- Ptolemäer: Ägypten, Zypern, Koilesyrien und die Kyrenaika ---------
  { name: 'Alexandria', lon: 29.92, lat: 31.20, factionId: 'ptolemaeer', capital: true, size: 'large' },
  { name: 'Memphis', lon: 31.25, lat: 29.85, factionId: 'ptolemaeer', capital: false, size: 'city' },
  { name: 'Hierosolyma', lon: 35.22, lat: 31.78, factionId: 'ptolemaeer', capital: false, size: 'city' },
  { name: 'Tyrus', lon: 35.20, lat: 33.27, factionId: 'ptolemaeer', capital: false, size: 'village' },
  { name: 'Kyrene', lon: 21.86, lat: 32.82, factionId: 'ptolemaeer', capital: false, size: 'village' },
  { name: 'Chersonesos', lon: 33.49, lat: 44.61, factionId: 'neutral', capital: false, size: 'village' },
  // --- Unabhängig: Britannien --------------------------------------------
  { name: 'Camulodunum', lon: 0.90, lat: 51.89, factionId: 'britannier', capital: true, size: 'city' },
  { name: 'Londinium', lon: -0.13, lat: 51.51, factionId: 'britannier', capital: false, size: 'city' },
  { name: 'Eburacum', lon: -1.08, lat: 53.96, factionId: 'britannier', capital: false, size: 'village' },
  { name: 'Isca Dumnoniorum', lon: -3.53, lat: 50.72, factionId: 'britannier', capital: false, size: 'village' },
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

// --- Erfahrung -----------------------------------------------------------
// Armeen lernen im Feld. Drei Sterne sind das Höchste; jeder Stern ist echte
// Kampfkraft, keine Verzierung.
export const EXPERIENCE_THRESHOLDS = [20, 55, 110];
export const MAX_STARS = EXPERIENCE_THRESHOLDS.length;
export const MAX_EXPERIENCE = EXPERIENCE_THRESHOLDS[MAX_STARS - 1];
export const EXPERIENCE_PER_BATTLE = 8;
export const EXPERIENCE_FOR_WIN = 8;
// Wie viel Kampfkraft ein Stern bringt.
export const EXPERIENCE_BONUS_PER_STAR = 0.12;

export const STAR_TITLES = ['Aushebung', 'Erprobt', 'Kampferfahren', 'Veteranen'];

export function experienceStars(experience) {
  let stars = 0;
  for (const threshold of EXPERIENCE_THRESHOLDS) {
    if ((experience || 0) >= threshold) stars++;
  }
  return stars;
}

export function experienceBonus(experience) {
  return 1 + experienceStars(experience) * EXPERIENCE_BONUS_PER_STAR;
}

export function starTitle(experience) {
  return STAR_TITLES[experienceStars(experience)];
}

// ★★☆ - gefüllte Sterne für das Erreichte, leere für das Mögliche.
export function starMarks(experience) {
  const stars = experienceStars(experience);
  return '★'.repeat(stars) + '☆'.repeat(MAX_STARS - stars);
}

// --- Hafenbau ------------------------------------------------------------
// Ohne Hafen kein Schiff: eine Armee geht nur dort an Bord, wo Kais, Werft
// und Vorräte stehen. Hauptstädte und Große Städte am Meer bringen ihren
// Hafen mit, jede andere Küstenstadt muss ihn bauen.
export const HARBOUR_COST = 300;
export const HARBOUR_TURNS = 3;
export const HARBOUR_NAME = 'Hafen';

// --- Straßenbau ----------------------------------------------------------
// Eine Straße macht jedes Feld, über das sie führt, so leicht begehbar wie
// offene Ebene - durch Wald, Hügel und Wüste ist das die halbe Mühe. Gebaut
// wird von Ort zu Ort, bezahlt nach Länge.
export const ROAD_MOVE_COST = 1;
export const ROAD_COST_PER_TILE = 30;
export const ROAD_TURNS_PER_TILE = 0.4;
export const ROAD_MIN_TURNS = 2;
// Wie viele Bauziele einer Stadt zur Auswahl gestellt werden.
export const ROAD_TARGET_CHOICES = 3;

export function roadCost(length) {
  return Math.round(length * ROAD_COST_PER_TILE);
}

export function roadTurns(length) {
  return Math.max(ROAD_MIN_TURNS, Math.round(length * ROAD_TURNS_PER_TILE));
}

export const MAX_MOVEMENT = 9;

// What it costs to push into ground an enemy army holds. Together with the
// rule that forbids moving from one held tile straight into another, this is
// what makes an army a barrier rather than a piece to walk around.
export const ZOC_EXTRA_COST = 2;

// --- Seefahrt -------------------------------------------------------------
// An army takes ship in one of its own coastal settlements. At sea it travels
// further than on foot, but it fights badly: rowing benches are no battle
// line, and troops wading ashore meet a prepared enemy.
// Was die Überfahrt eines Landheeres kostet: gecharterte Transporter.
export const SHIP_COST = 250;
// Und was ein Geschwader eigener Kriegsschiffe kostet, je Bautrupp.
export const WARSHIP_BATCH = 60;
export const WARSHIP_COST = 200;
export const NAVAL_MOVEMENT = 15;
export const SEA_MOVE_COST = 1;
export const EXHAUSTION_PER_SEA_MOVE = 5;
// Attacking straight off the ships.
export const AMPHIBIOUS_ATTACK_MULTIPLIER = 0.7;
// Auf einer Ruderbank ist ein Fußsoldat kein Fußsoldat: zur See zählt nur,
// was das Schiff kann. Landtruppen an Bord kämpfen deshalb stark gemindert,
// Bogenschützen noch am ehesten - sie können vom Deck aus schießen.
export const SEA_UNIT_SCALE = { infantry: 0.5, cavalry: 0.4, ranged: 0.8 };

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
