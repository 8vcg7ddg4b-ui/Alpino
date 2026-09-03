// --- Die Gegner -----------------------------------------------------------
// Jede Fraktion, die nicht der Spieler ist, wird hier geführt: sie baut,
// forscht, stellt Flotten auf, verteidigt ihre Welten und greift an, wo sie
// sich stark genug fühlt. Sie benutzt dieselben Regeln wie der Spieler -
// keine eigenen Zahlen, keine Abkürzungen.
import {
  UNIT_ROLES, WATCH_ROLE, unitDefs, ROLE_REQUIRES, BUILDING_ORDER, BUILDING_DEFS,
  TECH_ORDER, MAX_TECH_LEVEL, techStep, sizeTier, MAX_SHIELD_LEVEL, SHIELD_LEVELS,
} from './data.js';
import {
  factionById, systemsOf, fleetsOf, systemAt, fleetsAt, capitalOf,
  fleetTotalCount, fleetRoleCount, garrisonFieldUnits, garrisonTotal, logMsg,
  movementMaxFor,
} from './state.js';
import { atWar, alliedWith, relationOf } from './diplomacy.js';
import {
  buildShip, buyBuilding, buildShield, startResearch, raiseFleet, moveFleet,
  attackTile, besiegeSystem, blockadeSystem, reinforceFleet, mergeFleets,
  resetMovement, canBuildRole, endOfTurnFor, disbandIntoSystem,
} from './actions.js';
import { computeReachable, pathTo, longRoute, tileDistance, tileKey, hostileAt } from './pathfind.js';
import { previewBattle } from './combat.js';
import { rulerTraitSum } from './pilots.js';

// Wie scharf die KI insgesamt spielt - der Spieler stellt das in den
// Einstellungen ein.
let aiStance = 1;
export function setAiStance(value) {
  aiStance = Math.max(0.5, Math.min(1.6, value || 1));
}
export function getAiStance() {
  return aiStance;
}

export function aiTakeAllTurns(state) {
  const notes = [];
  for (const faction of state.factions) {
    if (faction.isPlayer || faction.isNeutral || !faction.alive) continue;
    if (faction.id === 'nephilim') { nephilimTurn(state, faction); continue; }
    resetMovement(state, faction.id);
    aiEconomy(state, faction);
    aiRaiseFleets(state, faction);
    aiMoveFleets(state, faction);
    endOfTurnFor(state, faction.id);
  }
  return notes;
}

// --- Haushalt -------------------------------------------------------------
// Reihenfolge: was bedroht ist, wird geschützt; danach wird gebaut, was das
// Reich stärker macht; der Rest geht in Schiffe.
function aiEconomy(state, faction) {
  const systems = systemsOf(state, faction.id);
  if (!systems.length) return;
  const ruler = faction.ruler;
  const buildBias = 0.35 + rulerTraitSum(ruler, 'build');
  const aggression = (0.5 + rulerTraitSum(ruler, 'aggression')) * aiStance;
  const threatened = systems.filter((s) => threatLevel(state, faction.id, s) > 0);

  // Forschung läuft mit, sobald der Schritt bezahlbar ist - ein Reich, das
  // nur Schiffe baut, fliegt in zehn Jahren dieselben Schiffe.
  if (!faction.research && Math.random() < 0.45) {
    const line = TECH_ORDER
      .filter((id) => (faction.tech[id] || 0) < MAX_TECH_LEVEL)
      .sort((a, b) => (faction.tech[a] || 0) - (faction.tech[b] || 0))[0];
    if (line) {
      const step = techStep(line, faction.tech[line] || 0);
      if (step && faction.credits > step.cost * 1.25) startResearch(state, faction.id, line);
    }
  }

  // Schilde für bedrohte Welten.
  for (const sys of threatened.sort((a, b) => threatLevel(state, faction.id, b) - threatLevel(state, faction.id, a))) {
    if (sys.shield.level >= MAX_SHIELD_LEVEL || sys.shield.building) continue;
    const next = SHIELD_LEVELS[sys.shield.level + 1];
    if (faction.credits > next.cost * 1.6) buildShield(state, sys);
  }

  // Ausbauten: Werft zuerst, dann Bergbau, dann der Rest - und nur dort, wo
  // Ruhe ist.
  if (Math.random() < buildBias) {
    const safe = systems.filter((s) => !s.siege).sort((a, b) => b.size - a.size);
    for (const sys of safe) {
      const wish = wishForSystem(state, faction, sys);
      if (!wish) continue;
      const cur = sys.buildings[wish] || { level: 0 };
      const info = BUILDING_DEFS[wish].levels[cur.level];
      if (!info || faction.credits < info.cost * 1.5) continue;
      const res = buyBuilding(state, sys, wish);
      if (res.ok) break;
    }
  }

  // Schiffe: die KI hält ein Verhältnis - viele Jäger, ein paar Bomber, dazu
  // Kiele und immer Landungstruppen, sonst kann sie nichts nehmen.
  const wantOrder = shipWishlist(state, faction, aggression);
  const yards = systems
    .filter((s) => !s.siege && s.training.length < sizeTier(s.size).buildSlots)
    .sort((a, b) => (b.buildings.werft ? b.buildings.werft.level : 0)
      - (a.buildings.werft ? a.buildings.werft.level : 0));
  for (const role of wantOrder) {
    const defs = unitDefs(faction.id);
    if (faction.credits < defs[role].cost * 1.15) break;
    const yard = yards.find((s) => canBuildRole(state, s, role)
      && s.training.length < sizeTier(s.size).buildSlots);
    if (!yard) continue;
    buildShip(state, yard, role);
  }
}

function wishForSystem(state, faction, sys) {
  const order = ['werft', 'bergbau', 'geschuetz', 'sensor', 'handel', 'akademie', 'terraformer'];
  for (const id of order) {
    const def = BUILDING_DEFS[id];
    const cur = sys.buildings[id] || { level: 0, building: null };
    if (cur.building) continue;
    if (cur.level >= def.maxLevel) continue;
    // Kleine Welten bekommen keine dritte Werftstufe: das wäre Geldverschwendung.
    if (id === 'werft' && cur.level >= sys.size) continue;
    return id;
  }
  return null;
}

function shipWishlist(state, faction, aggression) {
  const fleets = fleetsOf(state, faction.id);
  const have = { jaeger: 0, bomber: 0, korvette: 0, kreuzer: 0, traeger: 0, marines: 0 };
  for (const fleet of fleets) {
    for (const u of fleet.units) have[u.role] = (have[u.role] || 0) + u.count;
  }
  for (const sys of systemsOf(state, faction.id)) {
    for (const [role, n] of Object.entries(garrisonFieldUnits(sys))) {
      have[role] = (have[role] || 0) + n;
    }
  }
  const total = Object.values(have).reduce((a, b) => a + b, 0) || 1;
  const want = [];
  // Zielverhältnis: die Hälfte Jäger, ein Fünftel Bomber, dazu Kiele.
  if (have.jaeger / total < 0.45) want.push('jaeger', 'jaeger');
  if (have.bomber / total < 0.18) want.push('bomber');
  if (have.marines / total < 0.12) want.push('marines');
  if (have.korvette / total < 0.1) want.push('korvette');
  if (have.kreuzer / total < 0.08) want.push('kreuzer');
  if (have.traeger < Math.ceil(fleets.length / 2)) want.push('traeger');
  if (!want.length) want.push(aggression > 0.7 ? 'jaeger' : 'kreuzer');
  return want.slice(0, 3);
}

// Wie bedroht ist eine Welt? Zahl und Nähe der feindlichen Flotten.
function threatLevel(state, factionId, system) {
  let threat = 0;
  for (const fleet of state.fleets) {
    if (fleet.factionId === factionId) continue;
    const hostile = atWar(state, factionId, fleet.factionId)
      || fleet.factionId === 'neutral' || fleet.factionId === 'nephilim';
    if (!hostile) continue;
    const d = tileDistance(fleet, system);
    if (d > 8) continue;
    threat += fleetTotalCount(fleet) / Math.max(1, d);
  }
  if (system.siege) threat += 40;
  return threat;
}

// --- Flotten aufstellen --------------------------------------------------
function aiRaiseFleets(state, faction) {
  for (const sys of systemsOf(state, faction.id)) {
    const field = garrisonFieldUnits(sys);
    const strength = Object.values(field).reduce((a, b) => a + b, 0);
    if (strength < 14) continue;
    // Eine bedrohte Welt behält ihre Verbände unten; eine ruhige schickt sie
    // ins Feld.
    if (threatLevel(state, faction.id, sys) > 20) continue;
    raiseFleet(state, sys);
  }
}

// --- Bewegung und Gefecht ------------------------------------------------
function aiMoveFleets(state, faction) {
  const aggression = (0.5 + rulerTraitSum(faction.ruler, 'aggression')) * aiStance;
  const fleets = [...fleetsOf(state, faction.id)]
    .sort((a, b) => fleetTotalCount(b) - fleetTotalCount(a));

  for (const fleet of fleets) {
    if (!state.fleets.includes(fleet)) continue;
    if (fleet.movement <= 0) continue;

    // Zu schwach oder zu mutlos: zurück in die Werft, auffrischen.
    const weak = fleetTotalCount(fleet) < 10 || fleet.morale < 30;
    if (weak) {
      const home = homeYard(state, faction.id, fleet);
      if (home) {
        if (home.col === fleet.col && home.row === fleet.row) {
          const res = reinforceFleet(state, fleet);
          if (!res.ok && fleetTotalCount(fleet) < 6) disbandIntoSystem(state, fleet);
          continue;
        }
        marchTowards(state, fleet, home.col, home.row);
        continue;
      }
    }

    // Eine belagerte eigene Welt entlasten - das geht allem vor.
    const besieged = systemsOf(state, faction.id)
      .filter((s) => s.siege || threatLevel(state, faction.id, s) > 25)
      .sort((a, b) => tileDistance(fleet, a) - tileDistance(fleet, b))[0];
    if (besieged && tileDistance(fleet, besieged) <= 12) {
      const enemy = enemyNear(state, faction.id, besieged, 2);
      if (enemy && tryAttack(state, fleet, enemy.col, enemy.row, 0.9)) continue;
      if (tileDistance(fleet, besieged) > 0) { marchTowards(state, fleet, besieged.col, besieged.row); continue; }
    }

    // Ein Ziel in Reichweite: feindliche Flotte oder feindliches System.
    const { reach, attacks } = computeReachable(state, fleet);
    const options = [];
    const siegeOptions = [];
    for (const [key, entry] of attacks) {
      const [col, row] = key.split(',').map(Number);
      const target = entry.target;
      const sys = systemAt(state, col, row);
      const defender = target.kind === 'flotte' ? target.fleet : sys;
      if (!defender) continue;
      const preview = previewBattle(state, fleet, defender);
      let score = preview.chance;
      if (target.kind === 'system') {
        // Ein Sturm ohne Landungstruppen nimmt keine Welt, und ohne Bomber
        // kommt niemand durch den Schild: dann wird eingeschlossen, nicht
        // angegriffen. Das erspart beiden Seiten sinnlose Wrackfelder.
        const canTake = preview.hasMarines
          && (sys.shield.level === 0 || fleetRoleCount(fleet, 'bomber') > 0);
        if (!canTake) {
          siegeOptions.push({ col, row, sys, cost: entry.cost, chance: preview.chance });
          continue;
        }
        score += sizeTier(sys.size).income / 2;
        if (sys.capital) score += 25;
      } else {
        score += fleetTotalCount(target.fleet) / 2;
      }
      score -= entry.cost * 2;
      options.push({ col, row, score, chance: preview.chance, kind: target.kind, sys });
    }
    options.sort((a, b) => b.score - a.score);
    const best = options[0];
    const threshold = 62 - aggression * 22;
    if (best && best.chance >= threshold) {
      if (tryAttack(state, fleet, best.col, best.row, 0)) continue;
    }
    // Kein Sturm möglich, aber ein System in Reichweite: einschließen. Die
    // Belagerung drückt den Schild herunter und zehrt die Wache auf - und
    // irgendwann fällt die Welt von selbst.
    const siege = siegeOptions.sort((a, b) => (b.sys.size - a.sys.size) || (a.cost - b.cost))[0];
    if (siege) {
      const path = pathTo(reach, attacks, siege.col, siege.row);
      if (path && path.length > 1) {
        moveFleet(state, fleet, path.slice(0, -1));
        if (tileDistance(fleet, siege.sys) <= 1) {
          const own = systemAt(state, fleet.col, fleet.row);
          if (!own || own.factionId !== faction.id) blockadeSystem(state, fleet);
        }
        continue;
      }
      if (tileDistance(fleet, siege.sys) <= 1) { blockadeSystem(state, fleet); continue; }
    }

    // Nichts in Reichweite: marschieren. Ziel ist die schwächste erreichbare
    // feindliche Welt, sonst die eigene Grenze.
    const march = pickCampaignTarget(state, faction, fleet, aggression);
    if (march) { marchTowards(state, fleet, march.col, march.row); continue; }
    // Sonst: zusammenschließen, wo eine zweite eigene Flotte steht.
    const friend = fleetsAt(state, fleet.col, fleet.row)
      .find((f) => f !== fleet && f.factionId === fleet.factionId);
    if (friend) mergeFleets(state, friend, fleet);
  }
}

function tryAttack(state, fleet, col, row, minChance) {
  const target = hostileAt(state, fleet.factionId, col, row);
  if (!target) return false;
  const defender = target.kind === 'flotte' ? target.fleet : systemAt(state, col, row);
  if (!defender) return false;
  if (minChance > 0) {
    const preview = previewBattle(state, fleet, defender);
    if (preview.chance < minChance * 100) return false;
  }
  const res = attackTile(state, fleet, col, row);
  return !!res.ok;
}

function homeYard(state, factionId, fleet) {
  const own = systemsOf(state, factionId).filter((s) => !s.siege);
  if (!own.length) return null;
  return own.sort((a, b) => {
    const ya = (a.buildings.werft ? a.buildings.werft.level : 0);
    const yb = (b.buildings.werft ? b.buildings.werft.level : 0);
    if (yb !== ya) return yb - ya;
    return tileDistance(fleet, a) - tileDistance(fleet, b);
  })[0];
}

function enemyNear(state, factionId, system, range) {
  return state.fleets.find((f) => f.factionId !== factionId
    && (atWar(state, factionId, f.factionId) || f.factionId === 'neutral' || f.factionId === 'nephilim')
    && tileDistance(f, system) <= range);
}

// Wohin die Flotte auf lange Sicht will: die lohnendste feindliche Welt,
// gewogen nach Entfernung, Größe und Verteidigung.
function pickCampaignTarget(state, faction, fleet, aggression) {
  const enemies = state.systems.filter((sys) => {
    if (sys.factionId === faction.id) return false;
    if (sys.factionId === 'neutral') return aggression > 0.75;
    return atWar(state, faction.id, sys.factionId);
  });
  if (!enemies.length) {
    // Kein Krieg: an die eigene Grenze, dort wo die Bedrohung sitzt.
    const border = systemsOf(state, faction.id)
      .sort((a, b) => threatLevel(state, faction.id, b) - threatLevel(state, faction.id, a))[0];
    return border && tileDistance(fleet, border) > 1 ? border : null;
  }
  let best = null;
  let bestScore = -Infinity;
  for (const sys of enemies) {
    const dist = tileDistance(fleet, sys);
    const defence = garrisonTotal(sys) + sys.shield.level * 8;
    const score = sizeTier(sys.size).income * 1.5 + (sys.capital ? 30 : 0)
      - defence * 0.8 - dist * 1.6;
    if (score > bestScore) { bestScore = score; best = sys; }
  }
  return best;
}

// Ein Marschbefehl über mehrere Züge: der lange Weg wird berechnet, aber nur
// so weit geflogen, wie das Budget reicht.
function marchTowards(state, fleet, col, row) {
  const route = longRoute(state, fleet, col, row);
  if (!route || !route.length) return false;
  const { reach, attacks } = computeReachable(state, fleet);
  // Das weiteste Feld der Route, das in diesem Zug erreichbar ist.
  let dest = null;
  for (const step of route) {
    const key = tileKey(step.col, step.row);
    if (reach.has(key)) dest = step;
  }
  if (!dest) {
    // Nichts auf der Route erreichbar: irgendein Feld in Richtung Ziel.
    let bestKey = null;
    let bestDist = Infinity;
    for (const key of reach.keys()) {
      const [c, r] = key.split(',').map(Number);
      const d = Math.abs(c - col) + Math.abs(r - row);
      if (d < bestDist) { bestDist = d; bestKey = key; }
    }
    if (!bestKey) return false;
    const [c, r] = bestKey.split(',').map(Number);
    dest = { col: c, row: r };
  }
  const path = pathTo(reach, attacks, dest.col, dest.row);
  if (!path || path.length < 2) return false;
  moveFleet(state, fleet, path.slice(1));
  return true;
}

// --- Der Schwarm ----------------------------------------------------------
// Die Nephilim bauen nicht und verhandeln nicht: sie fliegen und greifen an.
function nephilimTurn(state, faction) {
  resetMovement(state, faction.id);
  for (const fleet of [...fleetsOf(state, faction.id)]) {
    if (!state.fleets.includes(fleet)) continue;
    const { reach, attacks } = computeReachable(state, fleet);
    let best = null;
    for (const [key, entry] of attacks) {
      const [col, row] = key.split(',').map(Number);
      const sys = systemAt(state, col, row);
      const score = (sys ? sizeTier(sys.size).income : 10) - entry.cost;
      if (!best || score > best.score) best = { col, row, score };
    }
    if (best) { tryAttack(state, fleet, best.col, best.row, 0); continue; }
    const target = state.systems
      .filter((s) => s.factionId !== faction.id)
      .sort((a, b) => tileDistance(fleet, a) - tileDistance(fleet, b))[0];
    if (target) marchTowards(state, fleet, target.col, target.row);
  }
}
