// Wem welches Feld gehört.
//
// Ein Reich ist nicht nur die Summe seiner Orte, sondern das Land dazwischen.
// Gerechnet wird als Einflusssphäre: jedes bestellbare Feld gehört dem Ort,
// der ihm über Land am nächsten liegt - eine Flutfüllung von allen Orten
// gleichzeitig. Das ist keine Vertragsgrenze, aber es ist das Bild, nach dem
// ein Feldherr plant, und seit die Grenzverletzung Krieg bedeutet, ist es
// auch eine Regel und nicht bloß eine Farbe.
//
// Meer gehört niemandem, und das Gebirge auch nicht: ein Pass ist ein Weg
// hindurch, kein Land, das eine Stadt verwaltet. Sonst liefe die Grenze quer
// über den Kamm statt an seinem Fuß.

import { atWar, hasPassage } from './diplomacy.js';

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function claimableTile(tile) {
  return !!tile && tile.type !== 'water' && tile.type !== 'mountain';
}

// Die Rechnung ist billig, aber sie steht in jedem Marschbefehl - deshalb
// wird sie gemerkt. Der Schlüssel ist, wem die Orte gerade gehören: ändert
// sich daran nichts, ändert sich auch an den Grenzen nichts. Damit übersteht
// der Zwischenspeicher auch das Rückgängigmachen, das den Spielstand aus
// einer Kopie zurückholt.
let cache = { key: null, owner: null, cols: 0 };

function cacheKey(state) {
  const map = state.map;
  let key = `${map.cols}x${map.rows}`;
  for (const city of state.cities) key += `|${city.id}:${city.factionId}`;
  return key;
}

function compute(state) {
  const { cols, rows, tiles } = state.map;
  const owner = new Array(cols * rows).fill(null);
  const queue = [];
  for (const city of state.cities) {
    const index = city.row * cols + city.col;
    owner[index] = city.factionId;
    queue.push(index);
  }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const col = index % cols;
    const row = (index - col) / cols;
    for (const [dc, dr] of NEIGHBOURS) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const next = r * cols + c;
      if (owner[next] !== null) continue;
      if (!claimableTile(tiles[r][c])) continue;
      owner[next] = owner[index];
      queue.push(next);
    }
  }
  return owner;
}

// Das ganze Feld auf einmal - für die Karte, die alles gleichzeitig einfärbt.
export function territoryMap(state) {
  if (!state || !state.map) return { owner: [], cols: 0 };
  const key = cacheKey(state);
  if (cache.key !== key) {
    cache = { key, owner: compute(state), cols: state.map.cols };
  }
  return { owner: cache.owner, cols: cache.cols };
}

// Und ein einzelnes Feld - für den Marschbefehl, der wissen will, wessen Boden
// er gerade betritt.
export function territoryOwner(state, col, row) {
  const map = state && state.map;
  if (!map || col < 0 || col >= map.cols || row < 0 || row >= map.rows) return null;
  const { owner, cols } = territoryMap(state);
  return owner[row * cols + col] || null;
}

// --- Grenzverletzung -------------------------------------------------------
// Wessen Boden dieser Marsch betritt, ohne dass er es dürfte. Geprüft wird der
// ganze Weg, nicht nur das Ziel: wer eine Ecke fremden Landes schneidet, hat
// die Grenze überschritten. Das Meer gehört niemandem, das Gebirge auch nicht,
// und mit wem man im Krieg steht, dessen Grenze gibt es ohnehin nicht mehr.
export function borderViolation(state, army, path) {
  if (!army || !path) return null;
  // Für ein Heer auf See zählt nur, wo es an Land geht: das Wasser dazwischen
  // gehört niemandem. Eine Landung auf fremdem Boden ist dieselbe
  // Grenzverletzung wie ein Marsch über die Linie.
  for (const tile of path) {
    const owner = territoryOwner(state, tile.col, tile.row);
    if (!owner || owner === army.factionId) continue;
    if (atWar(state, army.factionId, owner)) continue;
    if (hasPassage(state, army.factionId, owner)) continue;
    return owner;
  }
  return null;
}
