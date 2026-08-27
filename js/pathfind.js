import { TILE_TYPES, SEA_MOVE_COST, ZOC_EXTRA_COST } from './data.js';
import { armyAt, cityAt } from './state.js';

const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function key(col, row) {
  return `${col},${row}`;
}

// What a tile means to this army: blocked, free to cross, or a destination
// that starts a fight. A fleet sees the map inverted - open water is its road
// and every shore is a landing, which ends its voyage either way.
function classifyTile(state, col, row, movingFactionId, embarked) {
  const map = state.map;
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) {
    return { blocked: true };
  }
  const tile = map.tiles[row][col];
  const tileDef = TILE_TYPES[tile.type];
  const isSea = tile.type === 'water';

  if (embarked) {
    if (!isSea && tileDef.impassable) return { blocked: true };
  } else if (tileDef.impassable) {
    return { blocked: true };
  }

  const cost = isSea ? SEA_MOVE_COST : tileDef.cost;
  // Coming ashore is the end of the voyage, whether or not anyone contests it.
  const landing = embarked && !isSea;

  const occupant = armyAt(state, col, row);
  const city = cityAt(state, col, row);

  if (occupant && occupant.factionId === movingFactionId) {
    return { blocked: true };
  }
  if (occupant && occupant.factionId !== movingFactionId) {
    return { blocked: false, cost, endpointOnly: true, combat: true, landing };
  }
  if (city && city.factionId !== movingFactionId) {
    return { blocked: false, cost, endpointOnly: true, combat: true, landing };
  }
  return { blocked: false, cost, endpointOnly: landing, combat: false, landing };
}

// Every army holds the ground next to it. An enemy can push into that ground,
// but it costs, and it cannot then slide sideways along the front: to get past
// an army you either go round its zone or through the army itself.
//
// Control reaches only into the element the army is in - a legion on the shore
// does not slow a fleet sailing past it, and a fleet does not pin troops
// inland.
export function zoneOfControl(state, army) {
  const zoc = new Set();
  const { cols, rows, tiles } = state.map;
  for (const other of state.armies) {
    if (other.factionId === army.factionId) continue;
    const otherAtSea = !!other.embarked;
    for (const [dc, dr] of NEIGHBORS) {
      const col = other.col + dc;
      const row = other.row + dr;
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      if ((tiles[row][col].type === 'water') !== otherAtSea) continue;
      zoc.add(key(col, row));
    }
  }
  return zoc;
}

// Dijkstra over the movement-cost grid, bounded by the army's remaining movement.
// Returns a Map keyed "col,row" -> { cost, path: [{col,row},...], combat }
export function computeReachable(state, army) {
  const startKey = key(army.col, army.row);
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const visited = new Set();
  const combatEndpoint = new Set();
  const stopEndpoint = new Set();
  const landings = new Set();
  const embarked = !!army.embarked;
  const zoc = zoneOfControl(state, army);
  const contested = new Set();
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

      const info = classifyTile(state, ncol, nrow, army.factionId, embarked);
      if (info.blocked) continue;

      const isStart = ncol === army.col && nrow === army.row;
      if (isStart) continue;

      // Pushing into held ground costs; slipping from one held tile straight
      // into another is not a march past, it is a battle declined.
      const heldFrom = zoc.has(ck);
      const heldTo = zoc.has(nk);
      if (heldFrom && heldTo && !info.combat) continue;
      const newCost = current.cost + info.cost + (heldTo && !info.combat ? ZOC_EXTRA_COST : 0);
      if (newCost > army.movement) continue;

      // Combat tiles - and shores a fleet lands on - are valid destinations
      // but cannot be passed through.
      if (stopEndpoint.has(ck)) continue;

      const existing = dist.get(nk);
      if (existing === undefined || newCost < existing) {
        dist.set(nk, newCost);
        prev.set(nk, ck);
        if (info.combat) combatEndpoint.add(nk);
        else combatEndpoint.delete(nk);
        if (info.landing) landings.add(nk);
        else landings.delete(nk);
        if (info.combat || info.endpointOnly) stopEndpoint.add(nk);
        else stopEndpoint.delete(nk);
        if (heldTo && !info.combat) contested.add(nk);
        else contested.delete(nk);
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
    reachable.set(k, {
      cost,
      path,
      combat: combatEndpoint.has(k),
      landing: landings.has(k),
      contested: contested.has(k),
    });
  }
  return reachable;
}

export { key as tileKey };
