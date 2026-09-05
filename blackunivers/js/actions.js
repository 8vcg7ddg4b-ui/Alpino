// --- Die Züge -------------------------------------------------------------
// Was auf der Karte geschieht: fliegen, angreifen, erobern, bauen,
// forschen, belagern, handeln, kassieren. Jede Regel steht einmal hier und
// wird von Spieler und KI gleich benutzt.
import {
  unitDefs, shipName, ROLE_LABELS, UNIT_ROLES, WATCH_ROLE, ROLE_REQUIRES,
  BUILDING_DEFS, BUILDING_ORDER, buildingLevelInfo, buildingName,
  SHIELD_LEVELS, shieldInfo, MAX_SHIELD_LEVEL, sizeTier, watchTarget,
  TILE_TYPES, HAZARD_ATTRITION, SENSOR_RANGE, SENSOR_RANGE_NEBULA,
  CREDITS_PER_POPULATION, UPKEEP_FREE_UNITS, BASE_INCOME, BLOCKADE_INCOME_LOSS,
  SIEGE_ATTRITION, MORALE_MAX, MORALE_START, TRADE_ROUTE_BASE, TRADE_ROUTE_MAX,
  REINFORCE_COST_FACTOR, VICTORY_SYSTEMS, RIVAL_OF, GREAT_WORKS,
  TECH_LINES, MAX_TECH_LEVEL, techStep, TACTICS,
} from './data.js';
import { tileAt } from './mapgen.js';
import {
  makeId, createFleet, factionById, playerFaction, systemAt, systemById,
  fleetsAt, fleetsOf, systemsOf, capitalOf, fleetTotalCount, fleetRoleCount,
  garrisonTotal, garrisonFieldUnits, movementMaxFor, hasGreatWork, logMsg,
  markSeen, hasSeen, tileOf, attachAce, tidyUnits,
} from './state.js';
import { atWar, adjustRelation, declareWar, learnFaction, pushNews } from './diplomacy.js';
import { resolveBattle, battleSummary, sumLosses, lossesText, previewBattle } from './combat.js';
import { computeReachable, pathTo, tileDistance, nearestOwnSystem, hostileAt, tileKey } from './pathfind.js';
import { rulerTraitSum } from './pilots.js';

// --- Bewegung -------------------------------------------------------------
export function resetMovement(state, factionId) {
  for (const fleet of fleetsOf(state, factionId)) {
    fleet.movement = movementMaxFor(state, fleet);
    fleet.hasMoved = false;
  }
}

// Eine Flotte fliegt einen Weg entlang. Zurück kommt, wie weit sie kam und
// was sie unterwegs verloren hat.
export function moveFleet(state, fleet, path) {
  if (!path || !path.length) return { moved: 0, losses: 0 };
  let moved = 0;
  let losses = 0;
  let last = { col: fleet.col, row: fleet.row };
  for (const step of path) {
    const tile = tileAt(state.map, step.col, step.row);
    if (!tile) break;
    const cost = step.cost != null ? step.cost - moved : 1;
    if (fleet.movement <= 0) break;
    // Der Weg ist mit Kosten gerechnet; der Wegfinder liefert sie mit.
    const stepCost = Math.max(0, cost);
    if (stepCost > fleet.movement) break;
    fleet.movement -= stepCost;
    moved += stepCost;
    fleet.col = step.col;
    fleet.row = step.row;
    last = step;
    losses += applyHazard(state, fleet, tile);
    revealAround(state, fleet.factionId, fleet.col, fleet.row);
    if (fleet.units.every((u) => u.count <= 0)) break;
  }
  fleet.hasMoved = true;
  fleet.stance = 'normal';
  cleanupFleet(state, fleet);
  return { moved, losses, at: last };
}

// Trümmerfelder und Strahlung nehmen sich ihren Zoll - deshalb fliegt man
// darum herum, wenn man Zeit hat.
export function applyHazard(state, fleet, tile) {
  const rate = HAZARD_ATTRITION[tile.type];
  if (!rate) return 0;
  let lost = 0;
  for (const u of fleet.units) {
    if (u.count <= 0) continue;
    if (Math.random() * 100 < rate) { u.count -= 1; lost += 1; }
  }
  if (lost > 0 && fleet.factionId === state.playerFactionId) {
    logMsg(state, `${fleet.name} verliert ${lost} Maschinen in ${tile.zoneName || 'unruhigem Raum'}.`, 'verlust');
  }
  return lost;
}

// Verbände ohne Maschinen fliegen nicht mehr mit; eine Flotte ohne Verbände
// verschwindet von der Karte.
export function cleanupFleet(state, fleet) {
  fleet.units = fleet.units.filter((u) => u.count > 0);
  if (!fleet.units.length) {
    if (fleet.ace) markAceLost(state, fleet);
    state.fleets = state.fleets.filter((f) => f.id !== fleet.id);
    if (fleet.factionId === state.playerFactionId) {
      logMsg(state, `${fleet.name} ist aufgelöst - nichts kam zurück.`, 'verlust');
    }
    return false;
  }
  return true;
}

function markAceLost(state, fleet) {
  const ace = state.aces.find((a) => a.fleetId === fleet.id && a.alive);
  if (!ace) return;
  // Ein Ass fällt nicht immer mit seiner Flotte: manchmal steigt es aus.
  if (Math.random() < 0.45) {
    ace.alive = false;
    logMsg(state, `${ace.name} „${ace.call}" ist gefallen.`, 'ass');
    pushNews(state, { kind: 'ass', a: fleet.factionId, text: `${ace.name} „${ace.call}" ist gefallen.` });
  } else {
    ace.fleetId = null;
    logMsg(state, `${ace.name} „${ace.call}" wurde geborgen und wartet auf ein neues Kommando.`, 'ass');
  }
}

// --- Sicht ----------------------------------------------------------------
export function sensorRangeOf(state, factionId, col, row, base = SENSOR_RANGE) {
  const tile = tileOf(state, col, row);
  let range = base;
  if (tile && tile.type === TILE_TYPES.NEBULA) range = SENSOR_RANGE_NEBULA;
  if (hasGreatWork(state, factionId, 'horchposten')) range += 4;
  return range;
}

export function revealAround(state, factionId, col, row, range = null) {
  if (factionId !== state.playerFactionId) return;
  const r = range != null ? range : sensorRangeOf(state, factionId, col, row);
  for (let dr = -r; dr <= r; dr++) {
    for (let dc = -r; dc <= r; dc++) {
      if (dc * dc + dr * dr > r * r + r) continue;
      const t = tileAt(state.map, col + dc, row + dr);
      if (t) markSeen(state, t.col, t.row);
    }
  }
}

// Alles, was eine Fraktion in diesem Zug sieht - Felder, Flotten, Systeme.
export function computeVisibility(state, factionId) {
  const tiles = new Set();
  const fleets = new Set();
  const factions = new Set();
  const add = (col, row, range) => {
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        if (dc * dc + dr * dr > range * range + range) continue;
        const t = tileAt(state.map, col + dc, row + dr);
        if (t) tiles.add(tileKey(t.col, t.row));
      }
    }
  };
  for (const fleet of fleetsOf(state, factionId)) {
    add(fleet.col, fleet.row, sensorRangeOf(state, factionId, fleet.col, fleet.row));
  }
  for (const sys of systemsOf(state, factionId)) {
    const sensor = sys.buildings.sensor;
    const bonus = sensor && sensor.level ? BUILDING_DEFS.sensor.sight[sensor.level - 1] : 0;
    add(sys.col, sys.row, sensorRangeOf(state, factionId, sys.col, sys.row, SENSOR_RANGE + 1) + bonus);
  }
  for (const fleet of state.fleets) {
    if (fleet.factionId === factionId) continue;
    if (!tiles.has(tileKey(fleet.col, fleet.row))) continue;
    const tile = tileOf(state, fleet.col, fleet.row);
    // Im Nebel sieht man nur, wer daneben steht.
    if (tile && tile.type === TILE_TYPES.NEBULA) {
      const close = fleetsOf(state, factionId).some((f) => tileDistance(f, fleet) <= 1)
        || systemsOf(state, factionId).some((s) => tileDistance(s, fleet) <= 1);
      if (!close) continue;
    }
    fleets.add(fleet.id);
    factions.add(fleet.factionId);
  }
  for (const sys of state.systems) {
    if (sys.factionId === factionId) continue;
    if (tiles.has(tileKey(sys.col, sys.row))) factions.add(sys.factionId);
  }
  for (const id of factions) learnFaction(state, factionId, id);
  return { tiles, fleets, factions };
}

// --- Angriff --------------------------------------------------------------
// Ein Angriff ist ein Zug auf ein feindliches Feld: erst der Weg dorthin,
// dann das Gefecht, dann die Folgen.
export function attackTile(state, fleet, col, row, opts = {}) {
  const target = hostileAt(state, fleet.factionId, col, row);
  if (!target) return { ok: false, text: 'Dort steht kein Feind.' };
  const { reach, attacks } = computeReachable(state, fleet);
  const key = tileKey(col, row);
  if (!attacks.has(key)) return { ok: false, text: 'Zu weit - die Flotte kommt in diesem Zug nicht heran.' };
  const path = pathTo(reach, attacks, col, row);
  // Der letzte Schritt ist das Gefecht selbst; bis davor wird geflogen.
  const approach = path.slice(0, -1);
  if (approach.length) moveFleet(state, fleet, approach);
  if (!state.fleets.includes(fleet)) return { ok: false, text: 'Die Flotte kam nicht bis zum Feind.' };
  fleet.movement = 0;
  fleet.hasMoved = true;

  const defenderFleets = fleetsAt(state, col, row).filter((f) => f.factionId !== fleet.factionId);
  const sys = systemAt(state, col, row);

  // Erst die Flotten, dann die Welt: über einem verteidigten System muss man
  // zweimal gewinnen.
  if (defenderFleets.length) {
    const defender = strongestFleet(defenderFleets);
    if (!atWar(state, fleet.factionId, defender.factionId)
      && defender.factionId !== 'neutral' && defender.factionId !== 'nephilim') {
      declareWar(state, fleet.factionId, defender.factionId, 'Angriff im offenen Raum');
    }
    const report = resolveBattle(state, fleet, defender, opts);
    applyBattleResult(state, report, fleet, defender, null);
    return { ok: true, report };
  }

  if (sys) {
    if (!atWar(state, fleet.factionId, sys.factionId) && sys.factionId !== 'neutral'
      && sys.factionId !== 'nephilim') {
      declareWar(state, fleet.factionId, sys.factionId, `Angriff auf ${sys.name}`);
    }
    const report = resolveBattle(state, fleet, sys, opts);
    applyBattleResult(state, report, fleet, null, sys);
    return { ok: true, report };
  }
  return { ok: false, text: 'Dort ist nichts mehr zu holen.' };
}

function strongestFleet(list) {
  return [...list].sort((a, b) => fleetTotalCount(b) - fleetTotalCount(a))[0];
}

// Was ein Bericht auf der Karte bedeutet: Verluste, Moral, Rückzug,
// Eroberung, Erfahrung, Beute.
export function applyBattleResult(state, report, attackerFleet, defenderFleet, system) {
  const attackerFaction = factionById(state, report.attacker.factionId);
  const defenderFaction = factionById(state, report.defender.factionId);
  const summary = battleSummary(report);

  // Die Verbände aus dem Bericht sind die Wahrheit: sie werden übertragen.
  for (const u of attackerFleet.units) {
    const after = report.attacker.units.find((x) => x.id === u.id);
    if (after) u.count = Math.max(0, after.count);
  }
  attackerFleet.morale = Math.max(5, Math.min(MORALE_MAX, report.attacker.morale));

  if (defenderFleet) {
    for (const u of defenderFleet.units) {
      const after = report.defender.units.find((x) => x.id === u.id);
      if (after) u.count = Math.max(0, after.count);
    }
    defenderFleet.morale = Math.max(5, Math.min(MORALE_MAX, report.defender.morale));
  } else if (system) {
    const garrison = { ...system.garrison };
    for (const u of report.defender.units) {
      const role = u.role;
      garrison[role] = Math.max(0, u.count);
    }
    system.garrison = garrison;
    system.shield.down = report.shield ? report.shield.down : system.shield.down;
  }

  if (attackerFaction) {
    attackerFaction.stats.battles += 1;
    attackerFaction.stats.losses += summary.totalAttacker;
    attackerFaction.stats.kills += summary.totalDefender;
  }
  if (defenderFaction) {
    defenderFaction.stats.battles += 1;
    defenderFaction.stats.losses += summary.totalDefender;
    defenderFaction.stats.kills += summary.totalAttacker;
  }

  const won = report.winner === 'angreifer';
  if (attackerFaction) won ? attackerFaction.stats.won++ : attackerFaction.stats.lost++;
  if (defenderFaction) won ? defenderFaction.stats.lost++ : defenderFaction.stats.won++;

  // Erfahrung für die Überlebenden - die Sieger lernen mehr.
  gainExperience(attackerFleet, won ? 9 : 5);
  if (defenderFleet) gainExperience(defenderFleet, won ? 5 : 9);

  // Beute: Kredits aus dem Wrackfeld. Der Landreich lebt davon.
  if (won && attackerFaction) {
    const loot = Math.round(summary.totalDefender * 9
      * (1 + rulerTraitSum(attackerFaction.ruler, 'loot'))
      * (attackerFaction.id === 'landreich' ? 1.5 : 1));
    attackerFaction.credits += loot;
    if (attackerFaction.isPlayer && loot > 0) {
      logMsg(state, `Bergung aus dem Trümmerfeld: ${loot} Kredits.`, 'kredits');
    }
  }

  // Der Verlierer weicht zurück oder ist weg.
  if (defenderFleet) {
    if (!won) {
      retreatFleet(state, attackerFleet);
    } else {
      retreatFleet(state, defenderFleet);
    }
  } else if (system) {
    if (won) tryCapture(state, attackerFleet, system, report);
    else retreatFleet(state, attackerFleet);
  }

  cleanupFleet(state, attackerFleet);
  if (defenderFleet) cleanupFleet(state, defenderFleet);
  state.lastBattle = report;
  logBattle(state, report, summary);
  return report;
}

function gainExperience(fleet, amount) {
  for (const u of fleet.units) {
    if (u.count <= 0) continue;
    u.exp = Math.min(100, (u.exp || 0) + amount);
  }
}

// Zurück zum nächsten eigenen Hafen - und wenn es keinen gibt, bleibt die
// Flotte stehen, wo sie steht.
export function retreatFleet(state, fleet) {
  if (!state.fleets.includes(fleet)) return;
  const home = nearestOwnSystem(state, fleet.factionId, fleet.col, fleet.row);
  fleet.morale = Math.max(5, fleet.morale - (fleet.factionId === 'kilrathi' ? 12 : 6));
  fleet.movement = 0;
  fleet.stance = 'normal';
  if (!home) return;
  const dc = Math.sign(home.col - fleet.col);
  const dr = Math.sign(home.row - fleet.row);
  for (let step = 0; step < 2; step++) {
    const t = tileAt(state.map, fleet.col + dc, fleet.row + dr);
    if (!t || t.type === TILE_TYPES.RIFT) break;
    if (hostileAt(state, fleet.factionId, t.col, t.row)) break;
    fleet.col = t.col;
    fleet.row = t.row;
  }
}

// Eine Welt fällt, wenn drei Dinge zusammenkommen: die Wache ist geschlagen,
// der Schild ist unten, und es sind Landungstruppen da.
export function tryCapture(state, fleet, system, report) {
  const garrisonLeft = garrisonTotal(system);
  const marines = fleetRoleCount(fleet, 'marines');
  const shieldDown = !system.shield.level || system.shield.down >= 0.999;
  // Gemeldet wird nur, was den Spieler angeht: sein Sturm oder seine Welt.
  // Sonst stünde in der Chronik jeder fehlgeschlagene Angriff der halben
  // Karte.
  const me = state.playerFactionId;
  const mine = fleet.factionId === me || system.factionId === me;
  const note = (text) => { if (mine) logMsg(state, text, 'gefecht'); };
  if (garrisonLeft > 0) {
    note(`${system.name} hält: die Wache steht noch.`);
    return false;
  }
  if (!shieldDown) {
    note(`${system.name} liegt unter Feuer, aber der Schild steht `
      + `(${Math.round(system.shield.down * 100)}%). Bomber müssen ihn erst niederdrücken.`);
    return false;
  }
  if (marines <= 0) {
    note(`${system.name} ist wehrlos - aber ohne Landungstruppen `
      + 'nimmt niemand eine Welt.');
    return false;
  }
  captureSystem(state, system, fleet.factionId, fleet);
  return true;
}

export function captureSystem(state, system, factionId, fleet = null) {
  const from = system.factionId;
  const faction = factionById(state, factionId);
  const oldFaction = factionById(state, from);
  system.factionId = factionId;
  system.shield.down = 0;
  system.shield.level = Math.max(0, system.shield.level - 1);
  system.shield.building = null;
  system.siege = null;
  system.blockade = null;
  system.training = [];
  system.unrest = Math.min(10, 4 + (system.capital ? 4 : 0));
  system.garrison = { [WATCH_ROLE]: Math.max(2, Math.round(watchTarget(system, faction) * 0.4)) };
  // Die Landungstruppen bleiben unten: sie werden zur neuen Wache.
  if (fleet) {
    const marines = fleet.units.find((u) => u.role === 'marines' && u.count > 0);
    if (marines) {
      const landed = Math.max(1, Math.ceil(marines.count / 2));
      marines.count -= landed;
      system.garrison[WATCH_ROLE] += landed * 2;
      cleanupFleet(state, fleet);
    }
    fleet.col = system.col;
    fleet.row = system.row;
  }
  if (faction) {
    faction.stats.systemsTaken += 1;
    const tier = sizeTier(system.size);
    const loot = Math.round(tier.income * 2.5 * (1 + rulerTraitSum(faction.ruler, 'loot')));
    faction.credits += loot;
  }
  if (from !== 'neutral') adjustRelation(state, factionId, from, -12);
  if (factionId === state.playerFactionId || from === state.playerFactionId
    || hasSeen(state, system.col, system.row)) {
    logMsg(state, `${system.name} ist gefallen - ${faction ? faction.name : factionId} `
      + `nimmt das System${oldFaction ? ` von ${oldFaction.name}` : ''}.`, 'eroberung');
  }
  pushNews(state, {
    kind: 'eroberung', a: factionId, b: from,
    text: `${faction ? faction.short : factionId} erobert ${system.name}.`,
  });
  // Wer seine Hauptwelt verliert, verliert nicht das Reich - aber die
  // Hauptstadt zieht weiter.
  if (system.capital && oldFaction) {
    system.capital = false;
    const rest = systemsOf(state, from);
    if (rest.length) {
      const next = rest.sort((a, b) => b.size - a.size)[0];
      next.capital = true;
      logMsg(state, `${oldFaction.name} verlegt das Hauptquartier nach ${next.name}.`, 'reich');
    } else {
      oldFaction.alive = false;
      logMsg(state, `${oldFaction.name} ist besiegt.`, 'reich');
    }
  }
  if (oldFaction && !systemsOf(state, from).length) {
    oldFaction.alive = false;
  }
  return true;
}

function logBattle(state, report, summary) {
  const winner = report.winner === 'angreifer' ? report.attacker.factionId : report.defender.factionId;
  const me = state.playerFactionId;
  if (report.attacker.factionId !== me && report.defender.factionId !== me) return;
  const mine = report.attacker.factionId === me ? 'attacker' : 'defender';
  const good = winner === me;
  logMsg(state, `${report.attacker.name} gegen ${report.defender.name} `
    + `(${report.terrain}): ${good ? 'Sieg' : report.winner === 'unentschieden' ? 'unentschieden' : 'Niederlage'}. `
    + `Eigene Verluste: ${lossesText(mine === 'attacker' ? summary.lossesAttacker : summary.lossesDefender, me)}.`,
  good ? 'sieg' : 'niederlage');
}

// --- Werften: Schiffe bauen ---------------------------------------------
// Gebaut wird in Systemen, nicht in Flotten: ein Kiel liegt Züge lang auf
// der Werft und rückt dann in die Garnison ein.
export function canBuildRole(state, system, role) {
  const need = ROLE_REQUIRES[role];
  if (!need) return true;
  const b = system.buildings[need.building];
  return !!b && b.level >= need.level;
}

export function buildShip(state, system, role) {
  const faction = factionById(state, system.factionId);
  if (!faction) return { ok: false, text: 'Das System gehört niemandem.' };
  if (!canBuildRole(state, system, role)) {
    const need = ROLE_REQUIRES[role];
    return { ok: false, text: `Dafür braucht ${system.name} eine ${buildingName(need.building)} der Stufe ${need.level}.` };
  }
  const def = unitDefs(system.factionId)[role];
  if (faction.credits < def.cost) return { ok: false, text: 'Nicht genug Kredits.' };
  const slots = sizeTier(system.size).buildSlots;
  if (system.training.length >= slots) {
    return { ok: false, text: `${system.name} hat nur ${slots} Bauplätze - erst muss etwas fertig werden.` };
  }
  faction.credits -= def.cost;
  const speed = hasGreatWork(state, system.factionId, 'werften') ? 0.75 : 1;
  system.training.push({
    id: makeId('bau'),
    role,
    turnsLeft: Math.max(1, Math.round(def.time * speed)),
    total: Math.max(1, Math.round(def.time * speed)),
    cost: def.cost,
  });
  return { ok: true, text: `${def.name} liegt auf der Werft von ${system.name} (${def.time} Züge).` };
}

export function cancelTraining(state, system, id) {
  const idx = system.training.findIndex((t) => t.id === id);
  if (idx < 0) return { ok: false, text: 'Da liegt nichts.' };
  const job = system.training[idx];
  const faction = factionById(state, system.factionId);
  system.training.splice(idx, 1);
  if (faction) faction.credits += Math.round(job.cost * 0.5);
  return { ok: true, text: `Der Kiel wird abgebrochen, die Hälfte kommt zurück.` };
}

export function advanceTraining(state, factionId) {
  for (const sys of systemsOf(state, factionId)) {
    if (sys.siege) continue; // Unter Belagerung wird nicht gebaut.
    for (const job of [...sys.training]) {
      job.turnsLeft -= 1;
      if (job.turnsLeft > 0) continue;
      sys.training = sys.training.filter((t) => t.id !== job.id);
      const defs = unitDefs(factionId);
      const def = defs[job.role];
      sys.garrison[job.role] = (sys.garrison[job.role] || 0) + def.staffel;
      if (factionId === state.playerFactionId) {
        logMsg(state, `${def.name} in ${sys.name} fertig - sie liegt in der Garnison.`, 'werft');
      }
    }
  }
}

// --- Flotten aus der Garnison -------------------------------------------
// Was in einem System liegt, ist keine Flotte, bis man sie aufstellt.
export function raiseFleet(state, system, roleCounts = null) {
  const field = garrisonFieldUnits(system);
  const entries = Object.entries(roleCounts || field).filter(([role, n]) => n > 0 && field[role]);
  if (!entries.length) return { ok: false, text: `In ${system.name} liegt nichts, was ausrücken könnte.` };
  const defs = unitDefs(system.factionId);
  const units = [];
  for (const [role, wanted] of entries) {
    const have = field[role] || 0;
    const take = Math.min(have, wanted);
    if (take <= 0) continue;
    system.garrison[role] = have - take;
    // Aus Maschinen werden Verbände: je Staffelstärke ein Verband.
    let rest = take;
    while (rest > 0) {
      const size = Math.min(rest, defs[role].staffel);
      units.push({ role, count: size, exp: academyExperience(system) });
      rest -= size;
    }
  }
  if (!units.length) return { ok: false, text: 'Nichts ausgerückt.' };
  const fleet = createFleet(state, system.factionId, system.col, system.row, units, {});
  // Ein neues Kommando bekommt manchmal ein Ass - wer eines übrig hat.
  const free = state.aces.find((a) => a.factionId === system.factionId && a.alive && !a.fleetId);
  if (free) {
    free.fleetId = fleet.id;
    fleet.ace = { ...free };
  } else if (Math.random() < 0.2) {
    attachAce(state, fleet);
  }
  fleet.movement = 0;
  return { ok: true, text: `${fleet.name} rückt aus ${system.name} aus.`, fleet };
}

function academyExperience(system) {
  const a = system.buildings.akademie;
  if (!a || !a.level) return 0;
  return BUILDING_DEFS.akademie.experience[a.level - 1] || 0;
}

// Eine Flotte legt sich in ein eigenes System - sie wird wieder Garnison.
export function disbandIntoSystem(state, fleet) {
  const sys = systemAt(state, fleet.col, fleet.row);
  if (!sys || sys.factionId !== fleet.factionId) {
    return { ok: false, text: 'Das geht nur über einem eigenen System.' };
  }
  for (const u of fleet.units) {
    sys.garrison[u.role] = (sys.garrison[u.role] || 0) + u.count;
  }
  fleet.units = [];
  cleanupFleet(state, fleet);
  return { ok: true, text: `Die Verbände liegen wieder in ${sys.name}.` };
}

export function mergeFleets(state, a, b) {
  if (a.factionId !== b.factionId) return { ok: false, text: 'Fremde Flotten schließen sich nicht zusammen.' };
  if (a.col !== b.col || a.row !== b.row) return { ok: false, text: 'Sie stehen nicht auf demselben Feld.' };
  for (const u of b.units) a.units.push({ ...u, id: makeId('unt') });
  // Zwei Flotten mit je zwei Jägerstaffeln ergeben eine Flotte mit einer
  // Jägerstaffel doppelter Sollstärke - nicht vier Zeilen untereinander.
  tidyUnits(a);
  a.morale = Math.round((a.morale + b.morale) / 2);
  a.movement = Math.min(a.movement, b.movement);
  if (!a.ace && b.ace) {
    a.ace = b.ace;
    const rec = state.aces.find((x) => x.fleetId === b.id);
    if (rec) rec.fleetId = a.id;
  }
  b.units = [];
  state.fleets = state.fleets.filter((f) => f.id !== b.id);
  return { ok: true, text: `${b.name} geht in ${a.name} auf.` };
}

// Auffrischen: leere Verbände wieder auf Staffelstärke bringen. Geht nur
// über einem eigenen System mit Werft, und kostet.
export function reinforceFleet(state, fleet) {
  const sys = systemAt(state, fleet.col, fleet.row);
  if (!sys || sys.factionId !== fleet.factionId) {
    return { ok: false, text: 'Aufgefrischt wird über eigenem Gebiet.' };
  }
  const faction = factionById(state, fleet.factionId);
  const defs = unitDefs(fleet.factionId);
  let cost = 0;
  const missing = [];
  for (const u of fleet.units) {
    const def = defs[u.role];
    const cap = u.max || def.staffel;
    const gap = Math.max(0, cap - u.count);
    if (!gap) continue;
    missing.push({ u, gap, def, cap });
    cost += Math.round((def.cost / def.staffel) * gap * REINFORCE_COST_FACTOR);
  }
  if (!missing.length) return { ok: false, text: 'Die Flotte ist vollzählig.' };
  if (faction.credits < cost) {
    return { ok: false, text: `Auffrischen kostet ${cost} Kredits - so viel ist nicht da.` };
  }
  faction.credits -= cost;
  for (const m of missing) {
    m.u.count += m.gap;
    // Neue Piloten senken den Schnitt der Erfahrung.
    m.u.exp = Math.round((m.u.exp || 0) * (m.cap - m.gap) / Math.max(1, m.cap));
  }
  fleet.morale = Math.min(MORALE_MAX, fleet.morale + 8);
  return { ok: true, text: `${fleet.name} ist wieder vollzählig (${cost} Kredits).` };
}

// --- Schilde und Ausbauten ----------------------------------------------
export function buildShield(state, system) {
  const faction = factionById(state, system.factionId);
  if (system.shield.level >= MAX_SHIELD_LEVEL) return { ok: false, text: 'Stärker geht es nicht.' };
  if (system.shield.building) return { ok: false, text: 'Der Ausbau läuft schon.' };
  const next = SHIELD_LEVELS[system.shield.level + 1];
  if (faction.credits < next.cost) return { ok: false, text: `${next.name} kostet ${next.cost} Kredits.` };
  faction.credits -= next.cost;
  const speed = hasGreatWork(state, system.factionId, 'werften') ? 0.75 : 1;
  system.shield.building = { level: system.shield.level + 1, turnsLeft: Math.max(1, Math.round(next.time * speed)) };
  return { ok: true, text: `${next.name} über ${system.name} wird aufgebaut.` };
}

export function buyBuilding(state, system, id) {
  const def = BUILDING_DEFS[id];
  if (!def) return { ok: false, text: 'Das gibt es nicht.' };
  const faction = factionById(state, system.factionId);
  const cur = system.buildings[id] || { level: 0, building: null };
  if (cur.building) return { ok: false, text: `${def.name} wird schon gebaut.` };
  if (cur.level >= def.maxLevel) return { ok: false, text: `${def.name} ist voll ausgebaut.` };
  const info = def.levels[cur.level];
  if (faction.credits < info.cost) return { ok: false, text: `${def.name} kostet ${info.cost} Kredits.` };
  const slots = sizeTier(system.size).buildSlots;
  const running = Object.values(system.buildings).filter((b) => b.building).length
    + (system.shield.building ? 1 : 0);
  if (running >= slots) return { ok: false, text: `${system.name} hat nur ${slots} Bauplätze.` };
  faction.credits -= info.cost;
  const speed = hasGreatWork(state, system.factionId, 'werften') ? 0.75 : 1;
  system.buildings[id] = {
    level: cur.level,
    building: { level: cur.level + 1, turnsLeft: Math.max(1, Math.round(info.time * speed)) },
  };
  return { ok: true, text: `${def.name} (Stufe ${cur.level + 1}) in ${system.name} begonnen.` };
}

export function advanceConstruction(state, factionId) {
  for (const sys of systemsOf(state, factionId)) {
    if (sys.siege) continue;
    if (sys.shield.building) {
      sys.shield.building.turnsLeft -= 1;
      if (sys.shield.building.turnsLeft <= 0) {
        sys.shield.level = sys.shield.building.level;
        sys.shield.building = null;
        sys.shield.down = 0;
        if (factionId === state.playerFactionId) {
          logMsg(state, `${shieldInfo(sys.shield.level).name} über ${sys.name} steht.`, 'bau');
        }
      }
    }
    for (const [id, b] of Object.entries(sys.buildings)) {
      if (!b.building) continue;
      b.building.turnsLeft -= 1;
      if (b.building.turnsLeft <= 0) {
        b.level = b.building.level;
        b.building = null;
        if (factionId === state.playerFactionId) {
          logMsg(state, `${buildingName(id)} (Stufe ${b.level}) in ${sys.name} fertig.`, 'bau');
        }
      }
    }
  }
}

// --- Forschung ------------------------------------------------------------
export function startResearch(state, factionId, lineId) {
  const faction = factionById(state, factionId);
  const line = TECH_LINES[lineId];
  if (!line) return { ok: false, text: 'Diese Linie gibt es nicht.' };
  if (faction.research) return { ok: false, text: 'Es wird schon geforscht.' };
  const level = faction.tech[lineId] || 0;
  if (level >= MAX_TECH_LEVEL) return { ok: false, text: `${line.name} ist am Ende der Linie.` };
  const step = techStep(lineId, level);
  if (faction.credits < step.cost) return { ok: false, text: `${line.name} Stufe ${level + 1} kostet ${step.cost} Kredits.` };
  faction.credits -= step.cost;
  faction.research = { line: lineId, level: level + 1, turnsLeft: 3 + level * 2 };
  return { ok: true, text: `${line.name} Stufe ${level + 1}: die Werften arbeiten daran.` };
}

export function advanceResearch(state, factionId) {
  const faction = factionById(state, factionId);
  if (!faction || !faction.research) return;
  faction.research.turnsLeft -= 1;
  if (faction.research.turnsLeft > 0) return;
  const { line, level } = faction.research;
  faction.tech[line] = level;
  faction.research = null;
  if (factionId === state.playerFactionId) {
    logMsg(state, `${TECH_LINES[line].name} Stufe ${level} erreicht: ${techStep(line, level - 1).note}.`, 'technik');
  }
}

// --- Belagerung und Blockade --------------------------------------------
// Man kann eine Welt auch nehmen, ohne sie zu stürmen: einschließen, bis
// die Wache nichts mehr zu essen hat.
export function besiegeSystem(state, fleet) {
  const sys = systemAt(state, fleet.col, fleet.row);
  if (!sys) return { ok: false, text: 'Hier ist kein System.' };
  if (sys.factionId === fleet.factionId) return { ok: false, text: 'Das ist die eigene Welt.' };
  if (!atWar(state, fleet.factionId, sys.factionId) && sys.factionId !== 'neutral') {
    return { ok: false, text: 'Dazu müsste Krieg sein.' };
  }
  sys.siege = { factionId: fleet.factionId, fleetId: fleet.id, turns: 0 };
  fleet.stance = 'belagern';
  fleet.movement = 0;
  return { ok: true, text: `${fleet.name} schließt ${sys.name} ein.` };
}

export function liftSiege(state, fleet) {
  const sys = systemAt(state, fleet.col, fleet.row);
  if (sys && sys.siege && sys.siege.fleetId === fleet.id) sys.siege = null;
  fleet.stance = 'normal';
  return { ok: true, text: 'Die Einschließung ist aufgehoben.' };
}

export function blockadeSystem(state, fleet) {
  const sys = systemAt(state, fleet.col, fleet.row);
  if (!sys || sys.factionId === fleet.factionId) return { ok: false, text: 'Hier gibt es nichts zu blockieren.' };
  sys.blockade = { factionId: fleet.factionId, fleetId: fleet.id };
  fleet.stance = 'blockade';
  return { ok: true, text: `${sys.name} ist blockiert - seine Kassen bleiben leer.` };
}

// Jeden Zug: Belagerungen zehren, Schilde wachsen nach, Unruhe fällt.
export function updateSieges(state) {
  for (const sys of state.systems) {
    // Eine Belagerung endet, wenn die belagernde Flotte weg ist.
    if (sys.siege) {
      const fleet = state.fleets.find((f) => f.id === sys.siege.fleetId
        && f.col === sys.col && f.row === sys.row);
      if (!fleet) { sys.siege = null; }
      else {
        sys.siege.turns += 1;
        const bite = SIEGE_ATTRITION + Math.floor(sys.siege.turns / 2);
        for (const role of Object.keys(sys.garrison)) {
          sys.garrison[role] = Math.max(0, sys.garrison[role] - Math.ceil(bite / 3));
        }
        sys.unrest = Math.min(10, sys.unrest + 1);
        // Der Schild fällt mit der Zeit: irgendwann ist der Reaktor leer.
        sys.shield.down = Math.min(1, sys.shield.down + 0.12);
        if (garrisonTotal(sys) <= 0 && sys.shield.down >= 0.999) {
          const marines = fleetRoleCount(fleet, 'marines');
          if (marines > 0) captureSystem(state, sys, fleet.factionId, fleet);
        }
      }
    }
    if (sys.blockade) {
      const fleet = state.fleets.find((f) => f.id === sys.blockade.fleetId
        && f.col === sys.col && f.row === sys.row);
      if (!fleet) sys.blockade = null;
    }
    // Ohne Belagerung erholt sich alles langsam.
    if (!sys.siege) {
      sys.shield.down = Math.max(0, sys.shield.down - 0.2);
      sys.unrest = Math.max(0, sys.unrest - 0.5);
    }
  }
}

// Die Wache wächst nach - bis zu dem, was die Bevölkerung tragen kann.
export function regenerateGarrisons(state, factionId) {
  for (const sys of systemsOf(state, factionId)) {
    if (sys.siege) continue;
    const faction = factionById(state, factionId);
    const target = watchTarget(sys, faction);
    const have = sys.garrison[WATCH_ROLE] || 0;
    if (have < target) {
      sys.garrison[WATCH_ROLE] = Math.min(target, have + Math.max(1, Math.round(target / 8)));
    }
  }
}

// --- Wirtschaft -----------------------------------------------------------
export function systemIncome(state, system) {
  const tier = sizeTier(system.size);
  let income = tier.income + system.population * CREDITS_PER_POPULATION;
  const mine = system.buildings.bergbau;
  if (mine && mine.level) income += BUILDING_DEFS.bergbau.income[mine.level - 1];
  const trade = system.buildings.handel;
  if (trade && trade.level) {
    const routes = state.tradeRoutes.filter((r) => r.a === system.id || r.b === system.id).length;
    income += routes * TRADE_ROUTE_BASE * trade.level;
  }
  if (system.greatWork === 'basar') income += 180;
  income *= 1 - Math.min(0.5, system.unrest * 0.05);
  if (system.blockade) income *= 1 - BLOCKADE_INCOME_LOSS;
  if (system.siege) income = 0;
  return Math.round(income);
}

export function upkeepOf(state, factionId) {
  const defs = unitDefs(factionId);
  const faction = factionById(state, factionId);
  let units = 0;
  let upkeep = 0;
  for (const fleet of fleetsOf(state, factionId)) {
    for (const u of fleet.units) {
      units += 1;
      upkeep += defs[u.role].upkeep * (u.count / Math.max(1, defs[u.role].staffel));
    }
  }
  // Die ersten Verbände sind frei: ein kleines Reich erdrückt sich nicht
  // selbst an seiner Flotte.
  const free = Math.min(units, UPKEEP_FREE_UNITS);
  upkeep *= Math.max(0, (units - free) / Math.max(1, units));
  if (faction) upkeep *= 1 + rulerTraitSum(faction.ruler, 'upkeep');
  return Math.round(upkeep);
}

export function collectIncome(state, factionId) {
  const faction = factionById(state, factionId);
  if (!faction || faction.isNeutral) return { income: 0, upkeep: 0, net: 0 };
  let income = BASE_INCOME;
  for (const sys of systemsOf(state, factionId)) income += systemIncome(state, sys);
  const upkeep = upkeepOf(state, factionId);
  const net = income - upkeep;
  faction.credits = Math.max(0, faction.credits + net);
  // Wer nicht zahlen kann, verliert Verbände: die Flotte löst sich auf.
  if (net < 0 && faction.credits <= 0) {
    const fleets = fleetsOf(state, factionId);
    if (fleets.length) {
      const worst = fleets[fleets.length - 1];
      const unit = worst.units[worst.units.length - 1];
      if (unit) {
        unit.count = 0;
        cleanupFleet(state, worst);
        if (faction.isPlayer) {
          logMsg(state, 'Die Kassen sind leer - ein Verband wird abgemustert.', 'kredits');
        }
      }
    }
  }
  return { income, upkeep, net };
}

export function growPopulations(state, factionId) {
  for (const sys of systemsOf(state, factionId)) {
    if (sys.siege) { sys.population = Math.max(1, Math.round(sys.population * 0.97)); continue; }
    const tier = sizeTier(sys.size);
    const terra = sys.buildings.terraformer;
    const rate = 0.012 * (terra && terra.level ? BUILDING_DEFS.terraformer.growth[terra.level - 1] : 1);
    const cap = tier.populationCapital * 1.2;
    sys.population = Math.min(cap, Math.round((sys.population * (1 + rate)) * 10) / 10);
    // Wächst eine Welt über ihren Rang hinaus, steigt sie auf - dafür ist
    // der Terraformer da.
    if (sys.size < 5 && sys.population > sizeTier(sys.size + 1).population * 1.05
      && terra && terra.level >= 2) {
      sys.size += 1;
      if (factionId === state.playerFactionId) {
        logMsg(state, `${sys.name} steigt auf: ${sizeTier(sys.size).label}.`, 'reich');
      }
    }
  }
}

// --- Handelsrouten --------------------------------------------------------
export function openTradeRoute(state, a, b) {
  if (!a || !b || a.id === b.id) return { ok: false, text: 'Eine Route braucht zwei Häfen.' };
  const faction = factionById(state, a.factionId);
  if (!a.buildings.handel || !a.buildings.handel.level) {
    return { ok: false, text: `${a.name} hat keine Handelsstation.` };
  }
  if (!b.buildings.handel || !b.buildings.handel.level) {
    return { ok: false, text: `${b.name} hat keine Handelsstation.` };
  }
  if (atWar(state, a.factionId, b.factionId)) return { ok: false, text: 'Mit Kriegsgegnern wird nicht gehandelt.' };
  const mine = state.tradeRoutes.filter((r) => r.owner === a.factionId).length;
  if (mine >= TRADE_ROUTE_MAX) return { ok: false, text: `Mehr als ${TRADE_ROUTE_MAX} Routen trägt die Flotte nicht.` };
  if (state.tradeRoutes.some((r) => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id))) {
    return { ok: false, text: 'Diese Route läuft schon.' };
  }
  state.tradeRoutes.push({ id: makeId('route'), a: a.id, b: b.id, owner: a.factionId, since: state.turn });
  return { ok: true, text: `Handelsroute ${a.name} – ${b.name} eröffnet (${b.goods}).` };
}

export function closeTradeRoute(state, id) {
  state.tradeRoutes = state.tradeRoutes.filter((r) => r.id !== id);
  return { ok: true, text: 'Route geschlossen.' };
}

// Routen, deren Enden nicht mehr zusammenpassen, fallen weg.
export function pruneTradeRoutes(state) {
  state.tradeRoutes = state.tradeRoutes.filter((r) => {
    const a = systemById(state, r.a);
    const b = systemById(state, r.b);
    if (!a || !b) return false;
    if (a.factionId !== r.owner && b.factionId !== r.owner) return false;
    if (atWar(state, a.factionId, b.factionId)) return false;
    if (a.siege || b.siege) return false;
    return true;
  });
}

// --- Moral und Erholung --------------------------------------------------
export function recoverFleets(state, factionId) {
  for (const fleet of fleetsOf(state, factionId)) {
    const sys = systemAt(state, fleet.col, fleet.row);
    const atHome = sys && sys.factionId === factionId;
    let gain = atHome ? 7 : 3;
    if (fleet.ace && fleet.ace.bonus === 'moral' && fleet.ace.alive) gain += 2;
    if (hasGreatWork(state, factionId, 'nesthort')) gain += 2;
    // Wer tief im Feindesland steht, ohne Nachschub, verliert Moral.
    const supply = nearestOwnSystem(state, factionId, fleet.col, fleet.row);
    if (supply && tileDistance(fleet, supply) > 9) gain -= 5;
    fleet.morale = Math.max(10, Math.min(MORALE_MAX, fleet.morale + gain));
  }
}

export function setTactic(state, factionId, kind, tacticId) {
  const faction = factionById(state, factionId);
  const t = TACTICS[tacticId];
  if (!faction || !t) return { ok: false, text: 'Diese Schlachtordnung gibt es nicht.' };
  if (kind === 'angriff') faction.tacticAttack = tacticId;
  else faction.tacticDefence = tacticId;
  return { ok: true, text: `${t.name} ist jetzt die ${kind === 'angriff' ? 'Angriffs' : 'Verteidigungs'}ordnung.` };
}

// --- Sieg und Niederlage -------------------------------------------------
export function checkVictory(state) {
  const me = state.playerFactionId;
  const faction = factionById(state, me);
  const mine = systemsOf(state, me);
  if (!mine.length) {
    state.victory = { kind: 'niederlage', text: 'Das Reich hat kein System mehr. Der Feldzug ist verloren.' };
    return state.victory;
  }
  const rivalId = RIVAL_OF[me];
  const rival = rivalId ? factionById(state, rivalId) : null;
  if (rival && !rival.alive) {
    state.victory = {
      kind: 'sieg', text: `${rival.name} ist besiegt. Der Krieg ist entschieden.`,
    };
    return state.victory;
  }
  const rivalCapital = rivalId ? state.systems.find((s) => s.name === (rivalId === 'kilrathi' ? 'Kilrah' : 'Sol')) : null;
  if (rivalCapital && rivalCapital.factionId === me) {
    state.victory = {
      kind: 'sieg', text: `${rivalCapital.name} ist genommen. Das gegnerische Reich hat sein Herz verloren.`,
    };
    return state.victory;
  }
  if (mine.length >= VICTORY_SYSTEMS) {
    state.victory = {
      kind: 'sieg', text: `${mine.length} Systeme unter einer Flagge - der bekannte Raum gehört dir.`,
    };
    return state.victory;
  }
  return null;
}

// Was am Ende eines Zuges für eine Fraktion geschieht - Reihenfolge zählt.
export function endOfTurnFor(state, factionId) {
  advanceTraining(state, factionId);
  advanceConstruction(state, factionId);
  advanceResearch(state, factionId);
  regenerateGarrisons(state, factionId);
  growPopulations(state, factionId);
  recoverFleets(state, factionId);
  return collectIncome(state, factionId);
}

export { previewBattle };
