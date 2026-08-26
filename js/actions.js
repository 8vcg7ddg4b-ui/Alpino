import {
  UNIT_ORDER, UNIT_TYPES, MAX_MOVEMENT, INCOME_PER_CITY, GARRISON_POP_RATIO,
  RECRUIT_BATCH, GARRISON_REGEN_BATCH, TILE_TYPES,
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

function mergeAllUnits(parts) {
  const out = {};
  for (const key of UNIT_ORDER) {
    out[key] = parts.reduce((sum, part) => sum + (part[key] || 0), 0);
  }
  return out;
}

// Splits a combined force's survivors back over the contingents that made it
// up, in proportion to what each contributed, so no single contingent absorbs
// all of the casualties.
function splitSurvivors(survivors, parts) {
  const out = parts.map(() => ({}));
  for (const key of UNIT_ORDER) {
    const total = parts.reduce((sum, part) => sum + (part[key] || 0), 0);
    const available = survivors[key] || 0;
    if (total === 0) {
      out.forEach((o) => { o[key] = 0; });
      continue;
    }
    let assigned = 0;
    for (let i = 0; i < parts.length - 1; i++) {
      const share = Math.round((available * (parts[i][key] || 0)) / total);
      out[i][key] = Math.max(0, Math.min(available - assigned, share));
      assigned += out[i][key];
    }
    out[parts.length - 1][key] = Math.max(0, available - assigned);
  }
  return out;
}

const NEIGHBOUR_OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// A beaten army falls back rather than evaporating. It prefers the tile
// furthest from the attacker; only a force with nowhere left to go is lost.
function retreatArmy(state, defeated, fromCol, fromRow) {
  let best = null;
  let bestDistance = -1;
  for (const [dc, dr] of NEIGHBOUR_OFFSETS) {
    const col = defeated.col + dc;
    const row = defeated.row + dr;
    if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) continue;
    if (TILE_TYPES[state.map.tiles[row][col].type].impassable) continue;
    if (armyAt(state, col, row)) continue;
    const city = cityAt(state, col, row);
    if (city && city.factionId !== defeated.factionId) continue;
    const distance = Math.abs(col - fromCol) + Math.abs(row - fromRow);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = { col, row };
    }
  }
  if (!best) return null;
  defeated.col = best.col;
  defeated.row = best.row;
  defeated.movement = 0;
  return best;
}

// Keeps the whole engagement, not just who won: the report panel reads its
// per-unit breakdown, terrain modifier and round history straight from here.
function recordBattle(state, opts) {
  const { attackerFaction, defenderFaction, result, kind, city, col, row, combined, aftermath } = opts;
  const report = {
    id: makeId('battle'),
    turn: state.turn,
    kind,
    col,
    row,
    combined: !!combined,
    aftermath: aftermath || null,
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

  const cityIsEnemy = city && city.factionId !== army.factionId;
  // Everything holding the tile fights as one: every enemy army standing on it
  // plus the city's garrison. Resolving them one after another would let an
  // attacker beat a superior defence piecemeal.
  const defendingArmies = state.armies.filter(
    (a) => a.col === destCol && a.row === destRow && a.factionId !== army.factionId
  );
  const garrisonJoins = cityIsEnemy && unitTotalCount(city.garrison) > 0;

  // Settles what becomes of a beaten defending army: it falls back with its
  // survivors, and is only lost if it is wiped out or has nowhere to go.
  function routArmy(defeated, survivors) {
    defeated.units = survivors;
    if (unitTotalCount(survivors) <= 0) {
      removeArmy(state, defeated.id);
      return 'destroyed';
    }
    if (!retreatArmy(state, defeated, army.col, army.row)) {
      removeArmy(state, defeated.id);
      return 'encircled';
    }
    return 'retreated';
  }

  if (defendingArmies.length || garrisonJoins) {
    const contingents = defendingArmies.map((a) => ({ ...a.units }));
    if (garrisonJoins) contingents.push({ ...city.garrison });

    const result = resolveBattle(attackerUnits, mergeAllUnits(contingents), tileType);
    attackerUnits = result.attackerSurvivors;
    const shares = splitSurvivors(result.defenderSurvivors, contingents);

    // The city's own faction speaks for the defence when one is involved.
    const defenderFaction = factionById(
      state,
      garrisonJoins ? city.factionId : defendingArmies[0].factionId
    );

    let aftermath;
    if (result.outcome === 'attacker') {
      const fates = defendingArmies.map((a, i) => routArmy(a, shares[i]));
      if (garrisonJoins) {
        capturedCity = true;
        city.garrison = {};
      }
      // What happened to the field armies outranks the fall of the city; with
      // no armies present at all, the city's fall is the whole story.
      aftermath = {
        fate: fates.includes('retreated') ? 'retreated'
          : fates.includes('encircled') ? 'encircled'
            : fates.length ? 'destroyed' : 'cityFell',
        garrisonCaptured: garrisonJoins ? unitTotalCount(shares[shares.length - 1]) : 0,
      };
    } else {
      defendingArmies.forEach((a, i) => {
        a.units = shares[i];
        if (unitTotalCount(a.units) <= 0) removeArmy(state, a.id);
      });
      if (garrisonJoins) city.garrison = shares[shares.length - 1];
      bounced = true;
      aftermath = { fate: 'held' };
    }

    reports.push(recordBattle(state, {
      attackerFaction,
      defenderFaction,
      result,
      kind: garrisonJoins ? 'city' : 'army',
      city,
      col: destCol,
      row: destRow,
      combined: defendingArmies.length > 0 && garrisonJoins,
      aftermath,
    }));
  }

  if (!bounced && !capturedCity && unitTotalCount(attackerUnits) > 0 && cityIsEnemy) {
    const defenderFaction = factionById(state, city.factionId);
    if (unitTotalCount(city.garrison) > 0) {
      const result = resolveBattle(attackerUnits, city.garrison, tileType);
      attackerUnits = result.attackerSurvivors;
      if (result.outcome === 'attacker') {
        capturedCity = true;
        reports.push(recordBattle(state, {
          attackerFaction, defenderFaction, result, kind: 'city', city,
          col: destCol, row: destRow,
          aftermath: { fate: 'cityFell', garrisonCaptured: unitTotalCount(result.defenderSurvivors) },
        }));
      } else {
        city.garrison = result.defenderSurvivors;
        bounced = true;
        reports.push(recordBattle(state, {
          attackerFaction, defenderFaction, result, kind: 'city', city,
          col: destCol, row: destRow, aftermath: { fate: 'held' },
        }));
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
  // Never stack two armies on one tile: if anything still holds the ground
  // (a defender that could not be dislodged), the attacker stays put.
  const stillHeld = state.armies.some(
    (a) => a.id !== army.id && a.col === destCol && a.row === destRow
  );
  if ((!city || capturedCity) && !stillHeld) {
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
