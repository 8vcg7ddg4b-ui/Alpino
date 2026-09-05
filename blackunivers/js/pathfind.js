// --- Der Wegfinder --------------------------------------------------------
// Wohin eine Flotte in diesem Zug noch kommt. Dijkstra über die Felder, mit
// den Kosten der Karte: Nebel bremst, Trümmer bremsen mehr, der Graben ist
// zu, und Sprungpunkte sind Abkürzungen für einen Punkt.
import { tileMoveCost, tileImpassable, JUMP_POINT_COST } from './data.js';
import { tileAt, neighbours } from './mapgen.js';
import { atWar, alliedWith } from './diplomacy.js';
import { systemAt, fleetsAt, movementMaxFor, factionById } from './state.js';

function tileKey(col, row) {
  return `${col},${row}`;
}
export { tileKey };

// Ist das Feld für diese Fraktion feindlich besetzt? Dann fliegt man nicht
// durch, sondern greift an.
export function hostileAt(state, factionId, col, row) {
  const sys = systemAt(state, col, row);
  const fleets = fleetsAt(state, col, row);
  for (const f of fleets) {
    if (f.factionId === factionId) continue;
    if (atWar(state, factionId, f.factionId)) return { kind: 'flotte', fleet: f };
    // Unabhängige Flotten (Piraten, Retros) sind immer feindlich.
    if (f.factionId === 'neutral' || f.factionId === 'nephilim') return { kind: 'flotte', fleet: f };
  }
  if (sys && sys.factionId !== factionId) {
    if (atWar(state, factionId, sys.factionId) || sys.factionId === 'neutral'
      || sys.factionId === 'nephilim') {
      return { kind: 'system', system: sys };
    }
  }
  return null;
}

// Fremdes, aber nicht feindliches Gebiet: durch einen Nichtangriffspakt oder
// ein Bündnis darf man hinein, sonst nicht.
function passable(state, factionId, tile) {
  if (!tile || tileImpassable(tile.type)) return false;
  const sys = systemAt(state, tile.col, tile.row);
  if (sys && sys.factionId !== factionId && !sys.isNeutral) {
    if (atWar(state, factionId, sys.factionId)) return false; // Angriffsziel, kein Durchflug
    if (sys.factionId === 'neutral') return false;
    if (!alliedWith(state, factionId, sys.factionId)) return false;
  }
  for (const f of fleetsAt(state, tile.col, tile.row)) {
    if (f.factionId === factionId) continue;
    if (atWar(state, factionId, f.factionId)) return false;
    if (f.factionId === 'neutral' || f.factionId === 'nephilim') return false;
  }
  return true;
}

export function computeReachable(state, fleet) {
  const budget = fleet.movement;
  const start = tileKey(fleet.col, fleet.row);
  const reach = new Map();
  const attacks = new Map();
  reach.set(start, { cost: 0, prev: null, jump: false });
  if (budget <= 0) return { reach, attacks };

  const faction = factionById(state, fleet.factionId);
  const freeJump = faction && faction.tech.triebwerke >= 3;
  const open = [{ col: fleet.col, row: fleet.row, cost: 0 }];

  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    const curKey = tileKey(cur.col, cur.row);
    const entry = reach.get(curKey);
    if (!entry || entry.cost < cur.cost) continue;
    const here = tileAt(state.map, cur.col, cur.row);
    for (const nb of neighbours(state.map, cur.col, cur.row)) {
      if (tileImpassable(nb.type)) continue;
      const viaJump = !!(here && here.jump && here.jump.to.col === nb.col && here.jump.to.row === nb.row);
      const step = viaJump ? (freeJump ? 0 : JUMP_POINT_COST) : tileMoveCost(nb.type);
      const cost = cur.cost + step;
      if (cost > budget) continue;
      const nbKey = tileKey(nb.col, nb.row);
      const foe = hostileAt(state, fleet.factionId, nb.col, nb.row);
      if (foe) {
        // Feindliche Felder sind Endpunkte: man greift an und bleibt stehen.
        const known = attacks.get(nbKey);
        if (!known || known.cost > cost) {
          attacks.set(nbKey, { cost, prev: curKey, jump: viaJump, target: foe });
        }
        continue;
      }
      if (!passable(state, fleet.factionId, nb)) continue;
      const known = reach.get(nbKey);
      if (known && known.cost <= cost) continue;
      reach.set(nbKey, { cost, prev: curKey, jump: viaJump });
      open.push({ col: nb.col, row: nb.row, cost });
    }
  }
  return { reach, attacks };
}

// Der Weg von der Flotte zu einem erreichbaren Feld, Feld für Feld - die
// Karte zeichnet ihn als Fluglinie.
export function pathTo(reach, attacks, col, row) {
  const target = tileKey(col, row);
  const entry = (attacks && attacks.get(target)) || reach.get(target);
  if (!entry) return null;
  const out = [{ key: target, jump: entry.jump, cost: entry.cost }];
  let prev = entry.prev;
  while (prev) {
    const p = reach.get(prev);
    if (!p) break;
    out.unshift({ key: prev, jump: p.jump, cost: p.cost });
    prev = p.prev;
  }
  return out.map((step) => {
    const [c, r] = step.key.split(',').map(Number);
    return { col: c, row: r, jump: step.jump, cost: step.cost };
  });
}

// Der volle Weg über mehrere Züge, ohne Rücksicht auf das Budget - für die
// KI und für Marschbefehle über die halbe Karte.
export function longRoute(state, fleet, destCol, destRow, maxCost = 400) {
  const startKey = tileKey(fleet.col, fleet.row);
  const dest = tileKey(destCol, destRow);
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const open = [{ col: fleet.col, row: fleet.row, cost: 0 }];
  const faction = factionById(state, fleet.factionId);
  const freeJump = faction && faction.tech.triebwerke >= 3;
  let found = false;
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    const curKey = tileKey(cur.col, cur.row);
    if (curKey === dest) { found = true; break; }
    if ((dist.get(curKey) ?? Infinity) < cur.cost) continue;
    const here = tileAt(state.map, cur.col, cur.row);
    for (const nb of neighbours(state.map, cur.col, cur.row)) {
      if (tileImpassable(nb.type)) continue;
      const nbKey = tileKey(nb.col, nb.row);
      const viaJump = !!(here && here.jump && here.jump.to.col === nb.col && here.jump.to.row === nb.row);
      const step = viaJump ? (freeJump ? 0 : JUMP_POINT_COST) : tileMoveCost(nb.type);
      // Auf dem langen Weg zählt fremdes Gebiet als teuer, nicht als
      // unmöglich: die KI soll um Grenzen herumfliegen, wenn es geht.
      const foe = hostileAt(state, fleet.factionId, nb.col, nb.row);
      const penalty = nbKey === dest ? 0 : foe ? 8 : 0;
      const cost = cur.cost + step + penalty;
      if (cost > maxCost) continue;
      if ((dist.get(nbKey) ?? Infinity) <= cost) continue;
      dist.set(nbKey, cost);
      prev.set(nbKey, curKey);
      open.push({ col: nb.col, row: nb.row, cost });
    }
  }
  if (!found && !dist.has(dest)) return null;
  const out = [];
  let k = dest;
  while (k && k !== startKey) {
    const [c, r] = k.split(',').map(Number);
    out.unshift({ col: c, row: r });
    k = prev.get(k);
  }
  return out.length ? out : null;
}

// Luftlinie in Feldern - für Reichweiten, Sensoren und die KI.
export function tileDistance(a, b) {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

// Der nächste eigene Hafen: wohin eine geschlagene Flotte zurückfällt.
export function nearestOwnSystem(state, factionId, col, row) {
  let best = null;
  let bestDist = Infinity;
  for (const sys of state.systems) {
    if (sys.factionId !== factionId) continue;
    const d = tileDistance({ col, row }, sys);
    if (d < bestDist) { bestDist = d; best = sys; }
  }
  return best;
}

export function reachSummary(state, fleet) {
  const { reach, attacks } = computeReachable(state, fleet);
  return {
    tiles: reach.size - 1,
    targets: attacks.size,
    budget: fleet.movement,
    max: movementMaxFor(state, fleet),
  };
}
