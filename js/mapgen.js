import {
  TILE_TYPES, CITY_DEFS, tileImpassable, tileMoveCost,
} from './data.js';
import {
  MAP_COLS, MAP_ROWS, MAP_BOUNDS, RIDGES, FORESTS, STRAITS, RIVERS, LAKES,
  isLandAt, lonOfCol, latOfRow, colOfLon, rowOfLat, kmPerDegreeLon,
  colOfLonExact, rowOfLatExact,
} from './geodata.js';
import { mulberry32 } from './prng.js';

const DEG_LON = (MAP_BOUNDS.east - MAP_BOUNDS.west) / MAP_COLS;
const DEG_LAT = (MAP_BOUNDS.north - MAP_BOUNDS.south) / MAP_ROWS;

function inBounds(col, row) {
  return col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS;
}

// Real distance between two points in degrees, which is what the ranges and
// forests are measured in - a degree of longitude is much shorter in Germania
// than it is in Africa.
function kmBetween(lonA, latA, lonB, latB) {
  const dx = (lonA - lonB) * kmPerDegreeLon((latA + latB) / 2);
  const dy = (latA - latB) * 111.0;
  return Math.hypot(dx, dy);
}

// A tile covers 54 km of coastline, so testing only its centre would drop
// small islands and shave headlands. Nine samples per tile: enough of them on
// land and the tile is land.
const SAMPLES = [-0.34, 0, 0.34];
const LAND_SAMPLE_THRESHOLD = 3;

function tileIsLand(col, row) {
  let hits = 0;
  for (const dy of SAMPLES) {
    for (const dx of SAMPLES) {
      if (isLandAt(lonOfCol(col) + dx * DEG_LON, latOfRow(row) + dy * DEG_LAT)) hits++;
    }
  }
  return hits >= LAND_SAMPLE_THRESHOLD;
}

// Smooth 1D/2D value noise, used to vary crest height, range width and the
// silhouette of the foothills so no two stretches of a range look alike.
function makeNoise1D(rng, frequency) {
  const size = 64;
  const table = Array.from({ length: size }, () => rng());
  return function noise1d(t) {
    const x = t * frequency;
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    const a = table[((i % size) + size) % size];
    const b = table[(((i + 1) % size) + size) % size];
    return a + (b - a) * s;
  };
}

function makeNoise2D(rng) {
  const size = 32;
  const table = Array.from({ length: size * size }, () => rng());
  const at = (x, y) => table[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  return function noise2d(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
    const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };
}

// Densifies a spine into evenly spaced samples via Catmull-Rom, so distance
// queries follow a smooth curve instead of the straight control polygon.
function sampleSpine(points, samplesPerSegment = 24) {
  const padded = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < padded.length - 2; i++) {
    const [p0, p1, p2, p3] = [padded[i - 1], padded[i], padded[i + 1], padded[i + 2]];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const lon = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
        + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
        + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const lat = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
        + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
        + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([lon, lat]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const MOUNTAIN_MIN_HEIGHT = 2.1;
const HILL_MIN_HEIGHT = 0.85;

// Height contributed by one range at a tile: highest on the crest, falling off
// sideways, tapering at both ends and dipping at each named pass.
function ridgeHeightAt(ridge, samples, lon, lat, alongNoise, widthNoise, edgeNoise) {
  let bestDist = Infinity;
  let bestT = 0;
  for (let i = 0; i < samples.length; i++) {
    const d = kmBetween(samples[i][0], samples[i][1], lon, lat);
    if (d < bestDist) {
      bestDist = d;
      bestT = i / (samples.length - 1);
    }
  }

  const width = ridge.halfWidthKm * (0.78 + 0.5 * widthNoise(bestT))
    + (edgeNoise(lon * 0.9, lat * 0.9) - 0.5) * 45;
  if (width <= 2 || bestDist > width) return 0;

  const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, bestT))) ** 0.45;
  let crest = ridge.crest * (0.72 + 0.38 * alongNoise(bestT)) * taper;
  for (const pass of ridge.passes) {
    const d = Math.abs(bestT - pass);
    if (d < 0.07) crest *= 0.16 + (d / 0.07) * 0.84;
  }

  const falloff = 1 - (bestDist / width) ** 2.1;
  return Math.max(0, crest * falloff);
}

function applyRidges(tiles, rng) {
  const alongNoise = makeNoise1D(rng, 6);
  const widthNoise = makeNoise1D(rng, 4);
  const edgeNoise = makeNoise2D(rng);
  // A bounding box per range, generous enough to cover the widest the range's
  // noise can make it. Most tiles are nowhere near most ranges, and skipping
  // them turns map generation from noticeable into instant.
  const sampled = RIDGES.map((ridge) => {
    const samples = sampleSpine(ridge.spine);
    const marginLat = (ridge.halfWidthKm * 1.4 + 45) / 111;
    const marginLon = marginLat / Math.max(0.3, Math.cos((ridge.spine[0][1] * Math.PI) / 180));
    return {
      ridge,
      samples,
      minLon: Math.min(...samples.map((p) => p[0])) - marginLon,
      maxLon: Math.max(...samples.map((p) => p[0])) + marginLon,
      minLat: Math.min(...samples.map((p) => p[1])) - marginLat,
      maxLat: Math.max(...samples.map((p) => p[1])) + marginLat,
    };
  });

  for (let row = 0; row < MAP_ROWS; row++) {
    const lat = latOfRow(row);
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = tiles[row][col];
      if (tile.type === 'water') continue;
      const lon = lonOfCol(col);
      let height = 0;
      for (const box of sampled) {
        if (lon < box.minLon || lon > box.maxLon || lat < box.minLat || lat > box.maxLat) continue;
        height = Math.max(height, ridgeHeightAt(box.ridge, box.samples, lon, lat, alongNoise, widthNoise, edgeNoise));
      }
      if (height < 0.12) continue;
      tile.ridgeHeight = height;
      if (height >= MOUNTAIN_MIN_HEIGHT) tile.type = 'mountain';
      else if (height >= HILL_MIN_HEIGHT) tile.type = 'hills';
    }
  }
}

// How many tiles inland a tile is. The fertile strip of North Africa is
// exactly the land the sea still reaches; everything beyond it is desert.
function distanceFromSea(tiles) {
  const dist = Array.from({ length: MAP_ROWS }, () => new Array(MAP_COLS).fill(Infinity));
  const queue = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (tiles[row][col].type === 'water') {
        dist[row][col] = 0;
        queue.push([col, row]);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const [col, row] = queue[head];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (!inBounds(c, r) || dist[r][c] !== Infinity) continue;
      dist[r][c] = dist[row][col] + 1;
      queue.push([c, r]);
    }
  }
  return dist;
}

// The Sahara and the Arabian interior. Desert is crossable but slow, which is
// what keeps Africa a coastal theatre rather than an open plain.
const DESERT_MAX_LAT = 33.5;
const DESERT_MIN_INLAND = 2;

function applyDeserts(tiles, seaDistance, rng) {
  const grain = makeNoise2D(rng);
  for (let row = 0; row < MAP_ROWS; row++) {
    const lat = latOfRow(row);
    if (lat > DESERT_MAX_LAT + 1.5) continue;
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = tiles[row][col];
      if (tile.type === 'water' || tile.type === 'mountain') continue;
      const lon = lonOfCol(col);
      // A ragged edge, so the desert does not begin along a ruled line.
      const edge = DESERT_MAX_LAT + (grain(lon * 0.7, lat * 0.7) - 0.5) * 1.6;
      if (lat > edge) continue;
      if (seaDistance[row][col] < DESERT_MIN_INLAND + (grain(lon, lat) < 0.4 ? 1 : 0)) continue;
      tile.type = 'desert';
    }
  }
}

function applyForests(tiles, rng) {
  const grain = makeNoise2D(rng);
  for (let row = 0; row < MAP_ROWS; row++) {
    const lat = latOfRow(row);
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = tiles[row][col];
      if (tile.type !== 'plains') continue;
      const lon = lonOfCol(col);
      for (const forest of FORESTS) {
        const reach = forest.radiusKm * (0.7 + 0.6 * grain(lon * 0.6, lat * 0.6));
        if (kmBetween(forest.centre[0], forest.centre[1], lon, lat) <= reach) {
          tile.type = 'forest';
          break;
        }
      }
    }
  }
  // A scattering of unnamed woodland everywhere temperate, so the named
  // forests are not the only trees on the map.
  for (let row = 0; row < MAP_ROWS; row++) {
    const lat = latOfRow(row);
    if (lat < 36) continue;
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = tiles[row][col];
      if (tile.type !== 'plains') continue;
      if (grain(lonOfCol(col) * 1.7, lat * 1.7) > 0.72 && rng() < 0.8) tile.type = 'forest';
    }
  }
}

function applyHills(tiles, rng) {
  const grain = makeNoise2D(rng);
  for (let row = 0; row < MAP_ROWS; row++) {
    const lat = latOfRow(row);
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = tiles[row][col];
      if (tile.type !== 'plains' && tile.type !== 'forest') continue;
      if (grain(lonOfCol(col) * 1.1 + 40, lat * 1.1) > 0.76 && rng() < 0.7) {
        tile.type = 'hills';
        tile.ridgeHeight = 0.9 + rng() * 0.5;
      }
    }
  }
}

// Elevation is the crest height where a range set one, and a low roll of the
// ground everywhere else.
function assignElevation(tiles, rng) {
  const roll = makeNoise2D(rng);
  for (let row = 0; row < MAP_ROWS; row++) {
    const lat = latOfRow(row);
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = tiles[row][col];
      const base = TILE_TYPES[tile.type].elevation;
      if (tile.type === 'water') {
        tile.elevation = base;
        continue;
      }
      const undulation = (roll(lonOfCol(col) * 1.4, lat * 1.4) - 0.5) * 0.28;
      tile.elevation = Math.max(0, (tile.ridgeHeight ?? base) + undulation);
    }
  }
}

// A gentle, centre-weighted blur. A plain box blur would shave the crests flat;
// weighting the tile itself keeps the ridgelines while softening the slopes.
const SMOOTH_CENTER_WEIGHT = 4;

function smoothElevation(tiles, passes) {
  for (let pass = 0; pass < passes; pass++) {
    const source = tiles.map((line) => line.map((t) => t.elevation));
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (tiles[row][col].type === 'water') continue;
        let sum = source[row][col] * SMOOTH_CENTER_WEIGHT;
        let weight = SMOOTH_CENTER_WEIGHT;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c = col + dc;
          const r = row + dr;
          if (!inBounds(c, r) || tiles[r][c].type === 'water') continue;
          sum += source[r][c];
          weight += 1;
        }
        tiles[row][col].elevation = sum / weight;
      }
    }
  }
}

// Which connected stretch of walkable ground each tile belongs to, -1 for sea
// and mountain. The map never changes after this, so working it out once here
// saves every later question of "could an army walk there" a search.
function labelLandmasses(tiles) {
  const label = new Int32Array(MAP_COLS * MAP_ROWS).fill(-1);
  let next = 0;
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (label[row * MAP_COLS + col] !== -1) continue;
      if (tileImpassable(tiles[row][col])) continue;
      const stack = [[col, row]];
      while (stack.length) {
        const [c, r] = stack.pop();
        if (!inBounds(c, r)) continue;
        const index = r * MAP_COLS + c;
        if (label[index] !== -1 || tileImpassable(tiles[r][c])) continue;
        label[index] = next;
        stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
      }
      next++;
    }
  }
  return label;
}

// Dasselbe für das Wasser: welche Meere zusammenhängen. Ein Seeweg gibt es nur
// zwischen zwei Häfen an demselben Meer - vom Kaspischen Meer fährt kein Schiff
// ins Mittelmeer, so nah die beiden auf der Karte auch liegen.
function labelSeas(tiles) {
  const label = new Int32Array(MAP_COLS * MAP_ROWS).fill(-1);
  let next = 0;
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (label[row * MAP_COLS + col] !== -1) continue;
      if (tiles[row][col].type !== 'water') continue;
      const stack = [[col, row]];
      while (stack.length) {
        const [c, r] = stack.pop();
        if (!inBounds(c, r)) continue;
        const index = r * MAP_COLS + c;
        if (label[index] !== -1 || tiles[r][c].type !== 'water') continue;
        label[index] = next;
        stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
      }
      next++;
    }
  }
  return label;
}

// --- Flüsse ---------------------------------------------------------------
// Ein Fluss besetzt kein Feld, er trennt zwei. Der Linienzug aus geodata.js
// wird deshalb nicht in Felder, sondern in Feldgrenzen übersetzt: wo der Lauf
// von einem Feld ins nächste wechselt, entsteht eine Kante. Über eine solche
// Kante zu ziehen kostet extra - es sei denn, eine Straße führt hinüber, denn
// wer eine Straße baut, baut auch die Brücke.

// Der Schlüssel einer Kante: die beiden Feldnummern, immer in derselben
// Reihenfolge, damit sie von beiden Seiten gleich heißt.
export function riverEdgeKey(colA, rowA, colB, rowB) {
  const a = rowA * MAP_COLS + colA;
  const b = rowB * MAP_COLS + colB;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Der Lauf folgt den Ecken des Rasters, nicht den Feldmitten: ein Fluss liegt
// zwischen zwei Feldern. Der Linienzug wird fein abgetastet, jede Abtastung
// auf die nächste Rasterecke gezogen, und je zwei aufeinanderfolgende Ecken
// ergeben ein Stück Ufer - also die Grenze zwischen genau den beiden Feldern,
// die links und rechts davon liegen.
//
// Ecke (i, j) sitzt bei den Feldkoordinaten (i - 0,5 | j - 0,5). Ein
// waagerechtes Stück von (i, j) nach (i+1, j) trennt die Felder (i, j-1) und
// (i, j); ein senkrechtes von (i, j) nach (i, j+1) trennt (i-1, j) und (i, j).
function traceRiver(tiles, course) {
  const edges = [];
  // Ein Uferstück fällt nur weg, wenn beide Seiten Meer sind - dann ist der
  // Fluss schon in der See. Liegt nur eine Seite im Wasser, ist das die
  // Mündung, und die gehört dazu: sonst hört der Lauf ein Feld vor der Küste
  // auf, und genau das sah nach einer Lücke aus.
  const wet = (col, row) => !inBounds(col, row) || tiles[row][col].type === 'water';
  const add = (colA, rowA, colB, rowB) => {
    if (!inBounds(colA, rowA) || !inBounds(colB, rowB)) return;
    if (wet(colA, rowA) && wet(colB, rowB)) return;
    edges.push(riverEdgeKey(colA, rowA, colB, rowB));
  };
  const segment = (from, to) => {
    if (from.i === to.i) {
      // senkrechtes Ufer: trennt links und rechts
      const j = Math.min(from.j, to.j);
      add(from.i - 1, j, from.i, j);
    } else {
      // waagerechtes Ufer: trennt oben und unten
      const i = Math.min(from.i, to.i);
      add(i, from.j - 1, i, from.j);
    }
  };

  let previous = null;
  for (let k = 0; k < course.length - 1; k++) {
    const [lon1, lat1] = course[k];
    const [lon2, lat2] = course[k + 1];
    // Sechs Abtastungen je Feldbreite: enger, als das Raster auflösen kann.
    const steps = Math.max(2, Math.ceil(
      (Math.abs(lon2 - lon1) / DEG_LON + Math.abs(lat2 - lat1) / DEG_LAT) * 6
    ));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const current = {
        i: Math.round(colOfLonExact(lon1 + (lon2 - lon1) * t) + 0.5),
        j: Math.round(rowOfLatExact(lat1 + (lat2 - lat1) * t) + 0.5),
      };
      if (previous && (previous.i !== current.i || previous.j !== current.j)) {
        const di = current.i - previous.i;
        const dj = current.j - previous.j;
        if (Math.abs(di) + Math.abs(dj) === 1) {
          segment(previous, current);
        } else if (Math.abs(di) === 1 && Math.abs(dj) === 1) {
          // Über Eck: erst waagerecht, dann senkrecht - der Lauf bleibt eine
          // zusammenhängende Kette.
          const corner = { i: current.i, j: previous.j };
          segment(previous, corner);
          segment(corner, current);
        }
      }
      previous = current;
    }
  }
  return edges;
}

function traceRivers(tiles) {
  const edges = new Set();
  for (const river of RIVERS) {
    for (const key of traceRiver(tiles, river.course)) edges.add(key);
  }
  return edges;
}

export function generateMap(seed = 1337) {
  const rng = mulberry32(seed);
  const tiles = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const line = [];
    for (let col = 0; col < MAP_COLS; col++) {
      line.push({ type: tileIsLand(col, row) ? 'plains' : 'water' });
    }
    tiles.push(line);
  }

  // No settlement may end up in the sea, whatever the sampling decided.
  for (const city of CITY_DEFS) {
    const col = colOfLon(city.lon);
    const row = rowOfLat(city.lat);
    if (inBounds(col, row)) tiles[row][col].type = 'plains';
  }

  applyRidges(tiles, rng);
  applyDeserts(tiles, distanceFromSea(tiles), rng);
  applyForests(tiles, rng);
  applyHills(tiles, rng);

  // Clear the ground around every settlement so towns sit on open land. The
  // sea is left alone: pushing land into it would silt up the harbours and
  // swallow the small islands whole.
  for (const city of CITY_DEFS) {
    const centreCol = colOfLon(city.lon);
    const centreRow = rowOfLat(city.lat);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const col = centreCol + dc;
        const row = centreRow + dr;
        if (!inBounds(col, row)) continue;
        if (tiles[row][col].type === 'water') continue;
        // A town in the desert keeps its desert; it just loses the mountains.
        if (tiles[row][col].type !== 'desert') tiles[row][col].type = 'plains';
        delete tiles[row][col].ridgeHeight;
      }
    }
  }

  // Cut the narrows open last: clearing the ground around Tingis would
  // otherwise close the Strait of Gibraltar again.
  for (const strait of STRAITS) {
    const col = colOfLon(strait.lon);
    const row = rowOfLat(strait.lat);
    if (inBounds(col, row)) tiles[row][col].type = 'water';
  }

  // Und zuletzt die Seen. Sie kommen nach allem anderen, damit weder die
  // Wüstenrechnung noch das Freiräumen um die Orte sie wieder zuschüttet -
  // und sie weichen jedem Ort aus, der genau auf ihrem Feld steht.
  const orte = new Set(CITY_DEFS.map((c) => `${colOfLon(c.lon)},${rowOfLat(c.lat)}`));
  for (const see of LAKES) {
    const col = colOfLon(see.lon);
    const row = rowOfLat(see.lat);
    for (const [dc, dr] of [[0, 0], ...(see.felder || [])]) {
      const c = col + dc;
      const r = row + dr;
      if (!inBounds(c, r)) continue;
      if (orte.has(`${c},${r}`)) continue;
      tiles[r][c].type = 'water';
      // Der Merker unterscheidet den See vom Meer: an ihm liegt kein Hafen.
      tiles[r][c].lake = true;
      tiles[r][c].lakeName = see.name;
    }
  }

  assignElevation(tiles, rng);
  smoothElevation(tiles, 1);

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tiles,
    landmass: labelLandmasses(tiles),
    seas: labelSeas(tiles),
    // Die Flüsse entstehen zuletzt: erst muss feststehen, wo Land ist.
    rivers: traceRivers(tiles),
  };
}


// Eine Route über Land: der günstigste Weg zwischen zwei Feldern, damit eine
// Straße dem Gelände folgt und nicht quer durch die Adria gezogen wird.
// Braucht nur die Karte, deshalb steht sie hier und nicht bei den Regeln.
// Ein bereits gepflastertes Feld ist als Wegstück fast geschenkt: neue
// Straßen legen sich deshalb gerne an das bestehende Netz an.
// Was ein Flussübergang die Wegsuche kostet. Hoch genug, dass eine Straße
// lieber ein paar Felder am Ufer entlangzieht, als ein zweites Mal überzusetzen.
const ROUTE_RIVER_COST = 8;
// Was es kostet, eine neue Trasse neben eine bestehende zu legen.
const ROUTE_PARALLEL_COST = 3;

// `avoid` nennt Felder, die der Weg möglichst meiden soll - beim Aufbau des
// Startnetzes sind das die anderen Orte: eine Straße von der Hauptstadt zu
// einer Stadt soll nicht nebenbei ein Dorf anschließen, das noch keines
// haben soll. Gesperrt sind sie nicht, nur teuer; führt kein anderer Weg,
// nimmt die Straße ihn trotzdem.
const ROUTE_AVOID_COST = 60;

export function landRoute(map, from, to, roads = null, avoid = null) {
  const { cols, rows, tiles } = map;
  const key = (col, row) => row * cols + col;
  const start = key(from.col, from.row);
  const goal = key(to.col, to.row);
  // Step costs are small integers, so the frontier is a row of buckets keyed
  // by cost - no sorting, and the whole search stays linear.
  const cost = new Int32Array(cols * rows).fill(-1);
  const prev = new Int32Array(cols * rows).fill(-1);
  const buckets = [[start]];
  cost[start] = 0;

  for (let level = 0; level < buckets.length; level++) {
    const bucket = buckets[level];
    if (!bucket) continue;
    for (const currentKey of bucket) {
      if (cost[currentKey] !== level) continue;
      if (currentKey === goal) { level = buckets.length; break; }
      const col = currentKey % cols;
      const row = (currentKey - col) / cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const tile = tiles[nr][nc];
        if (tileImpassable(tile)) continue;
        // Eine bestehende Straße ist der billigste Weg - so legt sich eine
        // neue Verbindung auf das vorhandene Netz, statt eine zweite Trasse
        // danebenzuziehen.
        const gepflastert = roads && roads[`${nc},${nr}`];
        let step = gepflastert ? 1 : tileMoveCost(tile);
        // Neben einer bestehenden Straße herzulaufen ist teurer als auf ihr:
        // sonst legt sich eine zweite Trasse ein Feld daneben, wo eine
        // gereicht hätte. Wer auf die Straße einbiegt, zahlt das nicht - der
        // Schritt kostet dann ohnehin nur eins.
        if (!gepflastert && roads) {
          for (const [pc, pr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const sc = nc + pc;
            const sr = nr + pr;
            if (sc === col && sr === row) continue;
            if (roads[`${sc},${sr}`]) { step += ROUTE_PARALLEL_COST; break; }
          }
        }
        // Ein Fluss dazwischen kostet extra - es sei denn, hier steht schon
        // eine Brücke. Zwei Übergänge über denselben Fluss, zwei Felder
        // auseinander, sind zwei Brücken zu viel.
        if (map.rivers && map.rivers.has(riverEdgeKey(col, row, nc, nr))) {
          const bruecke = roads && roads[`${col},${row}`] && gepflastert;
          step += bruecke ? 0 : ROUTE_RIVER_COST;
        }
        const nextKey = key(nc, nr);
        if (avoid && nextKey !== goal && avoid.has(`${nc},${nr}`)) step += ROUTE_AVOID_COST;
        const next = level + step;
        if (cost[nextKey] !== -1 && cost[nextKey] <= next) continue;
        cost[nextKey] = next;
        prev[nextKey] = currentKey;
        (buckets[next] || (buckets[next] = [])).push(nextKey);
      }
    }
  }

  if (cost[goal] === -1) return null;
  const path = [];
  for (let k = goal; k !== -1; k = prev[k]) {
    path.push({ col: k % cols, row: (k - (k % cols)) / cols });
    if (k === start) break;
  }
  return path.reverse();
}
