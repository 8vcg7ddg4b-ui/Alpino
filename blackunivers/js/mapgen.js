// --- Die Karte entsteht ---------------------------------------------------
// Aus den Zonen der Chart wird ein Raster: jedes Feld weiß, ob es offener
// Raum, Nebel, Trümmer, Strahlung oder ein Graben ist. Dazu kommen die
// Sprungpunkte - die Pässe dieser Karte, denn durch einen Graben führt kein
// anderer Weg.
import {
  GRID_COLS, GRID_ROWS, xOfCol, yOfRow, colOfX, rowOfY,
  NEBULA_ZONES, ASTEROID_ZONES, RADIATION_ZONES, RIFT_ZONES,
  zoneAt, zoneDepth, sectorOfTile,
} from './starchart.js';
import { TILE_TYPES, SYSTEM_TILES } from './data.js';
import { makePrng } from './prng.js';

export const MAP_SEED = 20654;

// Die Sprungpunkte. Jeder ist ein Paar; wer auf dem einen steht, springt für
// einen Bewegungspunkt auf das andere. Sie sind mit Absicht gesetzt und nicht
// gewürfelt: sie entscheiden, wo Feldzüge stattfinden.
const JUMP_DEFS = [
  { name: 'Firekka-Sprung', a: { x: 30, y: 16 }, b: { x: 36, y: 9 } },
  { name: 'Sirius-Sprung', a: { x: 10, y: 17 }, b: { x: 17, y: 7 } },
  { name: 'Grabensprung Tyr–Höllenloch', a: { x: 64, y: 33 }, b: { x: 73, y: 34 } },
  { name: 'Cygnus-Sprung', a: { x: 48, y: 43 }, b: { x: 50, y: 52 } },
  { name: 'Perseus-Sprung', a: { x: 90, y: 31 }, b: { x: 96, y: 43 } },
  { name: 'Enigma-Sprung nach K’tithrak Mang', a: { x: 60, y: 11 }, b: { x: 69, y: 6 } },
  { name: 'Gemini-Sprung', a: { x: 41, y: 41 }, b: { x: 44, y: 46 } },
  { name: 'Vukar-Sprung', a: { x: 81, y: 18 }, b: { x: 86, y: 26 } },
];

function tileIndex(col, row) {
  return row * GRID_COLS + col;
}

export function generateMap() {
  const rnd = makePrng(MAP_SEED);
  const tiles = new Array(GRID_COLS * GRID_ROWS);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const x = xOfCol(col);
      const y = yOfRow(row);
      const rift = zoneAt(RIFT_ZONES, x, y);
      const nebula = zoneAt(NEBULA_ZONES, x, y);
      const rocks = zoneAt(ASTEROID_ZONES, x, y);
      const rad = zoneAt(RADIATION_ZONES, x, y);
      let type = TILE_TYPES.VOID;
      let zoneName = '';
      if (rift) { type = TILE_TYPES.RIFT; zoneName = rift.name; }
      else if (rocks) { type = TILE_TYPES.ASTEROIDS; zoneName = rocks.name; }
      else if (rad) { type = TILE_TYPES.RADIATION; zoneName = rad.name; }
      else if (nebula) { type = TILE_TYPES.NEBULA; zoneName = nebula.name; }
      tiles[tileIndex(col, row)] = {
        col, row, type, zoneName,
        // Die Dichte macht aus einer Bank ein Bild: am Rand dünn, im Kern
        // undurchdringlich. Ein Hauch Rauschen, damit keine Kreise entstehen.
        density: Math.max(0, Math.min(1,
          zoneDepth(NEBULA_ZONES, x, y) * 0.85 + rnd() * 0.2)),
        // Der Sternenstaub im Hintergrund - fest gewürfelt, damit er beim
        // Drehen der Kamera nicht wandert.
        speck: rnd(),
        sector: sectorOfTile(col, row).id,
        systemId: null,
        jump: null,
      };
    }
  }

  // Kein System liegt in einem Graben: die Karte ist nach den Systemen
  // gemacht, nicht umgekehrt. Wo eines läge, wird der Graben zu Nebel - und
  // die acht Nachbarfelder werden befahrbar, sonst wäre die Welt umzingelt.
  for (const sys of SYSTEM_TILES) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = sys.col + dc;
        const r = sys.row + dr;
        if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) continue;
        const t = tiles[tileIndex(c, r)];
        if (t.type === TILE_TYPES.RIFT) {
          t.type = TILE_TYPES.NEBULA;
          t.density = 0.5;
        }
      }
    }
  }

  // Die Sprungpunkte bekommen ihr Feld. Liegt es im Graben, wird es frei -
  // ein Sprungpunkt mitten im Nichts ist der Sinn der Sache.
  // Kein Sprungpunkt liegt auf einer Welt oder daneben: ein Tor gehört in den
  // freien Raum, nicht in einen Orbit. Wo die Sollstelle besetzt ist, wandert
  // der Punkt auf das nächste freie Feld.
  const taken = new Set(SYSTEM_TILES.map((sys) => `${sys.col},${sys.row}`));
  const busy = (col, row) => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (taken.has(`${col + dc},${row + dr}`)) return true;
      }
    }
    return false;
  };
  const freePlace = (p) => {
    if (!busy(p.col, p.row)) return p;
    for (let r = 1; r <= 6; r++) {
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue;
          const col = p.col + dc;
          const row = p.row + dr;
          if (col < 1 || row < 1 || col >= GRID_COLS - 1 || row >= GRID_ROWS - 1) continue;
          if (busy(col, row)) continue;
          return { col, row };
        }
      }
    }
    return p;
  };

  const jumpPoints = [];
  for (const def of JUMP_DEFS) {
    const a = freePlace({ col: colOfX(def.a.x), row: rowOfY(def.a.y) });
    const b = freePlace({ col: colOfX(def.b.x), row: rowOfY(def.b.y) });
    for (const p of [a, b]) {
      const t = tiles[tileIndex(p.col, p.row)];
      if (t.type === TILE_TYPES.RIFT) { t.type = TILE_TYPES.VOID; t.zoneName = ''; }
    }
    const jp = { name: def.name, a, b };
    jumpPoints.push(jp);
    tiles[tileIndex(a.col, a.row)].jump = { name: def.name, to: b };
    tiles[tileIndex(b.col, b.row)].jump = { name: def.name, to: a };
  }

  return {
    cols: GRID_COLS,
    rows: GRID_ROWS,
    tiles,
    jumpPoints,
  };
}

export function tileAt(map, col, row) {
  if (!map || col < 0 || row < 0 || col >= map.cols || row >= map.rows) return null;
  return map.tiles[row * map.cols + col];
}

// Die acht Nachbarn eines Feldes, Sprungpunkt inbegriffen. Der Sprung ist
// kein neunter Nachbar, sondern ein Nachbar wie jeder andere - nur weit weg.
export function neighbours(map, col, row, { withJump = true } = {}) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const t = tileAt(map, col + dc, row + dr);
      if (t) out.push(t);
    }
  }
  if (withJump) {
    const here = tileAt(map, col, row);
    if (here && here.jump) {
      const far = tileAt(map, here.jump.to.col, here.jump.to.row);
      if (far) out.push(far);
    }
  }
  return out;
}

// Ist ein Feld über den Sprungpunkt erreicht worden? Das braucht der
// Wegfinder, weil der Sprung anders kostet als der Flug.
export function isJumpStep(map, from, to) {
  const t = tileAt(map, from.col, from.row);
  if (!t || !t.jump) return false;
  return t.jump.to.col === to.col && t.jump.to.row === to.row;
}
