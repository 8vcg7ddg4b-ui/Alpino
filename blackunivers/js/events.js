// --- Was ohne Befehl geschieht -------------------------------------------
// Zwischen den Zügen passiert Raum: Sonnenstürme, Meutereien, Retro-Fanatiker,
// Funde in Wrackfeldern - und irgendwann kommt der Schwarm durch das Tor.
import {
  TILE_TYPES, PIRATE_SPAWN_CHANCE, NEPHILIM_FIRST_TURN, MORALE_MAX,
  sizeTier, shipName, WATCH_ROLE,
} from './data.js';
import { tileAt } from './mapgen.js';
import {
  createFleet, factionById, systemsOf, fleetsOf, systemAt, logMsg, randomFor,
  fleetTotalCount, capitalOf, playerFaction,
} from './state.js';
import { pick, rollInt } from './prng.js';
import { pushNews } from './diplomacy.js';
import { cleanupFleet } from './actions.js';

// Die Ereignisse des Spielers: sie werden gemeldet und wirken sofort.
const EVENTS = [
  {
    id: 'sonnensturm',
    title: 'Sonnensturm',
    weight: 10,
    text: (ctx) => `Ein Ausbruch der Sonne von ${ctx.system.name} legt die `
      + 'Sensoren lahm. Die Werften stehen einen Zug still.',
    apply: (state, ctx) => {
      for (const job of ctx.system.training) job.turnsLeft += 1;
      ctx.system.shield.down = Math.min(1, ctx.system.shield.down + 0.3);
    },
  },
  {
    id: 'wrackfund',
    title: 'Fund im Wrackfeld',
    weight: 12,
    text: (ctx) => `Bergungsschiffe finden bei ${ctx.system.name} das Wrack `
      + `eines Frachters. ${ctx.amount} Kredits.`,
    prepare: (state, ctx, rnd) => { ctx.amount = rollInt(rnd, 120, 420); },
    apply: (state, ctx) => { ctx.faction.credits += ctx.amount; },
  },
  {
    id: 'meuterei',
    title: 'Unruhe an Bord',
    weight: 7,
    needsFleet: true,
    text: (ctx) => `${ctx.fleet.name} klagt über zu lange Wachen. Die Moral fällt.`,
    apply: (state, ctx) => { ctx.fleet.morale = Math.max(10, ctx.fleet.morale - 18); },
  },
  {
    id: 'freiwillige',
    title: 'Freiwillige',
    weight: 9,
    text: (ctx) => `Die Akademien von ${ctx.system.name} schicken einen `
      + 'Jahrgang vor der Zeit. Die Wache wächst.',
    apply: (state, ctx) => {
      ctx.system.garrison[WATCH_ROLE] = (ctx.system.garrison[WATCH_ROLE] || 0) + 6;
    },
  },
  {
    id: 'seuche',
    title: 'Seuche',
    weight: 6,
    text: (ctx) => `Eine Fieberwelle auf ${ctx.system.name} kostet Menschen `
      + 'und Steuern.',
    apply: (state, ctx) => {
      ctx.system.population = Math.max(1, Math.round(ctx.system.population * 0.88));
      ctx.system.unrest = Math.min(10, ctx.system.unrest + 2);
    },
  },
  {
    id: 'handelsboom',
    title: 'Guter Jahrgang',
    weight: 9,
    text: (ctx) => `${ctx.system.goods} aus ${ctx.system.name} steht hoch im `
      + `Kurs. ${ctx.amount} Kredits.`,
    prepare: (state, ctx, rnd) => {
      ctx.amount = rollInt(rnd, 90, 260) + sizeTier(ctx.system.size).income;
    },
    apply: (state, ctx) => { ctx.faction.credits += ctx.amount; },
  },
  {
    id: 'ueberlaeufer',
    title: 'Überläufer',
    weight: 5,
    text: (ctx) => `Ein feindlicher Pilot setzt sich bei ${ctx.system.name} `
      + 'ab und bringt seine Maschine mit.',
    apply: (state, ctx) => {
      ctx.system.garrison.jaeger = (ctx.system.garrison.jaeger || 0) + 3;
    },
  },
  {
    id: 'aufstand',
    title: 'Aufstand',
    weight: 5,
    needsUnrest: true,
    text: (ctx) => `Auf ${ctx.system.name} wird gestreikt und geschossen. `
      + 'Die Wache greift ein.',
    apply: (state, ctx) => {
      ctx.system.unrest = Math.min(10, ctx.system.unrest + 3);
      ctx.system.garrison[WATCH_ROLE] = Math.max(1, Math.round((ctx.system.garrison[WATCH_ROLE] || 2) * 0.7));
    },
  },
  {
    id: 'spende',
    title: 'Kriegsanleihe',
    weight: 8,
    text: (ctx) => `Die Konzerne von ${ctx.system.name} zeichnen eine `
      + `Kriegsanleihe: ${ctx.amount} Kredits, zurückzuzahlen nie.`,
    prepare: (state, ctx, rnd) => { ctx.amount = rollInt(rnd, 150, 380); },
    apply: (state, ctx) => { ctx.faction.credits += ctx.amount; },
  },
];

// Einmal je Zug wird gewürfelt, ob überhaupt etwas geschieht.
export function rollEvents(state, factionId) {
  const rnd = randomFor(state, factionId.length * 31 + 5);
  if (rnd() > 0.35) return null;
  const faction = factionById(state, factionId);
  const systems = systemsOf(state, factionId);
  if (!faction || !systems.length) return null;
  const fleets = fleetsOf(state, factionId);
  const pool = EVENTS.filter((e) => {
    if (e.needsFleet && !fleets.length) return false;
    if (e.needsUnrest && !systems.some((s) => s.unrest > 2)) return false;
    return true;
  });
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let roll = rnd() * total;
  let chosen = pool[0];
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) { chosen = e; break; }
  }
  const ctx = {
    faction,
    system: chosen.needsUnrest
      ? pick(rnd, systems.filter((s) => s.unrest > 2))
      : pick(rnd, systems),
    fleet: fleets.length ? pick(rnd, fleets) : null,
  };
  if (chosen.prepare) chosen.prepare(state, ctx, rnd);
  chosen.apply(state, ctx);
  const text = chosen.text(ctx);
  if (factionId === state.playerFactionId) {
    logMsg(state, `${chosen.title}: ${text}`, 'ereignis');
  }
  return { id: chosen.id, title: chosen.title, text };
}

// --- Retros, Mandarine, Freibeuter --------------------------------------
// Unabhängige Verbände, die niemandem gehören und jeden angreifen. Sie
// halten den Raum unruhig, auch wo kein Krieg ist.
export function spawnRaiders(state) {
  const rnd = randomFor(state, 77);
  if (rnd() > PIRATE_SPAWN_CHANCE) return null;
  const existing = fleetsOf(state, 'neutral').length;
  if (existing >= 6) return null;
  // Sie kommen aus Nebelbänken und Trümmerfeldern, nicht aus Systemen.
  const candidates = state.map.tiles.filter((t) => (t.type === TILE_TYPES.NEBULA
    || t.type === TILE_TYPES.ASTEROIDS) && !t.systemId);
  if (!candidates.length) return null;
  const tile = pick(rnd, candidates);
  const size = rollInt(rnd, 1, 3);
  const units = [{ role: 'jaeger', count: 6 + size * 2 }];
  if (size >= 2) units.push({ role: 'korvette', count: 2 });
  if (size >= 3) units.push({ role: 'bomber', count: 4 });
  const fleet = createFleet(state, 'neutral', tile.col, tile.row, units, {
    name: pick(rnd, ['Retro-Schar', 'Mandarin-Verband', 'Freibeuter von Xytani',
      'Piratenrudel', 'Schmugglergeleit']),
    morale: 50,
  });
  logMsg(state, `Unbekannte Kennung bei ${tile.zoneName || 'einem Trümmerfeld'}: `
    + `${fleet.name} ist aufgetaucht.`, 'piraten');
  return fleet;
}

// Freibeuter fliegen selbst: sie suchen das nächste schwach verteidigte
// System und fallen darüber her.
export function moveRaiders(state) {
  for (const fleet of fleetsOf(state, 'neutral')) {
    const targets = state.systems
      .filter((s) => s.factionId !== 'neutral')
      .sort((a, b) => (Math.abs(a.col - fleet.col) + Math.abs(a.row - fleet.row))
        - (Math.abs(b.col - fleet.col) + Math.abs(b.row - fleet.row)));
    const target = targets[0];
    if (!target) continue;
    const dc = Math.sign(target.col - fleet.col);
    const dr = Math.sign(target.row - fleet.row);
    for (let step = 0; step < 2; step++) {
      const t = tileAt(state.map, fleet.col + dc, fleet.row + dr);
      if (!t || t.type === TILE_TYPES.RIFT) break;
      fleet.col = t.col;
      fleet.row = t.row;
      if (t.systemId) break;
    }
    // Über einem System plündern sie: Kredits weg, Unruhe hoch.
    const sys = systemAt(state, fleet.col, fleet.row);
    if (sys && sys.factionId !== 'neutral') {
      const faction = factionById(state, sys.factionId);
      const loot = Math.min(faction.credits, 60 + sizeTier(sys.size).income);
      faction.credits -= loot;
      sys.unrest = Math.min(10, sys.unrest + 1);
      if (faction.isPlayer) {
        logMsg(state, `${fleet.name} plündert ${sys.name}: ${loot} Kredits verloren.`, 'piraten');
      }
    }
  }
}

// --- Der Schwarm ----------------------------------------------------------
// Nach vielen Zügen öffnet sich ein Tor am Rand der Karte, und die Nephilim
// kommen. Sie verhandeln nicht.
export function nephilimWave(state) {
  if (state.turn < NEPHILIM_FIRST_TURN) return null;
  const rnd = randomFor(state, 91);
  const existing = fleetsOf(state, 'nephilim').length;
  if (existing >= 5) return null;
  if (state.nephilimTurn == null) {
    state.nephilimTurn = state.turn;
    logMsg(state, 'Ein Sprungpunkt öffnet sich, wo keiner sein dürfte. '
      + 'Was daraus kommt, antwortet nicht auf Funk.', 'nephilim');
    pushNews(state, { kind: 'nephilim', a: 'nephilim', text: 'Unbekannte Flotten treten in den bekannten Raum ein.' });
  } else if (rnd() > 0.3) return null;
  const edge = pick(rnd, state.map.tiles.filter((t) => t.type !== TILE_TYPES.RIFT
    && (t.col > state.map.cols - 4 || t.row > state.map.rows - 4) && !t.systemId));
  if (!edge) return null;
  const strength = 1 + Math.floor((state.turn - NEPHILIM_FIRST_TURN) / 12);
  const fleet = createFleet(state, 'nephilim', edge.col, edge.row, [
    { role: 'jaeger', count: 12 },
    { role: 'jaeger', count: 12 },
    { role: 'bomber', count: 8 * Math.min(3, strength) },
    { role: 'kreuzer', count: 2 * Math.min(3, strength) },
    { role: 'marines', count: 6 },
  ], { name: `Schwarmwelle ${existing + 1}`, morale: 90 });
  logMsg(state, `${fleet.name} tritt bei ${edge.zoneName || 'der Kante des Raums'} ein.`, 'nephilim');
  return fleet;
}

// Der Schwarm hat keine Diplomatie und keine Werften: er fliegt auf das
// nächste bewohnte System und frisst es.
export function moveNephilim(state) {
  for (const fleet of fleetsOf(state, 'nephilim')) {
    const target = state.systems
      .filter((s) => s.factionId !== 'nephilim')
      .sort((a, b) => (Math.abs(a.col - fleet.col) + Math.abs(a.row - fleet.row))
        - (Math.abs(b.col - fleet.col) + Math.abs(b.row - fleet.row)))[0];
    if (!target) continue;
    const dc = Math.sign(target.col - fleet.col);
    const dr = Math.sign(target.row - fleet.row);
    for (let step = 0; step < 3; step++) {
      const t = tileAt(state.map, fleet.col + dc, fleet.row + dr);
      if (!t || t.type === TILE_TYPES.RIFT) break;
      fleet.col = t.col;
      fleet.row = t.row;
    }
    cleanupFleet(state, fleet);
  }
}
