import { UNIT_ORDER, SHIP_COST } from './data.js';
import { computeReachable, tileKey } from './pathfind.js';
import {
  moveArmy, recruitUnit, raiseArmyFromGarrison, embarkArmy, embarkStatus,
  previewTileCombat,
} from './actions.js';
import { unitTotalCount, factionById, isCoastalCity, sameLandmass } from './state.js';

// Keeps enough in the treasury that paying for a fleet never leaves a faction
// unable to defend what it already has.
const AI_FLEET_RESERVE = 200;
// How much closer an overseas target must be before the fleet is worth it.
const SEA_CROSSING_MARGIN = 3;

function nearestTarget(state, army, walkable) {
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

  // Something on the far side of a sea is not a target you can march to, so a
  // land army weighs those separately and only turns to them when nothing on
  // its own landmass is left.
  let best = null;
  let bestScore = Infinity;
  let bestOverseas = null;
  let bestOverseasScore = Infinity;
  for (const c of candidates) {
    const dist = Math.abs(c.col - army.col) + Math.abs(c.row - army.row);
    const score = dist + c.weight * 0.05;
    const reachable = !walkable || walkable(c.col, c.row);
    if (reachable) {
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    } else if (score < bestOverseasScore) {
      bestOverseasScore = score;
      bestOverseas = c;
    }
  }
  // A crossing is worth mounting when the prize on the far shore is clearly
  // better than anything left to march on - an island town nobody can reach
  // on foot, say - and always when there is nothing to march on at all.
  if (best && bestOverseas && bestOverseasScore + SEA_CROSSING_MARGIN < bestScore) {
    return { ...bestOverseas, needsSea: true };
  }
  if (best) return best;
  return bestOverseas ? { ...bestOverseas, needsSea: true } : null;
}

// A commander who can count. The AI weighs an attack with the same forecast
// the player is shown, and declines a fight it is going to lose - a coarse
// estimate is enough to tell a storming from a slaughter.
const AI_FORECAST_SAMPLES = 12;
let aiMinWinChance = 0.5;

// How sure of winning the AI insists on being, set from the settings panel.
export function setAiStance(threshold) {
  aiMinWinChance = threshold;
}

function worthAttacking(state, army, col, row) {
  const preview = previewTileCombat(state, army.id, col, row, AI_FORECAST_SAMPLES);
  if (!preview) return true;
  if (preview.unopposed) return true;
  return preview.forecast.attackerWinChance >= aiMinWinChance;
}

function stepArmyTowards(state, army, target) {
  const reachable = computeReachable(state, army);
  if (reachable.size === 0) return;

  const targetKey = tileKey(target.col, target.row);
  const direct = reachable.get(targetKey);
  if (direct && (!direct.combat || worthAttacking(state, army, target.col, target.row))) {
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
  // Close in on foot by preference; only pick a fight worth having.
  if (bestNonCombat) {
    moveArmy(state, army.id, bestNonCombat.col, bestNonCombat.row);
    return;
  }
  if (bestCombat && worthAttacking(state, army, bestCombat.col, bestCombat.row)) {
    moveArmy(state, army.id, bestCombat.col, bestCombat.row);
  }
}

// A faction that spends its last coin on recruits every turn can never pay
// for a fleet or a wall. Recruiting stops at this floor.
const AI_TREASURY_FLOOR = 400;

function aiEconomy(state, faction, savingForFleet) {
  // An army waiting in a harbour for want of coin will wait for ever if the
  // treasury is spent on recruits every turn. When a crossing is pending, the
  // floor rises until the fleet is paid for.
  const floor = savingForFleet
    ? Math.max(AI_TREASURY_FLOOR, SHIP_COST + AI_FLEET_RESERVE)
    : AI_TREASURY_FLOOR;
  const ownCities = state.cities.filter((c) => c.factionId === faction.id);
  for (const city of ownCities) {
    if (faction.gold <= floor) break;
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

// How close an enemy army has to be before a settlement counts as threatened.
const HOME_GUARD_RANGE = 8;

// The own settlement with an enemy army nearest to it, if one is close enough
// to be a real danger.
function threatenedCity(state, faction) {
  let best = null;
  let bestDistance = Infinity;
  for (const city of state.cities) {
    if (city.factionId !== faction.id) continue;
    for (const enemy of state.armies) {
      if (enemy.factionId === faction.id) continue;
      const distance = Math.abs(enemy.col - city.col) + Math.abs(enemy.row - city.row);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = city;
      }
    }
  }
  return bestDistance <= HOME_GUARD_RANGE ? best : null;
}

// Returns whether a crossing is being held up by an empty treasury, so the
// economy knows to stop spending.
function aiMilitary(state, faction) {
  let savingForFleet = false;
  const armies = state.armies.filter((a) => a.factionId === faction.id);

  // Sending every army at the nearest enemy leaves nothing behind, and a
  // faction with neighbours on three sides loses its towns behind its own
  // army's back. With more than one host, the nearest one stays home.
  let guard = null;
  let guardHome = null;
  if (armies.length > 1) {
    const home = threatenedCity(state, faction);
    if (home) {
      guard = armies.reduce((closest, army) => {
        const distance = Math.abs(army.col - home.col) + Math.abs(army.row - home.row);
        const bestDistance = Math.abs(closest.col - home.col) + Math.abs(closest.row - home.row);
        return distance < bestDistance ? army : closest;
      });
      guardHome = home;
    }
  }
  for (const army of armies) {
    if (army === guard) {
      // Standing on the town it is guarding is the whole job.
      if (army.col !== guardHome.col || army.row !== guardHome.row) {
        stepArmyTowards(state, army, guardHome);
      }
      continue;
    }
    // A fleet already at sea navigates by the same rule; the pathfinder is
    // what knows the difference between a road and a sea lane.
    const walkable = army.embarked
      ? null
      : (col, row) => sameLandmass(state, army.col, army.row, col, row);
    const target = nearestTarget(state, army, walkable);
    if (!target) continue;

    if (target.needsSea && !army.embarked) {
      const status = embarkStatus(state, army);
      const treasury = factionById(state, faction.id).gold;
      if (status.can && treasury >= SHIP_COST + AI_FLEET_RESERVE) {
        embarkArmy(state, army.id);
        continue;
      }
      // Already in a harbour and only short of coin, or waiting out a storm:
      // hold. Marching off to look for a port it is already standing in was
      // enough to keep an island faction at home for the whole game.
      if (status.city) {
        if (status.can || status.reason === 'gold') savingForFleet = true;
        continue;
      }
      // Otherwise make for the nearest own harbour rather than standing still
      // on the wrong side of the water.
      const port = nearestOwnPort(state, army, walkable);
      if (port && (port.col !== army.col || port.row !== army.row)) {
        stepArmyTowards(state, army, port);
        continue;
      }
    }
    stepArmyTowards(state, army, target);
  }
  return savingForFleet;
}

// The closest own harbour this army could actually walk to.
function nearestOwnPort(state, army, walkable) {
  let best = null;
  let bestDist = Infinity;
  for (const city of state.cities) {
    if (city.factionId !== army.factionId) continue;
    if (!isCoastalCity(state, city)) continue;
    if (walkable && !walkable(city.col, city.row)) continue;
    const dist = Math.abs(city.col - army.col) + Math.abs(city.row - army.row);
    if (dist < bestDist) {
      bestDist = dist;
      best = { col: city.col, row: city.row };
    }
  }
  return best;
}

export function aiTakeTurn(state, faction) {
  // Movement first: a fleet that is needed this turn should not find the
  // treasury already spent on another batch of recruits.
  const savingForFleet = aiMilitary(state, faction);
  aiEconomy(state, faction, savingForFleet);
}

export function aiTakeAllTurns(state) {
  for (const faction of state.factions) {
    if (faction.isPlayer || faction.isNeutral || !faction.alive) continue;
    aiTakeTurn(state, faction);
  }
}
