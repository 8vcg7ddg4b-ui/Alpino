import {
  UNIT_ROLES, SHIP_ROLE, SHIP_COST, HARBOUR_COST, unitDef, roadCost, shipTypesOf,
  wallLevelInfo, TRADE_ROUTE_COST, MINE_COST, SHIPYARD_COST,
} from './data.js';
import { computeReachable, tileKey } from './pathfind.js';
import {
  moveArmy, recruitUnit, raiseArmyFromGarrison, embarkArmy, embarkStatus,
  previewTileCombat, roadProjectOf, buyRoad, roadNetworkFrom,
  buyHarbour, canBuildHarbour, buildFleet, raiseIndependentArmies,
  buyCityWalls, nextWallLevel, tradePartners, openTradeRoute,
  canBuildMine, buyMine, mineOre, buyShipyard,
} from './actions.js';
import {
  unitTotalCount, factionById, isCoastalCity, sameLandmass, isFleet,
} from './state.js';
import { atWar, rulerOf } from './diplomacy.js';
import { piratesTakeTurn } from './piraten.js';
import { hordesTakeTurn } from './staemme.js';

// Keeps enough in the treasury that paying for a fleet never leaves a faction
// unable to defend what it already has.
const AI_FLEET_RESERVE = 200;
// How much closer an overseas target must be before the fleet is worth it.
const SEA_CROSSING_MARGIN = 3;

// Marschentfernung in Feldern, wie die KI sie überall veranschlagt.
function tileDistance(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function nearestTarget(state, army, walkable) {
  const candidates = [];
  // Ein Ziel ist nur, womit man im Krieg steht. Steht der Friede, marschiert
  // dieses Heer daran vorbei - oder gar nicht erst los.
  for (const city of state.cities) {
    if (city.factionId !== army.factionId && atWar(state, army.factionId, city.factionId)) {
      candidates.push({ col: city.col, row: city.row, weight: unitTotalCount(city.garrison) + 5 });
    }
  }
  for (const other of state.armies) {
    if (other.factionId !== army.factionId && atWar(state, army.factionId, other.factionId)) {
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

  // Reicht es allein nicht, aber ein eigenes Heer steht in Reichweite, dann
  // wird zusammengelegt statt abgewartet. Sonst stehen zwei halbe Heere
  // nebeneinander vor einer Stadt, die keines von beiden nehmen kann.
  if (direct && direct.combat) {
    let merge = null;
    let mergeDist = Infinity;
    for (const [k, entry] of reachable) {
      if (!entry.merge) continue;
      const [col, row] = k.split(',').map(Number);
      const dist = Math.hypot(col - target.col, row - target.row);
      if (dist < mergeDist) {
        mergeDist = dist;
        merge = { col, row };
      }
    }
    if (merge) {
      moveArmy(state, army.id, merge.col, merge.row);
      return;
    }
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
// Steht der Feind schon vor dem Tor, ist Gold in der Truhe nichts mehr wert:
// dann wird ausgehoben, bis nichts mehr da ist.
const AI_EMERGENCY_FLOOR = 0;
// So viele Trupps hebt eine bedrohte Stadt in einer Runde aus. Einer je Stadt
// und Runde reicht nicht, wenn ein ganzes Heer anmarschiert - und wer erst in
// der Runde darauf aufstockt, hat die Stadt schon verloren.
const AI_EMERGENCY_BATCHES = 3;

// Woraus eine Garnison bestehen soll. Vorher würfelte die KI die Waffengattung
// aus und stellte damit reihenweise reine Reiterheere auf: teuer im Sold, im
// Angriff gut, hinter einer Mauer aber das Falsche.
const AI_COMPOSITION = { infantry: 0.6, cavalry: 0.2, ranged: 0.2 };

// Die Gattung, an der es gemessen an der Sollmischung am meisten fehlt.
function neediestRole(units) {
  const total = UNIT_ROLES.reduce((sum, key) => sum + (units[key] || 0), 0);
  let best = UNIT_ROLES[0];
  let bestGap = -Infinity;
  for (const key of UNIT_ROLES) {
    const gap = (AI_COMPOSITION[key] || 0) * total - (units[key] || 0);
    if (gap > bestGap) {
      bestGap = gap;
      best = key;
    }
  }
  return best;
}

function aiEconomy(state, faction, savingForFleet, buildReserve = 0, threats = []) {
  // An army waiting in a harbour for want of coin will wait for ever if the
  // treasury is spent on recruits every turn. When a crossing is pending, the
  // floor rises until the fleet is paid for.
  // Wer den Krieg sucht, lässt wenig in der Truhe liegen; wer aufs Gold sieht,
  // hebt später aus und behält mehr. Zwischen einem Segimer und einem
  // Ptolemaios liegt hier fast das Doppelte.
  const ruler = rulerOf(state, faction.id);
  const truhe = Math.round(AI_TREASURY_FLOOR
    * (1.3 - ruler.angriffslust / 200 + ruler.habgier / 250));
  let floor = savingForFleet
    ? Math.max(truhe, SHIP_COST + AI_FLEET_RESERVE)
    : truhe;
  // Auch eine Mauer oder eine Straße will erst bezahlt sein, bevor die nächste
  // Aushebung kommt.
  if (buildReserve > 0) floor = Math.max(floor, AI_TREASURY_FLOOR + buildReserve);

  // Die bedrohten Orte kommen zuerst an die Reihe, und für sie gilt kein
  // Sparzwang: eine volle Truhe in einer Stadt, die nächste Runde fällt, hat
  // noch keinen Feldzug gewonnen.
  const alarmed = new Map(
    threats.filter((t) => t.distance <= AI_ALARM_RANGE).map((t) => [t.city.id, t])
  );
  const ownCities = state.cities.filter((c) => c.factionId === faction.id)
    .sort((a, b) => (alarmed.has(b.id) ? 1 : 0) - (alarmed.has(a.id) ? 1 : 0));

  for (const city of ownCities) {
    const danger = alarmed.get(city.id);
    const cityFloor = danger ? AI_EMERGENCY_FLOOR : floor;
    const batches = danger ? AI_EMERGENCY_BATCHES : 1;
    for (let i = 0; i < batches; i++) {
      if (faction.gold <= cityFloor) break;
      if (!recruitUnit(state, city.id, neediestRole(city.garrison)).ok) break;
    }

    // Wo der Feind vor dem Tor steht, bleibt die Aushebung hinter der Mauer:
    // dort kämpft sie mit dem Wall im Rücken statt einzeln im offenen Feld.
    if (danger) continue;

    // Die Stadtwache zählt nicht mit: sie rückt nie aus, und eine Stadt, die
    // nur ihre Wache hat, stellt kein Heer auf.
    const marchable = UNIT_ROLES.reduce((sum, key) => sum + (city.garrison[key] || 0), 0);
    const hasFieldArmyHere = state.armies.some(
      (a) => a.factionId === faction.id && a.col === city.col && a.row === city.row
    );
    if (marchable >= 200 && (!hasFieldArmyHere || marchable >= 400)) {
      raiseArmyFromGarrison(state, city.id);
    }
  }
}

// Straßen sind eine Ausgabe für ruhige Zeiten, aber keine, die nie an die
// Reihe kommt: eine Fraktion sucht sich den nächsten eigenen Ort ohne
// Anschluss und spart darauf, so wie sie auf eine Flotte spart.
const AI_ROAD_TREASURY = 260;
// Teurer als das baut die KI nicht - für eine Straße quer durch Africa
// stehen die Truppen sonst ein halbes Jahrzehnt ohne Nachschub da.
const AI_ROAD_MAX_COST = 400;

// Der nächste eigene Ort, der noch nicht am Netz hängt, und der Ort am Netz,
// von dem aus er am kürzesten zu erreichen wäre.
function roadPlan(state, faction) {
  if ((state.roadProjects || []).some((p) => p.factionId === faction.id)) return null;
  const own = state.cities.filter((c) => c.factionId === faction.id);
  if (own.length < 2) return null;
  const hub = own.find((c) => c.capital) || own[0];
  const network = roadNetworkFrom(state, hub);
  const connected = own.filter((c) => network.has(`${c.col},${c.row}`));
  const anchors = connected.length ? connected : [hub];

  let best = null;
  for (const target of own) {
    if (network.has(`${target.col},${target.row}`)) continue;
    if (roadProjectOf(state, target.id)) continue;
    if (!sameLandmass(state, hub.col, hub.row, target.col, target.row)) continue;
    for (const from of anchors) {
      if (from.id === target.id || roadProjectOf(state, from.id)) continue;
      const air = Math.abs(from.col - target.col) + Math.abs(from.row - target.row);
      if (!best || air < best.air) best = { from, target, air };
    }
  }
  if (!best) return null;
  best.estimate = roadCost(best.air);
  return best.estimate <= AI_ROAD_MAX_COST ? best : null;
}

// Gibt zurück, ob die Fraktion gerade auf eine Straße spart - dann hält der
// Wirtschaftsteil die Kasse hoch genug, dass sie sie auch bezahlen kann.
function aiRoads(state, faction, savingForFleet) {
  if (savingForFleet) return false;
  const plan = roadPlan(state, faction);
  if (!plan) return false;
  if (faction.gold >= plan.estimate + AI_ROAD_TREASURY) {
    buyRoad(state, plan.from.id, plan.target.id);
    return false;
  }
  return true;
}

// Ein Bergwerk ist die beste Anlage, die es gibt: einmal bezahlt, trägt es
// jede Runde, solange der Ort gehalten wird. Die KI schlägt eines an, sobald
// sie es sich leisten kann - im erzreichsten Ort zuerst. Mehr als eines je
// Runde nicht: eine leere Truhe verteidigt keine Stadt.
const AI_MINE_TREASURY = 150;

// Gibt zurück, ob dafür gespart wird: wer ein Bergwerk will und es sich noch
// nicht leisten kann, hebt in dieser Runde weniger aus. Sonst steht die Kasse
// jede Runde bei vierhundert und der Stollen wird nie angeschlagen.
function aiMines(state, faction) {
  let best = null;
  let bestOre = 0;
  for (const city of state.cities) {
    if (city.factionId !== faction.id) continue;
    if (!canBuildMine(state, city)) continue;
    const erz = mineOre(state, city);
    if (erz <= bestOre) continue;
    bestOre = erz;
    best = city;
  }
  if (!best) return false;
  if (faction.gold >= MINE_COST + AI_MINE_TREASURY) {
    buyMine(state, best.id);
    return false;
  }
  return true;
}

// Das nächste feindliche Schiff - eine Flotte oder ein Heer auf Transportern.
function nearestSeaTarget(state, fleet) {
  let best = null;
  let bestDistance = Infinity;
  for (const other of state.armies) {
    if (other.factionId === fleet.factionId || !other.embarked) continue;
    if (!atWar(state, fleet.factionId, other.factionId)) continue;
    const distance = Math.abs(other.col - fleet.col) + Math.abs(other.row - fleet.row);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { col: other.col, row: other.row };
    }
  }
  return best;
}

// Schiffe baut, wer einen Hafen hat und gerade nichts Dringenderes braucht.
// Eine Flotte je drei Küstenorten reicht, um die eigene Küste zu decken.
// Gebaut wird vor der Aushebung, sonst ist die Kasse jede Runde leer, bevor
// die Werft an die Reihe kommt.
function aiNavy(state, faction) {
  const bauarten = shipTypesOf(faction.id);
  if (!bauarten.length) return;
  // Gebaut wird die Hauptbauart, wenn die Kasse sie hergibt, sonst die
  // billigste, die noch hineinpasst - lieber ein leichtes Geschwader als gar
  // keines.
  const bezahlbar = bauarten.filter((t) => faction.gold >= t.cost + AI_TREASURY_FLOOR);
  if (!bezahlbar.length) return;
  const ship = bezahlbar.includes(bauarten[0]) ? bauarten[0]
    : bezahlbar.reduce((a, b) => (b.cost < a.cost ? b : a));
  const harbours = state.cities.filter((c) => c.factionId === faction.id && c.harbour);
  if (!harbours.length) return;
  const fleets = state.armies.filter((a) => a.factionId === faction.id && isFleet(a)).length;
  const coastal = state.cities.filter((c) => c.factionId === faction.id && isCoastalCity(state, c));
  if (fleets >= Math.max(1, Math.round(coastal.length / 3))) return;
  // Ohne Helling kein Kiel: steht noch keine Werft, wird zuerst die gebaut -
  // eine je Fraktion genügt, sie liegt am besten im größten Hafen.
  const werften = harbours.filter((c) => c.shipyard);
  if (!werften.length) {
    if (harbours.some((c) => c.shipyardBuilding)) return;
    if (faction.gold < SHIPYARD_COST + AI_TREASURY_FLOOR) return;
    const platz = harbours.reduce((a, b) => (b.population > a.population ? b : a));
    buyShipyard(state, platz.id);
    return;
  }
  buildFleet(state, werften[Math.floor(Math.random() * werften.length)].id, ship.key);
}

// How close an enemy army has to be before a settlement counts as threatened.
const HOME_GUARD_RANGE = 12;
// So nah heißt: der Sturm kommt in dieser oder der nächsten Runde. Dann wird
// nicht mehr gespart, sondern ausgehoben.
const AI_ALARM_RANGE = 6;

// Jede eigene Stadt, vor der Feinde stehen, mit der Stärke, die sich vor ihr
// versammelt hat, und der Entfernung des nächsten von ihnen. Flotten zählen
// nicht mit: sie nehmen keine Stadt.
//
// Daran hängen drei Entscheidungen: wo die Wache steht, wo gemauert wird und
// wo ausgehoben wird, bis die Truhe leer ist.
function threatsAgainst(state, faction) {
  const threats = [];
  for (const city of state.cities) {
    if (city.factionId !== faction.id) continue;
    let strength = 0;
    let distance = Infinity;
    for (const enemy of state.armies) {
      if (enemy.factionId === faction.id || isFleet(enemy)) continue;
      if (!atWar(state, faction.id, enemy.factionId)) continue;
      const away = tileDistance(enemy, city);
      if (away > HOME_GUARD_RANGE) continue;
      strength += unitTotalCount(enemy.units);
      if (away < distance) distance = away;
    }
    if (strength > 0) threats.push({ city, strength, distance });
  }
  // Was am nächsten steht, ist am dringendsten; bei gleicher Nähe das Größere.
  threats.sort((a, b) => (a.distance - b.distance) || (b.strength - a.strength));
  return threats;
}

// Returns whether a crossing is being held up by an empty treasury, so the
// economy knows to stop spending.
function aiMilitary(state, faction, threats) {
  let savingForFleet = false;
  // Die Küstenstadt, in der eine Armee auf einen Hafen wartet.
  let harbourWanted = null;
  const armies = state.armies.filter((a) => a.factionId === faction.id);

  // Sending every army at the nearest enemy leaves nothing behind, and a
  // faction with neighbours on three sides loses its towns behind its own
  // army's back. With more than one host, the nearest one stays home.
  let guard = null;
  let guardHome = null;
  if (armies.length > 1) {
    const home = threats.length ? threats[0].city : null;
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
    // Eine Flotte sucht sich ihre eigenen Ziele: was auf dem Wasser fährt.
    // Städte kann sie nicht nehmen, Landheere nicht stellen.
    if (isFleet(army)) {
      const prey = nearestSeaTarget(state, army);
      if (prey) stepArmyTowards(state, army, prey);
      continue;
    }
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
        // Am Meer, aber ohne Hafen: dann ist der Hafen die nächste Ausgabe.
        if (status.reason === 'noHarbour') harbourWanted = status.city;
        if (status.reason !== 'noHarbour') continue;
      }
      // Otherwise make for the nearest own harbour rather than standing still
      // on the wrong side of the water.
      const port = nearestOwnPort(state, army, walkable);
      if (port && (port.col !== army.col || port.row !== army.row)) {
        stepArmyTowards(state, army, port);
        if (!port.city.harbour) harbourWanted = port.city;
        continue;
      }
      if (port && !port.city.harbour) {
        harbourWanted = port.city;
        continue;
      }
    }
    stepArmyTowards(state, army, target);
  }
  return { savingForFleet, harbourWanted };
}

// Ein Hafen wird gebaut, sobald eine Armee auf ihn wartet - und sonst nur,
// wenn eine Fraktion gar keinen hat und ihre Küste ungenutzt liegt.
function aiHarbours(state, faction, harbourWanted) {
  if ((state.cities || []).some((c) => c.factionId === faction.id && c.harbourBuilding)) return false;
  let target = harbourWanted && harbourWanted.factionId === faction.id
    && canBuildHarbour(state, harbourWanted) ? harbourWanted : null;
  if (!target) {
    const own = state.cities.filter((c) => c.factionId === faction.id);
    if (own.some((c) => c.harbour)) return false;
    // Der größte Küstenort ohne Hafen - dort lohnt die Werft am ehesten.
    const rank = { large: 0, city: 1, village: 2 };
    target = own.filter((c) => canBuildHarbour(state, c))
      .sort((a, b) => (rank[a.size] ?? 3) - (rank[b.size] ?? 3))[0] || null;
  }
  if (!target) return false;
  if (faction.gold >= HARBOUR_COST + AI_TREASURY_FLOOR) {
    buyHarbour(state, target.id);
    return false;
  }
  return true;
}

// --- Handel ---------------------------------------------------------------
// Ein Handelsweg ist die billigste Einnahme, die es gibt, und die KI soll
// nicht als einzige darauf verzichten. Sie eröffnet höchstens einen je Runde
// und nimmt den einträglichsten - mehr Umstände macht sie damit nicht.
const AI_TRADE_TREASURY = 300;

function aiTrade(state, faction) {
  // Ein Ptolemaios greift nach jedem Handelsweg, ein Areus lässt ihn liegen.
  const ruler = rulerOf(state, faction.id);
  const reserve = Math.round(AI_TRADE_TREASURY * (1.6 - ruler.habgier / 100));
  if (faction.gold < TRADE_ROUTE_COST + reserve) return;
  let best = null;
  for (const city of state.cities) {
    if (city.factionId !== faction.id) continue;
    for (const partner of tradePartners(state, city)) {
      if (!best || partner.income > best.income) best = { cityId: city.id, partner };
    }
  }
  if (best) openTradeRoute(state, best.cityId, best.partner.city.id);
}

// --- Mauern ---------------------------------------------------------------
// Nur Hauptstädte sind von Anfang an befestigt (CAPITAL_WALL_LEVEL); jede
// andere Stadt der KI blieb bisher das ganze Spiel über offen, weil
// buyCityWalls nirgends aufgerufen wurde. Gebaut wird eine Stufe nach der
// anderen, eine Baustelle zur Zeit, und zuerst dort, wo der Feind schon steht.
const AI_WALL_TREASURY = 200;
// Länger als auf diese Summe spart die KI nicht: die Steinmauer wird gebaut,
// wenn sie ohnehin bezahlbar ist, aber nicht auf Kosten der Aushebung erspart.
const AI_WALL_SAVE_MAX = 450;

function wallPlan(state, faction, threats) {
  // Zwei angefangene Mauern halten keine einzige Stadt.
  if (state.cities.some((c) => c.factionId === faction.id && c.wallBuilding)) return null;
  const danger = new Map(threats.map((t) => [t.city.id, t.strength]));
  const rank = { large: 0, city: 1, village: 2 };
  const city = state.cities
    .filter((c) => c.factionId === faction.id && nextWallLevel(c))
    .sort((a, b) => (danger.get(b.id) || 0) - (danger.get(a.id) || 0)
      || (b.capital ? 1 : 0) - (a.capital ? 1 : 0)
      || (rank[a.size] ?? 3) - (rank[b.size] ?? 3))[0];
  if (!city) return null;
  return { city, cost: wallLevelInfo(nextWallLevel(city)).cost };
}

// Gibt zurück, ob die Fraktion gerade auf eine Mauer spart.
function aiWalls(state, faction, threats) {
  const plan = wallPlan(state, faction, threats);
  if (!plan) return false;
  // Vorsicht ist Angriffslust von der anderen Seite: wer nicht angreifen will,
  // baut, und er spart auch länger darauf.
  const ruler = rulerOf(state, faction.id);
  const vorsicht = (100 - ruler.angriffslust) / 100;
  const reserve = Math.round(AI_WALL_TREASURY * (1.4 - vorsicht * 0.8));
  const sparGrenze = Math.round(AI_WALL_SAVE_MAX * (0.7 + vorsicht * 0.8));
  if (faction.gold >= plan.cost + reserve) {
    buyCityWalls(state, plan.city.id);
    return false;
  }
  return plan.cost <= sparGrenze;
}

// The closest own harbour this army could actually walk to. A town with a
// finished harbour always beats one that would first have to build one, however
// close it is - otherwise the army camps in a fishing village for ever.
function nearestOwnPort(state, army, walkable) {
  let best = null;
  let bestRank = Infinity;
  for (const city of state.cities) {
    if (city.factionId !== army.factionId) continue;
    if (!isCoastalCity(state, city)) continue;
    if (walkable && !walkable(city.col, city.row)) continue;
    const dist = Math.abs(city.col - army.col) + Math.abs(city.row - army.row);
    const rank = city.harbour ? dist : dist + 1000;
    if (rank < bestRank) {
      bestRank = rank;
      best = { col: city.col, row: city.row, city };
    }
  }
  return best;
}

// --- Die Unabhängigen ------------------------------------------------------
// Milizen führen keinen Feldzug: sie bleiben in der Nähe ihrer Stadt und
// greifen nur zu, wenn ein schwacher Nachbarort in Reichweite liegt. Erst
// wenn eine von ihnen zugreift, entsteht daraus ein Staat, und der wird von
// da an wie jede andere Fraktion geführt.

// Wie weit eine Miliz sich von ihrer Stadt entfernt.
const MILITIA_RANGE = 7;

function militiaTarget(state, army) {
  let best = null;
  let bestScore = -Infinity;
  for (const city of state.cities) {
    if (city.factionId === army.factionId) continue;
    const distance = Math.abs(city.col - army.col) + Math.abs(city.row - army.row);
    if (distance > MILITIA_RANGE) continue;
    // Ein offenes Dorf ist die Gelegenheit, eine Hauptstadt hinter Steinmauern
    // ist es nicht. Nähe zählt, Befestigung und Besatzung zählen dagegen.
    const garrison = unitTotalCount(city.garrison);
    const score = -distance * 2 - garrison / 40 - (city.wallLevel || 0) * 6;
    if (score <= bestScore) continue;
    bestScore = score;
    best = city;
  }
  return best;
}

// Die Seeräuber ziehen wie alles andere über den Wegfinder: sie kennen kein
// Land, nur Wasser, und der Wegfinder weiß das schon.
export function piratesMove(state) {
  piratesTakeTurn(state, stepArmyTowards);
}

// Und die Züge aus dem Osten: dasselbe, nur zu Fuß.
export function hordesMove(state) {
  hordesTakeTurn(state, stepArmyTowards);
}

export function independentsTakeTurn(state) {
  raiseIndependentArmies(state);
  for (const army of state.armies.filter((a) => a.factionId === 'neutral')) {
    const target = militiaTarget(state, army);
    if (target) stepArmyTowards(state, army, target);
  }
}

export function aiTakeTurn(state, faction) {
  // Was der Fraktion gerade droht, entscheidet über alles Weitere: wo die
  // Wache steht, wo gemauert und wo ausgehoben wird.
  const threats = threatsAgainst(state, faction);
  // Movement first: a fleet that is needed this turn should not find the
  // treasury already spent on another batch of recruits.
  const { savingForFleet, harbourWanted } = aiMilitary(state, faction, threats);
  // Ein Hafen geht der Flotte voraus: ohne ihn nützt das Schiffsgeld nichts.
  const savingForHarbour = aiHarbours(state, faction, harbourWanted);
  // Die Mauer geht der Straße vor: die eine hält eine Stadt, die andere macht
  // sie nur schneller erreichbar. Das Bergwerk geht der Mauer vor: eine Mauer hält eine Stadt, ein Bergwerk
  // bezahlt die nächsten drei. Es wird ohnehin nur einmal je Ort gebaut, und
  // nur dort, wo überhaupt Erz liegt - die Mauern kommen gleich danach.
  const savingForMine = !savingForFleet && !savingForHarbour
    && aiMines(state, faction);
  const savingForWall = !savingForFleet && !savingForHarbour && !savingForMine
    && aiWalls(state, faction, threats);
  const savingForRoad = !savingForHarbour && !savingForWall && !savingForMine
    && aiRoads(state, faction, savingForFleet);
  if (!savingForFleet && !savingForHarbour && !savingForWall && !savingForMine) {
    aiNavy(state, faction);
  }
  // Handel erst, wenn nichts Dringenderes ansteht: eine Mauer hält eine Stadt,
  // ein Handelsweg füllt nur die Truhe.
  if (!savingForFleet && !savingForHarbour && !savingForWall && !savingForMine
    && !savingForRoad) {
    aiTrade(state, faction);
  }
  let buildReserve = 0;
  if (savingForHarbour) buildReserve = HARBOUR_COST;
  else if (savingForMine) buildReserve = MINE_COST;
  else if (savingForWall) buildReserve = AI_WALL_SAVE_MAX;
  else if (savingForRoad) buildReserve = AI_ROAD_MAX_COST;
  aiEconomy(state, faction, savingForFleet, buildReserve, threats);
}

export function aiTakeAllTurns(state) {
  // Eine Abschrift der Liste: aus einer Miliz kann in dieser Runde ein Staat
  // werden, und der soll erst in der nächsten Runde ziehen.
  for (const faction of [...state.factions]) {
    if (faction.isPlayer || faction.isNeutral || !faction.alive) continue;
    aiTakeTurn(state, faction);
  }
  independentsTakeTurn(state);
  // Dann die Züge aus dem Osten, dann die Seeräuber: beide ziehen, nachdem
  // alle anderen gezogen sind - wer ein Heer in den Weg gestellt hat, soll es
  // dort auch antreffen.
  hordesMove(state);
  piratesMove(state);
}
