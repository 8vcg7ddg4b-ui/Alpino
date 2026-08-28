import {
  FACTIONS, CITY_DEFS, MAX_MOVEMENT, STARTING_GOLD, MORALE_START,
  DEFAULT_SETTLEMENT_SIZE, settlementTier, TILE_TYPES,
  CAPITAL_WALL_LEVEL, DEFAULT_PLAYER_FACTION, WATCH_ROLE, watchTarget,
} from './data.js';
import { colOfLon, rowOfLat, lonOfCol, latOfRow } from './geodata.js';
import { rollWeather } from './weather.js';
import { generateMap, landRoute } from './mapgen.js';

let nextId = 1;
export function makeId(prefix) {
  return `${prefix}_${nextId++}`;
}

// Jede Fraktion außer den Unabhängigen ist spielbar; welche es ist, entscheidet
// der Auswahlbildschirm. Alles andere - Startgold, Garnisonen, Heere - ist für
// alle gleich, damit die Wahl eine Frage der Lage bleibt und nicht der Zahlen.
export function createInitialState(playerFactionId = DEFAULT_PLAYER_FACTION) {
  const map = generateMap();

  const chosen = FACTIONS.some((f) => f.id === playerFactionId && !f.isNeutral)
    ? playerFactionId
    : DEFAULT_PLAYER_FACTION;
  const factions = FACTIONS.map((f) => ({
    ...f,
    isPlayer: f.id === chosen,
    gold: f.isNeutral ? 0 : STARTING_GOLD,
    alive: true,
  }));
  const playerName = factions.find((f) => f.isPlayer).name;

  const cities = CITY_DEFS.map((def) => {
    const isNeutral = def.factionId === 'neutral';
    const size = def.size || DEFAULT_SETTLEMENT_SIZE;
    const tier = settlementTier(size);
    // A settlement's people come from its tier; being a capital or being
    // independent shifts it within that tier rather than across it.
    const population = def.capital ? tier.populationCapital
      : isNeutral ? tier.populationNeutral : tier.population;
    // Jede Siedlung beginnt mit ihrer Stadtwache und sonst nichts. Alles
    // andere in der Garnison ist ausgehoben und kann wieder ausrücken.
    const faction = FACTIONS.find((f) => f.id === def.factionId);
    const garrison = { [WATCH_ROLE]: watchTarget({ population }, faction) };
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
      // Wer am Meer liegt, kann einen Hafen haben - Hauptstädte und Große
      // Städte haben ihn von Anfang an, alle anderen müssen ihn bauen.
      harbour: coastalOnMap(map, colOfLon(def.lon), rowOfLat(def.lat))
        && (!!def.capital || size === 'large'),
      harbourBuilding: null,
      garrison,
    };
  });

  const armies = [];
  const DEFAULT_ARMY = { infantry: 300, cavalry: 120, ranged: 120 };
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
        // Das Feld wird gleich vergeben; hier steht erst einmal der Heimatort.
        col: home.col,
        row: home.row,
        home,
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
  // Jedes Heer stellt sich vor seinen Heimatort - auf begehbaren Boden, nach
  // Möglichkeit nicht in die Wüste und nicht auf ein Feld, das schon besetzt
  // ist. Nur wenn ringsum nichts frei ist, steht es in der Stadt selbst.
  const taken = new Set(cities.map((c) => `${c.col},${c.row}`));
  const tileCost = (col, row) => {
    if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return null;
    const def = TILE_TYPES[map.tiles[row][col].type];
    if (def.impassable) return null;
    if (taken.has(`${col},${row}`)) return null;
    return def.cost;
  };
  for (const army of armies) {
    const home = army.home;
    delete army.home;
    // Rom blickt nach Norden, alle anderen nach Süden - sonst zählt ohnehin
    // nur, welches Feld das günstigste ist.
    const order = army.factionId === 'rom'
      ? [[0, -1], [0, 1], [1, 0], [-1, 0]]
      : [[0, 1], [0, -1], [1, 0], [-1, 0]];
    let best = null;
    let bestCost = Infinity;
    for (const [dc, dr] of order) {
      const cost = tileCost(home.col + dc, home.row + dr);
      if (cost === null || cost >= bestCost) continue;
      bestCost = cost;
      best = { col: home.col + dc, row: home.row + dr };
    }
    army.col = best ? best.col : home.col;
    army.row = best ? best.row : home.row;
    taken.add(`${army.col},${army.row}`);
  }

  // The weather seed travels with the game, so an undo restores the same
  // spell of rain rather than rolling a new one.
  const weatherSeed = Math.floor(Math.random() * 1e9);

  // Jede Fraktion beginnt mit Straßen von ihrer Hauptstadt zu den eigenen
  // Städten - das Netz, das sie über die Jahre schon gebaut hat. Die Dörfer
  // hängen noch nicht daran: dorthin ist die erste Straße Sache des Spielers.
  const roads = {};
  const markRoute = (route) => {
    for (const tile of route) roads[`${tile.col},${tile.row}`] = true;
  };
  const byFaction = new Map();
  for (const city of cities) {
    if (city.factionId === 'neutral') continue;
    if (!byFaction.has(city.factionId)) byFaction.set(city.factionId, []);
    byFaction.get(city.factionId).push(city);
  }
  for (const own of byFaction.values()) {
    const capital = own.find((c) => c.capital) || own[0];
    for (const city of own) {
      if (city === capital || city.size === 'village') continue;
      const route = landRoute(map, capital, city, roads);
      if (route) markRoute(route);
    }
  }

  return {
    turn: 1,
    weatherSeed,
    roads,
    roadProjects: [],
    // Bumped whenever the network changes, so the scene knows to redraw it.
    roadVersion: 0,
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
    log: [{ text: `Das Spiel beginnt. Führe ${playerName} zum Sieg!`, reportId: null }],
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

// Ob offenes Wasser in Hafenreichweite liegt - die Karte allein genügt dafür,
// weshalb die Prüfung schon beim Aufbau des Spielstands möglich ist.
export function coastalOnMap(map, col, row) {
  for (let dr = -PORT_RANGE; dr <= PORT_RANGE; dr++) {
    for (let dc = -PORT_RANGE; dc <= PORT_RANGE; dc++) {
      const distance = Math.abs(dc) + Math.abs(dr);
      if (distance === 0 || distance > PORT_RANGE) continue;
      const tile = map.tiles[row + dr] && map.tiles[row + dr][col + dc];
      if (tile && tile.type === 'water') return true;
    }
  }
  return false;
}

export function isCoastalCity(state, city) {
  return coastalOnMap(state.map, city.col, city.row);
}

export function unitTotalCount(units) {
  return Object.values(units).reduce((sum, n) => sum + n, 0);
}

// Log entries carry an optional battle-report id so the sidebar can turn them
// into links back into the full report.
// Wirtschaftsmeldungen fremder Fraktionen sind Rauschen: über zehn Fraktionen
// hinweg füllen Rekrutierung, Straßen und Häfen das Protokoll so schnell, dass
// die eigene Schlacht darin untergeht. Solche Zeilen erscheinen deshalb nur für
// die eigene Fraktion - Schlachten, Eroberungen und Jahreszeiten für alle.
export function logOwn(state, factionId, msg, reportId = null) {
  const faction = state.factions.find((f) => f.id === factionId);
  if (!faction || !faction.isPlayer) return;
  logMsg(state, msg, reportId);
}

export function logMsg(state, msg, reportId = null) {
  state.log.unshift({ text: msg, reportId });
  if (state.log.length > 60) state.log.length = 60;
}
