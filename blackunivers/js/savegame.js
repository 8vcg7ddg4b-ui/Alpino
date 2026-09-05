// --- Spielstand -----------------------------------------------------------
// Ein Feldzug ist ein Objekt; gespeichert wird es als Text im Browser. Die
// Karte wird nicht mitgespeichert - sie entsteht aus demselben Samen wieder
// genauso, und das spart das Zehnfache an Platz.
import { generateMap, tileAt } from './mapgen.js';
import { tidyUnits } from './state.js';

const KEY = 'blackunivers.save.v1';

export function saveGame(state) {
  try {
    const slim = {
      version: state.version,
      turn: state.turn,
      playerFactionId: state.playerFactionId,
      scenarioId: state.scenarioId,
      factions: state.factions,
      systems: state.systems,
      fleets: state.fleets,
      tradeRoutes: state.tradeRoutes,
      diplomacy: state.diplomacy,
      log: state.log.slice(-120),
      aces: state.aces,
      usedAceNames: state.usedAceNames,
      seen: state.seen,
      victory: state.victory,
      nephilimTurn: state.nephilimTurn,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(slim));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.systems || !data.factions) return null;
    // Die Karte wird neu erzeugt und die Systeme wieder auf ihre Felder
    // gesetzt - sonst wüsste kein Feld, welches System darauf liegt.
    const map = generateMap();
    for (const sys of data.systems) {
      const tile = tileAt(map, sys.col, sys.row);
      if (tile) tile.systemId = sys.id;
    }
    // Ältere Feldzüge führen noch mehrere Staffeln derselben Art neben-
    // einander - hier werden sie zusammengelegt.
    for (const fleet of data.fleets || []) tidyUnits(fleet);
    return { ...data, map, lastBattle: null };
  } catch (err) {
    return null;
  }
}

export function clearSaveGame() {
  try { localStorage.removeItem(KEY); } catch (err) { /* egal */ }
}

// Für die Merktafel im Startbild: was in dem gespeicherten Feldzug steht,
// ohne ihn zu laden.
export function saveGameSummary() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const me = (data.factions || []).find((f) => f.isPlayer);
    if (!me) return null;
    const systems = (data.systems || []).filter((s) => s.factionId === me.id).length;
    const fleets = (data.fleets || []).filter((f) => f.factionId === me.id).length;
    return {
      turn: data.turn,
      factionId: me.id,
      factionName: me.name,
      credits: me.credits,
      systems,
      fleets,
      scenarioId: data.scenarioId,
      savedAt: data.savedAt || null,
    };
  } catch (err) {
    return null;
  }
}
