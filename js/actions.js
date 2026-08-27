import {
  UNIT_ORDER, UNIT_TYPES, MAX_MOVEMENT, INCOME_PER_CITY,
  RECRUIT_BATCH, GARRISON_REGEN_BATCH, TILE_TYPES, settlementTier, garrisonCapacity,
  MORALE_MAX, MORALE_START, MORALE_AFTER_WIN, MORALE_AFTER_LOSS,
  MORALE_REST, MORALE_REST_IN_CITY, EXHAUSTION_PER_MOVE, EXHAUSTION_REST,
  EXHAUSTION_REST_IN_CITY, EXHAUSTION_PER_BATTLE,
  GARRISON_MORALE, GARRISON_EXHAUSTION,
  WALL_COST, WALL_BUILD_TURNS, WALL_DEFENCE_MULTIPLIER,
  SHIP_COST, NAVAL_MOVEMENT, EXHAUSTION_PER_SEA_MOVE,
  AMPHIBIOUS_ATTACK_MULTIPLIER, SEA_DEFENCE_MULTIPLIER,
} from './data.js';
import { computeReachable, tileKey } from './pathfind.js';
import { resolveBattle, forecastBattle } from './combat.js';
import {
  makeId, factionById, cityAt, armyAt, unitTotalCount, logMsg, playerFaction,
  isWaterTile, isCoastalCity, harbourTile,
} from './state.js';

export function removeArmy(state, armyId) {
  const idx = state.armies.findIndex((a) => a.id === armyId);
  if (idx !== -1) state.armies.splice(idx, 1);
  if (state.selectedArmyId === armyId) state.selectedArmyId = null;
}

function battleLine(attackerFaction, defenderFaction, vs, result, cityName, opts = {}) {
  const winner = result.outcome === 'attacker' ? attackerFaction.name : defenderFaction.name;
  const place = vs === 'city' ? ` bei ${cityName}` : '';
  const verb = opts.naval ? 'stellt zur See' : vs === 'city' ? 'belagert' : 'greift';
  const icon = opts.naval ? '⛵' : opts.amphibious ? '🌊' : '⚔️';
  const landing = opts.amphibious ? ' (Landung vom Meer)' : '';
  return `${icon} ${attackerFaction.name} ${verb} ${defenderFaction.name}${place}${landing} – Sieg für ${winner} (Verluste: Angreifer ${(result.attackerLossesPct * 100).toFixed(0)}%, Verteidiger ${(result.defenderLossesPct * 100).toFixed(0)}%).`;
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Averages a stat across the armies holding a tile and, when it joins in, the
// city garrison - each weighted by how many men it brings to the line.
function weightedCondition(armies, garrison, stat) {
  const fallback = stat === 'morale' ? MORALE_START : 0;
  let weighted = 0;
  let men = 0;
  for (const army of armies) {
    const count = unitTotalCount(army.units);
    weighted += (army[stat] ?? fallback) * count;
    men += count;
  }
  if (garrison) {
    const count = unitTotalCount(garrison);
    weighted += (stat === 'morale' ? GARRISON_MORALE : GARRISON_EXHAUSTION) * count;
    men += count;
  }
  return men > 0 ? weighted / men : fallback;
}

export function adjustMorale(army, delta) {
  army.morale = clamp((army.morale ?? MORALE_START) + delta, 0, MORALE_MAX);
}

export function adjustExhaustion(army, delta) {
  army.exhaustion = clamp((army.exhaustion ?? 0) + delta, 0, 100);
}

export function cityHasWalls(city) {
  return !!city && city.walls === 'complete';
}

const NEIGHBOUR_OFFSETS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Rowing wears men down far less than marching in armour does.
function moveExhaustion(army, cost) {
  return (army.embarked ? EXHAUSTION_PER_SEA_MOVE : EXHAUSTION_PER_MOVE) * cost;
}

// An army that has reached dry land is an army again: it leaves the ships
// behind, and wading ashore costs it the rest of the turn.
function comeAshore(state, army) {
  if (!army.embarked || isWaterTile(state, army.col, army.row)) return false;
  army.embarked = false;
  army.maxMovement = MAX_MOVEMENT;
  army.movement = 0;
  return true;
}

// A beaten army falls back rather than evaporating. It prefers the tile
// furthest from the attacker; only a force with nowhere left to go is lost.
function retreatArmy(state, defeated, fromCol, fromRow) {
  let best = null;
  let bestDistance = -1;
  for (const [dc, dr] of NEIGHBOUR_OFFSETS) {
    const col = defeated.col + dc;
    const row = defeated.row + dr;
    if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) continue;
    // A fleet falls back across the water, an army across the land; neither
    // can retreat into the other's element.
    const sea = isWaterTile(state, col, row);
    if (defeated.embarked ? !sea : TILE_TYPES[state.map.tiles[row][col].type].impassable) continue;
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
  const {
    attackerFaction, defenderFaction, result, kind, city, col, row, combined,
    aftermath, naval, amphibious,
  } = opts;
  const report = {
    id: makeId('battle'),
    turn: state.turn,
    kind,
    col,
    row,
    combined: !!combined,
    naval: !!naval,
    amphibious: !!amphibious,
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
    wallMultiplier: result.wallMultiplier,
    defenderMultiplier: result.defenderMultiplier,
    attackerMultiplier: result.attackerMultiplier,
    attackerMorale: result.attackerMorale,
    attackerExhaustion: result.attackerExhaustion,
    defenderMorale: result.defenderMorale,
    defenderExhaustion: result.defenderExhaustion,
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
  logMsg(state, battleLine(attackerFaction, defenderFaction, kind, result, city && city.name,
    { naval, amphibious }), report.id);
  return report;
}

// Everything the defence of a tile consists of, and every modifier the battle
// will run under. Both the forecast and the real engagement read it from here,
// so the preview can never promise a fight on terms the battle does not use.
export function gatherDefence(state, army, destCol, destRow, attackerOverrides = {}) {
  const city = cityAt(state, destCol, destRow);
  const cityIsEnemy = !!city && city.factionId !== army.factionId;
  const defendingArmies = state.armies.filter(
    (a) => a.col === destCol && a.row === destRow && a.factionId !== army.factionId
  );
  const garrisonJoins = cityIsEnemy && unitTotalCount(city.garrison) > 0;
  const contingents = defendingArmies.map((a) => ({ ...a.units }));
  if (garrisonJoins) contingents.push({ ...city.garrison });

  const atSea = isWaterTile(state, destCol, destRow);
  const amphibious = !!army.embarked && !atSea;
  const walled = cityIsEnemy && cityHasWalls(city);

  return {
    city,
    cityIsEnemy,
    defendingArmies,
    garrisonJoins,
    contingents,
    defenders: mergeAllUnits(contingents),
    hasDefence: defendingArmies.length > 0 || garrisonJoins,
    combined: defendingArmies.length > 0 && garrisonJoins,
    terrainType: state.map.tiles[destRow][destCol].type,
    atSea,
    amphibious,
    walled,
    kind: garrisonJoins ? 'city' : 'army',
    modifiers: {
      attackerMorale: army.morale,
      attackerExhaustion: army.exhaustion,
      ...attackerOverrides,
      defenderMorale: weightedCondition(defendingArmies, garrisonJoins ? city.garrison : null, 'morale'),
      defenderExhaustion: weightedCondition(defendingArmies, garrisonJoins ? city.garrison : null, 'exhaustion'),
      wallMultiplier: walled ? WALL_DEFENCE_MULTIPLIER : 1,
      // Caught on open water there is no line to form and no ground to hold.
      defenderMultiplier: atSea ? SEA_DEFENCE_MULTIPLIER : 1,
      // Storming a shore straight off the ships is the hardest attack there is.
      attackerMultiplier: amphibious ? AMPHIBIOUS_ATTACK_MULTIPLIER : 1,
    },
  };
}

// What the player is about to walk into, worked out before anything is
// committed: the odds, the expected cost, and every modifier that produced
// them. Changes nothing - not the state, not the campaign's battle sequence.
export function previewTileCombat(state, armyId, destCol, destRow, sampleCount) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return null;
  const entry = computeReachable(state, army).get(tileKey(destCol, destRow));
  if (!entry || !entry.combat) return null;

  // The march is paid for before the first blow falls, so the forecast has to
  // fight with the exhaustion the army will actually arrive with.
  const arrivalExhaustion = clamp(
    (army.exhaustion ?? 0) + moveExhaustion(army, entry.cost), 0, 100
  );
  const defence = gatherDefence(state, army, destCol, destRow, {
    attackerExhaustion: arrivalExhaustion,
  });
  const attackerFaction = factionById(state, army.factionId);
  const defenderFaction = factionById(
    state,
    defence.garrisonJoins ? defence.city.factionId
      : defence.defendingArmies.length ? defence.defendingArmies[0].factionId
        : defence.city ? defence.city.factionId : null
  );

  const base = {
    col: destCol,
    row: destRow,
    moveCost: entry.cost,
    armyId,
    armyName: army.name,
    attackerFactionId: attackerFaction.id,
    defenderFactionId: defenderFaction ? defenderFaction.id : null,
    cityName: defence.city ? defence.city.name : null,
    citySize: defence.city ? defence.city.size : null,
    cityCapital: defence.city ? !!defence.city.capital : false,
    kind: defence.kind,
    combined: defence.combined,
    terrainType: defence.terrainType,
    naval: defence.atSea,
    amphibious: defence.amphibious,
    walled: defence.walled,
    arrivalExhaustion,
  };

  if (!defence.hasDefence) {
    return { ...base, unopposed: true, forecast: null };
  }
  return {
    ...base,
    unopposed: false,
    forecast: forecastBattle(
      { ...army.units }, defence.defenders, defence.terrainType, defence.modifiers, sampleCount
    ),
  };
}

// Resolves everything that happens when `army` steps onto (col,row): 0, 1 or 2
// sequential engagements (field army, then city garrison), all resolved on the
// campaign map itself — there is no separate battle screen.
export function resolveTileCombat(state, army, destCol, destRow) {
  const attackerFaction = factionById(state, army.factionId);
  // Everything holding the tile fights as one: every enemy army standing on it
  // plus the city's garrison. Resolving them one after another would let an
  // attacker beat a superior defence piecemeal.
  const defence = gatherDefence(state, army, destCol, destRow);
  const {
    city, cityIsEnemy, defendingArmies, garrisonJoins, contingents, terrainType,
  } = defence;

  let attackerUnits = { ...army.units };
  let capturedCity = false;
  let bounced = false;
  const reports = [];

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

  if (defence.hasDefence) {
    // The defence's condition is the weighted average of its contingents; the
    // garrison contributes its own fixed standard.
    const result = resolveBattle(
      attackerUnits, defence.defenders, terrainType, defence.modifiers
    );
    attackerUnits = result.attackerSurvivors;
    const shares = splitSurvivors(result.defenderSurvivors, contingents);

    // The city's own faction speaks for the defence when one is involved.
    const defenderFaction = factionById(
      state,
      garrisonJoins ? city.factionId : defendingArmies[0].factionId
    );

    adjustExhaustion(army, EXHAUSTION_PER_BATTLE);
    adjustMorale(army, result.outcome === 'attacker' ? MORALE_AFTER_WIN : MORALE_AFTER_LOSS);
    for (const defender of defendingArmies) {
      adjustExhaustion(defender, EXHAUSTION_PER_BATTLE);
      adjustMorale(defender, result.outcome === 'defender' ? MORALE_AFTER_WIN : MORALE_AFTER_LOSS);
    }

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
      kind: defence.kind,
      city,
      col: destCol,
      row: destRow,
      combined: defence.combined,
      naval: defence.atSea,
      amphibious: defence.amphibious,
      aftermath,
    }));
  }

  if (!bounced && !capturedCity && unitTotalCount(attackerUnits) > 0 && cityIsEnemy) {
    const defenderFaction = factionById(state, city.factionId);
    if (unitTotalCount(city.garrison) > 0) {
      const result = resolveBattle(attackerUnits, city.garrison, terrainType, {
        attackerMorale: army.morale,
        attackerExhaustion: army.exhaustion,
        defenderMorale: GARRISON_MORALE,
        defenderExhaustion: GARRISON_EXHAUSTION,
        wallMultiplier: cityHasWalls(city) ? WALL_DEFENCE_MULTIPLIER : 1,
      });
      attackerUnits = result.attackerSurvivors;
      adjustExhaustion(army, EXHAUSTION_PER_BATTLE);
      adjustMorale(army, result.outcome === 'attacker' ? MORALE_AFTER_WIN : MORALE_AFTER_LOSS);
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
  adjustExhaustion(army, moveExhaustion(army, entry.cost));

  if (!entry.combat) {
    army.col = destCol;
    army.row = destRow;
    const landed = comeAshore(state, army);
    if (landed) {
      logMsg(state, `${factionById(state, army.factionId).name}: ${army.name} geht an Land.`);
    }
    return { ok: true, combat: false, landed, reports: [] };
  }
  const outcome = resolveTileCombat(state, army, destCol, destRow);
  // An assault that carried the shore puts the troops ashore for good; one
  // that was thrown back is still aboard its ships.
  const landed = outcome.survived ? comeAshore(state, army) : false;
  return { ok: true, combat: true, landed, ...outcome };
}

// Taking ship: the army leaves its home port and stands out to sea. The fleet
// is paid for once, and boarding takes the rest of the turn.
export function embarkArmy(state, armyId) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return { ok: false };
  if (army.embarked) return { ok: false, reason: 'atSea' };
  const city = cityAt(state, army.col, army.row);
  if (!city || city.factionId !== army.factionId) return { ok: false, reason: 'noCity' };
  if (!isCoastalCity(state, city)) return { ok: false, reason: 'noPort' };
  const faction = factionById(state, army.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  if (faction.gold < SHIP_COST) return { ok: false, reason: 'gold' };

  const berth = harbourTile(state, city, true);
  if (!berth) return { ok: false, reason: 'blocked' };

  faction.gold -= SHIP_COST;
  army.col = berth.col;
  army.row = berth.row;
  army.embarked = true;
  army.maxMovement = NAVAL_MOVEMENT;
  army.movement = 0;
  logMsg(state, `${faction.name}: ${army.name} sticht in ${city.name} in See (${SHIP_COST} Gold).`);
  return { ok: true };
}

// Whether this army could take ship right now, and if not, why - the sidebar
// needs the reason to explain the disabled button.
export function embarkStatus(state, army) {
  if (!army) return { can: false, reason: 'none' };
  if (army.embarked) return { can: false, reason: 'atSea' };
  const city = cityAt(state, army.col, army.row);
  if (!city || city.factionId !== army.factionId) return { can: false, reason: 'noCity' };
  if (!isCoastalCity(state, city)) return { can: false, reason: 'noPort', city };
  const faction = factionById(state, army.factionId);
  if (!faction || faction.gold < SHIP_COST) return { can: false, reason: 'gold', city };
  if (!harbourTile(state, city, true)) return { can: false, reason: 'blocked', city };
  return { can: true, city };
}

export function recruitUnit(state, cityId, unitKey) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const def = UNIT_TYPES[unitKey];
  const maxTotal = garrisonCapacity(city, faction);
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
    movement: 0, maxMovement: MAX_MOVEMENT, units: { ...city.garrison },
    // Fresh out of the barracks: rested, and steady from having been paid.
    morale: GARRISON_MORALE, exhaustion: 0,
    name: `${faction.name} Armee`,
  };
  state.armies.push(newArmy);
  city.garrison = {};
  logMsg(state, `${faction.name} stellt in ${city.name} eine neue Armee auf.`);
  return { ok: true, armyId: newArmy.id };
}

// An army standing on a friendly city dissolves into its garrison: the men
// stay, they just man the walls instead of marching.
export function disbandArmyIntoCity(state, armyId) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return { ok: false };
  const city = cityAt(state, army.col, army.row);
  if (!city || city.factionId !== army.factionId) return { ok: false, reason: 'noCity' };

  const joined = unitTotalCount(army.units);
  if (joined <= 0) return { ok: false, reason: 'empty' };
  for (const key of UNIT_ORDER) {
    if (army.units[key]) city.garrison[key] = (city.garrison[key] || 0) + army.units[key];
  }
  removeArmy(state, army.id);
  const faction = factionById(state, city.factionId);
  logMsg(state, `${faction.name}: ${joined.toLocaleString('de-DE')} Mann treten in ${city.name} der Garnison bei.`);
  return { ok: true, cityId: city.id, joined };
}

export function wallCost() {
  return WALL_COST;
}

// Walls are paid for up front and then raised over several turns.
export function buyCityWalls(state, cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  if (city.walls !== 'none') return { ok: false, reason: 'exists' };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  if (faction.gold < WALL_COST) return { ok: false, reason: 'gold' };

  faction.gold -= WALL_COST;
  city.walls = 'building';
  city.wallTurnsLeft = WALL_BUILD_TURNS;
  logMsg(state, `${faction.name} beginnt den Bau einer Stadtmauer in ${city.name} (${WALL_BUILD_TURNS} Runden).`);
  return { ok: true };
}

export function advanceWallConstruction(state) {
  for (const city of state.cities) {
    if (city.walls !== 'building') continue;
    city.wallTurnsLeft -= 1;
    if (city.wallTurnsLeft <= 0) {
      city.walls = 'complete';
      city.wallTurnsLeft = 0;
      logMsg(state, `Die Stadtmauer von ${city.name} ist fertiggestellt.`);
    }
  }
}

// Armies that stayed put regain their edge; a city lets them recover fastest.
export function recoverArmies(state) {
  for (const army of state.armies) {
    const rested = army.movement === army.maxMovement;
    if (!rested) continue;
    const city = cityAt(state, army.col, army.row);
    const inOwnCity = city && city.factionId === army.factionId;
    adjustMorale(army, inOwnCity ? MORALE_REST_IN_CITY : MORALE_REST);
    adjustExhaustion(army, inOwnCity ? EXHAUSTION_REST_IN_CITY : EXHAUSTION_REST);
  }
}

export function collectIncome(state) {
  for (const faction of state.factions) {
    if (faction.isNeutral) continue;
    const ownCities = state.cities.filter((c) => c.factionId === faction.id);
    let income = ownCities.reduce(
      (sum, c) => sum + INCOME_PER_CITY * settlementTier(c.size).incomeFactor, 0
    );
    income += ownCities.reduce((s, c) => s + Math.floor(c.population / 200), 0);
    const upkeep = state.armies
      .filter((a) => a.factionId === faction.id)
      .reduce((s, a) => s + UNIT_ORDER.reduce((s2, k) => s2 + (a.units[k] || 0) * UNIT_TYPES[k].upkeep, 0), 0);
    faction.gold = Math.max(0, Math.round(faction.gold + income - upkeep));
  }
}

export function regenerateGarrisons(state) {
  for (const city of state.cities) {
    const maxTotal = garrisonCapacity(city, factionById(state, city.factionId));
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
