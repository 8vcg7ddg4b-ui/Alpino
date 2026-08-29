import {
  FACTIONS, CITY_DEFS, MAX_MOVEMENT, STARTING_GOLD, MORALE_START,
  DEFAULT_SETTLEMENT_SIZE, settlementTier, TILE_TYPES,
  CAPITAL_WALL_LEVEL, DEFAULT_PLAYER_FACTION, WATCH_ROLE, watchTarget,
  UNIT_ROLES, SHIP_ROLE, RIVER_CROSSING_COST, TRADE_GOODS,
  tileImpassable, tileMoveCost,
} from './data.js';
import { colOfLon, rowOfLat, lonOfCol, latOfRow } from './geodata.js';
import { rollWeather } from './weather.js';
import { rulerFor } from './rulers.js';
import { initRelations, seedKnowledge } from './diplomacy.js';
import { generateMap, landRoute, riverEdgeKey } from './mapgen.js';
import { placeWonders } from './wonders.js';

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
    // Jede Fraktion hat einen Herrscher. Der Spieler ist nicht Zuschauer einer
    // Fraktion, sondern dieser eine Mann - seine Eigenschaften stehen ihm im
    // Diplomatiefenster gegenüber wie die aller anderen.
    ruler: f.isNeutral ? null : { ...rulerFor(f.id) },
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
    rosters.forEach((entry, index) => {
      // Ein Eintrag ist entweder die Truppenliste selbst oder ein Paar aus
      // Liste und Standort: Karthagos zweites Heer steht in Karthago Nova und
      // nicht dort, wo die Reihenfolge der Städte es hinstellen würde.
      const units = entry.units || entry;
      const home = (entry.home && cities.find(
        (c) => c.name === entry.home && c.factionId === faction.id
      )) || homes[Math.min(index, homes.length - 1)];
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
    const tile = map.tiles[row][col];
    if (tileImpassable(tile)) return null;
    if (taken.has(`${col},${row}`)) return null;
    return tileMoveCost(tile);
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

  // Jede Fraktion beginnt mit Straßen von ihrer Hauptstadt zu allen eigenen
  // Orten - das Netz, das sie über die Jahre schon gebaut hat. Auch die
  // Dörfer hängen daran: eine Fraktion, die ihr Land seit Generationen hält,
  // hat den Weg dorthin längst getreten, und wer beim ersten Blick in die
  // Bauliste eine Straße angeboten bekommt, die auf der Karte schon liegt,
  // hält das mit Recht für einen Fehler.
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
  // Gebaut wird wie ein Netz wächst, nicht wie ein Stern: angeschlossen wird
  // jeweils der Ort, dessen Weg ans bestehende Netz gerade am kürzesten ist.
  // Alles von der Hauptstadt aus einzeln anzubinden legte zwei Trassen
  // nebeneinander, sobald zwei Orte in dieselbe Richtung lagen.
  for (const own of byFaction.values()) {
    const capital = own.find((c) => c.capital) || own[0];
    const angeschlossen = [capital];
    const offen = own.filter((c) => c !== capital);
    while (offen.length) {
      let bester = null;
      for (let i = 0; i < offen.length; i++) {
        for (const quelle of angeschlossen) {
          const route = landRoute(map, quelle, offen[i], roads);
          if (!route) continue;
          if (!bester || route.length < bester.route.length) bester = { index: i, route };
        }
      }
      if (!bester) break;
      markRoute(bester.route);
      angeschlossen.push(offen[bester.index]);
      offen.splice(bester.index, 1);
    }
  }

  // Die unabhängigen Orte hängen an keiner Hauptstadt - aber ein Ort ohne
  // jeden Weg sieht auf der Karte verlassen aus, und Tarent und Syrakus waren
  // alles andere als das. Jeder bekommt deshalb den kurzen Weg zu seinem
  // nächsten Nachbarn, gleich wem der gehört.
  const NEUTRAL_ROAD_RANGE = 9;
  for (const city of cities) {
    if (city.factionId !== 'neutral') continue;
    let naechster = null;
    for (const other of cities) {
      if (other === city) continue;
      const d = Math.abs(other.col - city.col) + Math.abs(other.row - city.row);
      if (d > NEUTRAL_ROAD_RANGE) continue;
      if (!naechster || d < naechster.d) naechster = { city: other, d };
    }
    if (!naechster) continue;
    const route = landRoute(map, city, naechster.city, roads);
    if (route) markRoute(route);
  }

  const state = {
    turn: 1,
    weatherSeed,
    // Die Bauwerke der Alten Welt stehen schon, bevor der erste Zug gemacht
    // wird - sie werden nicht gebaut, sie werden erobert.
    wonders: placeWonders(map, cities),
    roads,
    roadProjects: [],
    // Handelswege zwischen zwei eigenen Orten. Sie stehen hier und nicht an
    // der Stadt, weil ein Weg immer zwei Enden hat und beide dasselbe meinen.
    tradeRoutes: [],
    // Wer mit wem im Krieg steht und was man voneinander hält.
    relations: initRelations(factions),
    // Wer wen überhaupt kennt - wird gleich nach dem Aufbau gesetzt, weil
    // dafür Städte und Fraktionen schon zusammenstehen müssen.
    known: {},
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
  // Wer wen kennt, hängt an den Städten - also erst, wenn der Spielstand steht.
  seedKnowledge(state);
  return state;
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
// --- Flüsse und Brücken ----------------------------------------------------
// Ein Fluss liegt zwischen zwei Feldern, nicht auf einem. Ob zwei Felder durch
// Wasser getrennt sind, ist deshalb eine Frage an die Kante zwischen ihnen.

export function riverBetween(state, colA, rowA, colB, rowB) {
  const rivers = state.map && state.map.rivers;
  return !!rivers && rivers.has(riverEdgeKey(colA, rowA, colB, rowB));
}

// Wer eine Straße über den Fluss legt, baut die Brücke mit: liegt auf beiden
// Ufern Pflaster, steht dort eine Brücke. Das braucht keinen eigenen Bau und
// keinen eigenen Zustand - die Brücke ist das, was die Straße dort tut.
export function bridgeBetween(state, colA, rowA, colB, rowB) {
  const roads = state.roads;
  if (!roads) return false;
  return !!roads[`${colA},${rowA}`] && !!roads[`${colB},${rowB}`];
}

export function riverCrossingCost(state, colA, rowA, colB, rowB) {
  if (!riverBetween(state, colA, rowA, colB, rowB)) return 0;
  return bridgeBetween(state, colA, rowA, colB, rowB) ? 0 : RIVER_CROSSING_COST;
}

// Die Flussseiten eines Felds, für die Geländeauskunft.
export function riverSidesOf(state, col, row) {
  const sides = [];
  for (const [dc, dr, name] of [[0, -1, 'Norden'], [1, 0, 'Osten'], [0, 1, 'Süden'], [-1, 0, 'Westen']]) {
    if (!riverBetween(state, col, row, col + dc, row + dr)) continue;
    sides.push({ name, bridged: bridgeBetween(state, col, row, col + dc, row + dr) });
  }
  return sides;
}

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

// Was ein Ort hervorbringt, ergibt sich aus dem Land, auf dem er steht: Salz
// aus der Wüste, Holz aus dem Wald, Erz aus den Hügeln, Pferde aus der weiten
// Ebene des Ostens, Wein und Öl aus dem Süden, Getreide aus dem Norden. Wo
// nichts davon zutrifft, lebt eine Küstenstadt vom Meer.
//
// Die Zuordnung hängt nur an Gelände und Lage, nicht am Zufall: derselbe Ort
// bringt in jedem Feldzug dasselbe hervor.
// Wie viele Felder im Umland eines Ortes von einer Art sind. Eine Siedlung
// steht immer auf ebenem Grund - was sie hervorbringt, wächst deshalb nicht
// auf ihrem Feld, sondern in den Feldern um sie herum.
const HINTERLAND = 2;
const HINTERLAND_MIN = 4;

function hinterlandType(state, city) {
  const counts = {};
  for (let dr = -HINTERLAND; dr <= HINTERLAND; dr++) {
    const row = state.map.tiles[city.row + dr];
    if (!row) continue;
    for (let dc = -HINTERLAND; dc <= HINTERLAND; dc++) {
      const tile = row[city.col + dc];
      if (tile) counts[tile.type] = (counts[tile.type] || 0) + 1;
    }
  }
  // Die Reihenfolge entscheidet, wenn zweierlei ums Umland streitet: das
  // Auffälligere gewinnt, das Gebirge vor dem Wald.
  return ['mountain', 'hills', 'forest', 'desert']
    .find((type) => (counts[type] || 0) >= HINTERLAND_MIN) || null;
}

export function tradeGoodOf(state, city) {
  const around = hinterlandType(state, city);
  if (around === 'mountain' || around === 'hills') return 'erz';
  if (around === 'forest') return 'holz';
  if (around === 'desert') return 'salz';
  const lat = latOfRow(city.row);
  const lon = lonOfCol(city.col);
  if (lon > 28 && lat > 44) return 'pferde';
  if (lat < 38) return 'oel';
  if (lat < 42) return 'wein';
  if (isCoastalCity(state, city)) return 'fisch';
  return 'getreide';
}

export function tradeGoodInfo(state, city) {
  const key = tradeGoodOf(state, city);
  return { key, ...TRADE_GOODS[key] };
}

// Eine Flotte ist eine Armee, die nur aus Schiffen besteht: sie fährt zur See,
// sie kämpft zur See, und sie geht nie an Land. Ein Landheer auf Transportern
// ist keine Flotte - es ist eingeschifft.
export function isFleet(army) {
  if (!army || !army.units) return false;
  return (army.units[SHIP_ROLE] || 0) > 0
    && UNIT_ROLES.every((key) => !(army.units[key] > 0));
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
  logMsg(state, msg, reportId, [factionId]);
}

// factions nennt, wen die Meldung angeht. Eine Zeile ohne Angabe gilt für
// alle - Jahreszeit, Wetter, Spielbeginn -, und das Protokoll kann danach
// filtern: standardmäßig zeigt es nur, was die eigene Fraktion betrifft.
export function logMsg(state, msg, reportId = null, factions = null) {
  state.log.unshift({ text: msg, reportId, factions });
  if (state.log.length > 60) state.log.length = 60;
}
