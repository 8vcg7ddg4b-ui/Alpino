import {
  FACTIONS, CITY_DEFS, MAX_MOVEMENT, STARTING_GOLD, MORALE_START,
  DEFAULT_SETTLEMENT_SIZE, settlementTier, TILE_TYPES, factionGarrisonFactor,
  CAPITAL_WALL_LEVEL,
} from './data.js';
import { colOfLon, rowOfLat, lonOfCol, latOfRow } from './geodata.js';
import { rollWeather } from './weather.js';
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
      // Settlements are authored at the coordinates of the real towns; the
      // tile they land on falls out of the map's resolution.
      col: colOfLon(def.lon),
      row: rowOfLat(def.lat),
      lon: def.lon,
      lat: def.lat,
      factionId: def.factionId,
      capital: !!def.capital,
      size,
      population,
      // Capitals are fortified from the outset; every other settlement starts
      // open and has to buy each stage and wait out its construction.
      wallLevel: def.capital ? CAPITAL_WALL_LEVEL : 0,
      wallBuilding: null,
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
        // Nobody starts as a veteran; that has to be earned in the field.
        experience: 0,
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

  // The weather seed travels with the game, so an undo restores the same
  // spell of rain rather than rolling a new one.
  const weatherSeed = Math.floor(Math.random() * 1e9);

  return {
    turn: 1,
    weatherSeed,
    weather: rollWeather(1, null, weatherSeed),
    map,
    factions,
    cities,
    armies,
    selectedArmyId: null,
    selectedCityId: null,
    // The tile the player last clicked, whose terrain the sidebar reports.
    inspectedTile: null,
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

// Where a tile actually is on Earth, in the form people write coordinates.
export function tilePosition(col, row) {
  const lon = lonOfCol(col);
  const lat = latOfRow(row);
  const fmt = (value, positive, negative) =>
    `${Math.abs(value).toFixed(1)}° ${value >= 0 ? positive : negative}`;
  return { lon, lat, label: `${fmt(lat, 'N', 'S')}, ${fmt(lon, 'O', 'W')}` };
}

// Whether an army standing on one tile could, given unlimited time, walk to
// the other. What the answer excludes is exactly what a fleet is for.
export function sameLandmass(state, fromCol, fromRow, toCol, toRow) {
  const { landmass, cols } = state.map;
  if (!landmass) return true;
  const a = landmass[fromRow * cols + fromCol];
  const b = landmass[toRow * cols + toCol];
  return a !== -1 && a === b;
}

export function isWaterTile(state, col, row) {
  if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) return false;
  return state.map.tiles[row][col].type === 'water';
}

// A tile is 54 km across, and the great ancient ports sat up an estuary:
// Hamburg, Bordeaux and London are all seaports without touching open water.
// So a settlement is a port when the sea is within this many tiles.
export const PORT_RANGE = 2;

// The open water a fleet raised in this settlement would actually lie in -
// the nearest free sea tile within reach of the harbour, or null if there is
// none, which is exactly what makes a town landlocked.
export function harbourTile(state, city, requireFree = false) {
  let best = null;
  let bestDistance = Infinity;
  for (let dr = -PORT_RANGE; dr <= PORT_RANGE; dr++) {
    for (let dc = -PORT_RANGE; dc <= PORT_RANGE; dc++) {
      const distance = Math.abs(dc) + Math.abs(dr);
      if (distance === 0 || distance > PORT_RANGE || distance >= bestDistance) continue;
      const col = city.col + dc;
      const row = city.row + dr;
      if (!isWaterTile(state, col, row)) continue;
      if (requireFree && armyAt(state, col, row)) continue;
      bestDistance = distance;
      best = { col, row };
    }
  }
  return best;
}

export function isCoastalCity(state, city) {
  return harbourTile(state, city) !== null;
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
