// Die Spielversion. Sie steht im Startbildschirm und muss mit der Angabe in
// package.json übereinstimmen - dieselbe Zahl trägt auch das Desktop-Paket.
export const GAME_VERSION = '1.1.0';

// The grid comes from the geography, not the other way round: change the
// bounds or the tile size in geodata.js and everything here follows.
export { MAP_COLS, MAP_ROWS } from './geodata.js';

// Bewegung wird in Punkten gerechnet, nicht in Feldern: offene Ebene kostet 3,
// gebrochenes Gelände - Wald, Hügel, Wüste - das Doppelte, eine gepflasterte
// Straße 1. Eine Straße ist damit ein Drittel der Ebene wert und ein Sechstel
// des Waldes: wer sein Land mit Straßen überzieht, verschiebt seine Heere ein
// Vielfaches schneller als über freies Feld. Ein Heer hat 18 Punkte: sechs
// Felder Ebene, drei Felder Wald, achtzehn Felder Straße.
export const TILE_TYPES = {
  plains: { name: 'Ebene', cost: 3, defense: 0, elevation: 0, color: '#8fae5a', deco: null },
  forest: { name: 'Wald', cost: 6, defense: 1, elevation: 0.35, color: '#4c7a3f', deco: 'tree' },
  hills: { name: 'Hügel', cost: 6, defense: 2, elevation: 1, color: '#b3a06b', deco: null },
  desert: { name: 'Wüste', cost: 6, defense: 0, elevation: 0.08, color: '#d9c489', deco: null },
  mountain: {
    name: 'Gebirge', cost: 198, defense: 3, elevation: 2.6, color: '#8a8a8a',
    deco: 'peak', impassable: true,
  },
  // Impassable on foot; a fleet crosses it at the sea cost below.
  water: { name: 'Meer', cost: 198, defense: 0, elevation: -0.4, color: '#3f6fa8', deco: null, impassable: true },
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
//
// Drei Bauarten, wie sie im 3. Jahrhundert v. Chr. tatsächlich nebeneinander
// fuhren: die schwere Fünfruderer-Flotte der Mittelmeermächte, der leichte
// Ruderer der Ägäis und der Adria, und das hochbordige Segelschiff des
// Nordens, dem der Rammsporn wenig anhaben konnte.
export const SHIP_TYPES = {
  quinquereme: {
    key: 'quinquereme',
    name: 'Quinqueremen',
    icon: '⛵',
    attack: 50, defense: 52, hp: 780, cost: 220, upkeep: 0.55,
    note: 'Fünfruderer mit Enterbrücke und Turm – schwer, teuer, im Rammstoß überlegen.',
  },
  lembos: {
    key: 'lembos',
    name: 'Leichte Ruderer',
    icon: '🚣',
    attack: 44, defense: 40, hp: 600, cost: 170, upkeep: 0.42,
    note: 'Lemboi und Trieren: schnell und billig, aber dünnwandig.',
  },
  keltenschiff: {
    key: 'keltenschiff',
    name: 'Segelschiffe',
    icon: '⛵',
    attack: 36, defense: 54, hp: 760, cost: 195, upkeep: 0.5,
    note: 'Hochbordige Eichenrümpfe mit Ledersegel – schwer zu rammen, schwach im Angriff.',
  },
};

// Wer welche Bauart fährt. Rom lernte den Schiffbau von einer gestrandeten
// punischen Quinquereme; die Diadochenreiche bauten dieselben schweren
// Einheiten. Griechen, Illyrer und Iberer fuhren leichter, die Stämme des
// Nordens und die Binnenvölker mit Segelschiffen.
export const FACTION_SHIP_TYPE = {
  rom: 'quinquereme',
  karthago: 'quinquereme',
  seleukiden: 'quinquereme',
  ptolemaeer: 'quinquereme',
  griechen: 'lembos',
  illyrer: 'lembos',
  iberer: 'lembos',
  numidien: 'lembos',
  parther: 'lembos',
  armenien: 'lembos',
  pontus: 'quinquereme',
  gallier: 'keltenschiff',
  britannier: 'keltenschiff',
  germanen: 'keltenschiff',
  daker: 'keltenschiff',
  sarmaten: 'keltenschiff',
  neutral: 'lembos',
};

export function shipTypeOf(factionId) {
  return SHIP_TYPES[FACTION_SHIP_TYPE[factionId] || 'lembos'];
}

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
    cavalry: { name: 'Punische Reiterei', icon: '🐎', attack: 11, defense: 3, hp: 85, cost: 145, upkeep: 0.09 },
    ranged: { name: 'Balearische Schleuderer', icon: '🪨', attack: 6, defense: 3, hp: 70, cost: 125, upkeep: 0.065, ranged: true },
  },
  // Numidien: leichtes Fußvolk, das nur die Reiter deckt - und die beste
  // leichte Reiterei der Karte, die niemand stellen kann.
  numidien: {
    infantry: { name: 'Numidische Speerträger', icon: '⚔️', attack: 6, defense: 6, hp: 90, cost: 90, upkeep: 0.045 },
    cavalry: { name: 'Numidische Reiter', icon: '🐎', attack: 12, defense: 3, hp: 85, cost: 145, upkeep: 0.09 },
    ranged: { name: 'Numidische Speerwerfer', icon: '🪶', attack: 6, defense: 3, hp: 70, cost: 105, upkeep: 0.055, ranged: true },
  },
  // Parthien kämpft zu Pferde: Fußvolk taugt nur zum Halten, die Entscheidung
  // fällt zwischen Panzerreitern und berittenen Bogenschützen.
  parther: {
    infantry: { name: 'Persisches Fußvolk', icon: '⚔️', attack: 5, defense: 7, hp: 95, cost: 95, upkeep: 0.05 },
    cavalry: { name: 'Kataphrakten', icon: '🐎', attack: 13, defense: 8, hp: 105, cost: 200, upkeep: 0.125 },
    ranged: { name: 'Berittene Bogenschützen', icon: '🏹', attack: 8, defense: 4, hp: 80, cost: 140, upkeep: 0.08, ranged: true },
  },
  // Armenien: schwere Reiterei aus dem Bergadel, dazu ein Fußvolk, das anders
  // als das parthische wirklich stehen kann.
  armenien: {
    infantry: { name: 'Armenische Speerträger', icon: '⚔️', attack: 6, defense: 9, hp: 100, cost: 105, upkeep: 0.055 },
    cavalry: { name: 'Armenische Kataphrakten', icon: '🐎', attack: 12, defense: 9, hp: 100, cost: 195, upkeep: 0.12 },
    ranged: { name: 'Armenische Bogenschützen', icon: '🏹', attack: 6, defense: 4, hp: 75, cost: 110, upkeep: 0.055, ranged: true },
  },
  // Pontus: hellenistische Phalanx im Zentrum, dazu Reiter aus dem Hinterland
  // und die Bogenschützen der Chalyber vom Schwarzen Meer.
  pontus: {
    infantry: { name: 'Pontische Phalangiten', icon: '🛡️', attack: 6, defense: 11, hp: 100, cost: 118, upkeep: 0.06 },
    cavalry: { name: 'Pontische Reiter', icon: '🐎', attack: 10, defense: 5, hp: 90, cost: 150, upkeep: 0.09 },
    ranged: { name: 'Chalybische Bogenschützen', icon: '🏹', attack: 7, defense: 3, hp: 70, cost: 120, upkeep: 0.06, ranged: true },
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
  // Die Wache ist überall dieselbe, die Schiffe nicht: jede Fraktion fährt
  // die Bauart, die zu ihrer Küste gehört.
  const factionKey = Object.keys(FACTION_UNITS).find((id) => FACTION_UNITS[id] === defs);
  return Object.assign(defs, {
    [WATCH_ROLE]: WATCH_UNIT,
    [SHIP_ROLE]: shipTypeOf(factionKey || factionId),
  });
}

export function unitDef(factionId, role) {
  return unitDefs(factionId)[role] || FACTION_UNITS.neutral[role];
}

// Wer gespielt wird, steht nicht in dieser Tabelle: jede Fraktion außer den
// Unabhängigen ist spielbar, ausgewählt wird sie beim Spielstart.
export const DEFAULT_PLAYER_FACTION = 'rom';

export const FACTIONS = [
  { id: 'rom', name: 'Rom', color: '#c0392b' },
  // Karthago hält seit Generationen einen Brückenkopf in Iberien; dort steht
  // ein eigenes Heer, weil es von Afrika aus nicht zu verteidigen wäre.
  {
    id: 'karthago', name: 'Karthago', color: '#2c3e8c',
    startingArmies: [
      { units: { infantry: 300, cavalry: 120, ranged: 120 } },
      { units: { infantry: 160, cavalry: 60, ranged: 50 }, home: 'Karthago Nova' },
    ],
  },
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
  // Numidien lebt vom Pferd: die berittenen Verbände, die Karthago jahrhunderte-
  // lang anwarb, stehen hier unter eigener Fahne.
  { id: 'numidien', name: 'Numidien', color: '#c98a2e', armyLabel: 'Reiterheer' },
  // Die Parther: aus der Steppe nordöstlich des Seleukidenreichs, berittene
  // Bogenschützen und Panzerreiter - das Heer, an dem Rom später scheitert.
  { id: 'parther', name: 'Parther', color: '#8c3f5c', armyLabel: 'Reiterheer' },
  // Armenien im Hochland zwischen Schwarzem und Kaspischem Meer: Panzerreiter
  // aus dem Bergadel, dazwischen ein Fußvolk, das die Pässe hält.
  { id: 'armenien', name: 'Armenien', color: '#3f8c72', armyLabel: 'Königsheer' },
  // Pontus am Südufer des Schwarzen Meeres: ein hellenistisches Königreich
  // mit den Häfen der Küste im Rücken und den Bergen des Hinterlands davor.
  { id: 'pontus', name: 'Pontus', color: '#6b6fc9' },
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
    blurb: 'Vier Städte an der afrikanischen Küste und Karthago Nova in Iberien, mit eigenem Heer.',
    strength: 'Quinqueremen, Häfen ringsum und zwei Heere auf zwei Erdteilen.',
    weakness: 'Eine lange Küste ohne Tiefe, und Numidien im Rücken.',
  },
  numidien: {
    difficulty: 'schwer',
    blurb: 'Fünf Orte zwischen Karthago und dem Atlas – Cirta als Königssitz, dazu das königliche Hippo.',
    strength: 'Numidische Reiter: die schnellste und härteste leichte Reiterei der Karte.',
    weakness: 'Fußvolk, das nur die Reiter deckt, und Karthago als unmittelbarer Nachbar.',
  },
  parther: {
    difficulty: 'mittel',
    blurb: 'Fünf Orte auf der iranischen Hochebene – Ekbatana als Sitz, der Zagros als Wall nach Westen.',
    strength: 'Kataphrakten und berittene Bogenschützen: das beste Reiterheer der Karte.',
    weakness: 'Fußvolk, das nur hält, teure Truppen und weite Wege zwischen den Orten.',
  },
  armenien: {
    difficulty: 'mittel',
    blurb: 'Fünf Orte im Hochland um den Ararat – Artaxata als Sitz, Berge nach allen Seiten.',
    strength: 'Kataphrakten und ein Fußvolk, das die Pässe wirklich halten kann.',
    weakness: 'Kein Meer, kein Hafen – und Seleukiden wie Parther als Nachbarn.',
  },
  pontus: {
    difficulty: 'mittel',
    blurb: 'Fünf Orte an der Südküste des Schwarzen Meeres – Amaseia im Bergland, Sinope und Amisos am Wasser.',
    strength: 'Phalangiten mit der zweitbesten Verteidigung und Quinqueremen im Schwarzen Meer.',
    weakness: 'Eine schmale Küste zwischen Bergen und Meer, Armenien und Seleukiden als Nachbarn.',
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
  { name: 'Hadrumetum', lon: 10.64, lat: 35.83, factionId: 'karthago', capital: false, size: 'city' },
  { name: 'Tingis', lon: -5.81, lat: 35.78, factionId: 'karthago', capital: false, size: 'village' },
  { name: 'Leptis Magna', lon: 14.29, lat: 32.64, factionId: 'karthago', capital: false, size: 'village' },
  // Karthagos Brückenkopf in Iberien: die Silberminen der Halbinsel und der
  // Hafen, von dem aus ein Heer nach Norden zieht statt über die See.
  { name: 'Karthago Nova', lon: -0.98, lat: 37.60, factionId: 'karthago', capital: false, size: 'city' },
  // --- Numidien: das Reiterland westlich von Karthago --------------------
  { name: 'Cirta', lon: 6.61, lat: 36.37, factionId: 'numidien', capital: true, size: 'large' },
  // Hippo Regius heißt "das königliche Hippo", weil dort die numidischen
  // Könige Hof hielten - es gehört hierher und nicht zu Karthago.
  { name: 'Hippo Regius', lon: 7.75, lat: 36.90, factionId: 'numidien', capital: false, size: 'city' },
  { name: 'Icosium', lon: 3.06, lat: 36.75, factionId: 'numidien', capital: false, size: 'city' },
  { name: 'Zama Regia', lon: 9.45, lat: 36.05, factionId: 'numidien', capital: false, size: 'village' },
  { name: 'Siga', lon: -1.32, lat: 35.19, factionId: 'numidien', capital: false, size: 'village' },
  // --- Parther: das Land östlich des Zweistromlands ----------------------
  { name: 'Ekbatana', lon: 48.52, lat: 34.80, factionId: 'parther', capital: true, size: 'large' },
  { name: 'Susa', lon: 48.25, lat: 32.19, factionId: 'parther', capital: false, size: 'city' },
  { name: 'Rhagae', lon: 51.43, lat: 35.59, factionId: 'parther', capital: false, size: 'city' },
  { name: 'Ktesiphon', lon: 44.58, lat: 33.09, factionId: 'parther', capital: false, size: 'village' },
  { name: 'Arbela', lon: 44.01, lat: 36.19, factionId: 'parther', capital: false, size: 'village' },
  // --- Pontus: die Südküste des Schwarzen Meeres -------------------------
  { name: 'Amaseia', lon: 35.83, lat: 40.65, factionId: 'pontus', capital: true, size: 'large' },
  { name: 'Sinope', lon: 35.15, lat: 42.03, factionId: 'pontus', capital: false, size: 'city' },
  { name: 'Amisos', lon: 36.33, lat: 41.52, factionId: 'pontus', capital: false, size: 'city' },
  { name: 'Trapezus', lon: 39.72, lat: 41.38, factionId: 'pontus', capital: false, size: 'village' },
  { name: 'Kabeira', lon: 36.96, lat: 40.32, factionId: 'pontus', capital: false, size: 'village' },
  // --- Armenien: das Hochland zwischen den Meeren ------------------------
  { name: 'Artaxata', lon: 44.55, lat: 39.93, factionId: 'armenien', capital: true, size: 'large' },
  { name: 'Tigranokerta', lon: 40.95, lat: 37.85, factionId: 'armenien', capital: false, size: 'city' },
  { name: 'Tushpa', lon: 43.38, lat: 38.49, factionId: 'armenien', capital: false, size: 'city' },
  { name: 'Arsamosata', lon: 39.20, lat: 38.60, factionId: 'armenien', capital: false, size: 'village' },
  { name: 'Naxuana', lon: 45.41, lat: 39.21, factionId: 'armenien', capital: false, size: 'village' },
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
  { name: 'Babylon', lon: 44.42, lat: 32.54, factionId: 'seleukiden', capital: false, size: 'city' },
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
// Erschöpfung wird je Bewegungspunkt berechnet, nicht je Feld: auf der Straße
// kommt ein Heer für denselben Preis weiter als querfeldein. Der Satz ist so
// gewählt, dass ein voller Tagesmarsch (MAX_MOVEMENT Punkte) rund 22 kostet.
// Das klingt wenig, wiegt aber schwer: seit Angriff und Verteidigung nahe
// beieinander liegen, entscheidet schon ein kleiner Unterschied im Zustand die
// Schlacht. Ein Heer, das den ganzen Tag marschiert ist, greift damit noch mit
// etwa vier zu zehn an - zwei solche Märsche hintereinander laugen es aus.
export const EXHAUSTION_PER_MOVE = 1.2;
export const EXHAUSTION_REST = -8;
export const EXHAUSTION_REST_IN_CITY = -15;
export const EXHAUSTION_PER_BATTLE = 8;
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

// --- Frontbreite ----------------------------------------------------------
// Eine Schlacht wird an einer Linie geschlagen, nicht als Haufen. Was über
// diese Zahl hinausgeht, steht in zweiter und dritter Reihe und wartet, bis
// vorne eine Lücke ist. Übermacht bleibt damit ein Vorteil - aber kein
// Freibrief: ein Heer von 2000 Mann trat vorher gegen 500 an, als kämpften
// alle 2000 auf einmal, und kam mit drei Prozent Verlust davon.
export const FRONTAGE_BASE = 900;
// Enges Gelände nimmt der Übermacht noch mehr davon: im Wald und in den
// Hügeln steht kein Heer in einer Linie. Gebirge fehlt hier, weil dort nicht
// gekämpft wird - es ist unpassierbar.
export const FRONTAGE_TERRAIN = { forest: 0.7, hills: 0.8 };

// Wie breit eine Seite auf diesem Gelände überhaupt aufmarschieren kann.
// `narrowBy` verengt die Front des Angreifers: vor einer Mauer kommt er nur
// an Tor und Bresche heran, und zwar umso weniger, je stärker sie ist.
export function frontageWidth(terrainType, narrowBy = 1) {
  return (FRONTAGE_BASE * (FRONTAGE_TERRAIN[terrainType] ?? 1)) / Math.max(1, narrowBy);
}

// Der Anteil einer Truppe, der gleichzeitig ins Gefecht kommt.
export function engagedShare(count, width) {
  return count > width ? width / count : 1;
}

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

// --- Bevölkerung ----------------------------------------------------------
// Orte wachsen. Nicht durch Zuzug oder Eroberung, sondern schlicht dadurch,
// dass mehr Kinder geboren werden als Menschen sterben - und das geht in
// Friedenszeiten schneller als in einem Jahr, in dem ein Heer vor dem Tor
// steht. Gerechnet wird je Runde, also je Monat.
//
// Der Satz ist bewusst klein: über ein Feldzugsjahr (zwölf Runden) wächst ein
// Ort um gut vier Prozent, über zehn Jahre um die Hälfte. Man sieht es nicht
// von Runde zu Runde, aber man sieht es.
export const BIRTH_RATE = 0.0035;
// Im Frühjahr und Sommer wird mehr geboren als im Winter.
export const BIRTH_SEASON = { fruehling: 1.3, sommer: 1.2, herbst: 0.9, winter: 0.6 };
// Steht ein fremdes Heer vor dem Ort, wächst nichts: die Felder liegen brach.
export const BIRTH_SIEGE_RANGE = 1;
// Weiter als bis hierher wächst ein Ort nicht - ein Dorf bleibt ein Dorf,
// solange es ein Dorf ist. Der Anteil bezieht sich auf die Einwohnerzahl,
// mit der ein Ort seines Rangs beginnt.
export const POPULATION_CEILING = 1.6;

// Die Obergrenze eines Orts: sein Rang bestimmt sie, die Hauptstadt hat mehr.
export function populationCeiling(city) {
  const tier = settlementTier(city.size);
  const basis = city.capital ? tier.populationCapital : tier.population;
  return Math.round(basis * POPULATION_CEILING);
}

// --- Handel ---------------------------------------------------------------
// Jeder Ort bringt hervor, was sein Land hergibt. Zwei eigene Orte, die eine
// Straße verbindet oder die beide einen Hafen haben, können einen Handelsweg
// eröffnen: beide Seiten tragen dann Runde für Runde mehr, und am meisten,
// wenn sie Verschiedenes anzubieten haben - Salz gegen Wein lohnt, Getreide
// gegen Getreide kaum.
export const TRADE_GOODS = {
  getreide: { name: 'Getreide', icon: '🌾' },
  wein: { name: 'Wein', icon: '🍇' },
  oel: { name: 'Olivenöl', icon: '🫒' },
  salz: { name: 'Salz', icon: '🧂' },
  erz: { name: 'Erz', icon: '⛏️' },
  holz: { name: 'Holz', icon: '🪵' },
  pferde: { name: 'Pferde', icon: '🐎' },
  fisch: { name: 'Fisch und Purpur', icon: '🐟' },
};

// Was ein Handelsweg einmalig kostet und was er beiden Seiten je Runde bringt.
export const TRADE_ROUTE_COST = 200;
export const TRADE_BASE_INCOME = 3;
export const TRADE_VARIETY_BONUS = 4;
// Mehr als zwei Wege trägt ein Ort nicht: sonst hängt am Ende jede Stadt an
// jeder, und der Handel wäre nur noch eine Zahl, die immer weiter wächst.
export const TRADE_ROUTES_PER_CITY = 2;
// Weiter als das reicht kein regelmäßiger Warenverkehr.
export const TRADE_MAX_DISTANCE = 14;

// Große Städte schlagen mehr um als ein Dorf.
export function tradeSizeFactor(size) {
  return size === 'large' ? 1.6 : size === 'village' ? 0.6 : 1;
}

// --- Straßenbau ----------------------------------------------------------
// Eine gepflasterte Straße kostet zwei Drittel dessen, was offene Ebene
// kostet, und ein Drittel dessen, was Wald, Hügel oder Wüste kosten: ein Heer
// kommt auf ihr die Hälfte weiter als querfeldein (9 Felder statt 6 je Runde)
// und zehrt dabei weniger. Zieht es über die ganze Halbinsel, braucht es
// trotzdem mehr als eine Runde. Gebaut wird von Ort zu Ort, bezahlt nach Länge.
export const ROAD_MOVE_COST = 2;
export const ROAD_COST_PER_TILE = 30;
export const ROAD_TURNS_PER_TILE = 0.4;
export const ROAD_MIN_TURNS = 2;
// Wie viele Bauziele eine Stadt hat: die beiden nächstgelegenen eigenen Orte,
// zu denen noch keine Straße führt. Weiter reicht kein Straßenbau von einem
// Ort aus - eine Fernstraße entsteht Stück für Stück über die Orte dazwischen,
// nicht in einem Zug quer durchs Land.
export const ROAD_TARGET_CHOICES = 2;

export function roadCost(length) {
  return Math.round(length * ROAD_COST_PER_TILE);
}

export function roadTurns(length) {
  return Math.max(ROAD_MIN_TURNS, Math.round(length * ROAD_TURNS_PER_TILE));
}

// Was es kostet, einen Fluss zu überschreiten - Furt suchen, Wagen entladen,
// Pferde schwimmen lassen. Zwei Felder Ebene, jedes Mal. Wo eine Straße
// hinüberführt, steht eine Brücke, und dann kostet es nichts.
export const RIVER_CROSSING_COST = 6;

export const MAX_MOVEMENT = 18;

// What it costs to push into ground an enemy army holds. Together with the
// rule that forbids moving from one held tile straight into another, this is
// what makes an army a barrier rather than a piece to walk around.
export const ZOC_EXTRA_COST = 4;

// --- Seefahrt -------------------------------------------------------------
// An army takes ship in one of its own coastal settlements. At sea it travels
// further than on foot, but it fights badly: rowing benches are no battle
// line, and troops wading ashore meet a prepared enemy.
// Was die Überfahrt eines Landheeres kostet: gecharterte Transporter.
export const SHIP_COST = 250;
// Wie viele Schiffe ein Bautrupp umfasst; was sie kosten, sagt die Bauart.
export const WARSHIP_BATCH = 60;
export const NAVAL_MOVEMENT = 30;
export const SEA_MOVE_COST = 2;
// Eine Überfahrt zehrt weniger als ein Marsch - gerudert wird in Schichten -,
// aber eine volle Fahrt über 30 Punkte setzt der Mannschaft trotzdem zu.
export const EXHAUSTION_PER_SEA_MOVE = 0.6;
// Attacking straight off the ships.
export const AMPHIBIOUS_ATTACK_MULTIPLIER = 0.7;
// Auf einer Ruderbank ist ein Fußsoldat kein Fußsoldat: zur See zählt nur,
// was das Schiff kann. Landtruppen an Bord kämpfen deshalb stark gemindert,
// Bogenschützen noch am ehesten - sie können vom Deck aus schießen.
export const SEA_UNIT_SCALE = { infantry: 0.5, cavalry: 0.4, ranged: 0.8 };

// How many times a battle is played through for the forecast. Enough for a
// stable percentage, cheap enough to run on every click.
export const BATTLE_PREVIEW_SAMPLES = 60;

// --- Unabhängige Orte ------------------------------------------------------
// Eine Stadt, die keinem Staat gehört, ist nicht wehrlos: aus ihrer Wache
// bildet sich mit der Zeit eine Miliz. Nimmt die einem Staat einen Ort ab,
// rufen die Unabhängigen der Gegend ein eigenes Gemeinwesen aus - aus zwei
// Orten und einem Heer wird eine Fraktion, die von da an mitspielt.
// Nicht gleich in der ersten Runde: die Eröffnung gehört den zwölf Staaten.
export const MILITIA_FIRST_TURN = 10;
export const MILITIA_MIN_POPULATION = 800;
// Wie wahrscheinlich es ist, dass ein Ort in einer Runde eine Miliz aufstellt.
export const MILITIA_CHANCE = 0.022;
// Wie viele Milizen gleichzeitig unterwegs sein dürfen. Mehr wären keine
// Unabhängigen mehr, sondern ein dreizehnter Krieg.
export const MILITIA_MAX = 4;
// Eine Miliz ist in erster Linie bewaffnete Bürgerschaft; die Stadtwache gibt
// nur den Kern dazu und behält eine Reserve auf der Mauer.
export const MILITIA_PER_POPULATION = 12;
export const MILITIA_MIN_SIZE = 60;
export const MILITIA_MAX_SIZE = 280;
export const MILITIA_WATCH_SHARE = 0.4;
export const MILITIA_WATCH_RESERVE = 40;
// So viele freie Staaten können höchstens entstehen.
export const FREE_STATE_MAX = 2;

// Ein freier Staat heißt nach dem Ort, aus dem er sich erhebt - den Namen
// bringt er selbst mit. Aus dieser Liste kommt nur noch die Farbe, unter der
// er auf der Karte steht.
export const FREE_STATE_NAMES = [
  { name: 'Mauren', color: '#b06a3a' },
  { name: 'Thraker', color: '#7d4a8c' },
  { name: 'Ligurer', color: '#4f8a7a' },
  { name: 'Lusitaner', color: '#a8603c' },
  { name: 'Boier', color: '#6b8c3a' },
  { name: 'Veneter', color: '#3f7d9c' },
  { name: 'Bithynier', color: '#9c7b2f' },
  { name: 'Kappadokier', color: '#a0503f' },
  { name: 'Nabatäer', color: '#c2a24a' },
  { name: 'Pannonier', color: '#6a5b9c' },
  { name: 'Räter', color: '#8a8f5a' },
  { name: 'Aquitanier', color: '#4a6f9c' },
];

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
