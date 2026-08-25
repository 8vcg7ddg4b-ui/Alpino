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

const ALPS = { rowMin: 5, rowMax: 8, colMin: 17, colMax: 28 };
const PYRENEES = { rowMin: 9, rowMax: 11, colMin: 13, colMax: 16 };

function isLand(col, row) {
  const mainRange = row <= 9 ? (MAINLAND_ROWS[row] || MAINLAND_DEFAULT) : null;
  if (mainRange) return col >= mainRange[0] && col <= mainRange[1];

  for (const table of [IBERIA, ITALY, GREECE, AFRICA]) {
    const range = table[row];
    if (range && col >= range[0] && col <= range[1]) return true;
  }
  return AEGEAN_ISLANDS.some(([c, r]) => c === col && r === row);
}

function inBand(band, col, row) {
  return row >= band.rowMin && row <= band.rowMax && col >= band.colMin && col <= band.colMax;
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

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (tiles[row][col].type !== 'plains') continue;
      if (inBand(ALPS, col, row) || inBand(PYRENEES, col, row)) {
        tiles[row][col].type = 'mountain';
      }
    }
  }

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
        if (inBounds(col, row)) tiles[row][col].type = 'plains';
      }
    }
  }

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      tiles[row][col].elevation = TILE_TYPES[tiles[row][col].type].elevation;
    }
  }

  // Elevation is purely cosmetic (gameplay cost/defense comes from tile.type),
  // so it can be blurred into gradual slopes for a natural-looking terrain
  // mesh instead of the sheer cliffs a per-type constant would otherwise draw.
  smoothElevation(tiles, 2);

  return { cols: MAP_COLS, rows: MAP_ROWS, tiles };
}

function smoothElevation(tiles, iterations) {
  const neighborOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let iter = 0; iter < iterations; iter++) {
    const next = tiles.map((row) => row.map((t) => t.elevation));
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        let sum = tiles[row][col].elevation;
        let count = 1;
        for (const [dc, dr] of neighborOffsets) {
          const nc = col + dc;
          const nr = row + dr;
          if (nc >= 0 && nc < MAP_COLS && nr >= 0 && nr < MAP_ROWS) {
            sum += tiles[nr][nc].elevation;
            count++;
          }
        }
        next[row][col] = sum / count;
      }
    }
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) tiles[row][col].elevation = next[row][col];
    }
  }
}
