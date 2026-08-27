// Jahreszeiten, Klimazonen und Wetter.
//
// Die Karte reicht von der Nordsee bis in die Sahara - ein einziges Wetter für
// alles wäre Unsinn. Stattdessen hat jede Klimazone ihr eigenes Wetter, das
// sich jede Runde neu einstellt, aber gerne bleibt: Regen über Germanien,
// während in Africa die Hitze steht.
//
// Jeder Wettertyp hier hat Regelwirkung. Es gibt keinen, der nur hübsch ist -
// bewölkt und klar sind die beiden, die absichtlich nichts tun, damit die
// anderen etwas bedeuten.

import { latOfRow } from './geodata.js';
import { mulberry32 } from './prng.js';

export const SEASONS = [
  { key: 'fruehling', name: 'Frühling', icon: '🌱' },
  { key: 'sommer', name: 'Sommer', icon: '☀️' },
  { key: 'herbst', name: 'Herbst', icon: '🍂' },
  { key: 'winter', name: 'Winter', icon: '❄️' },
];

// Vier Runden sind ein Jahr, und das erste ist das Jahr, in dem der Erste
// Punische Krieg beginnt.
export const TURNS_PER_YEAR = SEASONS.length;
export const START_YEAR_BC = 264;

export function calendarOfTurn(turn) {
  const index = Math.max(0, turn - 1);
  const season = SEASONS[index % TURNS_PER_YEAR];
  const year = START_YEAR_BC - Math.floor(index / TURNS_PER_YEAR);
  return { season, year, label: `${season.name} ${year} v. Chr.` };
}

// --- Wettertypen ---------------------------------------------------------
// moveCost  zusätzliche Bewegungspunkte je Feld
// wear      Erschöpfung je Runde, die eine Armee darin verbringt
// spirit    Moral je Runde
// unitScale Kampfkraft einzelner Waffengattungen, für beide Seiten
// volley    ob die Fernkampf-Eröffnung überhaupt stattfindet
export const WEATHER = {
  klar: {
    key: 'klar', name: 'Klar', icon: '☀️', effect: null,
    note: 'Gutes Marschwetter.',
  },
  bewoelkt: {
    key: 'bewoelkt', name: 'Bewölkt', icon: '☁️', effect: 'clouds',
    note: 'Bedeckt, aber trocken.',
  },
  regen: {
    key: 'regen', name: 'Regen', icon: '🌧️', effect: 'rain',
    moveCost: 1, wear: 4,
    unitScale: { cavalry: 0.85, archer: 0.7 },
    volley: false,
    note: 'Aufgeweichte Wege, nasse Sehnen: Bogenschützen und Reiterei leiden.',
  },
  sturm: {
    key: 'sturm', name: 'Sturm', icon: '🌊', effect: 'storm',
    moveCost: 1, wear: 6,
    unitScale: { cavalry: 0.85, archer: 0.6 },
    volley: false,
    blocksEmbark: true,
    seaScale: 0.8,
    note: 'Kein Schiff läuft aus. Wer schon auf See ist, kämpft schlecht.',
  },
  schnee: {
    key: 'schnee', name: 'Schnee', icon: '❄️', effect: 'snow',
    moveCost: 2, wear: 7, spirit: -3,
    unitScale: { cavalry: 0.8, archer: 0.8 },
    note: 'Jeder Schritt kostet doppelt, und das Lager zehrt an der Truppe.',
  },
  nebel: {
    key: 'nebel', name: 'Nebel', icon: '🌫️', effect: 'fog',
    unitScale: { archer: 0.8 },
    volley: false,
    note: 'Niemand sieht weit genug für den ersten Hagel.',
  },
  hitze: {
    key: 'hitze', name: 'Gluthitze', icon: '🔥', effect: 'heat',
    moveCost: 1, wear: 9,
    unitScale: { legionary: 0.92 },
    note: 'Marschieren in Rüstung zehrt schneller als jeder Feind.',
  },
  sandsturm: {
    key: 'sandsturm', name: 'Sandsturm', icon: '🌪️', effect: 'sand',
    moveCost: 2, wear: 7, spirit: -2,
    unitScale: { archer: 0.5, cavalry: 0.9 },
    volley: false,
    note: 'Man sieht die eigene Vorhut nicht mehr.',
  },
};

export function weatherInfo(key) {
  return WEATHER[key] || WEATHER.klar;
}

// --- Klimazonen ----------------------------------------------------------
// Nach Breitengrad, und Land und See getrennt: im Winter steht über der
// Nordsee der Sturm, während das Mittelmeer nur Regen sieht.
const BANDS = [
  { key: 'nord', name: 'Nordeuropa', minLat: 47 },
  { key: 'mitte', name: 'Mitteleuropa', minLat: 41 },
  { key: 'sued', name: 'Mittelmeerraum', minLat: 34 },
  { key: 'wueste', name: 'Wüstengürtel', minLat: -90 },
];

export function climateBand(lat) {
  return BANDS.find((band) => lat >= band.minLat) || BANDS[BANDS.length - 1];
}

export function zoneOf(row, isWater) {
  const band = climateBand(latOfRow(row));
  return `${band.key}-${isWater ? 'see' : 'land'}`;
}

export function zoneName(zone) {
  const [bandKey, element] = zone.split('-');
  const band = BANDS.find((b) => b.key === bandKey);
  return `${band ? band.name : bandKey}${element === 'see' ? ' (See)' : ''}`;
}

export const ZONES = BANDS.flatMap((band) => [`${band.key}-land`, `${band.key}-see`]);

// Gewichte je Zone und Jahreszeit. Die Zahlen sind Wahrscheinlichkeiten in
// Prozent und müssen nicht auf 100 kommen.
const CLIMATE = {
  'nord-land': {
    fruehling: { klar: 30, bewoelkt: 35, regen: 30, nebel: 5 },
    sommer: { klar: 50, bewoelkt: 30, regen: 20 },
    herbst: { klar: 10, bewoelkt: 35, regen: 40, nebel: 15 },
    winter: { schnee: 45, regen: 20, bewoelkt: 25, nebel: 10 },
  },
  'mitte-land': {
    fruehling: { klar: 40, bewoelkt: 30, regen: 30 },
    sommer: { klar: 60, bewoelkt: 25, regen: 15 },
    herbst: { klar: 25, bewoelkt: 35, regen: 35, nebel: 5 },
    winter: { schnee: 30, regen: 25, bewoelkt: 30, klar: 15 },
  },
  'sued-land': {
    fruehling: { klar: 55, bewoelkt: 25, regen: 20 },
    sommer: { klar: 70, hitze: 20, bewoelkt: 10 },
    herbst: { klar: 40, bewoelkt: 30, regen: 30 },
    winter: { klar: 30, bewoelkt: 30, regen: 40 },
  },
  'wueste-land': {
    fruehling: { klar: 70, sandsturm: 20, bewoelkt: 10 },
    sommer: { hitze: 55, klar: 30, sandsturm: 15 },
    herbst: { klar: 65, sandsturm: 20, hitze: 15 },
    winter: { klar: 75, bewoelkt: 15, regen: 10 },
  },
  'nord-see': {
    fruehling: { bewoelkt: 35, regen: 30, sturm: 20, klar: 15 },
    sommer: { klar: 45, bewoelkt: 35, regen: 15, sturm: 5 },
    herbst: { sturm: 35, regen: 30, bewoelkt: 25, klar: 10 },
    winter: { sturm: 45, regen: 25, bewoelkt: 30 },
  },
  'mitte-see': {
    fruehling: { klar: 35, bewoelkt: 30, regen: 25, sturm: 10 },
    sommer: { klar: 60, bewoelkt: 30, regen: 10 },
    herbst: { klar: 25, bewoelkt: 30, regen: 30, sturm: 15 },
    winter: { sturm: 35, regen: 30, bewoelkt: 25, klar: 10 },
  },
  'sued-see': {
    fruehling: { klar: 50, bewoelkt: 30, regen: 15, sturm: 5 },
    sommer: { klar: 70, bewoelkt: 25, sturm: 5 },
    herbst: { klar: 35, bewoelkt: 30, regen: 25, sturm: 10 },
    winter: { klar: 20, bewoelkt: 25, regen: 25, sturm: 30 },
  },
  'wueste-see': {
    fruehling: { klar: 60, bewoelkt: 25, regen: 15 },
    sommer: { klar: 80, bewoelkt: 20 },
    herbst: { klar: 55, bewoelkt: 30, regen: 15 },
    winter: { klar: 35, bewoelkt: 30, regen: 25, sturm: 10 },
  },
};

function pickWeighted(weights, roll) {
  const total = Object.values(weights).reduce((sum, n) => sum + n, 0);
  let mark = roll * total;
  for (const [key, weight] of Object.entries(weights)) {
    mark -= weight;
    if (mark <= 0) return key;
  }
  return Object.keys(weights)[0];
}

// Weather that changed every single turn would read as noise. A spell that has
// already set in is likely to hold, as long as the season still allows it.
const PERSISTENCE = 0.45;

export function rollWeather(turn, previous = null, seed = 20517) {
  const { season } = calendarOfTurn(turn);
  const zones = {};
  ZONES.forEach((zone, index) => {
    const weights = CLIMATE[zone][season.key];
    const rng = mulberry32(seed + turn * 977 + index * 131);
    const holding = previous && previous[zone] && weights[previous[zone]];
    zones[zone] = holding && rng() < PERSISTENCE
      ? previous[zone]
      : pickWeighted(weights, rng());
  });
  return zones;
}

export function weatherKeyAt(state, col, row) {
  if (!state.weather) return 'klar';
  const isWater = state.map.tiles[row][col].type === 'water';
  return state.weather[zoneOf(row, isWater)] || 'klar';
}

export function weatherAt(state, col, row) {
  return weatherInfo(weatherKeyAt(state, col, row));
}

// Zusätzliche Bewegungspunkte, die das Wetter auf diesem Feld kostet.
export function weatherMoveCost(state, col, row) {
  return weatherAt(state, col, row).moveCost || 0;
}

// Was das Wetter am Ort der Schlacht mit den Waffengattungen macht.
export function weatherBattleModifiers(state, col, row) {
  const weather = weatherAt(state, col, row);
  const modifiers = {};
  if (weather.unitScale) modifiers.unitScale = weather.unitScale;
  if (weather.volley === false) modifiers.openingVolley = false;
  return { weather, modifiers };
}
