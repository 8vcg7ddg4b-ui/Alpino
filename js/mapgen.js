import { MAP_COLS, MAP_ROWS, TILE_TYPES, CITY_DEFS } from './data.js';
import { mulberry32 } from './prng.js';

function inBounds(col, row) {
  return col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS;
}

function paintBlob(tiles, cx, cy, radius, type, rng) {
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const d = Math.hypot(col - cx, row - cy);
      const jitter = radius * (0.35 + rng() * 0.5);
      if (d <= jitter) {
        if (type === 'water' && tiles[row][col].type === 'mountain') continue;
        tiles[row][col].type = type;
      }
    }
  }
}

export function generateMap(seed = 1337) {
  const rng = mulberry32(seed);
  const tiles = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    const line = [];
    for (let col = 0; col < MAP_COLS; col++) {
      line.push({ type: 'plains' });
    }
    tiles.push(line);
  }

  // Mountain range along the top edge as a natural border.
  for (let col = 0; col < MAP_COLS; col++) {
    if (rng() < 0.55) tiles[0][col].type = 'mountain';
    if (rng() < 0.25) tiles[1][col].type = 'hills';
  }

  const forestBlobs = 6;
  for (let i = 0; i < forestBlobs; i++) {
    const cx = 1 + rng() * (MAP_COLS - 2);
    const cy = 2 + rng() * (MAP_ROWS - 3);
    paintBlob(tiles, cx, cy, 1.6 + rng() * 1.2, 'forest', rng);
  }

  const hillBlobs = 5;
  for (let i = 0; i < hillBlobs; i++) {
    const cx = 1 + rng() * (MAP_COLS - 2);
    const cy = 2 + rng() * (MAP_ROWS - 3);
    paintBlob(tiles, cx, cy, 1.2 + rng() * 1.2, 'hills', rng);
  }

  // A single lake, kept away from the map edges so it never seals a faction in.
  paintBlob(tiles, MAP_COLS * 0.55, MAP_ROWS * 0.55, 1.4, 'water', rng);

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

  return { cols: MAP_COLS, rows: MAP_ROWS, tiles };
}
