// The campaign map's geography, in real degrees.
//
// Everything here is longitude/latitude, taken from the actual coastline and
// the actual mountain ranges, and rasterised onto the tile grid by mapgen.js.
// That is what makes the map both bigger and truer: the resolution can change
// without anyone re-drawing a coastline by hand, settlements are placed at the
// coordinates of the real towns, and the shapes a player recognises - the boot
// of Italy, the Peloponnese, the Gulf of Sirte - come out right by themselves.

// The frame of the Roman world: Atlantic to Mesopotamia, Sahara to Jutland.
export const MAP_BOUNDS = { west: -10.5, east: 42.5, south: 29.5, north: 55.5 };

// Chosen so a tile is roughly 55 km across at the middle of the map.
export const MAP_COLS = 80;
export const MAP_ROWS = 52;

export function lonOfCol(col) {
  const { west, east } = MAP_BOUNDS;
  return west + ((col + 0.5) / MAP_COLS) * (east - west);
}

export function latOfRow(row) {
  const { south, north } = MAP_BOUNDS;
  // Row 0 is the top of the map, which is the north.
  return north - ((row + 0.5) / MAP_ROWS) * (north - south);
}

export function colOfLon(lon) {
  const { west, east } = MAP_BOUNDS;
  const col = Math.floor(((lon - west) / (east - west)) * MAP_COLS);
  return Math.max(0, Math.min(MAP_COLS - 1, col));
}

export function rowOfLat(lat) {
  const { south, north } = MAP_BOUNDS;
  const row = Math.floor(((north - lat) / (north - south)) * MAP_ROWS);
  return Math.max(0, Math.min(MAP_ROWS - 1, row));
}

// Degrees of longitude shrink towards the poles; distances in the north would
// otherwise read as far larger than they are.
export function kmPerDegreeLon(lat) {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

// Europe, Asia Minor and the Levant as one landmass: up the Atlantic, along
// the North Sea to Jutland, out to the map's northern and eastern edges, then
// back the whole length of the Mediterranean's northern shore.
const EURASIA = [
  // Atlantic: Gibraltar up to Brittany
  [-5.60, 36.00], [-6.30, 36.60], [-7.40, 37.20], [-8.80, 37.02],
  [-8.85, 38.40], [-9.50, 38.78], [-8.87, 41.90], [-8.90, 43.30],
  [-6.00, 43.60], [-3.80, 43.48], [-1.78, 43.38], [-1.25, 46.20],
  [-2.20, 47.30], [-4.80, 48.35], [-2.00, 48.65],
  // Channel and North Sea up to Jutland
  [0.10, 49.50], [1.60, 50.95], [3.20, 51.40], [4.30, 52.40],
  [5.20, 53.40], [8.20, 53.90], [8.50, 55.00],
  // Out to the northern and eastern edges of the map
  [8.50, 56.20], [43.50, 56.20], [43.50, 29.00],
  // Back west along the southern edge, then north up the Levant
  [34.40, 29.00], [34.30, 31.25], [34.60, 31.60], [35.00, 33.30],
  [35.90, 35.90], [36.20, 36.60], [34.70, 36.30], [33.00, 36.30],
  [31.00, 36.30], [29.20, 36.60], [28.20, 36.60], [27.30, 37.00],
  // Aegean coast of Asia Minor, the straits, and Thrace
  [26.30, 38.30], [26.10, 39.50], [26.20, 40.30], [25.00, 40.60],
  [24.00, 40.50], [23.00, 40.50], [22.60, 40.00], [23.00, 39.00],
  // Greece: Euboean shore, Attica, the Peloponnese
  [23.20, 38.30], [23.70, 37.90], [23.10, 37.50], [23.20, 36.40],
  [22.50, 36.40], [21.70, 36.80], [21.30, 37.60], [21.10, 38.30],
  [20.80, 38.90], [19.90, 39.80],
  // Adriatic: Albania, Dalmatia, Istria, the Po
  [19.30, 40.40], [19.50, 41.30], [18.60, 42.40], [16.20, 43.50],
  [15.20, 44.30], [13.60, 45.50], [12.30, 45.40],
  // Italy: down the Adriatic side, round the heel and the toe
  [12.60, 44.10], [13.50, 43.60], [14.80, 42.10], [16.00, 41.90],
  [18.40, 40.10], [17.20, 40.50], [16.50, 39.30], [17.15, 38.90],
  [15.65, 38.11],
  // Italy: up the Tyrrhenian coast to Liguria
  [16.10, 38.70], [15.30, 40.00], [14.30, 40.60], [13.60, 41.20],
  [12.25, 41.75], [11.20, 42.40], [10.30, 43.60], [9.80, 44.30],
  [8.90, 44.40],
  // Gaul and Hispania: Provence, the Ebro, the Levante, Baetica
  [7.60, 43.80], [5.40, 43.30], [3.10, 43.10], [3.20, 41.90],
  [2.20, 41.40], [0.90, 41.00], [-0.30, 39.40], [-0.70, 38.20],
  [-2.00, 36.90], [-4.50, 36.70],
];

// North Africa, from the Atlantic coast of Morocco to the Nile delta and on
// to Gaza, where it meets Asia at Sinai.
const AFRICA = [
  [-9.60, 29.00], [-9.80, 31.50], [-8.60, 33.30], [-6.80, 34.00],
  [-5.90, 35.80], [-5.30, 35.90], [-2.20, 35.10], [0.60, 35.80],
  [3.10, 36.80], [5.80, 36.90], [7.80, 36.90], [8.70, 37.05],
  [10.30, 37.05], [10.20, 36.80], [10.80, 35.80], [11.10, 35.20],
  [10.10, 34.30], [10.10, 33.80], [11.10, 33.20], [12.00, 32.90],
  [13.20, 32.90], [15.20, 32.40], [18.00, 30.80], [20.10, 31.10],
  [21.90, 32.90], [23.10, 32.60], [25.10, 31.60], [27.20, 31.30],
  [29.90, 31.20], [31.80, 31.40], [32.50, 31.10], [34.20, 31.20],
  [34.50, 29.00],
];

// Islands: no road leads to any of them, which is what fleets are for.
const ISLANDS = [
  // Sicilia
  [[12.43, 37.80], [13.36, 38.13], [14.50, 38.05], [15.65, 38.26],
    [15.28, 37.07], [14.50, 36.70], [12.60, 37.57]],
  // Sardinia
  [[8.20, 41.10], [9.20, 41.25], [9.60, 40.90], [9.70, 40.00],
    [9.50, 39.20], [9.10, 38.95], [8.40, 39.10], [8.40, 40.00]],
  // Corsica
  [[8.60, 42.98], [9.45, 42.70], [9.55, 42.10], [9.30, 41.40],
    [8.80, 41.40], [8.60, 42.00]],
  // Kreta
  [[23.50, 35.50], [24.80, 35.62], [26.30, 35.32], [26.15, 35.00],
    [24.70, 34.90], [23.60, 35.18]],
  // Zypern
  [[32.30, 35.10], [34.60, 35.70], [34.00, 34.90], [32.90, 34.60]],
  // Mallorca und Menorca
  [[2.35, 39.55], [3.45, 39.75], [3.15, 39.28], [2.35, 39.28]],
  [[3.80, 40.05], [4.30, 40.05], [4.25, 39.82], [3.85, 39.85]],
  // Ibiza
  [[1.20, 39.10], [1.60, 39.10], [1.60, 38.65], [1.20, 38.70]],
  // Rhodos
  [[27.70, 36.45], [28.25, 36.40], [28.20, 35.90], [27.75, 36.00]],
  // Euböa
  [[23.00, 38.65], [24.60, 38.50], [24.20, 37.98], [23.20, 38.30]],
  // Korfu
  [[19.60, 39.82], [20.12, 39.75], [20.00, 39.35], [19.72, 39.45]],
  // Britannia
  [[-5.70, 50.05], [-1.00, 50.72], [0.70, 51.40], [1.70, 52.70],
    [0.00, 53.60], [-0.20, 54.60], [-1.40, 56.20], [-5.20, 56.20],
    [-3.60, 54.60], [-3.00, 53.40], [-4.70, 53.30], [-5.30, 51.70],
    [-4.20, 51.20], [-3.40, 51.25]],
  // Hibernia
  [[-10.30, 51.60], [-6.20, 52.20], [-6.00, 54.10], [-7.60, 55.30],
    [-10.30, 54.00]],
];

// Seas cut back out of the land: without this the Black Sea and the Baltic
// would be filled in by the great eastern landmass.
const INLAND_SEAS = [
  // Ostsee, zwischen der jütischen Halbinsel und dem Nordrand der Karte
  [[9.60, 54.40], [11.00, 54.30], [13.00, 54.40], [16.00, 54.40],
    [19.00, 54.70], [21.50, 55.40], [23.00, 56.60], [10.00, 56.60]],

  // Schwarzes Meer mit Marmarameer und Asowschem Meer
  [[28.10, 41.20], [29.20, 41.30], [31.50, 41.10], [34.00, 42.00],
    [36.50, 45.00], [38.30, 46.30], [39.20, 47.20], [37.50, 47.10],
    [35.00, 45.30], [33.60, 46.20], [31.50, 46.60], [29.70, 45.30],
    [28.70, 44.80], [27.90, 43.40], [28.20, 42.00], [27.00, 40.90],
    [26.20, 40.40], [26.60, 40.30], [28.50, 40.60], [29.30, 40.70],
    [29.00, 41.00]],
];

// Mountain ranges as their real spines. `crest` is how high the range rises,
// `passes` are fractions along the spine where it dips into a saddle - without
// them an impassable range would seal a whole province off.
export const RIDGES = [
  {
    name: 'Alpen',
    spine: [[6.0, 45.9], [7.6, 45.9], [9.5, 46.4], [11.5, 46.9], [13.5, 47.0], [15.2, 47.2]],
    halfWidthKm: 130, crest: 4.7, passes: [0.32, 0.68],
  },
  {
    name: 'Pyrenäen',
    spine: [[-1.7, 43.3], [0.5, 42.8], [2.5, 42.4], [3.1, 42.4]],
    halfWidthKm: 75, crest: 4.1, passes: [0.5],
  },
  {
    name: 'Apennin',
    spine: [[9.9, 44.4], [11.5, 43.9], [13.3, 42.8], [14.5, 41.6], [16.0, 40.2], [16.3, 39.3]],
    halfWidthKm: 65, crest: 3.4, passes: [0.28, 0.62],
  },
  {
    name: 'Karpaten',
    spine: [[19.0, 49.3], [21.5, 48.6], [24.5, 47.8], [25.6, 46.2], [23.6, 45.4], [22.4, 45.3]],
    halfWidthKm: 95, crest: 3.9, passes: [0.42],
  },
  {
    name: 'Dinarisches Gebirge',
    spine: [[14.5, 45.5], [17.0, 44.0], [19.0, 42.6], [20.5, 41.5], [21.4, 40.2]],
    halfWidthKm: 85, crest: 3.5, passes: [0.4, 0.78],
  },
  {
    name: 'Pindos',
    spine: [[20.9, 40.2], [21.3, 39.2], [21.9, 38.5], [22.4, 37.9]],
    halfWidthKm: 60, crest: 3.2, passes: [0.55],
  },
  {
    name: 'Taurus',
    spine: [[29.6, 37.0], [32.0, 37.2], [34.5, 37.4], [36.6, 37.6]],
    halfWidthKm: 90, crest: 3.8, passes: [0.36, 0.74],
  },
  {
    name: 'Atlas',
    spine: [[-8.0, 31.4], [-5.0, 32.5], [-1.0, 34.2], [2.5, 35.6], [6.5, 36.3]],
    halfWidthKm: 90, crest: 3.6, passes: [0.3, 0.66],
  },
  {
    name: 'Kantabrisches Gebirge',
    spine: [[-7.2, 43.0], [-4.5, 43.0], [-2.2, 42.6]],
    halfWidthKm: 60, crest: 3.0, passes: [0.5],
  },
  {
    name: 'Sierra Nevada',
    spine: [[-5.6, 37.0], [-3.3, 37.1], [-1.6, 37.6]],
    halfWidthKm: 55, crest: 2.9, passes: [0.48],
  },
  {
    name: 'Zentralmassiv',
    spine: [[2.0, 45.6], [3.4, 45.0], [4.1, 44.2]],
    halfWidthKm: 70, crest: 2.6, passes: [0.5],
  },
  {
    name: 'Balkan',
    spine: [[22.6, 43.2], [25.0, 42.8], [27.3, 42.8]],
    halfWidthKm: 60, crest: 3.0, passes: [0.5],
  },
];

// Great forests, named where they were named. The Hercynian belt across
// Germania is the reason the tribes could hold ground against better-drilled
// armies: every step into it costs double.
export const FORESTS = [
  { name: 'Hercynischer Wald', centre: [10.5, 51.0], radiusKm: 380 },
  { name: 'Teutoburger Wald', centre: [8.4, 52.0], radiusKm: 190 },
  { name: 'Schwarzwald', centre: [8.2, 48.4], radiusKm: 120 },
  { name: 'Ardennen', centre: [5.4, 50.1], radiusKm: 150 },
  { name: 'Wald von Orléans', centre: [2.4, 47.6], radiusKm: 160 },
  { name: 'Arduenna Silva', centre: [16.0, 49.5], radiusKm: 220 },
  { name: 'Kaledonischer Wald', centre: [-3.5, 55.0], radiusKm: 190 },
  { name: 'Silva Litana', centre: [11.4, 44.6], radiusKm: 110 },
  { name: 'Wald von Numantia', centre: [-2.8, 42.0], radiusKm: 130 },
];

// A tile is 54 km across; the Strait of Gibraltar is 14 km, the Bosporus less
// than two. At this resolution the narrows that decided ancient naval strategy
// would silt up into land, so they are cut open by name.
export const STRAITS = [
  { name: 'Straße von Gibraltar', lon: -5.30, lat: 36.10 },
  { name: 'Straße von Messina', lon: 15.60, lat: 38.20 },
  { name: 'Hellespont', lon: 26.30, lat: 40.25 },
  // The Propontis: two tiles are what joins the Aegean to the Black Sea, and
  // Byzantion is left standing on the shore beside them rather than under them.
  { name: 'Propontis (West)', lon: 27.20, lat: 40.40 },
  { name: 'Propontis (Ost)', lon: 27.90, lat: 40.45 },
];

function pointInPolygon(lon, lat, shape) {
  // Most of the map is nowhere near most of these outlines; the bounding box
  // answers for them without touching a single edge.
  if (lon < shape.minLon || lon > shape.maxLon || lat < shape.minLat || lat > shape.maxLat) {
    return false;
  }
  const { points } = shape;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > lat) !== (yj > lat)
      && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function bounded(points) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { points, minLon, maxLon, minLat, maxLat };
}

const LAND_SHAPES = [EURASIA, AFRICA, ...ISLANDS].map(bounded);
const SEA_SHAPES = INLAND_SEAS.map(bounded);

export function isLandAt(lon, lat) {
  for (const sea of SEA_SHAPES) if (pointInPolygon(lon, lat, sea)) return false;
  for (const land of LAND_SHAPES) if (pointInPolygon(lon, lat, land)) return true;
  return false;
}
