import {
  UNIT_ROLES, GARRISON_ROLES, COMBAT_ROLES, WATCH_ROLE, watchTarget, watchGrowth,
  unitDef, MAX_MOVEMENT, INCOME_PER_CITY,
  RECRUIT_BATCH, TILE_TYPES, settlementTier, garrisonCapacity,
  MORALE_MAX, MORALE_START, MORALE_AFTER_WIN, MORALE_AFTER_LOSS,
  MORALE_REST, MORALE_REST_IN_CITY, EXHAUSTION_PER_MOVE, EXHAUSTION_REST,
  EXHAUSTION_REST_IN_CITY, EXHAUSTION_PER_BATTLE,
  GARRISON_MORALE, GARRISON_EXHAUSTION,
  MAX_WALL_LEVEL, wallLevelInfo, wallDefenceMultiplier,
  MAX_EXPERIENCE, EXPERIENCE_PER_BATTLE, EXPERIENCE_FOR_WIN,
  experienceBonus, experienceStars, starMarks, starTitle,
  SHIP_COST, NAVAL_MOVEMENT, EXHAUSTION_PER_SEA_MOVE,
  AMPHIBIOUS_ATTACK_MULTIPLIER, SEA_UNIT_SCALE, SHIP_ROLE, WARSHIP_BATCH,
  ROAD_TARGET_CHOICES, roadCost, roadTurns,
  HARBOUR_COST, HARBOUR_TURNS, HARBOUR_NAME,
  MILITIA_FIRST_TURN, MILITIA_MIN_POPULATION, MILITIA_CHANCE, MILITIA_MAX, MILITIA_WATCH_RESERVE,
  MILITIA_MAX_SIZE, MILITIA_MIN_SIZE, MILITIA_PER_POPULATION, MILITIA_WATCH_SHARE,
  FREE_STATE_MAX, FREE_STATE_NAMES, FACTION_UNITS,
} from './data.js';
import { landRoute } from './mapgen.js';
import { computeReachable, tileKey } from './pathfind.js';
import { resolveBattle, forecastBattle } from './combat.js';
import {
  makeId, factionById, cityAt, armyAt, unitTotalCount, logMsg, logOwn, playerFaction,
  isWaterTile, isCoastalCity, harbourTile, isFleet, PORT_RANGE,
} from './state.js';
import {
  rollWeather, weatherAt, weatherInfo, weatherBattleModifiers, calendarOfTurn, zoneName,
} from './weather.js';
import { wondersOfCity } from './wonders.js';

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

// Eine Schlacht geht beide Seiten an - so kann das Protokoll später
// entscheiden, ob sie den Spieler betrifft.
function logBattle(state, attackerFaction, defenderFaction, text, reportId) {
  logMsg(state, text, reportId, [attackerFaction.id, defenderFaction.id]);
}


// Über alle Rollen, die kämpfen können - die Stadtwache eingeschlossen. Wird
// hier nur über die drei Feldrollen gerechnet, verschwindet die Wache aus der
// Verteidigung, obwohl sie in der Stadt steht.
function mergeAllUnits(parts) {
  const out = {};
  for (const key of COMBAT_ROLES) {
    out[key] = parts.reduce((sum, part) => sum + (part[key] || 0), 0);
  }
  return out;
}

// Splits a combined force's survivors back over the contingents that made it
// up, in proportion to what each contributed, so no single contingent absorbs
// all of the casualties.
function splitSurvivors(survivors, parts) {
  const out = parts.map(() => ({}));
  for (const key of COMBAT_ROLES) {
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
    // Garrisons are levies: a fixed standard of morale, rested, and green.
    const garrisonValue = stat === 'morale' ? GARRISON_MORALE
      : stat === 'exhaustion' ? GARRISON_EXHAUSTION : 0;
    weighted += garrisonValue * count;
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

// Was eine Armee aus einer Schlacht mitnimmt. Wer gewinnt, lernt mehr - aber
// auch der Geschlagene, der überlebt, hat etwas gelernt.
export function awardExperience(army, won) {
  const before = experienceStars(army.experience);
  army.experience = clamp(
    (army.experience || 0) + EXPERIENCE_PER_BATTLE + (won ? EXPERIENCE_FOR_WIN : 0),
    0, MAX_EXPERIENCE
  );
  return experienceStars(army.experience) > before;
}

export function cityWallLevel(city) {
  return city ? (city.wallLevel || 0) : 0;
}

// The next stage this settlement could start building, or null once the stone
// wall stands. Stages are always taken in order.
export function nextWallLevel(city) {
  if (!city || city.wallBuilding) return null;
  const level = cityWallLevel(city) + 1;
  return level <= MAX_WALL_LEVEL ? level : null;
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
    aftermath, naval, amphibious, weather, attackerExperience, defenderExperience,
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
    attackerExperience: attackerExperience ?? null,
    defenderExperience: defenderExperience ?? null,
    attackerVeterancy: result.attackerVeterancy,
    defenderVeterancy: result.defenderVeterancy,
    weatherKey: weather ? weather.key : null,
    weatherName: weather ? weather.name : null,
    weatherIcon: weather ? weather.icon : null,
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
    unitScale: result.unitScale,
    weatherScale: result.weatherScale,
    seaScale: result.seaScale,
    openingVolley: result.openingVolley,
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
  logBattle(state, attackerFaction, defenderFaction,
    battleLine(attackerFaction, defenderFaction, kind, result, city && city.name,
    { naval, amphibious }), report.id);
  return report;
}

// Everything the defence of a tile consists of, and every modifier the battle
// will run under. Both the forecast and the real engagement read it from here,
// so the preview can never promise a fight on terms the battle does not use.
// Zwei Multiplikatorlisten je Waffengattung zu einer zusammenfassen.
function combineScales(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = (out[key] ?? 1) * value;
  return out;
}

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
  const wallLevel = cityIsEnemy ? cityWallLevel(city) : 0;
  const sky = weatherBattleModifiers(state, destCol, destRow);
  // Who the defence actually is decides which arms it fights with.
  const defenderFactionId = garrisonJoins ? city.factionId
    : defendingArmies.length ? defendingArmies[0].factionId
      : city ? city.factionId : 'neutral';
  // The garrison is a levy and brings no veterancy, so it only dilutes what
  // the field armies have learned.
  const defenceExperience = weightedCondition(
    defendingArmies, garrisonJoins ? city.garrison : null, 'experience'
  );

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
    wallLevel,
    wallName: wallLevel ? wallLevelInfo(wallLevel).name : null,
    weather: sky.weather,
    attackerExperience: army.experience || 0,
    defenceExperience,
    kind: garrisonJoins ? 'city' : 'army',
    defenderFactionId,
    modifiers: {
      attackerMorale: army.morale,
      attackerExhaustion: army.exhaustion,
      ...attackerOverrides,
      defenderMorale: weightedCondition(defendingArmies, garrisonJoins ? city.garrison : null, 'morale'),
      defenderExhaustion: weightedCondition(defendingArmies, garrisonJoins ? city.garrison : null, 'exhaustion'),
      wallMultiplier: wallDefenceMultiplier(wallLevel),
      defenderMultiplier: 1,
      // Storming a shore straight off the ships is the hardest attack there is.
      attackerMultiplier: amphibious ? AMPHIBIOUS_ATTACK_MULTIPLIER : 1,
      attackerVeterancy: experienceBonus(army.experience),
      defenderVeterancy: experienceBonus(defenceExperience),
      attackerFactionId: army.factionId,
      defenderFactionId,
      ...sky.modifiers,
      // Wetter und Seegang wirken beide auf die Waffengattungen; sie werden
      // multipliziert, nicht gegeneinander ausgetauscht. Für die Anzeige
      // bleiben beide getrennt erhalten - sonst schriebe der Bericht dem Wetter
      // zu, was in Wahrheit das Meer tut.
      unitScale: combineScales(sky.modifiers.unitScale, atSea ? SEA_UNIT_SCALE : null),
      weatherScale: sky.modifiers.unitScale || null,
      seaScale: atSea ? SEA_UNIT_SCALE : null,
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
    weather: defence.weather,
    attackerExperience: defence.attackerExperience,
    defenderExperience: defence.defenceExperience,
    attackerVeterancy: defence.modifiers.attackerVeterancy,
    defenderVeterancy: defence.modifiers.defenderVeterancy,
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
  const promotions = [];

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
    if (awardExperience(army, result.outcome === 'attacker')) {
      promotions.push(army);
    }
    for (const defender of defendingArmies) {
      adjustExhaustion(defender, EXHAUSTION_PER_BATTLE);
      adjustMorale(defender, result.outcome === 'defender' ? MORALE_AFTER_WIN : MORALE_AFTER_LOSS);
      if (awardExperience(defender, result.outcome === 'defender')) promotions.push(defender);
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
      weather: defence.weather,
      attackerExperience: defence.attackerExperience,
      defenderExperience: defence.defenceExperience,
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
        wallMultiplier: wallDefenceMultiplier(cityWallLevel(city)),
        attackerFactionId: army.factionId,
        defenderFactionId: city.factionId,
      });
      attackerUnits = result.attackerSurvivors;
      adjustExhaustion(army, EXHAUSTION_PER_BATTLE);
      adjustMorale(army, result.outcome === 'attacker' ? MORALE_AFTER_WIN : MORALE_AFTER_LOSS);
      if (awardExperience(army, result.outcome === 'attacker')) promotions.push(army);
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
      logMsg(state, `${attackerFaction.name} nimmt das unverteidigte ${city.name} kampflos ein.`,
        null, [attackerFaction.id, city.factionId]);
    }
  }

  if (capturedCity && city) {
    const lostTo = city.factionId;
    // Eine Miliz erobert nicht für die Unabhängigen - sie gründet einen Staat.
    if (army.factionId === 'neutral') foundFreeState(state, army, city);
    city.factionId = army.factionId;
    // Mit der Stadt wechselt auch das Wahrzeichen den Besitzer - das ist eine
    // Zeile im Protokoll wert, für beide Seiten.
    const landmarks = wondersOfCity(state, city.id);
    if (landmarks.length) {
      logMsg(state, `Mit ${city.name} fällt ${landmarks.map((w) => w.name).join(' und ')} `
        + `an ${attackerFaction.name}.`, null, [attackerFaction.id, lostTo]);
    }
    // A small occupying garrison remains so the city isn't immediately
    // defenseless against a follow-up attack the same turn.
    city.garrison = { infantry: 30 };
    city.population = Math.round(city.population * 0.92);
  }

  // A promotion is worth saying out loud; it changes how the army fights from
  // here on.
  for (const promoted of promotions) {
    if (!state.armies.includes(promoted)) continue;
    logOwn(state, promoted.factionId, `${starMarks(promoted.experience)} ${promoted.name} steigt auf: `
      + `${starTitle(promoted.experience)}.`);
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

// Zwei Heere derselben Fraktion werden zu einem. Erfahrung, Moral und
// Erschöpfung werden nach Kopfzahl gemittelt: ein frisches Aufgebot verdünnt
// die Veteranen, und wer erschöpft ankommt, zieht den Rest mit herunter.
export function mergeArmies(state, mover, host) {
  const moverMen = unitTotalCount(mover.units);
  const hostMen = unitTotalCount(host.units);
  const total = moverMen + hostMen;
  if (total > 0) {
    const blend = (stat, fallback) => (
      ((host[stat] ?? fallback) * hostMen + (mover[stat] ?? fallback) * moverMen) / total
    );
    host.experience = blend('experience', 0);
    host.morale = blend('morale', MORALE_START);
    host.exhaustion = blend('exhaustion', 0);
  }
  for (const key of COMBAT_ROLES) {
    if (mover.units[key]) host.units[key] = (host.units[key] || 0) + mover.units[key];
  }
  // Das vereinigte Heer hat den Marsch des Zuziehenden in den Knochen.
  host.movement = Math.min(host.movement, mover.movement);
  const name = mover.name;
  removeArmy(state, mover.id);
  logOwn(state, host.factionId, `${name} schließt sich ${host.name} an – ${
    unitTotalCount(host.units).toLocaleString('de-DE')} Mann.`);
  return { ok: true, combat: false, merged: true, armyId: host.id, reports: [] };
}

export function moveArmy(state, armyId, destCol, destRow) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return { ok: false };
  const reachable = computeReachable(state, army);
  const entry = reachable.get(tileKey(destCol, destRow));
  if (!entry) return { ok: false };

  army.movement = Math.max(0, army.movement - entry.cost);
  adjustExhaustion(army, moveExhaustion(army, entry.cost));

  // Zwei eigene Heere auf einem Feld werden eines.
  if (entry.merge) {
    const host = armyAt(state, destCol, destRow);
    if (!host || host.factionId !== army.factionId) return { ok: false };
    return mergeArmies(state, army, host);
  }

  if (!entry.combat) {
    army.col = destCol;
    army.row = destRow;
    const landed = comeAshore(state, army);
    if (landed) {
      logOwn(state, army.factionId, `${army.name} geht an Land.`);
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
  // Ein Kai, eine Werft, Vorräte: ohne Hafen legt kein Schiff ab.
  if (!city.harbour) return { ok: false, reason: 'noHarbour' };
  const faction = factionById(state, army.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  if (faction.gold < SHIP_COST) return { ok: false, reason: 'gold' };

  const berth = harbourTile(state, city, true);
  if (!berth) return { ok: false, reason: 'blocked' };
  if (weatherAt(state, berth.col, berth.row).blocksEmbark) {
    return { ok: false, reason: 'storm' };
  }

  faction.gold -= SHIP_COST;
  army.col = berth.col;
  army.row = berth.row;
  army.embarked = true;
  army.maxMovement = NAVAL_MOVEMENT;
  army.movement = 0;
  logOwn(state, faction.id, `${army.name} sticht in ${city.name} in See (${SHIP_COST} Gold).`);
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
  if (!city.harbour) return { can: false, reason: 'noHarbour', city };
  const faction = factionById(state, army.factionId);
  if (!faction || faction.gold < SHIP_COST) return { can: false, reason: 'gold', city };
  const berth = harbourTile(state, city, true);
  if (!berth) return { can: false, reason: 'blocked', city };
  if (weatherAt(state, berth.col, berth.row).blocksEmbark) {
    return { can: false, reason: 'storm', city };
  }
  return { can: true, city };
}

export function recruitUnit(state, cityId, unitKey) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const def = unitDef(city.factionId, unitKey);
  const maxTotal = garrisonCapacity(city, faction);
  if (unitTotalCount(city.garrison) >= maxTotal) return { ok: false, reason: 'full' };
  if (faction.gold < def.cost) return { ok: false, reason: 'gold' };
  faction.gold -= def.cost;
  city.garrison[unitKey] = (city.garrison[unitKey] || 0) + RECRUIT_BATCH;
  logOwn(state, faction.id, `${RECRUIT_BATCH} ${def.name} in ${city.name} ausgehoben.`);
  return { ok: true };
}

// --- Flottenbau -----------------------------------------------------------
// In einer Hafenstadt lassen sich Kriegsschiffe bauen. Sie bilden eine eigene
// Flotte, die im Hafenbecken liegt: kein Landheer, das übersetzt, sondern ein
// Geschwader, das das Meer selbst hält.
export function fleetAt(state, col, row, factionId) {
  const army = armyAt(state, col, row);
  return army && army.factionId === factionId && isFleet(army) ? army : null;
}

export function buildFleet(state, cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  if (!city.harbour) return { ok: false, reason: 'noHarbour' };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const ship = unitDef(city.factionId, SHIP_ROLE);
  if (faction.gold < ship.cost) return { ok: false, reason: 'gold' };

  // Liegt schon eine eigene Flotte im Hafen, wächst sie; sonst braucht es ein
  // freies Wasserfeld in Hafenreichweite.
  let fleet = null;
  for (let dr = -PORT_RANGE; dr <= PORT_RANGE && !fleet; dr++) {
    for (let dc = -PORT_RANGE; dc <= PORT_RANGE && !fleet; dc++) {
      if (Math.abs(dc) + Math.abs(dr) > PORT_RANGE) continue;
      if (!isWaterTile(state, city.col + dc, city.row + dr)) continue;
      fleet = fleetAt(state, city.col + dc, city.row + dr, city.factionId);
    }
  }
  const berth = fleet ? null : harbourTile(state, city, true);
  if (!fleet && !berth) return { ok: false, reason: 'blocked' };
  if (weatherAt(state, (fleet || berth).col, (fleet || berth).row).blocksEmbark) {
    return { ok: false, reason: 'storm' };
  }

  faction.gold -= ship.cost;
  if (fleet) {
    const veterans = unitTotalCount(fleet.units);
    fleet.experience = ((fleet.experience || 0) * veterans) / (veterans + WARSHIP_BATCH);
    fleet.units[SHIP_ROLE] = (fleet.units[SHIP_ROLE] || 0) + WARSHIP_BATCH;
    logOwn(state, faction.id, `${WARSHIP_BATCH} ${ship.name} verstärken ${fleet.name} in ${city.name}.`);
    return { ok: true, armyId: fleet.id };
  }

  const newFleet = {
    id: makeId('army'),
    factionId: city.factionId,
    col: berth.col,
    row: berth.row,
    movement: 0,
    maxMovement: NAVAL_MOVEMENT,
    units: { [SHIP_ROLE]: WARSHIP_BATCH },
    morale: GARRISON_MORALE,
    exhaustion: 0,
    experience: 0,
    embarked: true,
    name: `${faction.name} Flotte`,
  };
  state.armies.push(newFleet);
  logOwn(state, faction.id, `In ${city.name} läuft eine Flotte von ${WARSHIP_BATCH} ${ship.name} vom Stapel.`);
  return { ok: true, armyId: newFleet.id };
}

// Eine Armee, die in einer eigenen Stadt steht, kann dort frische Truppen
// kaufen. Sie treten unmittelbar in die Armee ein statt den Umweg über die
// Garnison zu nehmen - und verdünnen wie jede Aushebung die Erfahrung.
export function reinforceArmy(state, armyId, unitKey) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return { ok: false };
  if (army.embarked) return { ok: false, reason: 'atSea' };
  if (!UNIT_ROLES.includes(unitKey)) return { ok: false, reason: 'role' };
  const city = cityAt(state, army.col, army.row);
  if (!city || city.factionId !== army.factionId) return { ok: false, reason: 'noCity' };
  const faction = factionById(state, army.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const def = unitDef(city.factionId, unitKey);
  if (faction.gold < def.cost) return { ok: false, reason: 'gold' };

  faction.gold -= def.cost;
  const veterans = unitTotalCount(army.units);
  army.experience = ((army.experience || 0) * veterans) / (veterans + RECRUIT_BATCH);
  army.units[unitKey] = (army.units[unitKey] || 0) + RECRUIT_BATCH;
  logOwn(state, faction.id, `${RECRUIT_BATCH} ${def.name} verstärken ${army.name} in ${city.name}.`);
  return { ok: true };
}

export function raiseArmyFromGarrison(state, cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  // Die Wache bleibt, wo sie hingehört: auf der Mauer. Ausrücken kann nur,
  // was ausgehoben wurde.
  const field = UNIT_ROLES.reduce((sum, key) => sum + (city.garrison[key] || 0), 0);
  if (field === 0) return { ok: false, reason: 'empty' };

  const existing = state.armies.find(
    (a) => a.factionId === city.factionId && a.col === city.col && a.row === city.row
  );
  if (existing) {
    // Recruits dilute veterans: the army that takes them in is less practised
    // than it was, in proportion to how many green men joined it.
    const veterans = unitTotalCount(existing.units);
    if (veterans + field > 0) {
      existing.experience = ((existing.experience || 0) * veterans) / (veterans + field);
    }
    for (const key of UNIT_ROLES) {
      existing.units[key] = (existing.units[key] || 0) + (city.garrison[key] || 0);
      delete city.garrison[key];
    }
    logOwn(state, faction.id, `Verstärkung aus ${city.name} schließt sich der Armee an.`);
    return { ok: true, armyId: existing.id };
  }

  const marching = {};
  for (const key of UNIT_ROLES) {
    if (city.garrison[key]) marching[key] = city.garrison[key];
    delete city.garrison[key];
  }
  const newArmy = {
    id: makeId('army'), factionId: city.factionId, col: city.col, row: city.row,
    movement: 0, maxMovement: MAX_MOVEMENT, units: marching,
    // Fresh out of the barracks: rested, steady from having been paid, and
    // with nothing at all behind them.
    morale: GARRISON_MORALE, exhaustion: 0, experience: 0,
    name: `${faction.name} Armee`,
  };
  state.armies.push(newArmy);
  logOwn(state, faction.id, `Neue Armee in ${city.name} aufgestellt.`);
  return { ok: true, armyId: newArmy.id };
}

// An army standing on a friendly city dissolves into its garrison: the men
// stay, they just man the walls instead of marching.
export function disbandArmyIntoCity(state, armyId) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return { ok: false };
  const city = cityAt(state, army.col, army.row);
  if (!city || city.factionId !== army.factionId) return { ok: false, reason: 'noCity' };

  if (isFleet(army)) return { ok: false, reason: 'fleet' };
  const joined = unitTotalCount(army.units);
  if (joined <= 0) return { ok: false, reason: 'empty' };
  for (const key of UNIT_ROLES) {
    if (army.units[key]) city.garrison[key] = (city.garrison[key] || 0) + army.units[key];
  }
  removeArmy(state, army.id);
  const faction = factionById(state, city.factionId);
  logOwn(state, faction.id, `${joined.toLocaleString('de-DE')} Mann treten in ${city.name} der Garnison bei.`);
  return { ok: true, cityId: city.id, joined };
}

// Each stage is paid for up front and then raised over several turns. Only the
// next stage in the sequence can be started, and only one at a time.
export function buyCityWalls(state, cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  if (city.wallBuilding) return { ok: false, reason: 'building' };
  const level = nextWallLevel(city);
  if (!level) return { ok: false, reason: 'complete' };
  const stage = wallLevelInfo(level);
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  if (faction.gold < stage.cost) return { ok: false, reason: 'gold' };

  faction.gold -= stage.cost;
  city.wallBuilding = { level, turnsLeft: stage.turns };
  logOwn(state, faction.id, `${city.name}: Bau der ${stage.name} begonnen (${stage.turns} Runden).`);
  return { ok: true, level };
}

export function advanceWallConstruction(state) {
  const finished = [];
  for (const city of state.cities) {
    if (!city.wallBuilding) continue;
    city.wallBuilding.turnsLeft -= 1;
    if (city.wallBuilding.turnsLeft > 0) continue;
    city.wallLevel = city.wallBuilding.level;
    city.wallBuilding = null;
    finished.push(city);
    logOwn(state, city.factionId, `${wallLevelInfo(city.wallLevel).name} von ${city.name} fertiggestellt.`);
  }
  return finished;
}

// --- Straßenbau ----------------------------------------------------------
// Straßen verbinden die eigenen Orte. Gebaut wird eine Verbindung als Ganzes:
// bezahlt wird nach Länge, gepflastert wird erst, wenn sie fertig ist.

function roadKey(col, row) {
  return `${col},${row}`;
}

// Das Straßennetz, das von diesem Feld aus zusammenhängt - alle Felder, die
// man erreicht, ohne die Pflasterung zu verlassen.
export function roadNetworkFrom(state, tile) {
  const roads = state.roads || {};
  const start = roadKey(tile.col, tile.row);
  const seen = new Set();
  if (!roads[start]) return seen;
  seen.add(start);
  const queue = [{ col: tile.col, row: tile.row }];
  while (queue.length) {
    const current = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const col = current.col + dc;
      const row = current.row + dr;
      const k = roadKey(col, row);
      if (seen.has(k) || !roads[k]) continue;
      seen.add(k);
      queue.push({ col, row });
    }
  }
  return seen;
}

// Läuft schon ein durchgehender Weg von hier nach dort? Wandert über die
// gepflasterten Felder, nicht über die Luftlinie.
export function roadConnected(state, from, to) {
  const roads = state.roads || {};
  if (!roads[roadKey(from.col, from.row)] || !roads[roadKey(to.col, to.row)]) return false;
  return roadNetworkFrom(state, from).has(roadKey(to.col, to.row));
}

export function roadProjectOf(state, cityId) {
  return (state.roadProjects || []).find((p) => p.fromId === cityId || p.toId === cityId) || null;
}

function tilesToPave(state, route) {
  const roads = state.roads || {};
  return route.filter((tile) => !roads[roadKey(tile.col, tile.row)]).length;
}

// Die nächstgelegenen eigenen Orte, zu denen noch keine Straße führt. Die
// Vorauswahl nach Luftlinie hält die Wegsuche kurz.
export function roadTargets(state, city) {
  if (!city || city.factionId === 'neutral') return [];
  const own = state.cities.filter((c) => c.factionId === city.factionId && c.id !== city.id);
  const busy = new Set();
  for (const project of state.roadProjects || []) {
    busy.add(project.fromId);
    busy.add(project.toId);
  }
  if (busy.has(city.id)) return [];

  const candidates = own
    .filter((c) => !busy.has(c.id))
    .filter((c) => state.map.landmass[c.row * state.map.cols + c.col]
      === state.map.landmass[city.row * state.map.cols + city.col])
    .filter((c) => !roadConnected(state, city, c))
    .map((c) => ({ city: c, air: Math.abs(c.col - city.col) + Math.abs(c.row - city.row) }))
    .sort((a, b) => a.air - b.air)
    .slice(0, ROAD_TARGET_CHOICES * 2);

  const targets = [];
  for (const candidate of candidates) {
    const route = landRoute(state.map, city, candidate.city, state.roads);
    if (!route) continue;
    const length = tilesToPave(state, route);
    if (length === 0) continue;
    targets.push({
      cityId: candidate.city.id,
      name: candidate.city.name,
      length,
      cost: roadCost(length),
      turns: roadTurns(length),
      route,
    });
  }
  targets.sort((a, b) => a.length - b.length);
  return targets.slice(0, ROAD_TARGET_CHOICES);
}

export function buyRoad(state, cityId, targetCityId) {
  const city = state.cities.find((c) => c.id === cityId);
  const target = state.cities.find((c) => c.id === targetCityId);
  if (!city || !target || city.id === target.id) return { ok: false };
  if (city.factionId !== target.factionId) return { ok: false, reason: 'fremd' };
  if (roadProjectOf(state, city.id) || roadProjectOf(state, target.id)) {
    return { ok: false, reason: 'building' };
  }
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };

  // Gebaut wird nur zu den Orten, die der Ort auch anbietet - den beiden
  // nächstgelegenen. Die Regel steht damit nicht bloß in der Seitenleiste,
  // sondern im Regelwerk.
  if (!roadTargets(state, city).some((t) => t.cityId === target.id)) {
    return { ok: false, reason: 'zuweit' };
  }

  const route = landRoute(state.map, city, target, state.roads);
  if (!route) return { ok: false, reason: 'weglos' };
  const length = tilesToPave(state, route);
  if (length === 0) return { ok: false, reason: 'connected' };
  const cost = roadCost(length);
  if (faction.gold < cost) return { ok: false, reason: 'gold' };

  faction.gold -= cost;
  const turns = roadTurns(length);
  state.roadProjects.push({
    fromId: city.id,
    toId: target.id,
    fromName: city.name,
    toName: target.name,
    factionId: city.factionId,
    route: route.map((t) => ({ col: t.col, row: t.row })),
    length,
    turnsLeft: turns,
    turns,
  });
  logOwn(state, faction.id, `Straßenbau ${city.name} – ${target.name} begonnen (${length} Felder, ${turns} Runden, ${cost} Gold).`);
  return { ok: true, cost, turns, length };
}

export function advanceRoadConstruction(state) {
  const finished = [];
  const projects = state.roadProjects || [];
  for (let i = projects.length - 1; i >= 0; i--) {
    const project = projects[i];
    // Fällt einer der beiden Orte an den Feind, ist der Bau verloren.
    const from = state.cities.find((c) => c.id === project.fromId);
    const to = state.cities.find((c) => c.id === project.toId);
    if (!from || !to || from.factionId !== project.factionId || to.factionId !== project.factionId) {
      projects.splice(i, 1);
      logOwn(state, project.factionId, `Der Straßenbau ${project.fromName} – ${project.toName} wird abgebrochen.`);
      continue;
    }
    project.turnsLeft -= 1;
    if (project.turnsLeft > 0) continue;
    for (const tile of project.route) state.roads[roadKey(tile.col, tile.row)] = true;
    state.roadVersion = (state.roadVersion || 0) + 1;
    projects.splice(i, 1);
    finished.push(project);
    logOwn(state, project.factionId, `🛣️ Die Straße ${project.fromName} – ${project.toName} ist fertig.`);
  }
  return finished;
}

// --- Hafenbau ------------------------------------------------------------
// Ein Hafen ist die Bedingung fürs Einschiffen, nicht der Kaufpreis der
// Flotte: gebaut wird er einmal, die Schiffe kosten weiter je Fahrt.

export function canBuildHarbour(state, city) {
  if (!city || city.factionId === 'neutral') return false;
  if (city.harbour || city.harbourBuilding) return false;
  return isCoastalCity(state, city);
}

export function buyHarbour(state, cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  if (city.harbour) return { ok: false, reason: 'done' };
  if (city.harbourBuilding) return { ok: false, reason: 'building' };
  if (!isCoastalCity(state, city)) return { ok: false, reason: 'inland' };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  if (faction.gold < HARBOUR_COST) return { ok: false, reason: 'gold' };

  faction.gold -= HARBOUR_COST;
  city.harbourBuilding = { turnsLeft: HARBOUR_TURNS };
  logOwn(state, faction.id, `${city.name}: Bau eines ${HARBOUR_NAME}s begonnen (${HARBOUR_TURNS} Runden).`);
  return { ok: true };
}

export function advanceHarbourConstruction(state) {
  const finished = [];
  for (const city of state.cities) {
    if (!city.harbourBuilding) continue;
    city.harbourBuilding.turnsLeft -= 1;
    if (city.harbourBuilding.turnsLeft > 0) continue;
    city.harbour = true;
    city.harbourBuilding = null;
    finished.push(city);
    logOwn(state, city.factionId, `⚓ Der ${HARBOUR_NAME} von ${city.name} ist fertig.`);
  }
  return finished;
}

// What a season in the field costs. An army under snow or in the desert sun
// wears down whether or not it meets an enemy; its own walls shelter it.
export function applyWeather(state) {
  const player = playerFaction(state);
  const suffering = new Map();
  for (const army of state.armies) {
    const weather = weatherAt(state, army.col, army.row);
    if (!weather.wear && !weather.spirit) continue;
    const city = cityAt(state, army.col, army.row);
    const shelter = city && city.factionId === army.factionId ? 0.4 : 1;
    if (weather.wear) adjustExhaustion(army, weather.wear * shelter);
    if (weather.spirit) adjustMorale(army, weather.spirit * shelter);
    if (army.factionId === player.id && weather.wear >= 6) {
      suffering.set(weather, (suffering.get(weather) || 0) + 1);
    }
  }
  // Only the player's own hardship is worth a line in the log.
  for (const [weather, count] of suffering) {
    const subject = count === 1
      ? `Eine Armee ${player.name}s leidet`
      : `${count} Armeen ${player.name}s leiden`;
    logMsg(state, `${weather.icon} ${subject} unter ${weather.name}.`);
  }
}

// Rolls the next turn's weather and reports what the player can act on: a
// storm season closing the sea matters more than a sunny day inland.
export function advanceWeather(state) {
  const previous = state.weather;
  state.weather = rollWeather(state.turn, previous, state.weatherSeed);
  const { season, year, seasonStart } = calendarOfTurn(state.turn);
  const changes = [];
  for (const [zone, key] of Object.entries(state.weather)) {
    if (previous && previous[zone] === key) continue;
    const weather = weatherInfo(key);
    if (!weather.effect || weather.effect === 'clouds') continue;
    changes.push(`${weather.icon} ${weather.name} über ${zoneName(zone)}`);
  }
  // Die Jahreszeit wird gemeldet, wenn sie anfängt - nicht in jeder ihrer vier
  // Runden. Wetterwechsel dazwischen bekommen ihre eigene Zeile.
  if (seasonStart) {
    logMsg(state, `${season.icon} ${season.name} ${year} v. Chr.`
      + (changes.length ? ` – ${changes.slice(0, 3).join(', ')}.` : ''));
  } else if (changes.length) {
    logMsg(state, `${changes.slice(0, 3).join(', ')}.`);
  }
}

// Armies that stayed put regain their edge; a city lets them recover fastest.
// --- Unabhängige Orte ------------------------------------------------------
// Eine Stadt ohne Herrn ist nicht herrenlos: aus ihrer Wache bildet sich mit
// der Zeit eine Miliz, und was die einem Staat abnimmt, begründet ein eigenes
// Gemeinwesen. So bleibt die Landkarte zwischen den zwölf Kriegen in Bewegung,
// ohne dass ein dreizehnter von Anfang an mitliefe.

function freeTileNear(state, city, taken) {
  const order = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  let best = null;
  let bestCost = Infinity;
  for (const [dc, dr] of order) {
    const col = city.col + dc;
    const row = city.row + dr;
    if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) continue;
    const def = TILE_TYPES[state.map.tiles[row][col].type];
    if (def.impassable) continue;
    if (taken.has(`${col},${row}`)) continue;
    if (def.cost >= bestCost) continue;
    bestCost = def.cost;
    best = { col, row };
  }
  return best;
}

// Stellt in unabhängigen Orten Milizen auf. Bezahlt wird nicht mit Gold - die
// Männer kommen aus der Stadtwache, und die stellt sich danach langsam wieder
// nach, wie nach einer Belagerung.
export function raiseIndependentArmies(state) {
  if (state.turn < MILITIA_FIRST_TURN) return;
  const militias = state.armies.filter((a) => a.factionId === 'neutral');
  if (militias.length >= MILITIA_MAX) return;
  const taken = new Set([
    ...state.armies.map((a) => `${a.col},${a.row}`),
    ...state.cities.map((c) => `${c.col},${c.row}`),
  ]);
  const homes = new Set(militias.map((a) => a.homeCityId));

  for (const city of state.cities) {
    if (state.armies.filter((a) => a.factionId === 'neutral').length >= MILITIA_MAX) return;
    if (city.factionId !== 'neutral') continue;
    if (city.population < MILITIA_MIN_POPULATION) continue;
    // Ein Ort unterhält nur eine Miliz.
    if (homes.has(city.id)) continue;
    const watch = city.garrison[WATCH_ROLE] || 0;
    if (watch <= MILITIA_WATCH_RESERVE) continue;
    if (Math.random() > MILITIA_CHANCE) continue;
    const spot = freeTileNear(state, city, taken);
    if (!spot) continue;

    // Die Bürgerschaft stellt die Masse, die Wache den Kern.
    const strength = Math.min(MILITIA_MAX_SIZE,
      Math.round(city.population / MILITIA_PER_POPULATION));
    if (strength < MILITIA_MIN_SIZE) continue;
    // Zwei Drittel Fußvolk, ein Drittel Fernkampf: was eine Stadt an Waffen
    // im Haus hat, keine Reiterei.
    const infantry = Math.round(strength * 0.68);
    const ranged = strength - infantry;
    city.garrison[WATCH_ROLE] = watch - Math.min(watch - MILITIA_WATCH_RESERVE,
      Math.round(strength * MILITIA_WATCH_SHARE));

    state.armies.push({
      id: makeId('army'),
      factionId: 'neutral',
      homeCityId: city.id,
      col: spot.col,
      row: spot.row,
      movement: MAX_MOVEMENT,
      maxMovement: MAX_MOVEMENT,
      units: { infantry, ranged },
      morale: MORALE_START,
      exhaustion: 0,
      experience: 0,
      embarked: false,
      name: `Miliz von ${city.name}`,
    });
    taken.add(`${spot.col},${spot.row}`);
    homes.add(city.id);
    logMsg(state, `In ${city.name} stellt sich eine Miliz auf: `
      + `${strength.toLocaleString('de-DE')} Mann.`, null, ['neutral']);
  }
}

// Nimmt eine Miliz einem Staat einen Ort ab, ruft die Gegend ihr eigenes
// Gemeinwesen aus. Es bekommt den Namen eines Volkes, das es wirklich gab,
// die Waffen seines nächsten Nachbarn - und von da an spielt es mit.
export function foundFreeState(state, army, city) {
  const existing = state.factions.filter((f) => f.emergent).length;
  if (existing >= FREE_STATE_MAX || existing >= FREE_STATE_NAMES.length) return null;

  // Ein Staat braucht mehr als den eroberten Ort: die Heimatstadt der Miliz
  // muss noch stehen und noch unabhängig sein. Sonst ist es kein Gemeinwesen,
  // sondern eine Bande auf einer fremden Mauer - der Ort fällt dann einfach
  // an die Unabhängigen.
  const home = state.cities.find((c) => c.id === army.homeCityId && c.factionId === 'neutral');
  if (!home) return null;
  const seat = home;
  // Ein freier Staat heißt nach dem Ort, aus dem er sich erhoben hat: die
  // Bürger von Massilia nennen sich Massilia und nicht nach einem Volk, das
  // eine Liste ihnen zuweist. Aus der Liste kommt nur noch die Farbe.
  const label = FREE_STATE_NAMES[existing];
  const id = `frei${existing + 1}`;

  // Die Waffen des nächsten bestehenden Staates: wer zwischen Galliern lebt,
  // kämpft wie sie, und nicht wie eine Truppe aus dem Nichts.
  let model = null;
  let bestDistance = Infinity;
  for (const other of state.cities) {
    const owner = factionById(state, other.factionId);
    if (!owner || owner.isNeutral || owner.emergent) continue;
    const distance = Math.abs(other.col - seat.col) + Math.abs(other.row - seat.row);
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    model = owner.id;
  }
  if (model && FACTION_UNITS[model]) FACTION_UNITS[id] = FACTION_UNITS[model];

  const faction = {
    id,
    name: seat.name,
    color: label.color,
    emergent: true,
    isPlayer: false,
    gold: 0,
    alive: true,
  };
  state.factions.push(faction);

  city.factionId = id;
  home.factionId = id;
  home.capital = true;
  army.factionId = id;
  army.name = `${faction.name} Feldarmee`;
  delete army.homeCityId;

  logMsg(state, `${seat.name} ruft sich zum eigenen Staat aus: `
    + `${seat.name} und ${city.name} stehen von nun an unter eigener Fahne.`);
  return faction;
}

export function recoverArmies(state) {
  for (const army of state.armies) {
    // Rast ist keine Alles-oder-nichts-Sache: wer nur ein Stück gezogen ist,
    // hat den Rest des Tages Zeit, wieder zu Atem zu kommen. Erholt wird im
    // Verhältnis der Bewegung, die das Heer stehen gelassen hat - ein kurzer
    // Marsch trägt sich damit selbst, ein Gewaltmarsch nicht.
    const share = army.maxMovement > 0 ? army.movement / army.maxMovement : 1;
    if (share <= 0) continue;
    const city = cityAt(state, army.col, army.row);
    const inOwnCity = city && city.factionId === army.factionId;
    adjustMorale(army, (inOwnCity ? MORALE_REST_IN_CITY : MORALE_REST) * share);
    adjustExhaustion(army, (inOwnCity ? EXHAUSTION_REST_IN_CITY : EXHAUSTION_REST) * share);
  }
}

// Was ein einzelner Ort in dieser Runde einbringt, aufgeschlüsselt: die
// Abgaben der Siedlung selbst, was ihre Einwohner darüber hinaus tragen, und
// was ein Weltwunder vor ihren Toren an Pilgern und Händlern anzieht.
// Dieselbe Rechnung steht in der Seitenleiste und in der Rundenabrechnung -
// es soll nicht zwei Wahrheiten darüber geben, was eine Stadt wert ist.
export function cityIncome(state, city) {
  const settlement = INCOME_PER_CITY * settlementTier(city.size).incomeFactor;
  const people = Math.floor(city.population / 200);
  const wonders = wondersOfCity(state, city.id).reduce((sum, w) => sum + w.income, 0);
  return { settlement, people, wonders, total: settlement + people + wonders };
}

// Was die Heere einer Fraktion in dieser Runde kosten. Steht hier, weil die
// Übersicht dieselbe Zahl zeigt, die auch abgerechnet wird.
export function armyUpkeep(state, factionId) {
  return state.armies
    .filter((a) => a.factionId === factionId)
    .reduce((sum, a) => sum + COMBAT_ROLES.reduce(
      (inner, role) => inner + (a.units[role] || 0) * unitDef(factionId, role).upkeep, 0
    ), 0);
}

export function factionIncome(state, factionId) {
  return state.cities
    .filter((c) => c.factionId === factionId)
    .reduce((sum, c) => sum + cityIncome(state, c).total, 0);
}

export function collectIncome(state) {
  for (const faction of state.factions) {
    if (faction.isNeutral) continue;
    const income = factionIncome(state, faction.id);
    const upkeep = armyUpkeep(state, faction.id);
    faction.gold = Math.max(0, Math.round(faction.gold + income - upkeep));
  }
}

// Die Stadtwache stellt sich aus der Bevölkerung nach - Runde für Runde ein
// Stück, bis sie ihre Sollstärke wieder hat. Wer eine Stadt stürmt, hält sie
// deshalb eine Weile, bevor sie sich selbst wieder verteidigt.
export function regenerateGarrisons(state) {
  for (const city of state.cities) {
    const faction = factionById(state, city.factionId);
    const target = watchTarget(city, faction);
    const watch = city.garrison[WATCH_ROLE] || 0;
    if (watch >= target) continue;
    city.garrison[WATCH_ROLE] = Math.min(target, watch + watchGrowth(target));
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
