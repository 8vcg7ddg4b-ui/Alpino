// --- Der Weltzustand ------------------------------------------------------
// Ein Feldzug ist ein einziges Objekt: Karte, Systeme, Flotten, Fraktionen,
// Diplomatie, Chronik. Alles andere im Spiel liest daraus oder schreibt
// hinein - gespeichert wird genau das.
import {
  FACTIONS, SYSTEM_TILES, STARTING_CREDITS, MAX_MOVEMENT, MORALE_START,
  DEFAULT_SYSTEM_SIZE, sizeTier, watchTarget, startingShieldLevel,
  DEFAULT_PLAYER_FACTION, WATCH_ROLE, UNIT_ROLES, unitDefs, GREAT_WORKS,
  DEFAULT_TACTIC, TILE_TYPES, techMoveBonus, TRADE_GOODS, MAX_TECH_LEVEL,
} from './data.js';
import { generateMap, tileAt } from './mapgen.js';
import { GRID_COLS, GRID_ROWS } from './starchart.js';
import { initRelations, seedKnowledge, declareWar } from './diplomacy.js';
import { rulerFor, rulerTraitSum, drawAce } from './pilots.js';
import { makePrng, pick, rollInt } from './prng.js';

let nextId = 1;
export function makeId(prefix) {
  return `${prefix}_${nextId++}`;
}
export function resetIds(value = 1) {
  nextId = value;
}

export function createInitialState(playerFactionId = DEFAULT_PLAYER_FACTION, scenario = null) {
  const map = generateMap();
  const rnd = makePrng(scenario && scenario.seed ? scenario.seed : 4711);

  const chosen = FACTIONS.some((f) => f.id === playerFactionId && !f.isNeutral && !f.isInvader)
    ? playerFactionId : DEFAULT_PLAYER_FACTION;

  const factions = FACTIONS.map((f) => ({
    id: f.id,
    name: f.name,
    short: f.short,
    color: f.color,
    colorDark: f.colorDark,
    accent: f.accent,
    isNeutral: !!f.isNeutral,
    isInvader: !!f.isInvader,
    isPlayer: f.id === chosen,
    alive: true,
    credits: f.isNeutral ? 0 : STARTING_CREDITS,
    ruler: f.isNeutral || f.isInvader ? rulerFor(f.id) : rulerFor(f.id),
    tech: { triebwerke: 0, waffen: 0, schilde: 0 },
    research: null,
    tacticAttack: DEFAULT_TACTIC.angriff,
    tacticDefence: DEFAULT_TACTIC.verteidigung,
    // Was ein Reich im Feldzug angerichtet hat - für den Abschlussbericht.
    stats: { battles: 0, won: 0, lost: 0, systemsTaken: 0, losses: 0, kills: 0 },
  }));

  const state = {
    version: 1,
    turn: 1,
    playerFactionId: chosen,
    scenarioId: scenario ? scenario.id : 'vega',
    map,
    factions,
    systems: [],
    fleets: [],
    tradeRoutes: [],
    log: [],
    aces: [],
    usedAceNames: [],
    seen: {},
    // Startbasen: Militärbasen in Trümmerfeldern. Von ihnen starten Jäger
    // und Bomber, wenn kein Träger dabei ist - ohne eine solche Basis fliegt
    // eine Staffel nur halb.
    bases: [],
    victory: null,
    nephilimTurn: null,
    lastBattle: null,
  };

  // --- Die Systeme --------------------------------------------------------
  state.systems = SYSTEM_TILES.map((def) => {
    const factionId = (scenario && scenario.systemOverrides && scenario.systemOverrides[def.name])
      || def.factionId;
    const faction = factions.find((f) => f.id === factionId);
    const size = def.size || DEFAULT_SYSTEM_SIZE;
    const tier = sizeTier(size);
    const population = def.capital ? tier.populationCapital
      : faction && faction.isNeutral ? tier.populationNeutral : tier.population;
    const sys = {
      id: makeId('sys'),
      name: def.name,
      world: def.world || null,
      col: def.col,
      row: def.row,
      x: def.x,
      y: def.y,
      sector: tileAt(map, def.col, def.row).sector,
      factionId,
      capital: !!def.capital,
      size,
      population,
      // Der Planetenschild: die Mauer dieser Karte. `down` ist, wieviel davon
      // heruntergedrückt ist - erst bei 1 gehen die Truppen hinein.
      shield: { level: startingShieldLevel(def), down: 0, building: null },
      buildings: {},
      // Was auf der Werft liegt: eine Liste, weil eine Hauptwelt mehrere
      // Kiele gleichzeitig hat.
      training: [],
      garrison: { [WATCH_ROLE]: watchTarget({ size, capital: def.capital }, faction) },
      siege: null,
      blockade: null,
      unrest: 0,
      goods: pick(rnd, TRADE_GOODS),
      greatWork: null,
      foundedTurn: 1,
    };
    // Hauptwelten und Kernwelten starten mit dem, was sie brauchen: die
    // Konföderation hat 2654 Werften, die Grenzwelten haben Schrottplätze.
    if (sys.capital) {
      sys.buildings.werft = { level: factionId === 'confed' || factionId === 'kilrathi' ? 3 : 2, building: null };
      sys.buildings.bergbau = { level: 1, building: null };
      sys.buildings.handel = { level: 1, building: null };
      sys.buildings.sensor = { level: 1, building: null };
      sys.buildings.geschuetz = { level: 1, building: null };
    } else if (size >= 4) {
      sys.buildings.werft = { level: 2, building: null };
      sys.buildings.bergbau = { level: 1, building: null };
    } else if (size >= 3) {
      sys.buildings.werft = { level: 1, building: null };
    }
    tileAt(map, def.col, def.row).systemId = sys.id;
    return sys;
  });

  // Die Großen Werke liegen fest. Wer das System hält, hat das Werk.
  for (const gw of GREAT_WORKS) {
    const sys = state.systems.find((s) => s.name === gw.system);
    if (sys) sys.greatWork = gw.id;
  }

  // --- Diplomatie ---------------------------------------------------------
  initRelations(state);
  seedKnowledge(state);
  if (scenario && scenario.wars) {
    for (const [a, b] of scenario.wars) declareWar(state, a, b, 'Kriegslage bei Feldzugsbeginn');
  }

  // --- Die Startflotten ---------------------------------------------------
  // Jede Fraktion hat ihre Heimatflotte über der Hauptwelt und eine
  // Grenzflotte weiter draußen. Gleich viel für alle: die Wahl der Fraktion
  // ist eine Frage der Lage, nicht der Zahlen.
  for (const f of factions) {
    if (f.isNeutral || f.isInvader) continue;
    const own = state.systems.filter((s) => s.factionId === f.id);
    if (!own.length) { f.alive = false; continue; }
    const home = own.find((s) => s.capital) || own[0];
    const prefix = (FACTIONS.find((x) => x.id === f.id) || {}).fleetPrefix || f.short;
    createFleet(state, f.id, home.col, home.row, [
      { role: 'jaeger', count: 12 },
      { role: 'jaeger', count: 12 },
      { role: 'bomber', count: 8 },
      { role: 'kreuzer', count: 2 },
      { role: 'traeger', count: 1 },
      { role: 'marines', count: 6 },
    ], { name: `${prefix}-Heimatflotte`, ace: true });
    const border = own
      .filter((s) => s !== home)
      .sort((a, b) => b.size - a.size)[0] || home;
    // Das Imperium ist 2654 die Angriffsmacht: es steht mit drei Flotten im
    // Feld, während die anderen zwei aufstellen können.
    if (f.id === 'kilrathi') {
      const front = own.filter((s) => s !== home).sort((a, b) => a.x - b.x)[0] || home;
      createFleet(state, f.id, front.col, front.row, [
        { role: 'jaeger', count: 12 },
        { role: 'jaeger', count: 12 },
        { role: 'bomber', count: 8 },
        { role: 'kreuzer', count: 2 },
        { role: 'marines', count: 6 },
      ], { name: 'Klan-Kriegsflotte', ace: true });
    }
    createFleet(state, f.id, border.col, border.row, [
      { role: 'jaeger', count: 12 },
      { role: 'bomber', count: 8 },
      { role: 'korvette', count: 3 },
      { role: 'marines', count: 6 },
    ], { name: `${prefix}-Grenzflotte` });
  }

  placeBases(state, rnd);

  logMsg(state, `Feldzug beginnt: ${playerFaction(state).name}.`, 'start');
  return state;
}

// --- Startbasen -----------------------------------------------------------
// Eine Jägerstaffel braucht ein Deck. Wo kein Träger mitfliegt, muss eine
// eigene Welt oder eine Militärbasis in Reichweite sein - sonst hängen die
// Maschinen in der Leere und leisten nur die Hälfte. Basen werden in Fels
// gehauen; im freien Raum steht nichts, was nicht selbst fliegt.
const ROCK_NAMES = ['Felsennest', 'Steinbruch', 'Brockenwacht', 'Grubenbasis', 'Trümmerhorst', 'Kieskrone'];

function placeBases(state, rnd) {
  const used = new Set(state.systems.map((sys) => `${sys.col},${sys.row}`));
  let n = 0;
  const add = (kind, name, col, row) => {
    const key = `${col},${row}`;
    if (used.has(key)) return;
    used.add(key);
    state.bases.push({ id: makeId('bas'), kind, name, col, row });
    n += 1;
  };

  for (const f of state.factions) {
    if (f.isNeutral || f.isInvader) continue;
    const home = capitalOf(state, f.id);
    if (!home) continue;
    // Die Militärbasis liegt in einem Trümmerfeld in der Nähe.
    // Sie darf weiter weg liegen: Trümmerfelder gibt es nicht überall, und
    // ohne Basis fliegen die Staffeln eines Reiches nur halb.
    let best = null;
    for (let r = 2; r <= 12 && !best; r++) {
      for (let dr = -r; dr <= r && !best; dr++) {
        for (let dc = -r; dc <= r && !best; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue;
          const col = home.col + dc;
          const row = home.row + dr;
          const tile = tileAt(state.map, col, row);
          if (!tile || tile.type !== TILE_TYPES.ASTEROIDS) continue;
          if (used.has(`${col},${row}`)) continue;
          best = { col, row };
        }
      }
    }
    if (best) add('asteroid', `${ROCK_NAMES[n % ROCK_NAMES.length]}`, best.col, best.row);
  }

  // Ein paar herrenlose Brocken dazu - sie wechseln den Besitzer mit der
  // Grenze, die um sie herum verläuft.
  for (let i = 0; i < 40; i++) {
    if (state.bases.length >= 12) break;
    const col = 4 + Math.floor(rnd() * (GRID_COLS - 8));
    const row = 3 + Math.floor(rnd() * (GRID_ROWS - 6));
    const tile = tileAt(state.map, col, row);
    if (!tile || tile.type !== TILE_TYPES.ASTEROIDS) continue;
    add('asteroid', ROCK_NAMES[(n + 2) % ROCK_NAMES.length], col, row);
  }
}

// --- Flotten --------------------------------------------------------------
// Eine Flotte führt je Art einen Verband, nicht drei nebeneinander: zwei
// Rapier-Staffeln stehen als eine Staffel mit doppelter Sollstärke in der
// Liste. Das liest sich schneller, und gerechnet wird ohnehin über die Zahl
// der Maschinen.
export function tidyUnits(fleet, defsIn = null) {
  if (!fleet || !Array.isArray(fleet.units)) return fleet;
  const defs = defsIn || unitDefs(fleet.factionId);
  const byRole = new Map();
  for (const u of fleet.units) {
    const cap = u.max || (defs[u.role] ? defs[u.role].staffel : u.count) || 1;
    const have = byRole.get(u.role);
    if (!have) {
      byRole.set(u.role, { ...u, max: cap });
      continue;
    }
    // Die Erfahrung mischt sich nach Köpfen, nicht nach Verbänden.
    const total = have.count + u.count;
    have.exp = total > 0
      ? Math.round(((have.exp || 0) * have.count + (u.exp || 0) * u.count) / total)
      : Math.max(have.exp || 0, u.exp || 0);
    have.count = total;
    have.max = have.max + cap;
  }
  fleet.units = [...byRole.values()].filter((u) => u.count > 0 || u.max > 0);
  return fleet;
}

export function createFleet(state, factionId, col, row, unitList, opts = {}) {
  const defs = unitDefs(factionId);
  const fleet = {
    id: makeId('flt'),
    factionId,
    name: opts.name || fleetNameFor(state, factionId),
    col, row,
    units: unitList.map((u) => ({
      id: makeId('unt'),
      role: u.role,
      count: u.count ?? defs[u.role].staffel,
      max: defs[u.role].staffel,
      exp: u.exp ?? (factionId === 'confed' && u.role === 'jaeger' ? 20 : 0),
    })),
    morale: opts.morale ?? MORALE_START,
    movement: MAX_MOVEMENT,
    ace: null,
    stance: 'normal',
    path: null,
    hasMoved: false,
    createdTurn: state.turn,
  };
  tidyUnits(fleet, defs);
  if (opts.ace) attachAce(state, fleet);
  state.fleets.push(fleet);
  // Erst in der Liste kennt der Wegfinder die Flotte - und erst dann steht
  // fest, wie weit sie fliegt (Technik, Herrscher, Ass, Sprungtor).
  fleet.movement = movementMaxFor(state, fleet);
  return fleet;
}

const FLEET_NAMES = ['Erste', 'Zweite', 'Dritte', 'Vierte', 'Fünfte', 'Sechste',
  'Siebte', 'Achte', 'Neunte', 'Zehnte', 'Elfte', 'Zwölfte'];

export function fleetNameFor(state, factionId) {
  const own = state.fleets.filter((f) => f.factionId === factionId).length;
  const prefix = (FACTIONS.find((f) => f.id === factionId) || {}).fleetPrefix || 'Frei';
  const ord = FLEET_NAMES[own % FLEET_NAMES.length];
  return `${ord} ${prefix}-Kampfgruppe`;
}

export function attachAce(state, fleet) {
  const kind = (FACTIONS.find((f) => f.id === fleet.factionId) || {}).kind || 'terran';
  const used = new Set(state.usedAceNames);
  const rnd = makePrng(1000 + state.fleets.length * 7 + state.turn);
  const ace = drawAce(rnd, kind, used);
  if (!ace) return null;
  state.usedAceNames.push(ace.name);
  state.aces.push({ ...ace, factionId: fleet.factionId, fleetId: fleet.id });
  fleet.ace = ace;
  return ace;
}

export function factionById(state, id) {
  return state.factions.find((f) => f.id === id) || null;
}
export function playerFaction(state) {
  return state.factions.find((f) => f.isPlayer) || state.factions[0];
}
export function isPlayerFleet(state, fleet) {
  return !!fleet && fleet.factionId === state.playerFactionId;
}
export function systemById(state, id) {
  return state.systems.find((s) => s.id === id) || null;
}
export function systemAt(state, col, row) {
  return state.systems.find((s) => s.col === col && s.row === row) || null;
}
export function systemByName(state, name) {
  return state.systems.find((s) => s.name === name) || null;
}
export function fleetById(state, id) {
  return state.fleets.find((f) => f.id === id) || null;
}
export function fleetsAt(state, col, row) {
  return state.fleets.filter((f) => f.col === col && f.row === row);
}
export function fleetAt(state, col, row) {
  return fleetsAt(state, col, row)[0] || null;
}
export function fleetsOf(state, factionId) {
  return state.fleets.filter((f) => f.factionId === factionId);
}
export function systemsOf(state, factionId) {
  return state.systems.filter((s) => s.factionId === factionId);
}
export function capitalOf(state, factionId) {
  return state.systems.find((s) => s.factionId === factionId && s.capital)
    || systemsOf(state, factionId)[0] || null;
}

// Die Stärke einer Flotte in Maschinen und Kielen - die Zahl, die im HUD
// steht und über die man redet.
export function fleetTotalCount(fleet) {
  if (!fleet) return 0;
  return fleet.units.reduce((sum, u) => sum + u.count, 0);
}
export function fleetRoleCount(fleet, role) {
  if (!fleet) return 0;
  return fleet.units.filter((u) => u.role === role).reduce((s, u) => s + u.count, 0);
}
export function fleetHasRole(fleet, role) {
  return fleetRoleCount(fleet, role) > 0;
}
export function garrisonTotal(system) {
  if (!system) return 0;
  return Object.values(system.garrison || {}).reduce((s, n) => s + n, 0);
}
export function garrisonFieldUnits(system) {
  // Die Wache bleibt immer im System; alles andere kann ausrücken.
  const out = {};
  for (const [role, count] of Object.entries(system.garrison || {})) {
    if (role === WATCH_ROLE) continue;
    if (count > 0) out[role] = count;
  }
  return out;
}

// Wieviel eine Flotte in diesem Zug fliegen darf: Grundwert, Technik,
// Herrscher, Ass und Großes Werk.
export function movementMaxFor(state, fleet) {
  const faction = factionById(state, fleet.factionId);
  let m = MAX_MOVEMENT;
  if (faction) {
    m += techMoveBonus(faction.tech.triebwerke);
    m += rulerTraitSum(faction.ruler, 'move');
    if (fleet.factionId === 'borderworlds') m += 1;
    if (hasGreatWork(state, fleet.factionId, 'sprungtor')) m += 1;
  }
  if (fleet.ace && fleet.ace.bonus === 'bewegung' && fleet.ace.alive) m += 1;
  return Math.max(1, Math.round(m));
}

export function hasGreatWork(state, factionId, workId) {
  const sys = state.systems.find((s) => s.greatWork === workId);
  return !!sys && sys.factionId === factionId;
}
export function greatWorksOf(state, factionId) {
  return state.systems.filter((s) => s.greatWork && s.factionId === factionId)
    .map((s) => GREAT_WORKS.find((g) => g.id === s.greatWork))
    .filter(Boolean);
}

// --- Chronik --------------------------------------------------------------
export function logMsg(state, text, kind = 'info') {
  state.log.push({ turn: state.turn, text, kind });
  if (state.log.length > 400) state.log.shift();
}

export function tileOf(state, col, row) {
  return tileAt(state.map, col, row);
}

export function isNebula(state, col, row) {
  const t = tileAt(state.map, col, row);
  return !!t && t.type === TILE_TYPES.NEBULA;
}

// Ein Feld gilt als gesehen, wenn eine eigene Flotte oder ein eigenes System
// je in Sensorreichweite war. Ungesehene Felder liegen im Dunkeln.
export function markSeen(state, col, row) {
  state.seen[`${col},${row}`] = true;
}
export function hasSeen(state, col, row) {
  return !!state.seen[`${col},${row}`];
}

export function totalPopulation(state, factionId) {
  return systemsOf(state, factionId).reduce((s, sys) => s + sys.population, 0);
}

export function fleetSummary(fleet) {
  const byRole = {};
  for (const u of fleet.units) byRole[u.role] = (byRole[u.role] || 0) + u.count;
  return byRole;
}

// Die höchste Technikstufe, die eine Fraktion erreicht hat - für Berichte.
export function techLevelSum(faction) {
  return UNIT_ROLES.length ? Object.values(faction.tech).reduce((a, b) => a + b, 0) : 0;
}
export const MAX_TECH_SUM = MAX_TECH_LEVEL * 3;

export function randomFor(state, salt = 0) {
  return makePrng(state.turn * 7919 + salt * 104729 + 13);
}

export function rollFrom(state, salt, min, max) {
  return rollInt(randomFor(state, salt), min, max);
}
