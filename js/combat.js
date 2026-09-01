// Gerechnet wird über alle Rollen, die in einer Truppe stehen können - die
// drei Waffengattungen und die Stadtwache, die nur auf der Verteidigerseite
// vorkommt und dort mitkämpft.
import { unitDefs, COMBAT_ROLES, TILE_TYPES, BATTLE_PREVIEW_SAMPLES,
  frontageWidth, engagedShare, SHIP_ROLE, SHIP_TYPES,
  tacticEffect, tacticByKey,
  wallAssaultScale } from './data.js';
import { mulberry32 } from './prng.js';

let battleSeed = 42;

// Tauscht die Schiffsbauart in die Rollentabelle ein, ohne die Tabelle selbst
// anzurühren - sie gehört der Fraktion und wird von allen geteilt.
function withShipKind(defs, kind) {
  const ship = kind && SHIP_TYPES[kind];
  if (!ship || defs[SHIP_ROLE] === ship) return defs;
  return { ...defs, [SHIP_ROLE]: ship };
}

function cloneUnits(units) {
  const out = {};
  for (const key of COMBAT_ROLES) out[key] = units[key] || 0;
  return out;
}

// How much punishment a force can take, which depends on whose men they are:
// a Roman legionary and a Dacian falx-man do not stand up to the same beating.
function totalStrength(units, defs) {
  return COMBAT_ROLES.reduce((sum, key) => sum + (units[key] || 0) * defs[key].hp, 0);
}

function totalCount(units) {
  return COMBAT_ROLES.reduce((sum, key) => sum + (units[key] || 0), 0);
}

// Fresh, confident troops hit harder; worn-out ones falter. Both inputs are
// 0-100, and the result stays in a band that never trivialises a battle.
export function conditionFactor(morale, exhaustion) {
  const m = Math.max(0, Math.min(100, morale ?? 100));
  const e = Math.max(0, Math.min(100, exhaustion ?? 0));
  return (0.62 + 0.38 * (m / 100)) * (1 - 0.3 * (e / 100));
}

// Wie viel von der aufgebotenen Kraft beim Gegner ankommt. Der Angreifer hatte
// hier lange den deutlich größeren Anteil; zusammen mit der stärkeren
// Eröffnungssalve gewann er dadurch selbst bei Gleichstand fast jede Schlacht,
// und Angreifen war nie eine Entscheidung, sondern immer die richtige Wahl.
const ATTACK_DAMAGE_SHARE = 0.53;
const DEFENCE_DAMAGE_SHARE = 0.46;

// Nach wie vielen Runden sich absetzt, wer fechtend weicht. Wer sich absetzt,
// überlässt dem Gegner das Feld - deshalb ist das Rückzugsgefecht keine
// billige Siegordnung, sondern die Wahl, eine Schlacht zu verlieren und ein
// Heer zu behalten.
const ABSETZEN_RUNDE = 6;

// Simplified multi-round battle resolver. Runs entirely on the campaign map:
// no separate battle screen. Returns enough detail for a full battle report.
export function resolveBattle(attackerUnitsIn, defenderUnitsIn, terrainType, modifiers = {}) {
  const {
    attackerMorale = 100, attackerExhaustion = 0,
    defenderMorale = 100, defenderExhaustion = 0,
    wallMultiplier = 1, defenderMultiplier = 1, attackerMultiplier = 1, seed,
    // The weather does not care which side you are on: wet bowstrings are wet
    // for everyone, and in fog nobody gets an opening volley.
    unitScale = null, weatherScale = null, seaScale = null, openingVolley = true,
    // Veterans hit harder, and the report has to be able to say by how much -
    // so this is its own multiplier rather than folded into another.
    attackerVeterancy = 1, defenderVeterancy = 1,
    // Each side fights with its own arms. Without this every faction would be
    // Rome with a different colour.
    attackerFactionId = 'neutral', defenderFactionId = 'neutral',
    // Eine Flotte fährt die Bauart, mit der sie vom Stapel lief - nicht die,
    // die ihre Werft heute baut. Wer keine mitgibt, fährt die der Fraktion.
    attackerShipKind = null, defenderShipKind = null,
    // Was das Belagerungsgerät des Angreifers zur Eröffnungssalve beiträgt.
    // Ein Katapult schießt, ehe der erste Mann die Leiter berührt - und es
    // schießt auch dann, wenn kein Bogenschütze im Heer steht.
    siegeVolley = 0,
    // Die Schlachtordnung, in der jede Seite antritt. Was sie bewirkt, steht
    // in `TACTICS` (data.js); hier wird sie nur eingerechnet.
    attackerTactic = null, defenderTactic = null,
  } = modifiers;

  // Erst ausrechnen, was die beiden Ordnungen für diese beiden Truppen wiegen -
  // die Umfassung hängt an der Reiterei, die sie mitbringt.
  const atkOrdnung = tacticEffect('angriff', attackerTactic, attackerUnitsIn, terrainType);
  const defOrdnung = tacticEffect('verteidigung', defenderTactic, defenderUnitsIn, terrainType);

  const attackerDefs = withShipKind(unitDefs(attackerFactionId), attackerShipKind);
  const defenderDefs = withShipKind(unitDefs(defenderFactionId), defenderShipKind);

  // A forecast passes its own seed and must not touch the campaign's battle
  // sequence: previewing a fight may never change how that fight turns out.
  const rng = mulberry32(seed === undefined ? battleSeed++ : seed);
  const attacker = cloneUnits(attackerUnitsIn);
  const defender = cloneUnits(defenderUnitsIn);
  const terrainBonus = (TILE_TYPES[terrainType] && TILE_TYPES[terrainType].defense) || 0;
  const attackerCondition = conditionFactor(attackerMorale, attackerExhaustion);
  const defenderCondition = conditionFactor(defenderMorale, defenderExhaustion);

  // Wer stürmt, kommt nur an Tor und Bresche heran: je stärker die Mauer,
  // desto schmaler die Front, auf der überhaupt gefochten werden kann. Die
  // Verteidiger stehen auf ihrer eigenen Mauer und werden davon nicht enger.
  // Und die Ordnung entscheidet mit, wie breit jede Seite aufmarschiert.
  const attackerFrontage = frontageWidth(terrainType, wallMultiplier) * atkOrdnung.front;
  const defenderFrontage = frontageWidth(terrainType) * defOrdnung.front;

  const startAtkStrength = totalStrength(attacker, attackerDefs);
  const startDefStrength = totalStrength(defender, defenderDefs);
  const rounds = [];
  const maxRounds = 12;

  let ranged = openingVolley !== false;
  let outcome = null;
  let endedBy = 'erschöpft';

  for (let round = 1; round <= maxRounds; round++) {
    if (totalCount(attacker) === 0) { outcome = 'defender'; endedBy = 'vernichtet'; break; }
    if (totalCount(defender) === 0) { outcome = 'attacker'; endedBy = 'vernichtet'; break; }

    let atkPower = 0;
    let defPower = 0;
    for (const key of COMBAT_ROLES) {
      const atkDef = attackerDefs[key];
      const defDef = defenderDefs[key];
      const conditions = (unitScale && unitScale[key]) || 1;
      // Wer eine Mauer stürmt, tut das zu Fuß: die Reiterei zählt vor einer
      // Befestigung kaum noch, die Bogenschützen etwas weniger.
      atkPower += (attacker[key] || 0) * atkDef.attack
        * (ranged && atkDef.ranged ? 1 + 0.6 * atkOrdnung.salve : 1) * conditions
        * wallAssaultScale(key, wallMultiplier);
      // Die Steine der Katapulte fallen in der ersten Runde und zählen für
      // das ganze Heer, nicht je Gattung - deshalb nur einmal, beim Fußvolk.
      if (ranged && siegeVolley > 0 && key === 'infantry') {
        atkPower += (attacker[key] || 0) * atkDef.attack * siegeVolley * 0.35 * conditions;
      }
      defPower += (defender[key] || 0) * defDef.defense * (1 + terrainBonus * 0.15)
        * (ranged && defDef.ranged ? 1 + 0.4 * defOrdnung.salve : 1) * conditions;
    }
    const volley = ranged;
    ranged = false;

    // Die eigene Ordnung verstärkt den eigenen Schlag, die des Gegners lässt
    // ihn härter zurückschlagen: der Keil trifft schwer und öffnet die Flanken.
    atkPower *= attackerCondition * attackerMultiplier * attackerVeterancy
      * atkOrdnung.eigen * defOrdnung.gegen;
    defPower *= defenderCondition * wallMultiplier * defenderMultiplier * defenderVeterancy
      * defOrdnung.eigen * atkOrdnung.gegen;

    // Was nicht an die Front passt, wartet dahinter. Fällt vorne genug aus,
    // rückt es nach - deshalb wird der Anteil jede Runde neu bestimmt.
    atkPower *= engagedShare(totalCount(attacker), attackerFrontage);
    defPower *= engagedShare(totalCount(defender), defenderFrontage);

    const variance = () => 0.8 + rng() * 0.4;
    // Die Schonung des Rückzugsgefechts wirkt nicht auf die eigene Kraft,
    // sondern auf das, was der Gegner an einem anrichtet: wer fechtend weicht,
    // gewinnt nichts und verliert wenig. Darum steht sie auf der Seite des
    // Schadens, den man *empfängt*, nicht dessen, den man austeilt.
    const dmgToDefender = atkPower * ATTACK_DAMAGE_SHARE * variance() * defOrdnung.schonung;
    const dmgToAttacker = defPower * DEFENCE_DAMAGE_SHARE * variance() * atkOrdnung.schonung;

    const attackerBefore = totalCount(attacker);
    const defenderBefore = totalCount(defender);
    applyDamage(defender, dmgToDefender, defenderDefs);
    applyDamage(attacker, dmgToAttacker, attackerDefs);

    rounds.push({
      round,
      volley,
      attackerLeft: totalCount(attacker),
      defenderLeft: totalCount(defender),
      attackerLost: attackerBefore - totalCount(attacker),
      defenderLost: defenderBefore - totalCount(defender),
    });

    const atkRemainRatio = totalStrength(attacker, attackerDefs) / Math.max(1, startAtkStrength);
    const defRemainRatio = totalStrength(defender, defenderDefs) / Math.max(1, startDefStrength);
    if (atkRemainRatio < 0.35 && atkRemainRatio < defRemainRatio && rng() < 0.35) {
      outcome = 'defender';
      endedBy = 'Moral gebrochen';
      break;
    }
    if (defRemainRatio < 0.35 && defRemainRatio < atkRemainRatio && rng() < 0.35) {
      outcome = 'attacker';
      endedBy = 'Moral gebrochen';
      break;
    }

    // Wer fechtend weicht, hält das Feld nicht: nach der halben Schlacht bricht
    // er ab. Der Gegner bleibt stehen und hat gewonnen - nur eben gegen ein
    // Heer, das noch da ist.
    if (round >= ABSETZEN_RUNDE) {
      if (defOrdnung.weichen && totalCount(attacker) > 0) {
        outcome = 'attacker';
        endedBy = 'abgesetzt';
        break;
      }
      if (atkOrdnung.weichen && totalCount(defender) > 0) {
        outcome = 'defender';
        endedBy = 'abgesetzt';
        break;
      }
    }
  }

  if (!outcome) {
    const atkRatio = totalStrength(attacker, attackerDefs) / Math.max(1, startAtkStrength);
    const defRatio = totalStrength(defender, defenderDefs) / Math.max(1, startDefStrength);
    // Ties (including stalemates with no casualties at all) favor the defender.
    outcome = atkRatio > defRatio + 0.0001 ? 'attacker' : 'defender';
  }

  return {
    outcome,
    endedBy,
    rounds,
    terrainType,
    terrainBonus,
    attackerFrontage,
    defenderFrontage,
    attackerEngagedShare: engagedShare(totalCount(attackerUnitsIn), attackerFrontage),
    defenderEngagedShare: engagedShare(totalCount(defenderUnitsIn), defenderFrontage),
    wallMultiplier,
    siegeVolley,
    // Womit die Waffengattungen des Angreifers vor dieser Mauer gerechnet
    // wurden - der Bericht soll den Abschlag nennen können.
    assaultScale: wallMultiplier > 1
      ? Object.fromEntries(COMBAT_ROLES
        .map((key) => [key, wallAssaultScale(key, wallMultiplier)])
        .filter(([, value]) => value < 1))
      : null,
    defenderMultiplier,
    attackerMultiplier,
    unitScale,
    weatherScale,
    seaScale,
    openingVolley,
    attackerVeterancy,
    defenderVeterancy,
    // Welche Ordnung jede Seite gefochten hat - der Bericht nennt sie.
    attackerTactic: tacticByKey('angriff', attackerTactic).key,
    defenderTactic: tacticByKey('verteidigung', defenderTactic).key,
    attackerTacticEffect: atkOrdnung,
    defenderTacticEffect: defOrdnung,
    attackerMorale,
    attackerExhaustion,
    defenderMorale,
    defenderExhaustion,
    attackerCondition,
    defenderCondition,
    attackerEngaged: cloneUnits(attackerUnitsIn),
    defenderEngaged: cloneUnits(defenderUnitsIn),
    attackerSurvivors: attacker,
    defenderSurvivors: defender,
    attackerLossesPct: 1 - totalCount(attacker) / Math.max(1, totalCount(attackerUnitsIn)),
    defenderLossesPct: 1 - totalCount(defender) / Math.max(1, totalCount(defenderUnitsIn)),
  };
}

function applyDamage(units, dmg, defs) {
  const strength = totalStrength(units, defs);
  if (strength <= 0 || dmg <= 0) return;
  for (const key of COMBAT_ROLES) {
    const count = units[key] || 0;
    if (count <= 0) continue;
    const share = (count * defs[key].hp) / strength;
    const casualties = Math.round((dmg * share) / defs[key].hp);
    units[key] = Math.max(0, count - casualties);
  }
}


// A stable number for a given match-up, so the same forecast asked twice gives
// the same answer instead of shimmering while the player reads it.
function situationSeed(attacker, defender, terrainType, modifiers) {
  let h = 2166136261;
  const mix = (value) => {
    h ^= Math.round(value * 1000) | 0;
    h = Math.imul(h, 16777619);
  };
  for (const key of COMBAT_ROLES) {
    mix(attacker[key] || 0);
    mix(defender[key] || 0);
  }
  mix(String(terrainType).length);
  mix(modifiers.attackerMorale ?? 100);
  mix(modifiers.attackerExhaustion ?? 0);
  mix(modifiers.defenderMorale ?? 100);
  mix(modifiers.defenderExhaustion ?? 0);
  mix(modifiers.wallMultiplier ?? 1);
  mix(modifiers.defenderMultiplier ?? 1);
  mix(modifiers.attackerMultiplier ?? 1);
  mix(modifiers.openingVolley === false ? 7 : 3);
  mix(modifiers.attackerVeterancy ?? 1);
  mix(modifiers.defenderVeterancy ?? 1);
  mix(String(modifiers.attackerFactionId || '').length);
  mix(String(modifiers.defenderFactionId || '').length);
  for (const key of COMBAT_ROLES) mix((modifiers.unitScale && modifiers.unitScale[key]) ?? 1);
  return h >>> 0;
}

// Plays the same battle through many times to answer the only question the
// player actually has before committing: how likely is this, and what will it
// cost? Runs on copies with its own seeds, so it changes nothing.
export function forecastBattle(attackerUnitsIn, defenderUnitsIn, terrainType, modifiers = {}, sampleCount) {
  const samples = Math.max(1, sampleCount || BATTLE_PREVIEW_SAMPLES);
  const base = situationSeed(attackerUnitsIn, defenderUnitsIn, terrainType, modifiers);

  let wins = 0;
  let attackerLoss = 0;
  let defenderLoss = 0;
  let attackerWipes = 0;
  let defenderWipes = 0;
  const attackerSurvivors = {};
  const defenderSurvivors = {};
  for (const key of COMBAT_ROLES) {
    attackerSurvivors[key] = 0;
    defenderSurvivors[key] = 0;
  }

  let sample = null;
  for (let i = 0; i < samples; i++) {
    const result = resolveBattle(attackerUnitsIn, defenderUnitsIn, terrainType, {
      ...modifiers,
      seed: (base + i * 0x9e3779b9) >>> 0,
    });
    if (result.outcome === 'attacker') wins++;
    attackerLoss += result.attackerLossesPct;
    defenderLoss += result.defenderLossesPct;
    if (totalCount(result.attackerSurvivors) === 0) attackerWipes++;
    if (totalCount(result.defenderSurvivors) === 0) defenderWipes++;
    for (const key of COMBAT_ROLES) {
      attackerSurvivors[key] += result.attackerSurvivors[key] || 0;
      defenderSurvivors[key] += result.defenderSurvivors[key] || 0;
    }
    if (i === 0) sample = result;
  }

  for (const key of COMBAT_ROLES) {
    attackerSurvivors[key] = Math.round(attackerSurvivors[key] / samples);
    defenderSurvivors[key] = Math.round(defenderSurvivors[key] / samples);
  }

  return {
    samples,
    attackerWinChance: wins / samples,
    attackerLossesPct: attackerLoss / samples,
    defenderLossesPct: defenderLoss / samples,
    attackerWipeChance: attackerWipes / samples,
    defenderWipeChance: defenderWipes / samples,
    attackerEngaged: cloneUnits(attackerUnitsIn),
    defenderEngaged: cloneUnits(defenderUnitsIn),
    attackerSurvivors,
    defenderSurvivors,
    terrainType,
    terrainBonus: sample ? sample.terrainBonus : 0,
    attackerFrontage: sample ? sample.attackerFrontage : null,
    defenderFrontage: sample ? sample.defenderFrontage : null,
    attackerEngagedShare: sample ? sample.attackerEngagedShare : 1,
    defenderEngagedShare: sample ? sample.defenderEngagedShare : 1,
    wallMultiplier: modifiers.wallMultiplier ?? 1,
    siegeVolley: modifiers.siegeVolley ?? 0,
    assaultScale: sample ? sample.assaultScale : null,
    defenderMultiplier: modifiers.defenderMultiplier ?? 1,
    attackerMultiplier: modifiers.attackerMultiplier ?? 1,
    unitScale: modifiers.unitScale ?? null,
    weatherScale: modifiers.weatherScale ?? null,
    seaScale: modifiers.seaScale ?? null,
    openingVolley: modifiers.openingVolley !== false,
    attackerVeterancy: modifiers.attackerVeterancy ?? 1,
    defenderVeterancy: modifiers.defenderVeterancy ?? 1,
    // Die Vorschau rechnet mit derselben Ordnung, die später gefochten wird -
    // sonst verspräche sie etwas anderes, als hinterher geschieht.
    attackerTactic: tacticByKey('angriff', modifiers.attackerTactic).key,
    defenderTactic: tacticByKey('verteidigung', modifiers.defenderTactic).key,
    attackerTacticEffect: sample ? sample.attackerTacticEffect : null,
    defenderTacticEffect: sample ? sample.defenderTacticEffect : null,
    attackerFactionId: modifiers.attackerFactionId,
    defenderFactionId: modifiers.defenderFactionId,
    attackerMorale: modifiers.attackerMorale ?? 100,
    attackerExhaustion: modifiers.attackerExhaustion ?? 0,
    defenderMorale: modifiers.defenderMorale ?? 100,
    defenderExhaustion: modifiers.defenderExhaustion ?? 0,
  };
}
