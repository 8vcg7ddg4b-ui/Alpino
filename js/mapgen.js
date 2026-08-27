import { TILE_TYPES, CITY_DEFS } from './data.js';
import {
  MAP_COLS, MAP_ROWS, MAP_BOUNDS, RIDGES, FORESTS, STRAITS,
  isLandAt, lonOfCol, latOfRow, colOfLon, rowOfLat, kmPerDegreeLon,
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
      if (TILE_TYPES[tiles[row][col].type].impassable) continue;
      const stack = [[col, row]];
      while (stack.length) {
        const [c, r] = stack.pop();
        if (!inBounds(c, r)) continue;
        const index = r * MAP_COLS + c;
        if (label[index] !== -1 || TILE_TYPES[tiles[r][c].type].impassable) continue;
        label[index] = next;
        stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
      }
      next++;
    }
  }
  return label;
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

  assignElevation(tiles, rng);
  smoothElevation(tiles, 1);

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tiles,
    landmass: labelLandmasses(tiles),
  };
}
