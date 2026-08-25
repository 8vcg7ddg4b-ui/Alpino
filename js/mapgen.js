import { MAP_COLS, MAP_ROWS, TILE_TYPES, CITY_DEFS } from './data.js';
import { mulberry32 } from './prng.js';

function inBounds(col, row) {
  return col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS;
}

// Stylised Europe / Mediterranean / North-Africa coastline: a wide mainland
// up north, three peninsulas (Iberia, Italy, Greece) reaching into an inland
// sea, Sicily and a few Aegean islands, and a North-African strip in the south.
const MAINLAND_ROWS = {
  0: [10, 34], 1: [6, 37], 2: [4, 39],
};
const MAINLAND_DEFAULT = [3, 41];

const IBERIA = {
  10: [3, 16], 11: [3, 15], 12: [4, 14], 13: [4, 13], 14: [5, 13],
  15: [5, 12], 16: [6, 12], 17: [6, 11], 18: [7, 11], 19: [7, 10], 20: [8, 10],
};
const ITALY = {
  10: [19, 28], 11: [20, 27], 12: [21, 26], 13: [21, 25], 14: [21, 24],
  15: [21, 24], 16: [21, 23], 17: [21, 23], 18: [21, 23], 19: [21, 23],
  20: [21, 22], 21: [21, 22], 22: [21, 22],
};
const GREECE = {
  10: [31, 41], 11: [32, 40], 12: [33, 39], 13: [33, 38], 14: [33, 37],
  15: [33, 36], 16: [33, 35], 17: [33, 35], 18: [33, 34], 19: [33, 34], 20: [33, 34],
};
// A narrow Sicily land bridge (23-24) is the only link from Italy's toe down
// to the wide North-African coast that opens up from row 25 on.
const AFRICA = {
  23: [20, 24], 24: [19, 25], 25: [6, 35], 26: [7, 33], 27: [9, 30],
};
const AEGEAN_ISLANDS = [[37, 19], [38, 21], [36, 23], [40, 22]];

// Mountain ranges are described by a curved spine rather than a rectangle, so
// they read as a range winding across the land instead of a straight wall.
// `passes` are fractions along the spine where the crest dips into a saddle -
// they keep the range crossable (mountains are impassable terrain).
const RIDGES = [
  {
    name: 'Alpen',
    spine: [[15.5, 9.2], [18, 6.8], [21.5, 5.4], [25, 6.2], [27.5, 8.2]],
    halfWidth: 2.5,
    crest: 4.6,
    passes: [0.36, 0.74],
  },
  {
    name: 'Pyrenäen',
    spine: [[11.8, 11.2], [14.2, 9.6], [17, 10.4]],
    halfWidth: 2.1,
    crest: 4,
    passes: [0.55],
  },
];

const MOUNTAIN_MIN_HEIGHT = 2.1;
const HILL_MIN_HEIGHT = 0.85;

function isLand(col, row) {
  const mainRange = row <= 9 ? (MAINLAND_ROWS[row] || MAINLAND_DEFAULT) : null;
  if (mainRange) return col >= mainRange[0] && col <= mainRange[1];

  for (const table of [IBERIA, ITALY, GREECE, AFRICA]) {
    const range = table[row];
    if (range && col >= range[0] && col <= range[1]) return true;
  }
  return AEGEAN_ISLANDS.some(([c, r]) => c === col && r === row);
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
      const col = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t
        + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
        + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const row = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t
        + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
        + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([col, row]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

// Height contributed by one ridge at a tile: highest on the crest, falling off
// sideways, tapering at both ends of the range and dipping at each pass.
function ridgeHeightAt(ridge, samples, col, row, alongNoise, widthNoise, edgeNoise) {
  let bestDist = Infinity;
  let bestT = 0;
  for (let i = 0; i < samples.length; i++) {
    const d = Math.hypot(samples[i][0] - col, samples[i][1] - row);
    if (d < bestDist) {
      bestDist = d;
      bestT = i / (samples.length - 1);
    }
  }

  const width = ridge.halfWidth * (0.62 + 0.76 * widthNoise(bestT))
    + (edgeNoise(col * 0.45, row * 0.45) - 0.5) * 1.5;
  if (width <= 0.05 || bestDist > width) return 0;

  const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, bestT))) ** 0.45;
  let crest = ridge.crest * (0.5 + 0.5 * alongNoise(bestT)) * taper;
  for (const pass of ridge.passes) {
    const d = Math.abs(bestT - pass);
    if (d < 0.07) crest *= 0.16 + (d / 0.07) * 0.84;
  }

  const falloff = 1 - (bestDist / width) ** 1.7;
  return Math.max(0, crest * falloff);
}

function applyRidges(tiles, rng) {
  const alongNoise = makeNoise1D(rng, 6);
  const widthNoise = makeNoise1D(rng, 4);
  const edgeNoise = makeNoise2D(rng);
  const sampled = RIDGES.map((ridge) => ({ ridge, samples: sampleSpine(ridge.spine) }));

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = tiles[row][col];
      if (tile.type === 'water') continue;
      let height = 0;
      for (const { ridge, samples } of sampled) {
        height = Math.max(height, ridgeHeightAt(ridge, samples, col, row, alongNoise, widthNoise, edgeNoise));
      }
      if (height < 0.12) continue;
      tile.ridgeHeight = height;
      if (height >= MOUNTAIN_MIN_HEIGHT) tile.type = 'mountain';
      else if (height >= HILL_MIN_HEIGHT) tile.type = 'hills';
    }
  }
}

function paintBlob(tiles, cx, cy, radius, type, rng) {
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (tiles[row][col].type !== 'plains') continue;
      const d = Math.hypot(col - cx, row - cy);
      const jitter = radius * (0.35 + rng() * 0.5);
      if (d <= jitter) tiles[row][col].type = type;
    }
  }
}

export function generateMap(seed = 1337) {
  const rng = mulberry32(seed);
  const tiles = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const line = [];
    for (let col = 0; col < MAP_COLS; col++) {
      line.push({ type: isLand(col, row) ? 'plains' : 'water' });
    }
    tiles.push(line);
  }

  applyRidges(tiles, rng);

  const forestBlobs = 16;
  for (let i = 0; i < forestBlobs; i++) {
    const cx = 2 + rng() * (MAP_COLS - 4);
    const cy = 1 + rng() * (MAP_ROWS - 2);
    paintBlob(tiles, cx, cy, 1.6 + rng() * 1.4, 'forest', rng);
  }

  const hillBlobs = 14;
  for (let i = 0; i < hillBlobs; i++) {
    const cx = 2 + rng() * (MAP_COLS - 4);
    const cy = 1 + rng() * (MAP_ROWS - 2);
    paintBlob(tiles, cx, cy, 1.3 + rng() * 1.3, 'hills', rng);
  }

  // Clear terrain around every city so settlements always sit on open plains.
  for (const city of CITY_DEFS) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const col = city.col + dc;
        const row = city.row + dr;
        if (!inBounds(col, row)) continue;
        tiles[row][col].type = 'plains';
        delete tiles[row][col].ridgeHeight;
      }
    }
  }

  // Elevation is purely cosmetic (gameplay cost/defense comes from tile.type),
  // so ridges keep their own sculpted height and the remaining land gets a
  // gentle roll instead of being perfectly flat.
  const rollNoise = makeNoise2D(rng);
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = tiles[row][col];
      if (tile.ridgeHeight !== undefined) {
        tile.elevation = tile.ridgeHeight;
      } else {
        const base = TILE_TYPES[tile.type].elevation;
        tile.elevation = tile.type === 'water'
          ? base
          : base + (rollNoise(col * 0.32, row * 0.32) - 0.5) * 0.55;
      }
    }
  }

  smoothElevation(tiles, 1);

  return { cols: MAP_COLS, rows: MAP_ROWS, tiles };
}

// Center-weighted blur: it softens the joins between terrain types without
// flattening the ridge crests, which an even 1/5 box blur would erase.
const SMOOTH_CENTER_WEIGHT = 4;

function smoothElevation(tiles, iterations) {
  const neighborOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let iter = 0; iter < iterations; iter++) {
    const next = tiles.map((row) => row.map((t) => t.elevation));
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        let sum = tiles[row][col].elevation * SMOOTH_CENTER_WEIGHT;
        let weight = SMOOTH_CENTER_WEIGHT;
        for (const [dc, dr] of neighborOffsets) {
          const nc = col + dc;
          const nr = row + dr;
          if (nc >= 0 && nc < MAP_COLS && nr >= 0 && nr < MAP_ROWS) {
            sum += tiles[nr][nc].elevation;
            weight++;
          }
        }
        next[row][col] = sum / weight;
      }
    }
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) tiles[row][col].elevation = next[row][col];
    }
  }
}
