// Der Spielstand: die einzige Stelle, die einen laufenden Feldzug über eine
// Sitzung hinaus festhält.
//
// Die Karte selbst (`state.map`) gehört nicht zur Ablage. Sie entsteht bei
// jedem Aufruf von `generateMap()` byte-gleich neu: sie hängt an keinem
// echten Zufall, nur an einer festen Startzahl und festen Koordinaten - aus
// demselben Grund teilt schon das Rückgängig in `main.js` die Karte, statt
// sie zu kopieren. Gespeichert wird deshalb nur der bewegliche Teil: Städte,
// Heere, Fraktionen, Beziehungen, das Protokoll - alles, was sich seit dem
// Aufbau verändert haben kann.
import { generateMap } from './mapgen.js';
import { MAP_COLS, MAP_ROWS } from './geodata.js';
import { CITY_DEFS } from './data.js';
import { calendarOfTurn } from './weather.js';

const SAVE_KEY = 'spqr.spielstand';

// Die Form der Ablage, nicht die Version des Spiels: die ändert sich nur,
// wenn sich ändert, was hier hineingeschrieben wird. Ein Spielstand aus einer
// älteren Form wird verworfen statt halb geladen - eine Karte, deren Raster
// sich seither verschoben hat, träfe sonst auf Städte, die nicht mehr auf ihr
// Feld passen.
const SAVE_VERSION = 1;

function readEntry() {
  try {
    const roh = localStorage.getItem(SAVE_KEY);
    if (!roh) return null;
    const eintrag = JSON.parse(roh);
    if (!eintrag || eintrag.version !== SAVE_VERSION || !eintrag.state) return null;
    // Ein Spielstand aus einer Zeit mit anderem Raster oder anderen Orten
    // passt auf keine Karte, die `generateMap()` heute noch aufbaut.
    if (eintrag.mapCols !== MAP_COLS || eintrag.mapRows !== MAP_ROWS
      || eintrag.cityCount !== CITY_DEFS.length) return null;
    return eintrag;
  } catch (err) {
    return null;
  }
}

// Alles außer der Karte und der Wegvorschau - letztere ist reine Anzeige und
// beim nächsten Klick ohnehin neu berechnet.
export function saveGame(state) {
  try {
    const { map, reachable, ...rest } = state;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: SAVE_VERSION,
      mapCols: MAP_COLS,
      mapRows: MAP_ROWS,
      cityCount: CITY_DEFS.length,
      savedAt: Date.now(),
      state: rest,
    }));
    return true;
  } catch (err) {
    // Kein Platz mehr, ein privates Fenster, der Speicher gesperrt - der
    // Feldzug läuft trotzdem weiter, nur eben ohne Fortsetzen.
    return false;
  }
}

// Lädt den gespeicherten Zustand und stellt die Karte daneben, die nie Teil
// der Ablage war.
export function loadGame() {
  const eintrag = readEntry();
  if (!eintrag) return null;
  return { ...eintrag.state, map: generateMap(), reachable: null };
}

export function clearSaveGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Nichts abzuräumen, wenn ohnehin nichts geschrieben werden durfte.
  }
}

// Die Kurzfassung für die Kachel im Hauptmenü - nur die paar Werte, die dort
// stehen, ohne dafür Heere und Städte in einen echten Spielzustand zu heben.
export function saveGameSummary() {
  const eintrag = readEntry();
  if (!eintrag) return null;
  const { state } = eintrag;
  const ich = state.factions.find((f) => f.isPlayer);
  if (!ich) return null;
  const orte = state.cities.filter((c) => c.factionId === ich.id).length;
  const { season, year } = calendarOfTurn(state.turn, state.startYear);
  return {
    fraktion: ich.name,
    farbe: ich.color,
    runde: state.turn,
    jahr: `${season.icon} ${season.name} ${year} v. Chr.`,
    orte,
  };
}
