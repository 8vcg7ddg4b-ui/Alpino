import {
  UNIT_ROLES, GARRISON_ROLES, COMBAT_ROLES, WATCH_ROLE, watchTarget, watchGrowth,
  unitDef, MAX_MOVEMENT, cityTax,
  RECRUIT_BATCH, recruitPopCost, RECRUIT_MIN_POPULATION,
  TILE_TYPES, settlementTier, garrisonCapacity,
  MORALE_MAX, MORALE_START, MORALE_AFTER_WIN, MORALE_AFTER_LOSS,
  MORALE_REST, MORALE_REST_IN_CITY, EXHAUSTION_PER_MOVE, EXHAUSTION_REST,
  EXHAUSTION_REST_IN_CITY, EXHAUSTION_PER_BATTLE,
  GARRISON_MORALE, GARRISON_EXHAUSTION,
  MAX_WALL_LEVEL, wallLevelInfo, wallDefenceMultiplier,
  MAX_EXPERIENCE, EXPERIENCE_PER_BATTLE, EXPERIENCE_FOR_WIN,
  experienceBonus, experienceStars, starMarks, starTitle,
  SHIP_COST, NAVAL_MOVEMENT, EXHAUSTION_PER_SEA_MOVE,
  AMPHIBIOUS_ATTACK_MULTIPLIER, SEA_UNIT_SCALE, SHIP_ROLE, WARSHIP_BATCH,
  TRANSPORT_NAME, transportCount, shipTypesOf,
  ROAD_TARGET_CHOICES, roadCost, roadTurns,
  ROAD_EARTH, ROAD_STONE, roadLevelOf, stoneRoadCost, stoneRoadTurns,
  MINE_RANGE, MINE_ORE, MINE_MIN_ORE, mineIncome,
  BUILDINGS, buildingDef, buildingName, growthFactor,
  MILITIA_FIRST_TURN, MILITIA_MIN_POPULATION, MILITIA_CHANCE, MILITIA_MAX, MILITIA_WATCH_RESERVE,
  MILITIA_MAX_SIZE, MILITIA_MIN_SIZE, MILITIA_PER_POPULATION, MILITIA_WATCH_SHARE,
  FREE_STATE_MAX, FREE_STATE_NAMES, FACTION_UNITS,
  TRADE_GOODS, TRADE_ROUTE_COST, TRADE_BASE_INCOME, TRADE_VARIETY_BONUS,
  TRADE_ROUTES_PER_CITY, TRADE_MAX_DISTANCE, TRADE_SEA_DISTANCE, TRADE_SEA_BONUS,
  tradeSizeFactor,
  BIRTH_RATE, BIRTH_SEASON, populationCeiling,
  SIEGE_RANGE, SIEGE_STARVE_AFTER, SIEGE_ATTRITION, SIEGE_POPULATION_LOSS,
  CAMP_NAME, CAMP_COST, CAMP_DEFENCE, CAMP_SHELTER,
  CAPTURE_WALL_LOSS, CAPTURE_RUIN_CHANCE, repairCost, repairTurns,
  CAMP_SIEGE_STARVE_AFTER, CAMP_SIEGE_ATTRITION, CAMP_SIEGE_POPULATION_LOSS,
  tileImpassable, tileMoveCost, levyStrength, LEVY_SHARE,
} from './data.js';
import { landRoute } from './mapgen.js';
import { computeReachable, tileKey } from './pathfind.js';
import { resolveBattle, forecastBattle } from './combat.js';
import { pirateTollFactor, pirateLoot, isPirate } from './piraten.js';
import {
  makeId, factionById, cityAt, armyAt, unitTotalCount, logMsg, logOwn, playerFaction,
  isWaterTile, isCoastalCity, harbourTile, isFleet, PORT_RANGE, tradeGoodOf,
} from './state.js';
import {
  rollWeather, weatherAt, weatherInfo, weatherBattleModifiers, calendarOfTurn, zoneName,
} from './weather.js';
import { wondersOfCity } from './wonders.js';
import {
  adjustOpinion, atWar, hasTradePact, hasPassage, declareWar,
  warBlocked,
  OPINION_PER_BATTLE, OPINION_PER_CITY_TAKEN,
} from './diplomacy.js';
import { borderViolation } from './territory.js';

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
    if (defeated.embarked ? !sea : tileImpassable(state.map.tiles[row][col])) continue;
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
    attackerFrontage: result.attackerFrontage,
    defenderFrontage: result.defenderFrontage,
    attackerEngagedShare: result.attackerEngagedShare,
    defenderEngagedShare: result.defenderEngagedShare,
    wallMultiplier: result.wallMultiplier,
    assaultScale: result.assaultScale,
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
  // Ein freier Ort hat keinen Herrn, der ihm ein Heer schickt: er greift zu
  // seinen eigenen Leuten. Das Aufgebot tritt nur zur Verteidigung an, zählt
  // als Stadtwache und verschwindet nach der Schlacht wieder in den Gassen -
  // es steht nirgends in der Garnison, es wird für den Kampf aufgestellt.
  const levy = cityIsEnemy ? levyStrength(city) : 0;
  const garrisonJoins = cityIsEnemy && (unitTotalCount(city.garrison) > 0 || levy > 0);
  const contingents = defendingArmies.map((a) => ({ ...a.units }));
  if (garrisonJoins) {
    const wehr = { ...city.garrison };
    if (levy > 0) wehr[WATCH_ROLE] = (wehr[WATCH_ROLE] || 0) + levy;
    contingents.push(wehr);
  }

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
    // Wie viele Bürger mitkämpfen - die Vorschau nennt es, sonst wundert sich
    // ein Angreifer, warum vor ihm mehr steht, als die Aufklärung meldete.
    levy,
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
      // Wer ein Lager stürmt, stürmt über Graben und Palisade - weniger als
      // eine Mauer, aber genug, dass es teuer wird.
      defenderMultiplier: !atSea && defendingArmies.some((a) => a.camp) ? CAMP_DEFENCE : 1,
      // Storming a shore straight off the ships is the hardest attack there is.
      attackerMultiplier: amphibious ? AMPHIBIOUS_ATTACK_MULTIPLIER : 1,
      attackerVeterancy: experienceBonus(army.experience),
      defenderVeterancy: experienceBonus(defenceExperience),
      attackerFactionId: army.factionId,
      defenderFactionId,
      // Welche Bauart auf welcher Seite fährt: eine Flotte behält ihre, auch
      // wenn ihre Werft inzwischen eine andere baut.
      attackerShipKind: army.shipKind || null,
      defenderShipKind: (defendingArmies.find((a) => a.shipKind) || {}).shipKind || null,
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

// Ob und von wo aus dieser Ort eingeschlossen werden könnte. Belagert wird
// aus dem Feld daneben, nicht aus der Stadt: das letzte Feld des Anmarschwegs
// ist der Platz, an dem sich das Heer eingräbt.
function siegeOption(state, army, city, entry) {
  const pfad = entry.path || [];
  // Das vorletzte Feld des Weges - oder, wenn das Heer schon danebensteht,
  // sein eigenes.
  const halt = pfad.length >= 2 ? pfad[pfad.length - 2] : { col: army.col, row: army.row };
  const dann = { ...army, col: halt.col, row: halt.row };
  const status = siegeStatus(state, dann, city);
  return {
    cityId: city.id,
    col: halt.col,
    row: halt.row,
    can: status.can,
    reason: status.reason || null,
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
    // Wie viele Bürger der freie Ort selbst unter die Waffen gebracht hat.
    levy: defence.levy || 0,
    // Ob sich dieser Ort statt eines Sturms auch einschließen ließe - und von
    // welchem Feld aus. Die Vorschau stellt beides nebeneinander.
    siege: defence.city && defence.city.factionId !== army.factionId
      ? siegeOption(state, army, defence.city, entry) : null,
    // Wem dieser Angriff den Krieg erklären würde - null, wenn er schon läuft.
    declareWarOn: entry.declare || null,
    declareWarName: entry.declare
      ? (factionById(state, entry.declare) || {}).name || entry.declare : null,
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
    city, cityIsEnemy, defendingArmies, garrisonJoins, contingents, terrainType, levy,
  } = defence;

  let attackerUnits = { ...army.units };
  let capturedCity = false;
  // Was der Sturm an der Stadt angerichtet hat - der Bericht nennt es.
  let captureDamage = null;
  let bounced = false;

  // Ein Schlagabtausch bleibt in Erinnerung: wer heute angegriffen wurde,
  // verhandelt morgen schlechter.
  const defenderFactionId = defence.city ? defence.city.factionId
    : defence.defendingArmies.length ? defence.defendingArmies[0].factionId : null;
  if (defenderFactionId && defenderFactionId !== army.factionId) {
    adjustOpinion(state, army.factionId, defenderFactionId, OPINION_PER_BATTLE);
  }
  const reports = [];
  const promotions = [];

  // Settles what becomes of a beaten defending army: it falls back with its
  // survivors, and is only lost if it is wiped out or has nowhere to go.
  function routArmy(defeated, survivors) {
    const vorher = unitTotalCount(defeated.units);
    defeated.units = survivors;
    if (unitTotalCount(survivors) <= 0) {
      // Wer ein Seeräubergeschwader versenkt, findet in seinen Laderäumen,
      // was es zusammengetragen hat. Das ist der einzige Lohn dafür.
      if (isPirate(defeated)) pirateLoot(state, army.factionId, vorher);
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
      if (garrisonJoins) {
        const rest = { ...shares[shares.length - 1] };
        // Das Aufgebot bleibt nicht unter Waffen: was überlebt, geht zurück in
        // die Gassen. Nur die eigene Stadtwache bleibt auf der Mauer stehen,
        // und zwar in dem Verhältnis, in dem sie angetreten war.
        if (levy > 0) {
          const wache = city.garrison[WATCH_ROLE] || 0;
          const angetreten = wache + levy;
          const ueberlebt = rest[WATCH_ROLE] || 0;
          const bleibt = angetreten > 0 ? Math.round(ueberlebt * (wache / angetreten)) : 0;
          // Die gefallenen Bürger fehlen der Stadt danach wirklich.
          const gefalleneBuerger = Math.max(0, Math.round(
            (angetreten - ueberlebt) * (levy / Math.max(1, angetreten))
          ));
          city.population = Math.max(100, city.population - gefalleneBuerger);
          rest[WATCH_ROLE] = bleibt;
        }
        city.garrison = rest;
      }
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
    // Was der Sturm angerichtet hat: eine Bresche in der Mauer, Trümmer, wo
    // Werkstätten und Speicher standen. Der neue Herr erbt eine Baustelle.
    const schaden = damageOnCapture(state, city);
    if (schaden.wallLost || schaden.ruined.length) {
      const teile = [];
      if (schaden.wallLost) teile.push('die Mauer ist gebrochen');
      if (schaden.ruined.length) {
        teile.push(`${schaden.ruined.map((k) => buildingName(k, army.factionId)).join(', ')} `
          + `${schaden.ruined.length === 1 ? 'liegt' : 'liegen'} in Trümmern`);
      }
      logMsg(state, `${city.name} ist genommen – ${teile.join(', ')}.`,
        null, [attackerFaction.id, lostTo]);
    }
    captureDamage = schaden;
    // Wer die Stadt verliert, verliert ihren Handel: der neue Herr muss die
    // Wege selbst wieder eröffnen.
    pruneTradeRoutes(state);
    // Eine genommene Stadt vergisst kein Herrscher.
    adjustOpinion(state, army.factionId, lostTo, OPINION_PER_CITY_TAKEN);
  }

  // A promotion is worth saying out loud; it changes how the army fights from
  // here on.
  for (const promoted of promotions) {
    if (!state.armies.includes(promoted)) continue;
    logOwn(state, promoted.factionId, `${starMarks(promoted.experience)} ${promoted.name} steigt auf: `
      + `${starTitle(promoted.experience)}.`);
  }

  const angreiferStaerke = unitTotalCount(army.units);
  army.units = attackerUnits;
  if (unitTotalCount(attackerUnits) <= 0) {
    // Auch ein Geschwader, das sich selbst verrannt hat, gibt seine Beute her.
    if (isPirate(army) && defence.defenderFactionId) {
      pirateLoot(state, defence.defenderFactionId, angreiferStaerke);
    }
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
  return { ok: true, survived: true, capturedCity, captureDamage, reports };
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

// Dasselbe für ein einzelnes Ziel, wie es die Seitenleiste und die KI fragen:
// wohin dürfte dieses Heer ziehen, ohne einen Krieg auszulösen?
export function moveWarning(state, army, destCol, destRow, reachable = null) {
  const felder = reachable || computeReachable(state, army);
  const entry = felder.get(tileKey(destCol, destRow));
  if (!entry) return null;
  const owner = borderViolation(state, army, entry.path);
  if (!owner) return null;
  const faction = factionById(state, owner);
  const gebunden = warBlocked(state, army.factionId, owner);
  return { factionId: owner, name: faction ? faction.name : owner, blocked: gebunden };
}

// Wem dieser Zug den Krieg erklären würde, weil er auf ein fremdes Heer, eine
// fremde Flotte oder einen fremden Ort geht - null, wenn der Krieg schon
// läuft. Die Kampfvorschau sagt es, ehe der Spieler zuschlägt.
export function attackDeclaration(state, army, destCol, destRow, reachable = null) {
  const felder = reachable || computeReachable(state, army);
  const entry = felder.get(tileKey(destCol, destRow));
  if (!entry || !entry.declare) return null;
  const faction = factionById(state, entry.declare);
  return { factionId: entry.declare, name: faction ? faction.name : entry.declare };
}


export function moveArmy(state, armyId, destCol, destRow) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return { ok: false };
  const reachable = computeReachable(state, army);
  const entry = reachable.get(tileKey(destCol, destRow));
  if (!entry) return { ok: false };

  // Eine Grenzverletzung ist eine Kriegserklärung. Wer sie nicht erklären
  // darf, marschiert auch nicht: das Heer bleibt stehen.
  const verletzt = borderViolation(state, army, entry.path);
  if (verletzt) {
    const faction = factionById(state, verletzt);
    const krieg = declareWar(state, army.factionId, verletzt,
      'ein Heer hat die Grenze überschritten');
    if (!krieg.ok) {
      return { ok: false, reason: 'grenze', factionId: verletzt,
        text: `${faction ? faction.name : verletzt}: ${krieg.text
          || 'so kurz nach dem Friedensschluss überschreitet niemand die Grenze'}.` };
    }
    logOwn(state, army.factionId, `⚔ ${army.name} überschreitet die Grenze `
      + `${faction ? faction.name : verletzt} – das ist Krieg.`);
  }

  // Ein Angriff ist eine Kriegserklärung. Wer im Frieden auf ein fremdes Heer,
  // eine fremde Flotte oder einen fremden Ort losgeht, hat damit den Krieg -
  // erklärt wird er hier, ehe der erste Schlag fällt. Das kann ein anderes
  // Reich treffen als die Grenze darüber: durch fremdes Land marschiert und
  // am Ende einen Dritten angegriffen.
  const angegriffen = entry.declare && entry.declare !== verletzt ? entry.declare : null;
  if (angegriffen) {
    const faction = factionById(state, angegriffen);
    const stadt = cityAt(state, destCol, destRow);
    const ziel = stadt && stadt.factionId === angegriffen ? stadt.name
      : armyAt(state, destCol, destRow)?.embarked ? 'eine Flotte' : 'ein Heer';
    const krieg = declareWar(state, army.factionId, angegriffen, `ein Angriff auf ${ziel}`);
    if (!krieg.ok) {
      return { ok: false, reason: 'angriff', factionId: angegriffen,
        text: `${faction ? faction.name : angegriffen}: ${krieg.text
          || 'so kurz nach dem Friedensschluss greift niemand an'}.` };
    }
    logOwn(state, army.factionId, `⚔ ${army.name} greift ${ziel} an – `
      + `das ist Krieg mit ${faction ? faction.name : angegriffen}.`);
  }

  army.movement = Math.max(0, army.movement - entry.cost);
  adjustExhaustion(army, moveExhaustion(army, entry.cost));
  // Wer abmarschiert, lässt Graben und Palisade stehen - für ihn zählen sie
  // nicht mehr.
  army.camp = false;

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
    return { ok: true, combat: false, landed, grenzkrieg: verletzt || null,
      kriegserklaerung: angegriffen, reports: [] };
  }
  const outcome = resolveTileCombat(state, army, destCol, destRow);
  // An assault that carried the shore puts the troops ashore for good; one
  // that was thrown back is still aboard its ships.
  const landed = outcome.survived ? comeAshore(state, army) : false;
  return { ok: true, combat: true, landed, grenzkrieg: verletzt || null,
    kriegserklaerung: angegriffen, ...outcome };
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
  const ruempfe = transportCount(unitTotalCount(army.units));
  logOwn(state, faction.id,
    `${army.name} geht in ${city.name} auf ${ruempfe} ${TRANSPORT_NAME}e und sticht in See `
    + `(${SHIP_COST} Gold).`);
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
  if (cityBlockaded(state, city)) return { can: false, reason: 'blockade', city };
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
  // Ohne Kaserne wird niemand ausgebildet: ein Ort ohne Ausbildungsstätte
  // stellt keine Truppen, er hat nur seine Wache.
  if (!city.barracks) return { ok: false, reason: 'noBarracks' };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const def = unitDef(city.factionId, unitKey);
  const maxTotal = garrisonCapacity(city, faction);
  if (unitTotalCount(city.garrison) >= maxTotal) return { ok: false, reason: 'full' };
  if (faction.gold < def.cost) return { ok: false, reason: 'gold' };
  // Die Männer kommen aus der Stadt, nicht aus der Truhe: jede Aushebung
  // kostet Einwohner - und damit Steuer, Nachwuchs und die Wache, die sich
  // aus ihnen nachstellt. Unter die Untergrenze geht es nicht.
  const leute = recruitPopCost(RECRUIT_BATCH);
  if (city.population - leute < RECRUIT_MIN_POPULATION) {
    return { ok: false, reason: 'population', needed: leute };
  }
  faction.gold -= def.cost;
  city.population -= leute;
  city.garrison[unitKey] = (city.garrison[unitKey] || 0) + RECRUIT_BATCH;
  logOwn(state, faction.id, `${RECRUIT_BATCH} ${def.name} in ${city.name} ausgehoben `
    + `– ${leute} Einwohner weniger (${city.population.toLocaleString('de-DE')}).`);
  return { ok: true, pop: leute };
}

// --- Flottenbau -----------------------------------------------------------
// In einer Hafenstadt lassen sich Kriegsschiffe bauen. Sie bilden eine eigene
// Flotte, die im Hafenbecken liegt: kein Landheer, das übersetzt, sondern ein
// Geschwader, das das Meer selbst hält.
export function fleetAt(state, col, row, factionId) {
  const army = armyAt(state, col, row);
  return army && army.factionId === factionId && isFleet(army) ? army : null;
}

// Gebaut wird eine bestimmte Bauart: jede Fraktion hat bis zu drei, und die
// Werft baut die, die man ihr nennt. Ohne Angabe die erste - das ist die,
// mit der diese Fraktion in den Krieg zieht.
export function buildFleet(state, cityId, kind = null) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  if (!city.harbour) return { ok: false, reason: 'noHarbour' };
  // Ohne Helling kein Kiel: die Werft ist Bedingung für jedes Kriegsschiff.
  if (!city.shipyard) return { ok: false, reason: 'noShipyard' };
  // Und aus einem gesperrten Hafen läuft nichts aus.
  if (cityBlockaded(state, city)) return { ok: false, reason: 'blockade' };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const bauarten = shipTypesOf(city.factionId);
  const ship = (kind && bauarten.find((t) => t.key === kind)) || bauarten[0];
  if (!ship) return { ok: false, reason: 'keineBauart' };
  // Eine Werft baut nur, was ihre Leute bauen können.
  if (kind && ship.key !== kind) return { ok: false, reason: 'fremdeBauart' };
  if (faction.gold < ship.cost) return { ok: false, reason: 'gold' };

  // Liegt schon eine eigene Flotte derselben Bauart im Hafen, wächst sie;
  // sonst braucht es ein freies Wasserfeld in Hafenreichweite. Zwei Bauarten
  // in einem Verband gäbe es nicht: was zusammen fährt, fährt gleich schnell.
  let fleet = null;
  for (let dr = -PORT_RANGE; dr <= PORT_RANGE && !fleet; dr++) {
    for (let dc = -PORT_RANGE; dc <= PORT_RANGE && !fleet; dc++) {
      if (Math.abs(dc) + Math.abs(dr) > PORT_RANGE) continue;
      if (!isWaterTile(state, city.col + dc, city.row + dr)) continue;
      const kandidat = fleetAt(state, city.col + dc, city.row + dr, city.factionId);
      if (kandidat && (kandidat.shipKind || bauarten[0].key) === ship.key) fleet = kandidat;
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
    return { ok: true, armyId: fleet.id, kind: ship.key };
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
    // Die Bauart reist mit der Flotte: sie entscheidet, wie sie kämpft und
    // wie sie aussieht, auch wenn die Werft längst eine andere baut.
    shipKind: ship.key,
    name: `${faction.name} ${ship.name}`,
  };
  state.armies.push(newFleet);
  logOwn(state, faction.id, `In ${city.name} läuft ein Geschwader von ${WARSHIP_BATCH} ${ship.name} vom Stapel.`);
  return { ok: true, armyId: newFleet.id, kind: ship.key };
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
  // Auch die Verstärkung im Feld kommt aus der Kaserne des Orts.
  if (!city.barracks) return { ok: false, reason: 'noBarracks' };
  const faction = factionById(state, army.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const def = unitDef(city.factionId, unitKey);
  if (faction.gold < def.cost) return { ok: false, reason: 'gold' };
  // Auch diese Männer kommen aus der Stadt - sonst wäre die Verstärkung im
  // Feld das Schlupfloch, durch das man die Aushebung umgeht.
  const leute = recruitPopCost(RECRUIT_BATCH);
  if (city.population - leute < RECRUIT_MIN_POPULATION) {
    return { ok: false, reason: 'population', needed: leute };
  }

  faction.gold -= def.cost;
  city.population -= leute;
  const veterans = unitTotalCount(army.units);
  army.experience = ((army.experience || 0) * veterans) / (veterans + RECRUIT_BATCH);
  army.units[unitKey] = (army.units[unitKey] || 0) + RECRUIT_BATCH;
  logOwn(state, faction.id, `${RECRUIT_BATCH} ${def.name} verstärken ${army.name} in ${city.name} `
    + `– ${leute} Einwohner weniger.`);
  return { ok: true, pop: leute };
}

export function raiseArmyFromGarrison(state, cityId) {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false };
  // Ein Heer aufzustellen ist Sache der Kaserne: sie sammelt, rüstet aus und
  // gibt die Fahne aus. Ohne sie bleibt, was da ist, auf der Mauer stehen.
  if (!city.barracks) return { ok: false, reason: 'noBarracks' };
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
    morale: GARRISON_MORALE, exhaustion: 0, experience: 0, camp: false,
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
  // Unter Belagerung wird keine Mauer aufgezogen - dafür müsste man vor sie
  // treten, und davor steht der Feind.
  if (citySieged(state, city)) return { ok: false, reason: 'siege' };
  const level = nextWallLevel(city);
  if (!level) return { ok: false, reason: 'complete' };
  const stage = wallLevelInfo(level);
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  // Über einer Bresche wird nicht neu gebaut, sondern ausgebessert.
  const ruine = wallRuined(city);
  const kosten = ruine ? repairCost(stage.cost) : stage.cost;
  const dauer = ruine ? repairTurns(stage.turns) : stage.turns;
  if (faction.gold < kosten) return { ok: false, reason: 'gold' };

  faction.gold -= kosten;
  city.wallBuilding = { level, turnsLeft: dauer, turns: dauer, repair: ruine };
  logOwn(state, faction.id, `${city.name}: ${ruine ? 'Ausbesserung' : 'Bau'} der `
    + `${stage.name} begonnen (${dauer} ${dauer === 1 ? 'Runde' : 'Runden'}).`);
  return { ok: true, level, repair: ruine };
}

export function advanceWallConstruction(state) {
  const finished = [];
  for (const city of state.cities) {
    if (!city.wallBuilding) continue;
    if (citySieged(state, city)) continue;
    city.wallBuilding.turnsLeft -= 1;
    if (city.wallBuilding.turnsLeft > 0) continue;
    const ausgebessert = !!city.wallBuilding.repair;
    city.wallLevel = city.wallBuilding.level;
    city.wallBuilding = null;
    city.wallRuins = false;
    finished.push({ city, level: city.wallLevel, repair: ausgebessert });
    logOwn(state, city.factionId, `${wallLevelInfo(city.wallLevel).name} von ${city.name} `
      + `${ausgebessert ? 'wieder ausgebessert' : 'fertiggestellt'}.`);
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

function tilesToPave(state, route, level = ROAD_EARTH) {
  const roads = state.roads || {};
  return route.filter((tile) => roadLevelOf(roads[roadKey(tile.col, tile.row)]) < level).length;
}

// Die Stufe eines Feldes: 0 offenes Land, 1 gefahrener Weg, 2 Steinstraße.
export function roadLevelAt(state, col, row) {
  return roadLevelOf(state.roads && state.roads[roadKey(col, row)]);
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

// --- Ausbau zur Steinstraße ------------------------------------------------
// Ausgebaut wird, was schon liegt: eine bestehende Verbindung zu einem eigenen
// Ort. Das setzt eine Verwaltung voraus - eine Steinstraße ist Vermessung,
// Fronarbeit und Abrechnung, kein Trampelpfad.
export function stoneTargets(state, city) {
  if (!city || city.factionId === 'neutral' || !city.forum) return [];
  const busy = new Set();
  for (const project of state.roadProjects || []) {
    busy.add(project.fromId);
    busy.add(project.toId);
  }
  if (busy.has(city.id)) return [];
  const targets = [];
  for (const other of state.cities) {
    if (other.id === city.id || other.factionId !== city.factionId) continue;
    if (busy.has(other.id)) continue;
    if (!roadConnected(state, city, other)) continue;
    const route = landRoute(state.map, city, other, state.roads);
    if (!route) continue;
    const length = tilesToPave(state, route, ROAD_STONE);
    if (length === 0) continue;
    targets.push({
      cityId: other.id,
      name: other.name,
      length,
      cost: stoneRoadCost(length),
      turns: stoneRoadTurns(length),
      route,
    });
  }
  targets.sort((a, b) => a.length - b.length);
  return targets.slice(0, ROAD_TARGET_CHOICES);
}

export function upgradeRoad(state, cityId, targetCityId) {
  const city = state.cities.find((c) => c.id === cityId);
  const target = state.cities.find((c) => c.id === targetCityId);
  if (!city || !target || city.id === target.id) return { ok: false };
  if (city.factionId !== target.factionId) return { ok: false, reason: 'fremd' };
  if (!city.forum) return { ok: false, reason: 'noForum' };
  if (roadProjectOf(state, city.id) || roadProjectOf(state, target.id)) {
    return { ok: false, reason: 'building' };
  }
  if (citySieged(state, city) || citySieged(state, target)) {
    return { ok: false, reason: 'siege' };
  }
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  const angebot = stoneTargets(state, city).find((t) => t.cityId === target.id);
  if (!angebot) return { ok: false, reason: 'zuweit' };
  if (faction.gold < angebot.cost) return { ok: false, reason: 'gold' };

  faction.gold -= angebot.cost;
  state.roadProjects.push({
    fromId: city.id,
    toId: target.id,
    fromName: city.name,
    toName: target.name,
    factionId: city.factionId,
    route: angebot.route.map((t) => ({ col: t.col, row: t.row })),
    length: angebot.length,
    turnsLeft: angebot.turns,
    turns: angebot.turns,
    level: ROAD_STONE,
  });
  logOwn(state, faction.id, `Ausbau zur Steinstraße ${city.name} – ${target.name} begonnen `
    + `(${angebot.length} Felder, ${angebot.turns} Runden, ${angebot.cost} Gold).`);
  return { ok: true, ...angebot };
}

export function buyRoad(state, cityId, targetCityId) {
  const city = state.cities.find((c) => c.id === cityId);
  const target = state.cities.find((c) => c.id === targetCityId);
  if (!city || !target || city.id === target.id) return { ok: false };
  if (city.factionId !== target.factionId) return { ok: false, reason: 'fremd' };
  if (roadProjectOf(state, city.id) || roadProjectOf(state, target.id)) {
    return { ok: false, reason: 'building' };
  }
  if (citySieged(state, city) || citySieged(state, target)) {
    return { ok: false, reason: 'siege' };
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
    level: ROAD_EARTH,
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
    const stufe = project.level || ROAD_EARTH;
    for (const tile of project.route) {
      const key = roadKey(tile.col, tile.row);
      if (roadLevelOf(state.roads[key]) >= stufe) continue;
      state.roads[key] = stufe;
    }
    state.roadVersion = (state.roadVersion || 0) + 1;
    projects.splice(i, 1);
    finished.push(project);
    logOwn(state, project.factionId, stufe >= ROAD_STONE
      ? `🧱 Die Steinstraße ${project.fromName} – ${project.toName} ist fertig.`
      : `🛣️ Die Straße ${project.fromName} – ${project.toName} ist fertig.`);
  }
  return finished;
}

// --- Bauwerke --------------------------------------------------------------
// Alle Bauwerke eines Orts laufen durch dieselben drei Funktionen: prüfen,
// kaufen, Runde für Runde weiterbauen. Was ein einzelnes Bauwerk kostet, was
// es voraussetzt und was es danach kann, steht in BUILDINGS - hier steht nur
// noch, wie gebaut wird. Vorher war das sechsmal fast derselbe Absatz.

// Manche Bauwerke setzen nicht ein anderes Bauwerk voraus, sondern den Ort
// selbst: einen Hafen gibt es nur an der Küste, ein Bergwerk nur dort, wo im
// Umland etwas liegt.
export function buildingSiteOk(state, city, def) {
  if (!def || !def.site) return true;
  if (def.site === 'coast') return isCoastalCity(state, city);
  if (def.site === 'ore') return mineOre(state, city) >= MINE_MIN_ORE;
  return true;
}

// Warum hier gerade nicht gebaut werden kann - null heißt: es kann.
export function buildingBlocker(state, city, key) {
  const def = buildingDef(key);
  if (!def || !city) return 'unknown';
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return 'neutral';
  if (city[key]) return 'done';
  if (city[`${key}Building`]) return 'building';
  if (citySieged(state, city)) return 'siege';
  if (def.requires && !city[def.requires]) return 'requires';
  if (!buildingSiteOk(state, city, def)) return 'site';
  return null;
}

export function canBuildBuilding(state, city, key) {
  return buildingBlocker(state, city, key) === null;
}

export function buyBuilding(state, cityId, key) {
  const city = state.cities.find((c) => c.id === cityId);
  const def = buildingDef(key);
  if (!city || !def) return { ok: false };
  const blocker = buildingBlocker(state, city, key);
  if (blocker) return { ok: false, reason: blocker };
  const faction = factionById(state, city.factionId);
  const preis = buildingPrice(city, def);
  if (faction.gold < preis.cost) return { ok: false, reason: 'gold' };

  faction.gold -= preis.cost;
  city[`${key}Building`] = { turnsLeft: preis.turns, turns: preis.turns, repair: preis.repair };
  logOwn(state, faction.id, `${city.name}: ${buildingName(key, faction.id)} wird `
    + `${preis.repair ? 'wieder aufgebaut' : 'gebaut'} `
    + `(${preis.turns} ${preis.turns === 1 ? 'Runde' : 'Runden'}).`);
  return { ok: true, repair: preis.repair };
}

// Eine Runde Bauzeit für alles, was in irgendeinem Ort im Bau ist.
export function advanceConstruction(state) {
  const finished = [];
  for (const city of state.cities) {
    // Unter Belagerung ruht jede Baustelle - das Material kommt nicht herein.
    if (citySieged(state, city)) continue;
    for (const def of BUILDINGS) {
      const bau = city[`${def.key}Building`];
      if (!bau) continue;
      bau.turnsLeft -= 1;
      if (bau.turnsLeft > 0) continue;
      city[def.key] = true;
      city[`${def.key}Building`] = null;
      const ausTruemmern = city[`${def.key}Ruins`];
      city[`${def.key}Ruins`] = false;
      finished.push({ city, key: def.key, repair: !!ausTruemmern });
      // Das Bergwerk meldet, was es trägt; alle anderen, wozu sie da sind.
      const wirkung = def.key === 'mine'
        ? `${mineIncomeOf(state, city)} Gold je Runde`
        : def.purpose;
      logOwn(state, city.factionId, `${def.icon} ${buildingName(def.key, city.factionId)} `
        + `in ${city.name} steht: ${wirkung}.`);
    }
  }
  return finished;
}

// Die alten Namen, damit ein Aufrufer nicht wissen muss, dass es eine Tabelle
// gibt: sie tun alle dasselbe, nur mit festem Schlüssel.
export const canBuildHarbour = (state, city) => canBuildBuilding(state, city, 'harbour');
export const canBuildBarracks = (state, city) => canBuildBuilding(state, city, 'barracks');
export const canBuildForum = (state, city) => canBuildBuilding(state, city, 'forum');
export const canBuildShipyard = (state, city) => canBuildBuilding(state, city, 'shipyard');
export const canBuildMine = (state, city) => canBuildBuilding(state, city, 'mine');
export const canBuildFarm = (state, city) => canBuildBuilding(state, city, 'farm');
export const canBuildGranary = (state, city) => canBuildBuilding(state, city, 'granary');
export const canBuildViaduct = (state, city) => canBuildBuilding(state, city, 'viaduct');

export const buyHarbour = (state, cityId) => buyBuilding(state, cityId, 'harbour');
export const buyBarracks = (state, cityId) => buyBuilding(state, cityId, 'barracks');
export const buyForum = (state, cityId) => buyBuilding(state, cityId, 'forum');
export const buyShipyard = (state, cityId) => buyBuilding(state, cityId, 'shipyard');
export const buyMine = (state, cityId) => buyBuilding(state, cityId, 'mine');
export const buyFarm = (state, cityId) => buyBuilding(state, cityId, 'farm');
export const buyGranary = (state, cityId) => buyBuilding(state, cityId, 'granary');
export const buyViaduct = (state, cityId) => buyBuilding(state, cityId, 'viaduct');

// --- Bergwerk --------------------------------------------------------------
// Was im Umland liegt, in Punkten: das Gebirge zählt doppelt, das Hügelland
// einfach, alles andere gar nicht. Gerechnet wird über ein Quadrat von zwei
// Feldern um den Ort - so weit reicht ein Stollen und der Karren, der das Erz
// hereinbringt.
export function mineOre(state, city) {
  if (!city) return 0;
  let erz = 0;
  for (let dr = -MINE_RANGE; dr <= MINE_RANGE; dr++) {
    const row = state.map.tiles[city.row + dr];
    if (!row) continue;
    for (let dc = -MINE_RANGE; dc <= MINE_RANGE; dc++) {
      const tile = row[city.col + dc];
      if (tile) erz += MINE_ORE[tile.type] || 0;
    }
  }
  return erz;
}

// Was das Bergwerk dieses Orts je Runde trägt - null, solange keines steht.
export function mineIncomeOf(state, city) {
  if (!city || !city.mine) return 0;
  return mineIncome(mineOre(state, city));
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
    const shelter = city && city.factionId === army.factionId ? 0.4
      : army.camp ? CAMP_SHELTER : 1;
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
    const tile = state.map.tiles[row][col];
    if (tileImpassable(tile)) continue;
    if (taken.has(`${col},${row}`)) continue;
    if (tileMoveCost(tile) >= bestCost) continue;
    bestCost = tileMoveCost(tile);
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
    // Im eigenen Lager ruht es sich wie hinter eigenen Mauern.
    const geschuetzt = (city && city.factionId === army.factionId) || army.camp;
    adjustMorale(army, (geschuetzt ? MORALE_REST_IN_CITY : MORALE_REST) * share);
    adjustExhaustion(army, (geschuetzt ? EXHAUSTION_REST_IN_CITY : EXHAUSTION_REST) * share);
  }
}

// --- Handel ---------------------------------------------------------------
// Ein Handelsweg verbindet zwei eigene Orte. Er wird einmal bezahlt und trägt
// dann Runde für Runde - beiden Enden, denn Handel ist keine Einbahnstraße.
// Verbunden sein heißt: eine durchgehende Straße, oder auf beiden Seiten ein
// Hafen. Ein Karren braucht einen Weg, ein Schiff braucht zwei Häfen.

export function tradeRoutesOf(state, cityId) {
  return (state.tradeRoutes || []).filter((r) => r.aId === cityId || r.bId === cityId);
}

export function tradePartnerOf(state, route, cityId) {
  const otherId = route.aId === cityId ? route.bId : route.aId;
  return state.cities.find((c) => c.id === otherId) || null;
}

// Was ein einzelner Weg jeder Seite je Runde einbringt. Verschiedene Waren
// tragen mehr: wer Salz gegen Wein tauscht, verdient an beidem.
export function tradeRouteIncome(state, a, b) {
  if (!a || !b) return 0;
  const variety = tradeGoodOf(state, a) === tradeGoodOf(state, b) ? 0 : TRADE_VARIETY_BONUS;
  const size = (tradeSizeFactor(a.size) + tradeSizeFactor(b.size)) / 2;
  // Ein Seeweg trägt nur, solange auf ihm niemand kreuzt: liegen Seeräuber vor
  // einem der beiden Häfen, kommt die Hälfte der Ladung nie an.
  const kind = tradeLinkKind(state, a, b);
  const zoll = kind === 'sea' ? pirateTollFactor(state, a, b) : 1;
  // Was über See kommt, ist mehr wert: ein Schiff trägt, was kein Karren trägt.
  const see = kind === 'sea' ? TRADE_SEA_BONUS : 1;
  return Math.round((TRADE_BASE_INCOME + variety) * size * see * zoll);
}

// Ob dieser Weg gerade von Seeräubern beschnitten wird - die Stadtansicht
// sagt es, sonst wundert man sich über die fehlenden Einnahmen.
export function tradeRouteRaided(state, a, b) {
  if (!a || !b) return false;
  if (tradeLinkKind(state, a, b) !== 'sea') return false;
  return pirateTollFactor(state, a, b) < 1;
}

// Was der Handel diesem Ort insgesamt einbringt.
export function tradeIncomeOf(state, city) {
  return tradeRoutesOf(state, city.id).reduce(
    (sum, route) => sum + tradeRouteIncome(state, city, tradePartnerOf(state, route, city.id)), 0
  );
}

// Ob zwei Orte überhaupt miteinander handeln dürfen: im eigenen Reich immer,
// über die Grenze nur mit einem Handelsabkommen. Mit dem Abkommen fällt auch
// der Weg - deshalb wird beim Rundenwechsel geprüft, ob er noch gilt.
export function tradeAllowed(state, a, b) {
  if (!a || !b) return false;
  if (a.factionId === b.factionId) return true;
  if (a.factionId === 'neutral' || b.factionId === 'neutral') return false;
  return hasTradePact(state, a.factionId, b.factionId);
}

// Ob zwei Häfen an demselben Meer liegen. Vom Kaspischen Meer fährt kein Schiff
// ins Mittelmeer, so nah die beiden auf der Karte auch aussehen - und ein
// Seeweg, der über Land führt, ist keiner.
export function sameSea(state, a, b) {
  const seas = state.map && state.map.seas;
  if (!seas) return true;
  const hafenA = harbourTile(state, a);
  const hafenB = harbourTile(state, b);
  if (!hafenA || !hafenB) return false;
  const cols = state.map.cols;
  return seas[hafenA.row * cols + hafenA.col] === seas[hafenB.row * cols + hafenB.col];
}

// Ob zwischen zwei Orten überhaupt Waren fließen können - und auf welchem Weg.
export function tradeLinkKind(state, a, b) {
  if (roadConnected(state, a, b)) return 'road';
  if (a.harbour && b.harbour && isCoastalCity(state, a) && isCoastalCity(state, b)
    && sameSea(state, a, b)) return 'sea';
  return null;
}

// Der Kurs, den die Händler nehmen: der kürzeste Weg über Wasser von einem
// Hafen zum anderen. Gebraucht wird er für die Karte - ein Seeweg soll als
// Linie über dem Meer liegen und nicht quer durch eine Halbinsel.
export function seaLane(state, a, b) {
  const map = state.map;
  const start = harbourTile(state, a);
  const ziel = harbourTile(state, b);
  if (!start || !ziel) return null;
  const cols = map.cols;
  const rows = map.rows;
  const seen = new Int8Array(cols * rows);
  const from = new Int32Array(cols * rows).fill(-1);
  const startIndex = start.row * cols + start.col;
  const zielIndex = ziel.row * cols + ziel.col;
  const queue = [startIndex];
  seen[startIndex] = 1;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === zielIndex) break;
    const col = index % cols;
    const row = (index - col) / cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const next = r * cols + c;
      if (seen[next]) continue;
      if (map.tiles[r][c].type !== 'water') continue;
      seen[next] = 1;
      from[next] = index;
      queue.push(next);
    }
  }
  if (!seen[zielIndex]) return null;
  const lane = [];
  for (let index = zielIndex; index !== -1; index = from[index]) {
    const col = index % cols;
    lane.unshift({ col, row: (index - col) / cols });
    if (index === startIndex) break;
  }
  return lane;
}

// Wie weit ein Weg dieser Art reichen darf.
export function tradeReach(kind) {
  return kind === 'sea' ? TRADE_SEA_DISTANCE : TRADE_MAX_DISTANCE;
}

function tradeDistance(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

// Die Orte, mit denen dieser hier noch handeln könnte, samt dem, was der Weg
// brächte: die eigenen immer, die fremden, sobald ein Handelsabkommen steht.
// Was die Bedingung nicht erfüllt, taucht gar nicht erst auf.
export function tradePartners(state, city) {
  if (tradeRoutesOf(state, city.id).length >= TRADE_ROUTES_PER_CITY) return [];
  const linked = new Set(tradeRoutesOf(state, city.id)
    .map((r) => (r.aId === city.id ? r.bId : r.aId)));
  return state.cities
    .filter((other) => other.id !== city.id
      && tradeAllowed(state, city, other)
      && !linked.has(other.id)
      && tradeRoutesOf(state, other.id).length < TRADE_ROUTES_PER_CITY
      && tradeDistance(city, other) <= TRADE_SEA_DISTANCE)
    .map((other) => ({
      city: other,
      kind: tradeLinkKind(state, city, other),
      distance: tradeDistance(city, other),
      income: tradeRouteIncome(state, city, other),
      good: tradeGoodOf(state, other),
    }))
    // Über Land reicht ein Karren nicht so weit wie ein Schiff.
    .filter((entry) => entry.kind && entry.distance <= tradeReach(entry.kind))
    .sort((a, b) => b.income - a.income || a.distance - b.distance);
}

export function openTradeRoute(state, cityId, targetId) {
  const city = state.cities.find((c) => c.id === cityId);
  const other = state.cities.find((c) => c.id === targetId);
  if (!city || !other || city.id === other.id) return { ok: false };
  if (!tradeAllowed(state, city, other)) return { ok: false, reason: 'fremd' };
  const faction = factionById(state, city.factionId);
  if (!faction || faction.isNeutral) return { ok: false };
  if (!tradePartners(state, city).some((p) => p.city.id === other.id)) {
    return { ok: false, reason: 'unmöglich' };
  }
  if (faction.gold < TRADE_ROUTE_COST) return { ok: false, reason: 'gold' };
  faction.gold -= TRADE_ROUTE_COST;
  const kind = tradeLinkKind(state, city, other);
  state.tradeRoutes.push({ id: makeId('trade'), aId: city.id, bId: other.id, kind });
  logOwn(state, faction.id, `Handelsweg ${city.name} – ${other.name} eröffnet `
    + `(${kind === 'sea' ? 'zur See' : 'über Land'}, +${
      tradeRouteIncome(state, city, other)} Gold je Seite und Runde).`);
  return { ok: true };
}

export function closeTradeRoute(state, routeId) {
  const routes = state.tradeRoutes || [];
  const index = routes.findIndex((r) => r.id === routeId);
  if (index < 0) return { ok: false };
  const route = routes[index];
  const a = state.cities.find((c) => c.id === route.aId);
  const b = state.cities.find((c) => c.id === route.bId);
  routes.splice(index, 1);
  if (a && b) logOwn(state, a.factionId, `Handelsweg ${a.name} – ${b.name} aufgegeben.`);
  return { ok: true };
}

// Ein Handelsweg endet, wenn ein Ende den Besitzer wechselt oder die
// Verbindung abreißt - eine Straße, die durch fremdes Land führt, wird nicht
// unterbrochen, aber eine verlorene Stadt handelt nicht mehr für den alten
// Herrn. Läuft nach jeder Eroberung und zu jedem Rundenwechsel.
export function pruneTradeRoutes(state) {
  state.tradeRoutes = (state.tradeRoutes || []).filter((route) => {
    const a = state.cities.find((c) => c.id === route.aId);
    const b = state.cities.find((c) => c.id === route.bId);
    if (!a || !b || !tradeAllowed(state, a, b)) return false;
    return !!tradeLinkKind(state, a, b);
  });
}

// Was ein einzelner Ort in dieser Runde einbringt, aufgeschlüsselt: die
// Abgaben der Siedlung selbst, was ihre Einwohner darüber hinaus tragen, und
// was ein Weltwunder vor ihren Toren an Pilgern und Händlern anzieht.
// Dieselbe Rechnung steht in der Seitenleiste und in der Rundenabrechnung -
// es soll nicht zwei Wahrheiten darüber geben, was eine Stadt wert ist.
export function cityIncome(state, city) {
  // Ein belagerter Ort trägt nichts: die Felder sind abgeerntet, die Wege
  // gesperrt, die Karren aus dem Stollen kommen nicht durch.
  if (citySieged(state, city)) {
    return { people: 0, wonders: 0, trade: 0, mine: 0, total: 0, besieged: true };
  }
  // Die Steuer der Einwohner ist die Grundlage: ein Ort wirft nichts dafür ab,
  // dass es ihn gibt, sondern nur für die, die in ihm wohnen.
  const people = cityTax(city.population);
  const wonders = wondersOfCity(state, city.id).reduce((sum, w) => sum + w.income, 0);
  const trade = tradeIncomeOf(state, city);
  // Das Bergwerk trägt für sich: es hängt weder an der Größe des Orts noch an
  // seinen Einwohnern, sondern allein an dem, was im Berg liegt.
  const mine = mineIncomeOf(state, city);
  return {
    people, wonders, trade, mine,
    total: people + wonders + trade + mine,
  };
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

// --- Trümmer ---------------------------------------------------------------
// Was eine Eroberung von einer Stadt übrig lässt. Die Mauer verliert eine
// Stufe - eine Bresche ist keine Mauer -, und jedes Bauwerk kann in Trümmern
// liegen. Beides bleibt sichtbar: über den Trümmern lässt sich neu bauen, und
// zwar zum halben Preis und in der halben Zeit, denn die Grundmauern stehen.
export function buildingRuined(city, key) {
  return !!(city && city[`${key}Ruins`]);
}

export function wallRuined(city) {
  return !!(city && city.wallRuins);
}

// Was ein Bauwerk hier und jetzt kostet - aus Trümmern die Hälfte.
export function buildingPrice(city, def) {
  const ruine = buildingRuined(city, def.key);
  return {
    cost: ruine ? repairCost(def.cost) : def.cost,
    turns: ruine ? repairTurns(def.turns) : def.turns,
    repair: ruine,
  };
}

export function damageOnCapture(state, city, rng = Math.random) {
  const zerstoert = [];
  const stufeVorher = cityWallLevel(city);
  if (stufeVorher > 0) {
    city.wallLevel = Math.max(0, stufeVorher - CAPTURE_WALL_LOSS);
    city.wallBuilding = null;
    city.wallRuins = true;
  }
  for (const def of BUILDINGS) {
    if (!city[def.key]) continue;
    if (rng() >= CAPTURE_RUIN_CHANCE) continue;
    city[def.key] = false;
    city[`${def.key}Building`] = null;
    city[`${def.key}Ruins`] = true;
    zerstoert.push(def.key);
  }
  return { wallLost: stufeVorher - cityWallLevel(city), ruined: zerstoert };
}

// --- Das Lager -------------------------------------------------------------
// Graben, Wall, Palisade: ein halber Tag Arbeit, und das Heer steht nicht mehr
// im offenen Feld. Gebaut wird mit dem, was an Bewegung übrig ist - wer schon
// marschiert ist, schlägt heute kein Lager mehr auf.
export function campStatus(state, army) {
  if (!army) return { can: false, reason: 'none' };
  if (army.camp) return { can: false, reason: 'done' };
  if (army.embarked) return { can: false, reason: 'atSea' };
  if (isFleet(army)) return { can: false, reason: 'fleet' };
  const city = cityAt(state, army.col, army.row);
  // In einer Stadt braucht niemand ein Lager: sie ist eines.
  if (city) return { can: false, reason: 'inCity' };
  if (army.movement <= 0) return { can: false, reason: 'movement' };
  const faction = factionById(state, army.factionId);
  if (!faction || faction.isNeutral) return { can: false, reason: 'none' };
  if (faction.gold < CAMP_COST) return { can: false, reason: 'gold' };
  return { can: true };
}

export function buildCamp(state, armyId) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army) return { ok: false };
  const status = campStatus(state, army);
  if (!status.can) return { ok: false, reason: status.reason };
  const faction = factionById(state, army.factionId);
  faction.gold -= CAMP_COST;
  army.camp = true;
  // Der Rest des Tages gehört dem Spaten.
  army.movement = 0;
  const belagert = campSiegeTarget(state, army);
  logOwn(state, army.factionId, belagert
    ? `⛺ ${army.name} schlägt ein Belagerungslager vor ${belagert.name} auf.`
    : `⛺ ${army.name} schlägt ein ${CAMP_NAME} auf.`);
  return { ok: true, siege: belagert || null };
}

export function breakCamp(state, armyId) {
  const army = state.armies.find((a) => a.id === armyId);
  if (!army || !army.camp) return { ok: false };
  army.camp = false;
  logOwn(state, army.factionId, `${army.name} bricht das ${CAMP_NAME} ab.`);
  return { ok: true };
}

// Der feindliche Ort, vor dem dieses Lager liegt - falls es vor einem liegt.
export function campSiegeTarget(state, army) {
  if (!army || army.embarked) return null;
  for (const city of state.cities) {
    if (city.factionId === army.factionId) continue;
    if (!atWar(state, army.factionId, city.factionId)) continue;
    if (Math.abs(army.col - city.col) + Math.abs(army.row - city.row) > SIEGE_RANGE) continue;
    return city;
  }
  return null;
}

// --- Belagerung ------------------------------------------------------------
// Wer sich vor einen Ort stellt, belagert ihn. Es braucht keinen Befehl und
// keinen eigenen Zustand dafür: die Lage der Heere sagt es. Ein Landheer
// unmittelbar neben dem Ort schließt ihn ein; eine Flotte vor einem Hafenort
// sperrt ihm die See. Beides heißt Belagerung, und beides nimmt dem Ort, was
// von draußen kommt.
//
// Die Seeräuber sind ausgenommen: sie haben ihre eigene Regel (halber Ertrag
// auf jedem Seeweg in ihrer Reichweite) und sollen einem Reich nicht mit
// einem einzigen Segel die Steuer nehmen.
// Eine Belagerung führt ein Reich, nicht zwei. Stehen die Heere zweier
// Fraktionen vor demselben Tor, dann belagert nur eines von beiden - das,
// das angefangen hat, solange es steht, und sonst das stärkere. Das andere
// steht daneben: es schneidet nichts ab, hungert niemanden aus und bekommt
// den Ort auch nicht durch Warten. Wer ihn will, muss den Belagerer zuerst
// vom Feld schlagen. Vorher konnten sich vier Reiche eine Stadt teilen, und
// die Belagerung lief für alle zugleich.
export function siegeForces(state, city) {
  if (!city) return null;
  const nachReich = new Map();
  for (const army of state.armies) {
    if (army.factionId === city.factionId) continue;
    if (isPirate(army)) continue;
    if (!atWar(state, city.factionId, army.factionId)) continue;
    if (Math.abs(army.col - city.col) + Math.abs(army.row - city.row) > SIEGE_RANGE) continue;
    const eintrag = nachReich.get(army.factionId)
      || { land: [], sea: [], mann: 0 };
    if (isFleet(army) || army.embarked) {
      // Ein Schiff belagert nur, was einen Hafen hat: vor einer Binnenstadt
      // liegt keine Flotte, und vor einer Küste ohne Kai nimmt sie nichts.
      if (!city.harbour) continue;
      eintrag.sea.push(army);
    } else {
      eintrag.land.push(army);
    }
    eintrag.mann += unitTotalCount(army.units);
    nachReich.set(army.factionId, eintrag);
  }
  if (!nachReich.size) return null;

  // Eine Belagerung entsteht nicht dadurch, dass jemand danebensteht: sie wird
  // erklärt. Wer eine Stadt belagern will, greift sie an und wählt statt des
  // Sturms die Belagerung - dann schließt sein Heer den Ort ein. Ohne diese
  // Entscheidung marschiert ein Heer an einer Stadt vorbei, ohne sie
  // abzuschneiden. Vorher genügte es, ein Feld daneben stehen zu bleiben, und
  // jeder Durchmarsch würgte nebenbei eine fremde Stadt ab.
  const halter = city.siege && nachReich.has(city.siege.by) ? city.siege.by : null;
  if (!halter) return null;
  const { land, sea } = nachReich.get(halter);
  const daneben = [...nachReich.keys()].filter((id) => id !== halter);
  // Ein Belagerungslager ist etwas anderes als ein Heer, das zufällig
  // danebensteht: es schneidet vom ersten Tag an ab und zehrt schneller.
  return { factionId: halter, land, sea, camp: land.some((a) => a.camp), daneben };
}

// Alles, was die Seitenleiste über eine Belagerung wissen muss - live aus der
// Lage gerechnet, damit sie dasteht, sobald das Heer danebensteht, und nicht
// erst nach dem Rundenwechsel.
export function siegeInfo(state, city) {
  const forces = siegeForces(state, city);
  if (!forces) return null;
  const alle = [...forces.land, ...forces.sea];
  const seit = city.siege ? Math.max(0, state.turn - city.siege.since) : 0;
  const frist = forces.camp ? CAMP_SIEGE_STARVE_AFTER : SIEGE_STARVE_AFTER;
  return {
    land: forces.land.length,
    sea: forces.sea.length,
    camp: !!forces.camp,
    men: alle.reduce((sum, a) => sum + unitTotalCount(a.units), 0),
    // Belagert wird von einem Reich. `factions` bleibt eine Liste, damit die
    // Anzeige unverändert damit rechnen kann - sie hat jetzt genau einen Namen.
    factions: [forces.factionId],
    by: forces.factionId,
    // Wer sonst noch davorsteht, ohne die Belagerung zu führen.
    daneben: forces.daneben,
    seit,
    hungert: seit >= frist,
    bisHunger: Math.max(0, frist - seit),
  };
}

// Ob einem Hafenort die See gesperrt ist: dann geht kein Heer an Bord und
// läuft kein Schiff vom Stapel.
export function cityBlockaded(state, city) {
  if (!city || !city.harbour) return false;
  // Eine Sperre ist keine Belagerung: dafür genügt es, dass Schiffe vor der
  // Hafeneinfahrt kreuzen. Aushungern kann nur, wer die Belagerung erklärt
  // hat - aber auslaufen kann aus einem verstellten Hafen niemand.
  return state.armies.some((army) => army.factionId !== city.factionId
    && !isPirate(army)
    && atWar(state, city.factionId, army.factionId)
    && (isFleet(army) || army.embarked)
    && Math.abs(army.col - city.col) + Math.abs(army.row - city.row) <= SIEGE_RANGE);
}

// Einmal je Runde festhalten, seit wann ein Ort belagert wird. Nur die Dauer
// muss im Spielstand stehen - alles andere ergibt sich aus der Lage.
// Hält die erklärte Belagerung, oder ist sie zu Ende? Begonnen wird sie
// nirgends mehr von selbst - das tut `besiegeCity` -, hier wird nur geprüft,
// ob der Belagerer noch davorsteht.
export function updateSieges(state) {
  for (const city of state.cities) {
    if (!city.siege) continue;
    if (siegeForces(state, city)) continue;
    logOwn(state, city.factionId, `🕊 Die Belagerung von ${city.name} ist aufgehoben.`);
    logOwn(state, city.siege.by, `Die Belagerung von ${city.name} ist aufgegeben – `
      + 'vor dem Ort steht niemand mehr.');
    city.siege = null;
  }
  // Was in dieser Runde neu eingeschlossen wurde - erklärt wird es im Zug,
  // gemeldet wird es hier, damit der Rundenwechsel es dem Betroffenen sagen
  // kann.
  return state.cities.filter((c) => c.siege && c.siege.since === state.turn);
}

// --- Eine Belagerung erklären ---------------------------------------------
// Der Weg dorthin führt über den Angriff: wer eine Stadt anwählt, bekommt die
// Wahl zwischen Sturm und Belagerung. Der Sturm entscheidet heute, die
// Belagerung entscheidet in ein paar Runden - dafür ohne Sturm über die Mauer.
export function siegeStatus(state, army, city) {
  if (!army || !city) return { can: false, reason: 'none' };
  // Ein Geschwader schließt einen Ort ein, wenn er einen Hafen hat - vor einer
  // Binnenstadt liegt keine Flotte. Ein eingeschifftes Heer belagert nicht:
  // es sitzt auf Transportern und hat weder Graben noch Wall.
  const zurSee = isFleet(army) || army.embarked;
  if (zurSee && (army.embarked && !isFleet(army))) return { can: false, reason: 'fleet' };
  if (zurSee && !city.harbour) return { can: false, reason: 'kein Hafen' };
  if (city.factionId === army.factionId) return { can: false, reason: 'own' };
  if (!atWar(state, army.factionId, city.factionId)) return { can: false, reason: 'peace' };
  const weite = Math.abs(army.col - city.col) + Math.abs(army.row - city.row);
  if (weite > SIEGE_RANGE) return { can: false, reason: 'far' };
  // Zwei Reiche belagern denselben Ort nicht zugleich.
  if (city.siege && city.siege.by !== army.factionId) {
    return { can: false, reason: 'besetzt', by: city.siege.by };
  }
  if (city.siege && city.siege.by === army.factionId) return { can: false, reason: 'running' };
  return { can: true };
}

export function besiegeCity(state, armyId, cityId) {
  const army = state.armies.find((a) => a.id === armyId);
  const city = state.cities.find((c) => c.id === cityId);
  const status = siegeStatus(state, army, city);
  if (!status.can) return { ok: false, reason: status.reason };
  city.siege = { since: state.turn, by: army.factionId, factions: [army.factionId] };
  // Wer sich vor eine Stadt legt, marschiert an diesem Tag nicht mehr weiter.
  army.movement = 0;
  const feind = factionById(state, army.factionId);
  logOwn(state, army.factionId, `⚔️ ${army.name} schließt ${city.name} ein.`);
  logOwn(state, city.factionId, `⚔️ ${city.name} wird von ${feind.name} belagert: `
    + 'keine Steuer, kein Nachschub, kein Bau.');
  return { ok: true, city };
}



export function siegeTurns(state, city) {
  return city && city.siege ? Math.max(0, state.turn - city.siege.since) : 0;
}

// Hunger. Eine Belagerung, die ein paar Runden steht, muss keine Mauer
// stürmen - sie wartet, und die Stadt wird jede Runde schwächer.
export function applySiegeAttrition(state) {
  const gelitten = [];
  for (const city of state.cities) {
    if (!city.siege) continue;
    const forces = siegeForces(state, city);
    const lager = !!(forces && forces.camp);
    const frist = lager ? CAMP_SIEGE_STARVE_AFTER : SIEGE_STARVE_AFTER;
    const zehrung = lager ? CAMP_SIEGE_ATTRITION : SIEGE_ATTRITION;
    const hunger = lager ? CAMP_SIEGE_POPULATION_LOSS : SIEGE_POPULATION_LOSS;
    if (state.turn - city.siege.since < frist) continue;
    let verloren = 0;
    for (const role of GARRISON_ROLES) {
      const zahl = city.garrison[role] || 0;
      if (zahl <= 0) continue;
      const weg = Math.max(1, Math.round(zahl * zehrung));
      city.garrison[role] = Math.max(0, zahl - weg);
      verloren += Math.min(weg, zahl);
    }
    const buerger = Math.round(city.population * hunger);
    city.population = Math.max(100, city.population - buerger);
    if (verloren || buerger) {
      gelitten.push({ city, verloren, buerger });
      logOwn(state, city.factionId, `🍂 In ${city.name} wird gehungert: `
        + `${verloren} Mann und ${buerger} Bürger weniger.`);
    }
  }
  return gelitten;
}

// --- Geburten -------------------------------------------------------------
// Jede Runde ist ein Monat, und in jedem Monat werden Kinder geboren. Das
// wirkt sich aus: die Einwohner tragen zu den Einnahmen bei, sie stellen die
// Stadtwache nach und sie bestimmen, wie groß eine Garnison sein darf.
//
// Zwei Dinge bremsen: der Winter und ein Heer vor dem Tor. Und über die
// Obergrenze seines Rangs wächst kein Ort hinaus - ein Dorf bleibt ein Dorf.
export function citySieged(state, city) {
  return !!siegeForces(state, city);
}

// Was ein Ort in dieser Runde an Menschen gewinnt - null, wenn er belagert
// wird oder schon so groß ist, wie er werden kann.
export function birthsIn(state, city) {
  const grenze = populationCeiling(city);
  if (city.population >= grenze) return 0;
  if (citySieged(state, city)) return 0;
  const { season } = calendarOfTurn(state.turn);
  const rate = BIRTH_RATE * (BIRTH_SEASON[season.key] ?? 1) * growthFactor(city);
  return Math.min(Math.round(city.population * rate), grenze - city.population);
}

export function growPopulations(state) {
  for (const city of state.cities) {
    city.population += birthsIn(state, city);
  }
}

// Die Stadtwache stellt sich aus der Bevölkerung nach - Runde für Runde ein
// Stück, bis sie ihre Sollstärke wieder hat. Wer eine Stadt stürmt, hält sie
// deshalb eine Weile, bevor sie sich selbst wieder verteidigt.
export function regenerateGarrisons(state) {
  for (const city of state.cities) {
    // Aus einer belagerten Stadt kommt niemand nach: wer draußen ist, bleibt
    // draußen, und drinnen wird nicht ausgebildet, sondern gehungert.
    if (citySieged(state, city)) continue;
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
