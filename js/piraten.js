// Seeräuber.
//
// Sie sind keine Macht, mit der man verhandelt: kein Herrscher, keine Stadt,
// kein Vertrag, kein Sieg. Sie sind das, was auf dem Wasser liegt, sobald es
// niemand mehr streitig macht - ein Geschwader schneller Anderthalbruderer,
// das Transporter aufbringt, vor den Häfen kreuzt und die Seehandelswege
// beschneidet, bis jemand mit einer Kriegsflotte kommt und es versenkt.
//
// Ihre ganze Stärke ist die Geschwindigkeit: sie fahren schneller als jede
// gebaute Flotte und schlagen härter zu, als ihre Zahl vermuten lässt. Ihre
// ganze Schwäche ist der offene Kampf: wer sie stellt, gewinnt.

import {
  PIRATE_FACTION, PIRATE_FIRST_TURN, PIRATE_MAX, PIRATE_CHANCE, PIRATE_BATCH,
  PIRATE_MAX_SHIPS, PIRATE_MOVEMENT, PIRATE_LOOT, PIRATE_BLOCKADE_RANGE,
  PIRATE_TOLL, PIRATE_HUNT_RANGE, SHIP_ROLE, GARRISON_MORALE, SHIP_TYPES,
} from './data.js';
import {
  makeId, unitTotalCount, isFleet, isWaterTile, logMsg, factionById,
} from './state.js';

// Wie ein Geschwader heißt. Der Name kommt vom Ort, vor dem es zuerst gesehen
// wurde - so hieß es damals auch: die Seeräuber von Kilikien, die von Illyrien.
const PIRATE_HOMES = [
  'Kilikien', 'Illyrien', 'Kreta', 'Liparische Inseln', 'Balearen',
  'Pamphylien', 'Sardinien', 'Kyrenaika', 'Ligurien', 'Istrien',
];

export function pirateFleets(state) {
  return state.armies.filter((a) => a.factionId === PIRATE_FACTION);
}

export function isPirate(army) {
  return !!army && army.factionId === PIRATE_FACTION;
}

function tileDistance(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

// Wo Handel fährt: die Häfen der Reiche. Dort lohnt sich das Kreuzen, und
// nirgends sonst.
function harbourCities(state) {
  return state.cities.filter((c) => c.harbour && c.factionId !== 'neutral');
}

// Ein Auslaufplatz: offenes Wasser in der Nähe eines Hafens, aber nicht dort,
// wo schon eine Kriegsflotte liegt - Seeräuber suchen die leere See.
function raidingGround(state, rng) {
  const haefen = harbourCities(state);
  if (!haefen.length) return null;
  const flotten = state.armies.filter((a) => isFleet(a) && !isPirate(a));
  const belegt = new Set(state.armies.map((a) => `${a.col},${a.row}`));
  let best = null;
  let bestScore = -Infinity;
  for (let versuch = 0; versuch < 240; versuch++) {
    const hafen = haefen[Math.floor(rng() * haefen.length)];
    const col = hafen.col + Math.round((rng() - 0.5) * 12);
    const row = hafen.row + Math.round((rng() - 0.5) * 12);
    if (!isWaterTile(state, col, row)) continue;
    if (belegt.has(`${col},${row}`)) continue;
    const naeheHafen = tileDistance({ col, row }, hafen);
    if (naeheHafen < 2 || naeheHafen > 7) continue;
    // Je weiter die nächste Kriegsflotte, desto lieber. Wer eine Küste
    // bewacht, sieht dort keine Seeräuber.
    let wache = Infinity;
    for (const flotte of flotten) wache = Math.min(wache, tileDistance({ col, row }, flotte));
    const score = Math.min(wache, 20) - naeheHafen * 0.5 + rng();
    if (score <= bestScore) continue;
    bestScore = score;
    best = { col, row, hafen };
  }
  return best;
}

// Ein neues Geschwader läuft aus. Es gehört niemandem, es kostet niemanden
// etwas, und es kündigt sich nicht an - man sieht es, wenn es da ist.
export function spawnPirates(state, rng = Math.random) {
  if (state.turn < PIRATE_FIRST_TURN) return null;
  const vorhanden = pirateFleets(state);
  if (vorhanden.length >= PIRATE_MAX) return null;
  if (rng() >= PIRATE_CHANCE) return null;
  const platz = raidingGround(state, rng);
  if (!platz) return null;

  const heimat = PIRATE_HOMES[Math.floor(rng() * PIRATE_HOMES.length)];
  const fleet = {
    id: makeId('army'),
    factionId: PIRATE_FACTION,
    col: platz.col,
    row: platz.row,
    movement: 0,
    maxMovement: PIRATE_MOVEMENT,
    units: { [SHIP_ROLE]: PIRATE_BATCH },
    morale: GARRISON_MORALE,
    exhaustion: 0,
    experience: 0,
    embarked: true,
    shipKind: 'hemiolia',
    name: `Seeräuber von ${heimat}`,
  };
  state.armies.push(fleet);
  logMsg(state, `Vor ${platz.hafen.name} werden Seeräuber gesichtet: `
    + `${PIRATE_BATCH} ${SHIP_TYPES.hemiolia.name} unter schwarzem Segel.`, null,
  [platz.hafen.factionId]);
  return { fleet, hafen: platz.hafen };
}

// Was ein Geschwader jagt: zuerst ein Heer auf Transportern - das ist die
// Beute, für die es fährt -, dann eine schwächere Kriegsflotte, sonst der
// nächste Hafen, vor dem es sich legt.
export function pirateTarget(state, fleet) {
  let best = null;
  let bestScore = -Infinity;
  for (const other of state.armies) {
    if (other.factionId === PIRATE_FACTION) continue;
    if (!other.embarked) continue;
    const distance = tileDistance(fleet, other);
    if (distance > PIRATE_HUNT_RANGE) continue;
    const meine = unitTotalCount(fleet.units);
    const seine = unitTotalCount(other.units);
    // Ein Transporter ist Beute, eine Kriegsflotte ein Risiko - und eine, die
    // stärker ist als man selbst, gar nichts.
    const beute = isFleet(other) ? (seine < meine * 0.8 ? 4 : -99) : 12;
    const score = beute - distance;
    if (score <= bestScore) continue;
    bestScore = score;
    best = other;
  }
  if (best) return { ziel: best, art: 'beute' };

  // Nichts auf See: dann legt man sich vor einen Hafen und wartet.
  let hafen = null;
  let nah = Infinity;
  for (const city of harbourCities(state)) {
    const distance = tileDistance(fleet, city);
    if (distance >= nah) continue;
    nah = distance;
    hafen = city;
  }
  return hafen ? { ziel: hafen, art: 'blockade' } : null;
}

// Liegt ein Geschwader nahe genug an diesem Feld, um zu nehmen, was dort
// vorbeifährt? Danach richtet sich, was ein Seehandelsweg noch abwirft.
export function pirateNear(state, col, row, range = PIRATE_BLOCKADE_RANGE) {
  return pirateFleets(state).some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) <= range);
}

// Was von einem Seehandelsweg übrig bleibt: nichts, wenn keiner kreuzt, die
// Hälfte, wenn einer vor einem der beiden Häfen liegt.
export function pirateTollFactor(state, a, b) {
  const bedroht = pirateNear(state, a.col, a.row) || pirateNear(state, b.col, b.row);
  return bedroht ? 1 - PIRATE_TOLL : 1;
}

// Wird ein Geschwader versenkt, findet der Sieger, was in seinem Laderaum
// liegt. Das ist der einzige Grund, sie überhaupt zu jagen.
export function pirateLoot(state, victorFactionId, sunkShips) {
  const faction = factionById(state, victorFactionId);
  if (!faction || faction.isNeutral) return 0;
  const beute = Math.round(PIRATE_LOOT * Math.min(1, sunkShips / PIRATE_BATCH));
  if (beute <= 0) return 0;
  faction.gold += beute;
  logMsg(state, `Aus den Laderäumen der Seeräuber kommen ${beute} Gold Beute.`,
    null, [victorFactionId]);
  return beute;
}

// Ein Geschwader wächst, solange es ungestört fährt: wer nimmt, hat bald mehr
// Schiffe. Ohne das wären sie nach zwei Runden kein Thema mehr.
const PIRATE_GROWTH = 3;

export function piratesTakeTurn(state, stepTowards, rng = Math.random) {
  spawnPirates(state, rng);
  for (const fleet of pirateFleets(state)) {
    fleet.movement = fleet.maxMovement || PIRATE_MOVEMENT;
    const ships = fleet.units[SHIP_ROLE] || 0;
    if (ships > 0 && ships < PIRATE_MAX_SHIPS) {
      fleet.units[SHIP_ROLE] = Math.min(PIRATE_MAX_SHIPS, ships + PIRATE_GROWTH);
    }
    const target = pirateTarget(state, fleet);
    if (target) stepTowards(state, fleet, target.ziel);
  }
}
