import { TILE_TYPES } from './data.js';
import { armyAt, cityAt } from './state.js';

const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function key(col, row) {
  return `${col},${row}`;
}

function classifyTile(state, col, row, movingFactionId) {
  const map = state.map;
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) {
    return { blocked: true };
  }
  const tile = map.tiles[row][col];
  const tileDef = TILE_TYPES[tile.type];
  if (tileDef.impassable) return { blocked: true };

  const occupant = armyAt(state, col, row);
  const city = cityAt(state, col, row);

  if (occupant && occupant.factionId === movingFactionId) {
    return { blocked: true };
  }
  if (occupant && occupant.factionId !== movingFactionId) {
    return { blocked: false, cost: tileDef.cost, endpointOnly: true, combat: true };
  }
  if (city && city.factionId !== movingFactionId) {
    return { blocked: false, cost: tileDef.cost, endpointOnly: true, combat: true };
  }
  return { blocked: false, cost: tileDef.cost, endpointOnly: false, combat: false };
}

// Dijkstra over the movement-cost grid, bounded by the army's remaining movement.
// Returns a Map keyed "col,row" -> { cost, path: [{col,row},...], combat }
export function computeReachable(state, army) {
  const startKey = key(army.col, army.row);
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const visited = new Set();
  const combatEndpoint = new Set();
  const frontier = [{ col: army.col, row: army.row, cost: 0 }];

  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const current = frontier.shift();
    const ck = key(current.col, current.row);
    if (visited.has(ck)) continue;
    visited.add(ck);

    for (const [dc, dr] of NEIGHBORS) {
      const ncol = current.col + dc;
      const nrow = current.row + dr;
      const nk = key(ncol, nrow);
      if (visited.has(nk)) continue;

      const info = classifyTile(state, ncol, nrow, army.factionId);
      if (info.blocked) continue;

      const isStart = ncol === army.col && nrow === army.row;
      if (isStart) continue;

      const newCost = current.cost + info.cost;
      if (newCost > army.movement) continue;

      // Combat tiles are valid destinations but cannot be passed through.
      const cameFromCombat = combatEndpoint.has(ck);
      if (cameFromCombat) continue;

      const existing = dist.get(nk);
      if (existing === undefined || newCost < existing) {
        dist.set(nk, newCost);
        prev.set(nk, ck);
        if (info.combat) combatEndpoint.add(nk);
        else combatEndpoint.delete(nk);
        frontier.push({ col: ncol, row: nrow, cost: newCost });
      }
    }
  }

  const reachable = new Map();
  for (const [k, cost] of dist) {
    if (k === startKey) continue;
    const path = [];
    let cur = k;
    while (cur !== startKey) {
      const [c, r] = cur.split(',').map(Number);
      path.unshift({ col: c, row: r });
      cur = prev.get(cur);
    }
    reachable.set(k, { cost, path, combat: combatEndpoint.has(k) });
  }
  return reachable;
}

export { key as tileKey };
