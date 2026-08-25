import { UNIT_TYPES, UNIT_ORDER, TILE_TYPES } from './data.js';
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

// Simplified multi-round battle resolver. Runs entirely on the campaign map:
// no separate battle screen, just a resolved outcome plus a readable log.
export function resolveBattle(attackerUnitsIn, defenderUnitsIn, terrainType) {
  const rng = mulberry32(battleSeed++);
  const attacker = cloneUnits(attackerUnitsIn);
  const defender = cloneUnits(defenderUnitsIn);
  const terrainBonus = (TILE_TYPES[terrainType] && TILE_TYPES[terrainType].defense) || 0;

  const startAtkStrength = totalStrength(attacker);
  const startDefStrength = totalStrength(defender);
  const rounds = [];
  const maxRounds = 12;

  let ranged = true;
  let outcome = null;

  for (let round = 1; round <= maxRounds; round++) {
    if (totalCount(attacker) === 0) { outcome = 'defender'; break; }
    if (totalCount(defender) === 0) { outcome = 'attacker'; break; }

    let atkPower = 0;
    let defPower = 0;
    for (const key of UNIT_ORDER) {
      const def = UNIT_TYPES[key];
      const rangedBonus = ranged && def.ranged ? 1.6 : 1;
      atkPower += (attacker[key] || 0) * def.attack * rangedBonus;
      defPower += (defender[key] || 0) * def.defense * (1 + terrainBonus * 0.15) * (ranged && def.ranged ? 1.4 : 1);
    }
    ranged = false;

    const variance = () => 0.8 + rng() * 0.4;
    const dmgToDefender = atkPower * 0.55 * variance();
    const dmgToAttacker = defPower * 0.42 * variance();

    applyDamage(defender, dmgToDefender);
    applyDamage(attacker, dmgToAttacker);

    rounds.push({
      round,
      attackerLeft: totalCount(attacker),
      defenderLeft: totalCount(defender),
    });

    const atkRemainRatio = totalStrength(attacker) / Math.max(1, startAtkStrength);
    const defRemainRatio = totalStrength(defender) / Math.max(1, startDefStrength);
    if (atkRemainRatio < 0.35 && atkRemainRatio < defRemainRatio && rng() < 0.35) {
      outcome = 'defender';
      break;
    }
    if (defRemainRatio < 0.35 && defRemainRatio < atkRemainRatio && rng() < 0.35) {
      outcome = 'attacker';
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
    rounds,
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
