// Wandernde Stämme.
//
// Der Osten ist nicht der Rand der Welt, sondern ihre Tür. Alle paar Jahre
// setzt sich dahinter ein Volk in Bewegung und zieht nach Westen, weil dort
// Land ist: Weiber, Kinder, Karren, Herden - und dazwischen mehr wehrhafte
// Männer, als ein Reich auf einmal ins Feld stellt.
//
// Ein solcher Zug führt keinen Feldzug. Er hat eine Richtung und ein Ziel:
// das Reich, das ihm am nächsten liegt. Was ihm im Weg steht, überrennt er.
// Nimmt er einen Ort, ist der Zug zu Ende - dann bleibt das Volk dort, der
// Ort wird unabhängig, und aus dem Wanderer wird ein Nachbar.

import {
  HORDE_FACTION, HORDE_FIRST_TURN, HORDE_MAX, HORDE_CHANCE, HORDE_EDGE,
  HORDE_MOVEMENT, HORDE_MIN_STRENGTH, HORDE_MAX_STRENGTH, HORDE_SHARE,
  HORDE_NAMES, MORALE_START, WATCH_ROLE, tileImpassable,
} from './data.js';
import {
  makeId, unitTotalCount, logMsg, factionById, armyAt, cityAt,
} from './state.js';

export function hordes(state) {
  return state.armies.filter((a) => a.factionId === HORDE_FACTION);
}

export function isHorde(army) {
  return !!army && army.factionId === HORDE_FACTION;
}

function tileDistance(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

// Ein Platz am Ostrand, auf dem ein Zug aufbrechen kann: fester Boden, kein
// Ort, kein Heer - und Platz genug, dass er nicht schon im ersten Schritt vor
// einer Mauer steht.
function eastGate(state, rng) {
  const { cols, rows, tiles } = state.map;
  const belegt = new Set(state.armies.map((a) => `${a.col},${a.row}`));
  const orte = new Set(state.cities.map((c) => `${c.col},${c.row}`));
  const kandidaten = [];
  for (let row = 1; row < rows - 1; row++) {
    for (let col = cols - HORDE_EDGE; col < cols - 1; col++) {
      const tile = tiles[row][col];
      if (!tile || tileImpassable(tile)) continue;
      if (belegt.has(`${col},${row}`) || orte.has(`${col},${row}`)) continue;
      kandidaten.push({ col, row });
    }
  }
  if (!kandidaten.length) return null;
  return kandidaten[Math.floor(rng() * kandidaten.length)];
}

// Wogegen der Zug geht: das Reich, dessen nächster Ort am nächsten liegt.
// Kein Volk sucht sich einen Gegner aus - es zieht dorthin, wo Land ist, und
// das ist die Richtung, in der jemand sitzt.
export function hordeTarget(state, from) {
  let bestFaction = null;
  let bestCity = null;
  let bestDistance = Infinity;
  for (const city of state.cities) {
    const faction = factionById(state, city.factionId);
    if (!faction || faction.isNeutral || !faction.alive) continue;
    const distance = tileDistance(from, city);
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    bestCity = city;
    bestFaction = faction;
  }
  return bestFaction ? { faction: bestFaction, city: bestCity, distance: bestDistance } : null;
}

// Der nächste Ort des Reiches, gegen das der Zug geht - er wandert mit, wenn
// das Reich Orte verliert oder gewinnt.
export function hordeWaypoint(state, horde) {
  let best = null;
  let bestDistance = Infinity;
  for (const city of state.cities) {
    if (horde.gegen && city.factionId !== horde.gegen) continue;
    if (!horde.gegen && city.factionId === HORDE_FACTION) continue;
    const distance = tileDistance(horde, city);
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    best = city;
  }
  // Ist das Reich verschwunden, zieht der Zug auf den nächsten Ort überhaupt.
  if (!best) {
    for (const city of state.cities) {
      const distance = tileDistance(horde, city);
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = city;
    }
  }
  return best;
}

// Ein Volk macht sich auf. Es kostet niemanden etwas, es kündigt sich nicht an
// und es fragt niemanden.
export function spawnHorde(state, rng = Math.random) {
  if (state.turn < HORDE_FIRST_TURN) return null;
  if (hordes(state).length >= HORDE_MAX) return null;
  if (rng() >= HORDE_CHANCE) return null;
  const start = eastGate(state, rng);
  if (!start) return null;
  const ziel = hordeTarget(state, start);
  if (!ziel) return null;

  const staerke = Math.round(
    HORDE_MIN_STRENGTH + rng() * (HORDE_MAX_STRENGTH - HORDE_MIN_STRENGTH)
  );
  const name = HORDE_NAMES[Math.floor(rng() * HORDE_NAMES.length)];
  const horde = {
    id: makeId('army'),
    factionId: HORDE_FACTION,
    col: start.col,
    row: start.row,
    movement: 0,
    maxMovement: HORDE_MOVEMENT,
    units: {
      infantry: Math.round(staerke * HORDE_SHARE.infantry),
      cavalry: Math.round(staerke * HORDE_SHARE.cavalry),
      ranged: Math.round(staerke * HORDE_SHARE.ranged),
    },
    morale: MORALE_START,
    exhaustion: 0,
    experience: 0,
    embarked: false,
    // Wogegen der Zug geht. Er bleibt dabei, auch wenn unterwegs etwas
    // Näheres auftaucht - ein Volk in Bewegung dreht nicht um.
    gegen: ziel.faction.id,
    name: `Zug der ${name}`,
  };
  state.armies.push(horde);
  logMsg(state, `Aus dem Osten zieht ein Volk heran: ${horde.name}, `
    + `${unitTotalCount(horde.units).toLocaleString('de-DE')} wehrhafte Männer. `
    + `Der Zug geht gegen ${ziel.faction.name}.`, null, null);
  return { horde, ziel };
}

// Nimmt ein Zug einen Ort, ist er zu Ende: das Volk bleibt, der Ort wird
// unabhängig, und was von den Wagen übrig ist, steht von da an als Stadtwache
// auf seiner Mauer.
export function settleHordes(state) {
  const gesiedelt = [];
  for (const city of state.cities) {
    if (city.factionId !== HORDE_FACTION) continue;
    city.factionId = 'neutral';
    const horde = armyAt(state, city.col, city.row);
    const leute = horde && isHorde(horde) ? unitTotalCount(horde.units) : 0;
    if (horde && isHorde(horde)) {
      state.armies = state.armies.filter((a) => a.id !== horde.id);
      if (state.selectedArmyId === horde.id) state.selectedArmyId = null;
    }
    // Was gekämpft hat, legt die Waffen nicht ab - es steht jetzt auf der Mauer.
    city.garrison[WATCH_ROLE] = (city.garrison[WATCH_ROLE] || 0) + Math.round(leute * 0.6);
    city.population += Math.round(leute * 1.8);
    gesiedelt.push({ city, horde, leute });
    logMsg(state, `${horde ? horde.name : 'Ein wanderndes Volk'} lässt sich in `
      + `${city.name} nieder. Der Ort steht von nun an für sich.`, null, null);
  }
  return gesiedelt;
}

// Ein Zug, der nirgends mehr hinkann, zerfällt: ohne Ziel und ohne Land löst
// sich ein wanderndes Volk in der Landschaft auf.
export function pruneHordes(state) {
  for (const horde of hordes(state)) {
    if (unitTotalCount(horde.units) > 0) continue;
    state.armies = state.armies.filter((a) => a.id !== horde.id);
  }
}

export function hordesTakeTurn(state, stepTowards, rng = Math.random) {
  spawnHorde(state, rng);
  for (const horde of hordes(state)) {
    horde.movement = horde.maxMovement || HORDE_MOVEMENT;
    // Steht der Zug schon auf einem Ort, wird gesiedelt, nicht gezogen.
    const hier = cityAt(state, horde.col, horde.row);
    if (hier && hier.factionId === HORDE_FACTION) continue;
    const ziel = hordeWaypoint(state, horde);
    if (ziel) stepTowards(state, horde, ziel);
  }
  settleHordes(state);
  pruneHordes(state);
}
