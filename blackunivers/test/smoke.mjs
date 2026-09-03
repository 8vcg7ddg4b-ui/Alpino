// Ein Feldzug ohne Bildschirm: die Regeln werden 80 Züge lang durchgespielt
// und danach befragt. Läuft mit `node blackunivers/test/smoke.mjs`.
import { createInitialState, systemsOf, fleetsOf, factionById, fleetTotalCount, playerFaction } from '../js/state.js';
import { aiTakeAllTurns, setAiStance } from '../js/ai.js';
import { rollEvents, spawnRaiders, moveRaiders, nephilimWave, moveNephilim } from '../js/events.js';
import { endOfTurnFor, resetMovement, updateSieges, pruneTradeRoutes, checkVictory, computeVisibility } from '../js/actions.js';
import { rulersTakeTurn, expireOffers, takeDiploNews } from '../js/diplomacy.js';
import { scenarioById } from '../js/scenarios.js';
import { GAME_NAME, calendarOfTurn } from '../js/data.js';

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) return;
  failures += 1;
  console.error(`FEHLER: ${name}${detail ? ` – ${detail}` : ''}`);
}

const TURNS = Number(process.argv[2] || 80);
const scenario = scenarioById(process.argv[3] || 'vega');
const state = createInitialState('confed', scenario);
setAiStance(1);

// Der Spieler wird in diesem Test von derselben KI geführt - so laufen alle
// Regeln durch, auch die, die nur der Spieler benutzt.
const humanId = state.playerFactionId;
state.factions.find((f) => f.id === humanId).isPlayer = false;
state.playerFactionId = '__test__';

console.log(`${GAME_NAME}: Testfeldzug „${scenario.name}", ${TURNS} Züge`);

for (let turn = 1; turn <= TURNS; turn++) {
  state.turn = turn;
  aiTakeAllTurns(state);
  rulersTakeTurn(state);
  updateSieges(state);
  pruneTradeRoutes(state);
  expireOffers(state);
  spawnRaiders(state);
  moveRaiders(state);
  nephilimWave(state);
  moveNephilim(state);
  for (const f of state.factions) {
    if (f.isNeutral) continue;
    rollEvents(state, f.id);
  }
  takeDiploNews(state);

  // Nach jedem Zug muss die Welt in sich stimmen.
  for (const fleet of state.fleets) {
    check('Flotte hat Verbände', fleet.units.length > 0, fleet.name);
    check('Verbände haben Maschinen', fleet.units.every((u) => u.count > 0), fleet.name);
    check('Flotte steht auf der Karte',
      fleet.col >= 0 && fleet.row >= 0 && fleet.col < state.map.cols && fleet.row < state.map.rows,
      `${fleet.name} @ ${fleet.col},${fleet.row}`);
    const tile = state.map.tiles[fleet.row * state.map.cols + fleet.col];
    check('Flotte nicht im Graben', tile.type !== 'graben', `${fleet.name} in ${tile.zoneName}`);
    check('Zahlen sind Zahlen', Number.isFinite(fleet.morale) && fleet.morale > 0, fleet.name);
  }
  for (const sys of state.systems) {
    check('System hat Besitzer', !!sys.factionId, sys.name);
    check('Bevölkerung positiv', sys.population > 0, sys.name);
    check('Schildstufe im Rahmen', sys.shield.level >= 0 && sys.shield.level <= 4, sys.name);
    check('Schild nicht über 100%', sys.shield.down <= 1.0001, `${sys.name} ${sys.shield.down}`);
  }
  for (const f of state.factions) {
    check('Kredits nicht negativ', f.credits >= 0, `${f.name}: ${f.credits}`);
    check('Kredits sind endlich', Number.isFinite(f.credits), f.name);
  }
}

// --- Bericht --------------------------------------------------------------
const cal = calendarOfTurn(state.turn);
console.log(`\nStand: ${cal.month} ${cal.year}`);
for (const f of state.factions) {
  if (f.isNeutral) continue;
  const sys = systemsOf(state, f.id);
  const flt = fleetsOf(state, f.id);
  const machines = flt.reduce((s, x) => s + fleetTotalCount(x), 0);
  console.log(`${f.name.padEnd(30)} ${String(sys.length).padStart(2)} Systeme, `
    + `${String(flt.length).padStart(2)} Flotten (${String(machines).padStart(3)} Maschinen), `
    + `${String(f.credits).padStart(6)} Kredits, Technik ${Object.values(f.tech).join('/')}, `
    + `Schlachten ${f.stats.battles} (${f.stats.won} gewonnen), erobert ${f.stats.systemsTaken}`);
}
const raiders = fleetsOf(state, 'neutral').length;
console.log(`Freibeuter unterwegs: ${raiders}, Schwarmflotten: ${fleetsOf(state, 'nephilim').length}`);
const battles = state.factions.reduce((s, f) => s + (f.isNeutral ? 0 : f.stats.battles), 0);
const taken = state.factions.reduce((s, f) => s + (f.isNeutral ? 0 : f.stats.systemsTaken), 0);
console.log(`Gefechte insgesamt: ${battles}, Systemwechsel: ${taken}`);

// Ein Feldzug, in dem nichts passiert, ist auch ein Fehler.
check('Es wurde gekämpft', battles > 10, `nur ${battles} Gefechte`);
check('Systeme haben gewechselt', taken > 0, 'keine Eroberung in 80 Zügen');
check('Flotten existieren noch', state.fleets.length > 4, `${state.fleets.length} Flotten`);
check('Diplomatie hat gearbeitet', state.diplomacy.news.length > 0);

if (failures) {
  console.error(`\n${failures} Prüfung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Prüfungen bestanden.');
