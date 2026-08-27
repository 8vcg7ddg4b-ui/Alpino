import { UNIT_TYPES, UNIT_ORDER, TILE_TYPES, BATTLE_PREVIEW_SAMPLES } from './data.js';
import { mulberry32 } from './prng.js';

let battleSeed = 42;

function cloneUnits(units) {
  const out = {};
  for (const key of UNIT_ORDER) out[key] = units[key] || 0;
  return out;
}

function totalStrength(units) {
  return UNIT_ORDER.reduce((sum, key) => sum + (units[key] || 0) * UNIT_TYPES[key].hp, 0);
}

function totalCount(units) {
  return UNIT_ORDER.reduce((sum, key) => sum + (units[key] || 0), 0);
}

// Fresh, confident troops hit harder; worn-out ones falter. Both inputs are
// 0-100, and the result stays in a band that never trivialises a battle.
export function conditionFactor(morale, exhaustion) {
  const m = Math.max(0, Math.min(100, morale ?? 100));
  const e = Math.max(0, Math.min(100, exhaustion ?? 0));
  return (0.62 + 0.38 * (m / 100)) * (1 - 0.3 * (e / 100));
}

// Simplified multi-round battle resolver. Runs entirely on the campaign map:
// no separate battle screen. Returns enough detail for a full battle report.
export function resolveBattle(attackerUnitsIn, defenderUnitsIn, terrainType, modifiers = {}) {
  const {
    attackerMorale = 100, attackerExhaustion = 0,
    defenderMorale = 100, defenderExhaustion = 0,
    wallMultiplier = 1, defenderMultiplier = 1, attackerMultiplier = 1, seed,
  } = modifiers;

  // A forecast passes its own seed and must not touch the campaign's battle
  // sequence: previewing a fight may never change how that fight turns out.
  const rng = mulberry32(seed === undefined ? battleSeed++ : seed);
  const attacker = cloneUnits(attackerUnitsIn);
  const defender = cloneUnits(defenderUnitsIn);
  const terrainBonus = (TILE_TYPES[terrainType] && TILE_TYPES[terrainType].defense) || 0;
  const attackerCondition = conditionFactor(attackerMorale, attackerExhaustion);
  const defenderCondition = conditionFactor(defenderMorale, defenderExhaustion);

  const startAtkStrength = totalStrength(attacker);
  const startDefStrength = totalStrength(defender);
  const rounds = [];
  const maxRounds = 12;

  let ranged = true;
  let outcome = null;
  let endedBy = 'erschöpft';

  for (let round = 1; round <= maxRounds; round++) {
    if (totalCount(attacker) === 0) { outcome = 'defender'; endedBy = 'vernichtet'; break; }
    if (totalCount(defender) === 0) { outcome = 'attacker'; endedBy = 'vernichtet'; break; }

    let atkPower = 0;
    let defPower = 0;
    for (const key of UNIT_ORDER) {
      const def = UNIT_TYPES[key];
      const rangedBonus = ranged && def.ranged ? 1.6 : 1;
      atkPower += (attacker[key] || 0) * def.attack * rangedBonus;
      defPower += (defender[key] || 0) * def.defense * (1 + terrainBonus * 0.15) * (ranged && def.ranged ? 1.4 : 1);
    }
    const volley = ranged;
    ranged = false;

    atkPower *= attackerCondition * attackerMultiplier;
    defPower *= defenderCondition * wallMultiplier * defenderMultiplier;

    const variance = () => 0.8 + rng() * 0.4;
    const dmgToDefender = atkPower * 0.55 * variance();
    const dmgToAttacker = defPower * 0.42 * variance();

    const attackerBefore = totalCount(attacker);
    const defenderBefore = totalCount(defender);
    applyDamage(defender, dmgToDefender);
    applyDamage(attacker, dmgToAttacker);

    rounds.push({
      round,
      volley,
      attackerLeft: totalCount(attacker),
      defenderLeft: totalCount(defender),
      attackerLost: attackerBefore - totalCount(attacker),
      defenderLost: defenderBefore - totalCount(defender),
    });

    const atkRemainRatio = totalStrength(attacker) / Math.max(1, startAtkStrength);
    const defRemainRatio = totalStrength(defender) / Math.max(1, startDefStrength);
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
  }

  if (!outcome) {
    const atkRatio = totalStrength(attacker) / Math.max(1, startAtkStrength);
    const defRatio = totalStrength(defender) / Math.max(1, startDefStrength);
    // Ties (including stalemates with no casualties at all) favor the defender.
    outcome = atkRatio > defRatio + 0.0001 ? 'attacker' : 'defender';
  }

  return {
    outcome,
    endedBy,
    rounds,
    terrainType,
    terrainBonus,
    wallMultiplier,
    defenderMultiplier,
    attackerMultiplier,
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

function applyDamage(units, dmg) {
  const strength = totalStrength(units);
  if (strength <= 0 || dmg <= 0) return;
  for (const key of UNIT_ORDER) {
    const count = units[key] || 0;
    if (count <= 0) continue;
    const share = (count * UNIT_TYPES[key].hp) / strength;
    const casualties = Math.round((dmg * share) / UNIT_TYPES[key].hp);
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
  for (const key of UNIT_ORDER) {
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
  for (const key of UNIT_ORDER) {
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
    for (const key of UNIT_ORDER) {
      attackerSurvivors[key] += result.attackerSurvivors[key] || 0;
      defenderSurvivors[key] += result.defenderSurvivors[key] || 0;
    }
    if (i === 0) sample = result;
  }

  for (const key of UNIT_ORDER) {
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
    wallMultiplier: modifiers.wallMultiplier ?? 1,
    defenderMultiplier: modifiers.defenderMultiplier ?? 1,
    attackerMultiplier: modifiers.attackerMultiplier ?? 1,
    attackerMorale: modifiers.attackerMorale ?? 100,
    attackerExhaustion: modifiers.attackerExhaustion ?? 0,
    defenderMorale: modifiers.defenderMorale ?? 100,
    defenderExhaustion: modifiers.defenderExhaustion ?? 0,
  };
}
