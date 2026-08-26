import {
  FACTIONS, CITY_DEFS, MAX_MOVEMENT, STARTING_GOLD, MORALE_START,
} from './data.js';
import { generateMap } from './mapgen.js';

let nextId = 1;
export function makeId(prefix) {
  return `${prefix}_${nextId++}`;
}

export function createInitialState() {
  const map = generateMap();

  const factions = FACTIONS.map((f) => ({
    ...f,
    gold: f.isNeutral ? 0 : STARTING_GOLD,
    alive: true,
  }));

  const cities = CITY_DEFS.map((def) => {
    const isNeutral = def.factionId === 'neutral';
    return {
      id: makeId('city'),
      name: def.name,
      col: def.col,
      row: def.row,
      factionId: def.factionId,
      capital: !!def.capital,
      population: def.capital ? 6000 : isNeutral ? 2000 : 3500,
      // Capitals are fortified from the outset; every other city has to pay
      // for its walls and wait out the construction.
      walls: def.capital ? 'complete' : 'none',
      wallTurnsLeft: 0,
      garrison: def.capital
        ? { legionary: 250, cavalry: 80, archer: 80 }
        : isNeutral
        ? { legionary: 120 }
        : { legionary: 150, archer: 80 },
    };
  });

  const armies = [];
  for (const faction of factions) {
    if (faction.isNeutral) continue;
    const capital = cities.find((c) => c.factionId === faction.id && c.capital);
    if (!capital) continue;
    armies.push({
      id: makeId('army'),
      factionId: faction.id,
      col: capital.col,
      row: capital.row + (faction.id === 'rom' ? -1 : 1),
      movement: MAX_MOVEMENT,
      maxMovement: MAX_MOVEMENT,
      units: { legionary: 300, cavalry: 120, archer: 120 },
      morale: MORALE_START,
      exhaustion: 0,
      name: `${faction.name} Feldarmee`,
    });
  }
  // Nudge starting armies onto valid map tiles.
  for (const army of armies) {
    army.row = Math.max(0, Math.min(map.rows - 1, army.row));
    army.col = Math.max(0, Math.min(map.cols - 1, army.col));
  }

  return {
    turn: 1,
    map,
    factions,
    cities,
    armies,
    selectedArmyId: null,
    selectedCityId: null,
    reachable: null,
    log: [{ text: 'Das Spiel beginnt. Führe Rom zum Sieg!', reportId: null }],
    battleReports: [],
    gameOver: null,
    cam: { x: 0, y: 0 },
  };
}

export function playerFaction(state) {
  return state.factions.find((f) => f.isPlayer);
}

export function factionById(state, id) {
  return state.factions.find((f) => f.id === id);
}

export function cityAt(state, col, row) {
  return state.cities.find((c) => c.col === col && c.row === row);
}

export function armyAt(state, col, row) {
  return state.armies.find((a) => a.col === col && a.row === row);
}

export function unitTotalCount(units) {
  return Object.values(units).reduce((sum, n) => sum + n, 0);
}

// Log entries carry an optional battle-report id so the sidebar can turn them
// into links back into the full report.
export function logMsg(state, msg, reportId = null) {
  state.log.unshift({ text: msg, reportId });
  if (state.log.length > 60) state.log.length = 60;
}
