import {
  UNIT_ORDER, UNIT_TYPES, MAX_MOVEMENT, INCOME_PER_CITY, GARRISON_POP_RATIO,
  RECRUIT_BATCH, GARRISON_REGEN_BATCH,
} from './data.js';
import { computeReachable, tileKey } from './pathfind.js';
import { resolveBattle } from './combat.js';
import {
  makeId, factionById, cityAt, armyAt, unitTotalCount, logMsg, playerFaction,
} from './state.js';

export function removeArmy(state, armyId) {
  const idx = state.armies.findIndex((a) => a.id === armyId);
  if (idx !== -1) state.armies.splice(idx, 1);
  if (state.selectedArmyId === armyId) state.selectedArmyId = null;
}

function battleLine(attackerFaction, defenderFaction, vs, result, cityName) {
  const winner = result.outcome === 'attacker' ? attackerFaction.name : defenderFaction.name;
  const place = vs === 'city' ? ` bei ${cityName}` : '';
  const verb = vs === 'city' ? 'belagert' : 'greift';
  return `⚔️ ${attackerFaction.name} ${verb} ${defenderFaction.name}${place} – Sieg für ${winner} (Verluste: Angreifer ${(result.attackerLossesPct * 100).toFixed(0)}%, Verteidiger ${(result.defenderLossesPct * 100).toFixed(0)}%).`;
}

const MAX_BATTLE_REPORTS = 40;

// Keeps the whole engagement, not just who won: the report panel reads its
// per-unit breakdown, terrain modifier and round history straight from here.
function recordBattle(state, opts) {
  const { attackerFaction, defenderFaction, result, kind, city, col, row } = opts;
  const report = {
    id: makeId('battle'),
    turn: state.turn,
    kind,
    col,
    row,
    cityName: city ? city.name : null,
    attackerFactionId: attackerFaction.id,
    defenderFactionId: defenderFaction.id,
    attacker: attackerFaction.name,
    defender: defenderFaction.name,
    outcome: result.outcome,
    endedBy: result.endedBy,
    terrainType: result.terrainType,
    terrainBonus: result.terrainBonus,
    attackerEngaged: result.attackerEngaged,
    defenderEngaged: result.defenderEngaged,
    attackerSurvivors: { ...result.attackerSurvivors },
    defenderSurvivors: { ...result.defenderSurvivors },
    attackerLossesPct: result.attackerLossesPct,
    defenderLossesPct: result.defenderLossesPct,
    rounds: result.rounds,
    involvesPlayer:
      !!attackerFaction.isPlayer || !!defenderFaction.isPlayer,
  };
  state.battleReports.unshift(report);
  if (state.battleReports.length > MAX_BATTLE_REPORTS) {
    state.battleReports.length = MAX_BATTLE_REPORTS;
  }
  logMsg(state, battleLine(attackerFaction, defenderFaction, kind, result, city && city.name), report.id);
  return report;
}

// Resolves everything that happens when `army` steps onto (col,row): 0, 1 or 2
// sequential engagements (field army, then city garrison), all resolved on the
// campaign map itself — there is no separate battle screen.
export function resolveTileCombat(state, army, destCol, destRow) {
  const tileType = state.map.tiles[destRow][destCol].type;
  const defendingArmy = armyAt(state, destCol, destRow);
  const city = cityAt(state, destCol, destRow);
  const attackerFaction = factionById(state, army.factionId);

  let attackerUnits = { ...army.units };
  let capturedCity = false;
  let bounced = false;
  const reports = [];

  if (defendingArmy) {
    const defenderFaction = factionById(state, defendingArmy.factionId);
    const result = resolveBattle(attackerUnits, defendingArmy.units, tileType);
    reports.push(recordBattle(state, {
      attackerFaction, defenderFaction, result, kind: 'army', city, col: destCol, row: destRow,
    }));
    attackerUnits = result.attackerSurvivors;
    if (result.outcome === 'attacker') {
      removeArmy(state, defendingArmy.id);
    } else {
      defendingArmy.units = result.defenderSurvivors;
      if (unitTotalCount(defendingArmy.units) <= 0) removeArmy(state, defendingArmy.id);
      bounced = true;
    }
  }

  if (!bounced && unitTotalCount(attackerUnits) > 0 && city && city.factionId !== army.factionId) {
    const defenderFaction = factionById(state, city.factionId);
    if (unitTotalCount(city.garrison) > 0) {
      const result = resolveBattle(attackerUnits, city.garrison, tileType);
      reports.push(recordBattle(state, {
        attackerFaction, defenderFaction, result, kind: 'city', city, col: destCol, row: destRow,
      }));
      attackerUnits = result.attackerSurvivors;
      if (result.outcome === 'attacker') {
        capturedCity = true;
      } else {
        city.garrison = result.defenderSurvivors;
        bounced = true;
      }
    } else {
      capturedCity = true;
      logMsg(state, `${attackerFaction.name} nimmt das unverteidigte ${city.name} kampflos ein.`);
    }
  }

  if (capturedCity && city) {
    city.factionId = army.factionId;
    // A small occupying garrison remains so the city isn't immediately
    // defenseless against a follow-up attack the same turn.
    city.garrison = { legionary: 30 };
    city.population = Math.round(city.population * 0.92);
  }

  army.units = attackerUnits;
  if (unitTotalCount(attackerUnits) <= 0) {
    removeArmy(state, army.id);
    return { ok: true, survived: false, reports };
  }
  if (!city || capturedCity) {
    army.col = destCol;
    army.row = destRow;
  }
  return { ok: true, survived: true, capturedCity, reports };
}

export function moveArmy(state, armyId, destCol, destRow) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return { ok: false };
  const reachable = computeReachable(state, army);
  const entry = reachable.get(tileKey(destCol, destRow));
  if (!entry) return { ok: false };

  army.movement = Math.max(0, army.movement - entry.cost);

  if (!entry.combat) {
    army.col = destCol;
    army.row = destRow;
    return { ok: true, combat: false, reports: [] };
  }
  return { ok: true, combat: true, ...resolveTileCombat(state, army, destCol, destRow) };
}

export function recruitUnit(state, cityId, unitKey) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const def = UNIT_TYPES[unitKey];
  const maxTotal = Math.floor(city.population / GARRISON_POP_RATIO);
  if (unitTotalCount(city.garrison) >= maxTotal) return { ok: false, reason: 'full' };
  if (faction.gold < def.cost) return { ok: false, reason: 'gold' };
  faction.gold -= def.cost;
  city.garrison[unitKey] = (city.garrison[unitKey] || 0) + RECRUIT_BATCH;
  logMsg(state, `${faction.name} rekrutiert ${RECRUIT_BATCH} ${def.name} in ${city.name}.`);
  return { ok: true };
}

export function raiseArmyFromGarrison(state, cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  if (unitTotalCount(city.garrison) === 0) return { ok: false, reason: 'empty' };

  const existing = state.armies.find(
    (a) => a.factionId === city.factionId && a.col === city.col && a.row === city.row
  );
  if (existing) {
    for (const key of UNIT_ORDER) existing.units[key] = (existing.units[key] || 0) + (city.garrison[key] || 0);
    city.garrison = {};
    logMsg(state, `${faction.name}: Verstärkung aus ${city.name} schließt sich der Armee an.`);
    return { ok: true, armyId: existing.id };
  }

  const newArmy = {
    id: makeId('army'), factionId: city.factionId, col: city.col, row: city.row,
    movement: 0, maxMovement: MAX_MOVEMENT, units: { ...city.garrison }, name: `${faction.name} Armee`,
  };
  state.armies.push(newArmy);
  city.garrison = {};
  logMsg(state, `${faction.name} stellt in ${city.name} eine neue Armee auf.`);
  return { ok: true, armyId: newArmy.id };
}

export function collectIncome(state) {
  for (const faction of state.factions) {
    if (faction.isNeutral) continue;
    const ownCities = state.cities.filter((c) => c.factionId === faction.id);
    let income = ownCities.length * INCOME_PER_CITY;
    income += ownCities.reduce((s, c) => s + Math.floor(c.population / 200), 0);
    const upkeep = state.armies
      .filter((a) => a.factionId === faction.id)
      .reduce((s, a) => s + UNIT_ORDER.reduce((s2, k) => s2 + (a.units[k] || 0) * UNIT_TYPES[k].upkeep, 0), 0);
    faction.gold = Math.max(0, Math.round(faction.gold + income - upkeep));
  }
}

export function regenerateGarrisons(state) {
  for (const city of state.cities) {
    const maxTotal = Math.floor(city.population / GARRISON_POP_RATIO);
    const current = unitTotalCount(city.garrison);
    if (current < maxTotal && Math.random() < 0.5) {
      const grow = Math.min(GARRISON_REGEN_BATCH, maxTotal - current);
      city.garrison.legionary = (city.garrison.legionary || 0) + grow;
    }
  }
}

export function resetMovement(state) {
  for (const army of state.armies) army.movement = army.maxMovement;
}

export function checkVictory(state) {
  for (const faction of state.factions) {
    if (faction.isNeutral) continue;
    const hasCities = state.cities.some((c) => c.factionId === faction.id);
    const hasArmies = state.armies.some((a) => a.factionId === faction.id);
    faction.alive = hasCities || hasArmies;
  }
  const player = playerFaction(state);
  if (!player.alive) {
    state.gameOver = { result: 'defeat' };
    return;
  }
  const enemiesAlive = state.factions.filter((f) => !f.isPlayer && !f.isNeutral && f.alive);
  if (enemiesAlive.length === 0) {
    state.gameOver = { result: 'victory' };
  }
}
