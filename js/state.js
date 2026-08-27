import {
  FACTIONS, CITY_DEFS, MAX_MOVEMENT, STARTING_GOLD, MORALE_START,
  DEFAULT_SETTLEMENT_SIZE, settlementTier, TILE_TYPES, factionGarrisonFactor,
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
    const size = def.size || DEFAULT_SETTLEMENT_SIZE;
    const tier = settlementTier(size);
    // A settlement's people and garrison come from its tier; being a capital
    // or being independent shifts it within that tier rather than across it.
    const population = def.capital ? tier.populationCapital
      : isNeutral ? tier.populationNeutral : tier.population;
    const base = def.capital ? tier.garrisonCapital
      : isNeutral ? tier.garrisonNeutral : tier.garrison;
    const levy = factionGarrisonFactor(FACTIONS.find((f) => f.id === def.factionId));
    const garrison = {};
    for (const [key, count] of Object.entries(base)) garrison[key] = Math.round(count * levy);
    return {
      id: makeId('city'),
      name: def.name,
      col: def.col,
      row: def.row,
      factionId: def.factionId,
      capital: !!def.capital,
      size,
      population,
      // Capitals are fortified from the outset; every other city has to pay
      // for its walls and wait out the construction.
      walls: def.capital ? 'complete' : 'none',
      wallTurnsLeft: 0,
      garrison,
    };
  });

  const armies = [];
  const DEFAULT_ARMY = { legionary: 300, cavalry: 120, archer: 120 };
  for (const faction of factions) {
    if (faction.isNeutral) continue;
    const capital = cities.find((c) => c.factionId === faction.id && c.capital);
    if (!capital) continue;
    // Most factions field one army from the capital; a faction may instead
    // start with several smaller hosts, which are spread over its towns.
    const rosters = faction.startingArmies || [faction.startingArmy || DEFAULT_ARMY];
    const homes = [capital, ...cities.filter((c) => c.factionId === faction.id && !c.capital)];
    rosters.forEach((units, index) => {
      const home = homes[Math.min(index, homes.length - 1)];
      const label = faction.armyLabel || 'Feldarmee';
      armies.push({
        id: makeId('army'),
        factionId: faction.id,
        col: home.col,
        row: home.row + (faction.id === 'rom' ? -1 : 1),
        movement: MAX_MOVEMENT,
        maxMovement: MAX_MOVEMENT,
        units: { ...units },
        morale: MORALE_START,
        exhaustion: 0,
        // Every army starts on foot; it only puts to sea once it takes ship.
        embarked: false,
        name: rosters.length > 1 ? `${faction.name} ${label} ${index + 1}` : `${faction.name} ${label}`,
      });
    });
  }
  // Nudge starting armies onto valid map tiles, and off the sea and the
  // mountains if a capital happens to sit against one.
  for (const army of armies) {
    army.row = Math.max(0, Math.min(map.rows - 1, army.row));
    army.col = Math.max(0, Math.min(map.cols - 1, army.col));
    if (TILE_TYPES[map.tiles[army.row][army.col].type].impassable) {
      const capital = cities.find((c) => c.factionId === army.factionId && c.capital);
      army.col = capital.col;
      army.row = capital.row;
    }
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

export function isWaterTile(state, col, row) {
  if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) return false;
  return state.map.tiles[row][col].type === 'water';
}

// A settlement counts as a port when it can be reached from open water, which
// is what lets an army take ship there.
export function isCoastalCity(state, city) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .some(([dc, dr]) => isWaterTile(state, city.col + dc, city.row + dr));
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
