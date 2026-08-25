import { UNIT_ORDER } from './data.js';
import { computeReachable, tileKey } from './pathfind.js';
import { moveArmy, recruitUnit, raiseArmyFromGarrison } from './actions.js';
import { unitTotalCount } from './state.js';

function nearestTarget(state, army) {
  const candidates = [];
  for (const city of state.cities) {
    if (city.factionId !== army.factionId) {
      candidates.push({ col: city.col, row: city.row, weight: unitTotalCount(city.garrison) + 5 });
    }
  }
  for (const other of state.armies) {
    if (other.factionId !== army.factionId) {
      candidates.push({ col: other.col, row: other.row, weight: unitTotalCount(other.units) });
    }
  }
  if (!candidates.length) return null;
  let best = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const dist = Math.abs(c.col - army.col) + Math.abs(c.row - army.row);
    const score = dist + c.weight * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function stepArmyTowards(state, army, target) {
  const reachable = computeReachable(state, army);
  if (reachable.size === 0) return;

  const targetKey = tileKey(target.col, target.row);
  if (reachable.has(targetKey)) {
    moveArmy(state, army.id, target.col, target.row);
    return;
  }

  let bestNonCombat = null;
  let bestNonCombatDist = Infinity;
  let bestCombat = null;
  let bestCombatDist = Infinity;
  for (const [k, entry] of reachable) {
    const [col, row] = k.split(',').map(Number);
    const dist = Math.hypot(col - target.col, row - target.row);
    if (entry.combat) {
      if (dist < bestCombatDist) {
        bestCombatDist = dist;
        bestCombat = { col, row };
      }
    } else if (dist < bestNonCombatDist) {
      bestNonCombatDist = dist;
      bestNonCombat = { col, row };
    }
  }
  const pick = bestNonCombat || bestCombat;
  if (pick) moveArmy(state, army.id, pick.col, pick.row);
}

function aiEconomy(state, faction) {
  const ownCities = state.cities.filter((c) => c.factionId === faction.id);
  for (const city of ownCities) {
    const unitKey = UNIT_ORDER[Math.floor(Math.random() * UNIT_ORDER.length)];
    recruitUnit(state, city.id, unitKey);

    const garrisonStrength = unitTotalCount(city.garrison);
    const hasFieldArmyHere = state.armies.some(
      (a) => a.factionId === faction.id && a.col === city.col && a.row === city.row
    );
    if (garrisonStrength >= 300 && (!hasFieldArmyHere || garrisonStrength >= 500)) {
      raiseArmyFromGarrison(state, city.id);
    }
  }
}

function aiMilitary(state, faction) {
  const armies = state.armies.filter((a) => a.factionId === faction.id);
  for (const army of armies) {
    const target = nearestTarget(state, army);
    if (!target) continue;
    stepArmyTowards(state, army, target);
  }
}

export function aiTakeTurn(state, faction) {
  aiEconomy(state, faction);
  aiMilitary(state, faction);
}

export function aiTakeAllTurns(state) {
  for (const faction of state.factions) {
    if (faction.isPlayer || faction.isNeutral || !faction.alive) continue;
    aiTakeTurn(state, faction);
  }
}
