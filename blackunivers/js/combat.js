// --- Das Gefecht ----------------------------------------------------------
// Gekämpft wird auf der Karte, nicht auf einem eigenen Bildschirm: eine
// Flotte fliegt auf ein Feld, auf dem ein Feind steht, und dann wird
// gerechnet. Das Ergebnis ist ein Bericht - er wird gezeigt, animiert und
// in die Chronik geschrieben.
import {
  ROLE_MATCHUP, ROLE_LABELS, UNIT_ROLES, WATCH_ROLE, unitDefs, shipName,
  TACTICS, techAttackBonus, techArmourBonus, shieldInfo, SHIELD_BREAK_PER_BOMBER,
  TILE_TYPES, BUILDING_DEFS, experienceStars, MORALE_MAX,
} from './data.js';
import {
  factionById, fleetTotalCount, garrisonTotal, hasGreatWork, logMsg, tileOf,
} from './state.js';
import { baseOwner } from './territory.js';
import { aceCombatBonus } from './pilots.js';
import { rulerTraitSum } from './pilots.js';

const ROUNDS = 5;
const BREAK_MORALE = 18;

// Ein Verband, wie ihn die Rechnung sieht: Rolle, Zahl, Erfahrung.
function unitsOfSystem(state, system) {
  const out = [];
  for (const [role, count] of Object.entries(system.garrison || {})) {
    if (count <= 0) continue;
    out.push({ id: `gar_${system.id}_${role}`, role, count, exp: 20, garrison: true });
  }
  return out;
}

// --- Woher die Staffeln starten ------------------------------------------
// Jäger und Bomber haben keine Sprungtriebwerke und keine Vorräte für Wochen.
// Sie starten von einem Träger, von einer eigenen Welt, von einer Raumstation
// oder von einer Militärbasis in einem Trümmerfeld. Fehlt beides, hängen sie
// in der Leere und leisten nur die Hälfte.
export function launchBase(state, factionId, col, row, units) {
  if ((units || []).some((u) => u.role === 'traeger' && u.count > 0)) {
    return { ok: true, kind: 'traeger', name: 'Trägerdeck' };
  }
  for (const sys of state.systems) {
    if (sys.factionId !== factionId) continue;
    if (Math.max(Math.abs(sys.col - col), Math.abs(sys.row - row)) <= 1) {
      return { ok: true, kind: 'welt', name: sys.name };
    }
  }
  for (const base of state.bases || []) {
    if (Math.max(Math.abs(base.col - col), Math.abs(base.row - row)) > 2) continue;
    if (baseOwner(state, base) !== factionId) continue;
    return { ok: true, kind: base.kind, name: base.name };
  }
  return { ok: false, kind: null, name: null };
}

// Der Beitrag eines Verbands zur Stärke einer Seite.
function unitStrength(state, factionId, unit, opts) {
  const defs = unitDefs(factionId);
  const def = defs[unit.role] || defs[WATCH_ROLE];
  const faction = factionById(state, factionId);
  let value = def.attack * unit.count;
  // Erfahrung: aus Neulingen werden Legenden, und das sind bis zu +35%.
  value *= 1 + experienceStars(unit.exp) * 0.07;
  // Technik gilt für das ganze Reich.
  if (faction) value *= 1 + techAttackBonus(faction.tech.waffen);
  // Die Schlachtordnung verschiebt, was eine Rolle wert ist.
  const tactic = TACTICS[opts.tactic];
  if (tactic && tactic.mods[unit.role]) value *= tactic.mods[unit.role];
  // Das Ass fliegt in einer Rolle vorn.
  value *= 1 + aceCombatBonus(opts.ace, unit.role);
  if (unit.role === 'jaeger' || unit.role === 'bomber') {
    // Träger machen die Jäger daneben stärker - das ist ihr eigentlicher Wert.
    if (opts.carriers > 0) value *= 1 + Math.min(0.35, opts.carriers * 0.12);
    // Ohne Deck in Reichweite fliegt eine Staffel nur halb.
    if (opts.launch === false) value *= 0.5;
  }
  // Moral: eine gebrochene Flotte schießt schlecht.
  value *= 0.55 + (opts.morale / MORALE_MAX) * 0.65;
  // Doktrin und Große Werke.
  if (faction) {
    if (hasGreatWork(state, factionId, 'klauenhalle')) value *= 1.15;
    value *= 1 + rulerTraitSum(faction.ruler, 'aggression') * 0.1;
  }
  return value;
}

// Wie gut trifft diese Seite die andere? Der Rollenkreis entscheidet: Jäger
// über Bomber, Bomber über Kiele, Kiele über Jäger.
function matchupFactor(myUnits, foeUnits) {
  const foeTotal = foeUnits.reduce((s, u) => s + u.count, 0) || 1;
  let sum = 0;
  let weight = 0;
  for (const mine of myUnits) {
    for (const foe of foeUnits) {
      const row = ROLE_MATCHUP[mine.role] || ROLE_MATCHUP.jaeger;
      const f = row[foe.role] ?? 1;
      const w = mine.count * (foe.count / foeTotal);
      sum += f * w;
      weight += w;
    }
  }
  return weight > 0 ? sum / weight : 1;
}

function sideStrength(state, side) {
  const carriers = side.units.filter((u) => u.role === 'traeger').reduce((s, u) => s + u.count, 0);
  let total = 0;
  for (const u of side.units) {
    if (u.count <= 0) continue;
    total += unitStrength(state, side.factionId, u, {
      tactic: side.tactic, ace: side.ace, morale: side.morale, carriers,
      launch: side.launch === undefined ? true : side.launch,
    });
  }
  return total;
}

// Panzerung der Gegenseite: sie bestimmt, wieviel Schaden in Verluste
// umgesetzt wird.
function sideArmour(state, side) {
  const defs = unitDefs(side.factionId);
  const faction = factionById(state, side.factionId);
  let armour = 0;
  let count = 0;
  for (const u of side.units) {
    if (u.count <= 0) continue;
    const def = defs[u.role] || defs[WATCH_ROLE];
    armour += def.armour * u.count;
    count += u.count;
  }
  let avg = count ? armour / count : 8;
  if (faction) avg *= 1 + techArmourBonus(faction.tech.schilde);
  if (side.ace && side.ace.bonus === 'panzerung') avg *= 1 + side.ace.power;
  return Math.max(3, avg);
}

// Verluste verteilen: wer schlecht gegen den Angreifer steht, verliert mehr.
// Der Schaden wird als Ganzes auf die Verbände aufgeteilt - nach Anfälligkeit,
// und was durch volle Verbände übrigbleibt, wird noch einmal umgelegt.
function applyLosses(side, foe, damage) {
  const losses = {};
  if (damage <= 0) return losses;
  const defs = unitDefs(side.factionId);
  const armourOf = (u) => (defs[u.role] || defs[WATCH_ROLE]).armour;
  let pool = damage;
  for (let pass = 0; pass < 3 && pool >= 0.75; pass++) {
    const alive = side.units.filter((u) => u.count > 0);
    if (!alive.length) break;
    const totalV = totalVulnerability(alive, foe);
    // Panzerung zählt beim Sterben, nicht nur beim Rechnen: ein Kreuzer
    // verträgt viermal so viel wie ein Jäger, ehe er ausfällt.
    let machines = 0;
    let armourSum = 0;
    for (const u of alive) { machines += u.count; armourSum += armourOf(u) * u.count; }
    const avgArmour = machines ? armourSum / machines : 8;
    const before = pool;
    for (const u of alive) {
      if (pool < 0.75) break;
      const share = before * (vulnerability(u, foe) / totalV)
        * (avgArmour / Math.max(1, armourOf(u)));
      let hit = Math.floor(share + 0.5);
      if (hit <= 0) hit = pass === 0 && before >= 1 ? 1 : 0;
      hit = Math.min(hit, u.count, Math.floor(pool));
      if (hit <= 0) continue;
      u.count -= hit;
      pool -= hit;
      losses[u.role] = (losses[u.role] || 0) + hit;
    }
    if (pool >= before - 0.01) break;
  }
  return losses;
}

function vulnerability(unit, foe) {
  let sum = 0;
  const foeTotal = foe.units.reduce((s, u) => s + u.count, 0) || 1;
  for (const f of foe.units) {
    const row = ROLE_MATCHUP[f.role] || ROLE_MATCHUP.jaeger;
    sum += (row[unit.role] ?? 1) * (f.count / foeTotal);
  }
  return Math.max(0.1, sum);
}
function totalVulnerability(units, foe) {
  return units.reduce((s, u) => s + (u.count > 0 ? vulnerability(u, foe) : 0), 0) || 1;
}

// Was das Feld dazu sagt: Nebel schützt den Verteidiger, Trümmer kosten
// beide Seiten Maschinen, Strahlung frisst Panzerung.
function terrainMods(state, col, row) {
  const tile = tileOf(state, col, row);
  const type = tile ? tile.type : TILE_TYPES.VOID;
  switch (type) {
    case TILE_TYPES.NEBULA: return { defence: 1.18, hazard: 0.03, label: 'Nebelbank' };
    case TILE_TYPES.ASTEROIDS: return { defence: 1.12, hazard: 0.07, label: 'Asteroidenfeld' };
    case TILE_TYPES.RADIATION: return { defence: 1.0, hazard: 0.09, label: 'Strahlungszone' };
    default: return { defence: 1, hazard: 0, label: 'offener Raum' };
  }
}

function geschuetzBonus(system) {
  const b = system.buildings && system.buildings.geschuetz;
  if (!b || !b.level) return 0;
  return BUILDING_DEFS.geschuetz.defence[b.level - 1] || 0;
}

// --- Die Hauptrechnung ---------------------------------------------------
// `attacker` ist immer eine Flotte. `defender` ist eine Flotte oder ein
// System; ein System bringt Wache, Schild und Geschütze mit.
export function resolveBattle(state, attackerFleet, defender, opts = {}) {
  const rnd = opts.rnd || Math.random;
  const attackerFaction = factionById(state, attackerFleet.factionId);
  const isSystemFight = !!defender.name && !defender.units;
  const defFactionId = defender.factionId;
  const defenderFaction = factionById(state, defFactionId);

  const attackSide = {
    factionId: attackerFleet.factionId,
    units: attackerFleet.units.map((u) => ({ ...u })),
    morale: attackerFleet.morale,
    ace: attackerFleet.ace,
    tactic: opts.attackerTactic || (attackerFaction ? attackerFaction.tacticAttack : 'zange'),
    label: attackerFleet.name,
  };
  const defenceSide = {
    factionId: defFactionId,
    units: isSystemFight ? unitsOfSystem(state, defender) : defender.units.map((u) => ({ ...u })),
    morale: isSystemFight ? Math.max(40, 55 + (defender.capital ? 15 : 0) - defender.unrest * 2) : defender.morale,
    ace: isSystemFight ? null : defender.ace,
    tactic: opts.defenderTactic
      || (defenderFaction ? defenderFaction.tacticDefence : 'schildwall'),
    label: isSystemFight ? `${defender.name} (Verteidigung)` : defender.name,
  };

  const terrain = terrainMods(state, isSystemFight ? defender.col : defender.col, isSystemFight ? defender.row : defender.row);
  // Der Nebelhinterhalt gilt nur in der Bank.
  if (defenceSide.tactic === 'hinterhalt' && terrain.label !== 'Nebelbank') {
    defenceSide.tactic = 'jagdschirm';
  }

  // Wer von wo startet - das entscheidet über die halbe Wirkung der Staffeln.
  const attackerBase = launchBase(state, attackSide.factionId, defender.col, defender.row, attackSide.units);
  attackSide.launch = attackerBase.ok;
  defenceSide.launch = isSystemFight
    ? true
    : launchBase(state, defenceSide.factionId, defender.col, defender.row, defenceSide.units).ok;

  const shield = isSystemFight ? { ...defender.shield } : null;
  const rounds = [];
  let winner = null;
  let shieldBroken = !isSystemFight || shield.level === 0;

  for (let r = 1; r <= ROUNDS; r++) {
    const aStrength = sideStrength(state, attackSide);
    let dStrength = sideStrength(state, defenceSide) * terrain.defence;
    if (isSystemFight) {
      const info = shieldInfo(shield.level);
      const remaining = Math.max(0, 1 - shield.down);
      dStrength *= 1 + (info.bonus - 1) * remaining;
      dStrength *= 1 + geschuetzBonus(defender);
      if (hasGreatWork(state, defFactionId, 'nesthort')) dStrength *= 1.1;
    }
    if (aStrength <= 0 || dStrength <= 0) break;

    const aArmour = sideArmour(state, attackSide);
    const dArmour = sideArmour(state, defenceSide);
    const aMatch = matchupFactor(attackSide.units, defenceSide.units);
    const dMatch = matchupFactor(defenceSide.units, attackSide.units);

    const luckA = 0.85 + rnd() * 0.3;
    const luckB = 0.85 + rnd() * 0.3;
    const dmgToDefence = (aStrength * aMatch * luckA) / (dArmour * 11);
    const dmgToAttack = (dStrength * dMatch * luckB) / (aArmour * 11);

    const lossesD = applyLosses(defenceSide, attackSide, dmgToDefence);
    const lossesA = applyLosses(attackSide, defenceSide, dmgToAttack);

    // Bomber drücken den Schild herunter. Ohne Bomber kommt niemand durch
    // einen Zitadellenschild - man kann die Welt nur einschließen.
    if (isSystemFight && shield.level > 0) {
      const bombers = attackSide.units.filter((u) => u.role === 'bomber').reduce((s, u) => s + u.count, 0);
      const kreuzer = attackSide.units.filter((u) => u.role === 'kreuzer').reduce((s, u) => s + u.count, 0);
      const press = bombers * SHIELD_BREAK_PER_BOMBER * 0.1 + kreuzer * 0.03;
      shield.down = Math.min(1, shield.down + press / Math.max(1, shield.level));
      if (shield.down >= 1) shieldBroken = true;
    }

    // Trümmer und Strahlung nehmen sich ihren Teil von beiden Seiten.
    if (terrain.hazard > 0) {
      hazardLosses(attackSide, terrain.hazard, rnd);
      if (!isSystemFight) hazardLosses(defenceSide, terrain.hazard, rnd);
    }
    if (TACTICS[defenceSide.tactic] && TACTICS[defenceSide.tactic].hazard) {
      hazardLosses(attackSide, TACTICS[defenceSide.tactic].hazard, rnd);
    }

    // Moral: Verluste brechen den Willen, nicht die Zahl.
    const aLost = Object.values(lossesA).reduce((s, n) => s + n, 0);
    const dLost = Object.values(lossesD).reduce((s, n) => s + n, 0);
    const aBefore = attackSide.units.reduce((s, u) => s + u.count, 0) + aLost;
    const dBefore = defenceSide.units.reduce((s, u) => s + u.count, 0) + dLost;
    attackSide.morale -= (aLost / Math.max(1, aBefore)) * 55;
    defenceSide.morale -= (dLost / Math.max(1, dBefore)) * 45;
    if (attackSide.factionId === 'kilrathi') attackSide.morale += 3;
    if (attackSide.ace && attackSide.ace.bonus === 'moral') attackSide.morale += 3;
    if (defenceSide.ace && defenceSide.ace.bonus === 'moral') defenceSide.morale += 3;

    rounds.push({
      round: r,
      attackStrength: Math.round(aStrength),
      defenceStrength: Math.round(dStrength),
      lossesAttacker: lossesA,
      lossesDefender: lossesD,
      shieldDown: shield ? Math.round(shield.down * 100) : null,
      attackerMorale: Math.round(attackSide.morale),
      defenderMorale: Math.round(defenceSide.morale),
    });

    const aAlive = attackSide.units.reduce((s, u) => s + u.count, 0);
    const dAlive = defenceSide.units.reduce((s, u) => s + u.count, 0);
    if (dAlive <= 0) { winner = 'angreifer'; break; }
    if (aAlive <= 0) { winner = 'verteidiger'; break; }
    if (defenceSide.morale < BREAK_MORALE && !isSystemFight) { winner = 'angreifer'; break; }
    if (attackSide.morale < BREAK_MORALE) { winner = 'verteidiger'; break; }
  }

  if (!winner) {
    // Nach fünf Runden entscheidet, wer noch stehen kann - und zwar nach
    // Gefechtswert, nicht nach Stückzahl. Zwei Kreuzer sind mehr als
    // zwanzig angeschlagene Jäger.
    const aScore = sideStrength(state, attackSide) * (attackSide.morale / 60);
    const dScore = sideStrength(state, defenceSide) * (defenceSide.morale / 60);
    winner = aScore > dScore * 1.1 ? 'angreifer' : dScore > aScore * 1.1 ? 'verteidiger' : 'unentschieden';
  }

  return {
    kind: isSystemFight ? 'system' : 'flotte',
    winner,
    launchBase: attackerBase,
    rounds,
    terrain: terrain.label,
    attacker: {
      factionId: attackSide.factionId,
      fleetId: attackerFleet.id,
      name: attackSide.label,
      tactic: attackSide.tactic,
      morale: Math.round(attackSide.morale),
      units: attackSide.units,
      ace: attackSide.ace ? attackSide.ace.call : null,
    },
    defender: {
      factionId: defenceSide.factionId,
      name: defenceSide.label,
      systemId: isSystemFight ? defender.id : null,
      fleetId: isSystemFight ? null : defender.id,
      tactic: defenceSide.tactic,
      morale: Math.round(defenceSide.morale),
      units: defenceSide.units,
      ace: defenceSide.ace ? defenceSide.ace.call : null,
    },
    shield: shield ? { level: shield.level, down: shield.down, broken: shieldBroken } : null,
    col: defender.col,
    row: defender.row,
  };
}

function hazardLosses(side, rate, rnd) {
  for (const u of side.units) {
    if (u.count <= 0) continue;
    const hit = Math.floor(u.count * rate * (0.5 + rnd()));
    if (hit > 0) u.count -= hit;
  }
}

// Eine Vorschau, ohne zu würfeln: was das HUD zeigt, bevor man angreift.
export function previewBattle(state, attackerFleet, defender, opts = {}) {
  const isSystemFight = !!defender.name && !defender.units;
  const attackerFaction = factionById(state, attackerFleet.factionId);
  const defenderFaction = factionById(state, defender.factionId);
  const attackSide = {
    factionId: attackerFleet.factionId,
    units: attackerFleet.units.map((u) => ({ ...u })),
    morale: attackerFleet.morale,
    ace: attackerFleet.ace,
    tactic: opts.attackerTactic || (attackerFaction ? attackerFaction.tacticAttack : 'zange'),
  };
  const defenceSide = {
    factionId: defender.factionId,
    units: isSystemFight ? unitsOfSystem(state, defender) : defender.units.map((u) => ({ ...u })),
    morale: isSystemFight ? 55 : defender.morale,
    ace: isSystemFight ? null : defender.ace,
    tactic: opts.defenderTactic || (defenderFaction ? defenderFaction.tacticDefence : 'schildwall'),
  };
  const aBase = launchBase(state, attackSide.factionId, defender.col, defender.row, attackSide.units);
  const dBase = isSystemFight
    ? { ok: true, kind: 'welt', name: defender.name }
    : launchBase(state, defenceSide.factionId, defender.col, defender.row, defenceSide.units);
  attackSide.launch = aBase.ok;
  defenceSide.launch = dBase.ok;
  const terrain = terrainMods(state, defender.col, defender.row);
  const a = sideStrength(state, attackSide) * matchupFactor(attackSide.units, defenceSide.units);
  let d = sideStrength(state, defenceSide) * matchupFactor(defenceSide.units, attackSide.units) * terrain.defence;
  if (isSystemFight) {
    const info = shieldInfo(defender.shield.level);
    d *= 1 + (info.bonus - 1) * Math.max(0, 1 - defender.shield.down);
    d *= 1 + geschuetzBonus(defender);
  }
  const total = a + d || 1;
  return {
    attackStrength: Math.round(a),
    defenceStrength: Math.round(d),
    chance: Math.max(2, Math.min(98, Math.round((a / total) * 100))),
    terrain: terrain.label,
    shieldLevel: isSystemFight ? defender.shield.level : 0,
    shieldDown: isSystemFight ? defender.shield.down : 0,
    needsMarines: isSystemFight,
    hasMarines: attackerFleet.units.some((u) => u.role === 'marines' && u.count > 0),
    attackerTactic: attackSide.tactic,
    defenderTactic: defenceSide.tactic,
    launchBase: aBase,
    foeLaunchBase: dBase,
    hasFighters: attackerFleet.units.some(
      (u) => (u.role === 'jaeger' || u.role === 'bomber') && u.count > 0,
    ),
  };
}

// Der Bericht in Worten - er steht im Fenster nach dem Gefecht und in der
// Chronik.
export function battleSummary(report) {
  const lossesA = sumLosses(report.rounds, 'lossesAttacker');
  const lossesD = sumLosses(report.rounds, 'lossesDefender');
  return {
    lossesAttacker: lossesA,
    lossesDefender: lossesD,
    totalAttacker: Object.values(lossesA).reduce((s, n) => s + n, 0),
    totalDefender: Object.values(lossesD).reduce((s, n) => s + n, 0),
    rounds: report.rounds.length,
  };
}

export function sumLosses(rounds, key) {
  const out = {};
  for (const r of rounds) {
    for (const [role, n] of Object.entries(r[key] || {})) {
      out[role] = (out[role] || 0) + n;
    }
  }
  return out;
}

export function lossesText(losses, factionId) {
  const parts = [];
  for (const role of [...UNIT_ROLES, WATCH_ROLE]) {
    if (!losses[role]) continue;
    parts.push(`${losses[role]} × ${shipName(factionId, role)}`);
  }
  return parts.length ? parts.join(', ') : 'keine Verluste';
}
