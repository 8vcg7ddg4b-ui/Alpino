// Die Weltwunder der Antike und einige weitere Wahrzeichen, die zur Zeit des
// Feldzugs schon standen.
//
// Wie alles Geografische stehen sie hier in echten Längen- und Breitengraden,
// nicht in Feldkoordinaten: auf welchem Feld ein Bauwerk landet, rechnet die
// Karte beim Aufbau aus. Verschiebt sich die Auflösung des Rasters, wandern
// die Bauwerke von selbst mit.
//
// Von den klassischen sieben Weltwundern liegen sechs auf der Karte. Die
// Hängenden Gärten von Babylon stünden bei 44,4° O - gut zwei Grad östlich
// des Kartenrandes, mitten in Mesopotamien. Sie hier an den Rand zu rücken
// wäre geografisch falsch, deshalb fehlen sie.

import { colOfLon, rowOfLat } from './geodata.js';
import { TILE_TYPES } from './data.js';

// Was ein Bauwerk der Fraktion einbringt, die den nächstgelegenen Ort hält.
// Ein Weltwunder zieht Pilger und Händler an und wiegt gut ein halbes Dorf
// auf; ein Wahrzeichen ist weniger wert, aber nicht nichts.
const WONDER_INCOME = 15;
const LANDMARK_INCOME = 6;

// Bis hierhin gilt ein Ort als der Ort des Bauwerks. Weiter entfernt gehört
// es niemandem - Stonehenge liegt so einsam, dass keine Stadt es beansprucht,
// wenn die Britannier ihre Orte verloren haben.
const OWNER_RANGE = 6;

// Bis hierhin wird nach festem Boden gesucht, wenn das rechnerische Feld im
// Meer oder im Hochgebirge liegt - bei 55 km je Feld sind das gut 110 km.
const SNAP_RANGE = 2;

const WONDER_DEFS = [
  {
    id: 'gizeh',
    name: 'Pyramiden von Gizeh',
    model: 'pyramid',
    wonder: true,
    lon: 31.13, lat: 29.98,
    built: 'um 2560 v. Chr.',
    note: 'Das älteste der sieben Weltwunder und das einzige, das noch steht. '
      + 'Zur Zeit des Feldzugs sind die Pyramiden bereits über zwei Jahrtausende alt.',
  },
  {
    id: 'pharos',
    name: 'Leuchtturm von Alexandria',
    model: 'lighthouse',
    wonder: true,
    lon: 29.89, lat: 31.21,
    built: 'um 280 v. Chr.',
    note: 'Der Pharos auf der Insel vor Alexandria weist den Schiffen nachts mit '
      + 'einem Feuer den Weg in den Hafen.',
  },
  {
    id: 'rhodos',
    name: 'Koloss von Rhodos',
    model: 'colossus',
    wonder: true,
    lon: 28.23, lat: 36.44,
    built: '292–280 v. Chr.',
    note: 'Eine Bronzestatue des Helios über dem Hafen von Rhodos, keine dreißig '
      + 'Jahre alt und schon in aller Munde.',
  },
  {
    id: 'halikarnassos',
    name: 'Mausoleum von Halikarnassos',
    model: 'mausoleum',
    wonder: true,
    lon: 27.42, lat: 37.04,
    built: 'um 350 v. Chr.',
    note: 'Das Grabmal des Königs Maussolos von Karien - so berühmt, dass sein Name '
      + 'seither für jedes große Grabmal steht.',
  },
  {
    id: 'ephesos',
    name: 'Artemistempel von Ephesos',
    model: 'temple',
    wonder: true,
    lon: 27.34, lat: 37.95,
    built: 'um 323 v. Chr. neu errichtet',
    note: 'Der größte Tempel der griechischen Welt, 127 Säulen aus Marmor. Nach dem '
      + 'Brand von 356 v. Chr. wurde er noch prächtiger wieder aufgebaut.',
  },
  {
    id: 'olympia',
    name: 'Zeusstatue von Olympia',
    model: 'statue',
    wonder: true,
    lon: 21.63, lat: 37.64,
    built: 'um 435 v. Chr.',
    note: 'Zwölf Meter Gold und Elfenbein im Zeustempel von Olympia, ein Werk des '
      + 'Phidias. Alle vier Jahre kommt die griechische Welt zu den Spielen hierher.',
  },
  {
    id: 'akropolis',
    name: 'Parthenon auf der Akropolis',
    model: 'temple',
    wonder: false,
    lon: 23.73, lat: 37.97,
    built: '447–432 v. Chr.',
    note: 'Der Tempel der Athena Parthenos über Athen, aus der Beute der Perserkriege '
      + 'errichtet.',
  },
  {
    id: 'delphi',
    name: 'Orakel von Delphi',
    model: 'temple',
    wonder: false,
    lon: 22.50, lat: 38.48,
    built: 'um 330 v. Chr. neu errichtet',
    note: 'Das Heiligtum des Apollon am Parnass. Wer einen Krieg beginnen will, fragt '
      + 'zuerst hier - und bekommt eine Antwort, die in beide Richtungen zutrifft.',
  },
  {
    id: 'kapitol',
    name: 'Tempel des Jupiter Optimus Maximus',
    model: 'temple',
    wonder: false,
    lon: 12.48, lat: 41.89,
    built: '509 v. Chr.',
    note: 'Der Staatstempel Roms auf dem Kapitol. Hier endet jeder Triumphzug.',
  },
  {
    id: 'saeulen',
    name: 'Säulen des Herakles',
    model: 'pillars',
    wonder: false,
    lon: -5.35, lat: 36.13,
    built: 'seit jeher',
    note: 'Der Fels von Calpe und der Berg Abyla zu beiden Seiten der Meerenge. '
      + 'Dahinter beginnt für die Alte Welt das Unbekannte.',
  },
  {
    id: 'stonehenge',
    name: 'Steinkreis von Stonehenge',
    model: 'stones',
    wonder: false,
    lon: -1.83, lat: 51.18,
    built: 'um 2500 v. Chr.',
    note: 'Ein Ring aufgerichteter Steine in der Ebene von Salisbury, älter als die '
      + 'Pyramiden von Gizeh in ihrer heutigen Gestalt und schon damals rätselhaft.',
  },
];

// Die Hängenden Gärten stehen nicht auf der Karte - die Auskunft im Spiel sagt
// das lieber, als sie stillschweigend zu unterschlagen.
export const OFFMAP_WONDER = {
  name: 'Hängende Gärten von Babylon',
  where: 'Babylon, 44,4° O – östlich des Kartenrandes',
};

function passableLand(map, col, row) {
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return false;
  const type = map.tiles[row][col].type;
  return type !== 'water' && !TILE_TYPES[type].impassable;
}

// Das rechnerische Feld, und wenn dort Wasser oder Fels ist, das nächste feste
// Feld daneben. Der Koloss stand im Hafen von Rhodos und die Säulen des
// Herakles zu beiden Seiten einer Meerenge: bei 55 km je Feld fällt so etwas
// schnell ins Wasser, und ein Bauwerk auf dem Meer wäre falscher als eines,
// das ein Feld weiter am Ufer steht.
function snapToLand(map, col, row) {
  if (passableLand(map, col, row)) return { col, row, snapped: false };
  for (let radius = 1; radius <= SNAP_RANGE; radius++) {
    let best = null;
    let bestDistance = Infinity;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
        if (!passableLand(map, col + dc, row + dr)) continue;
        const distance = dc * dc + dr * dr;
        if (distance >= bestDistance) continue;
        bestDistance = distance;
        best = { col: col + dc, row: row + dr, snapped: true };
      }
    }
    if (best) return best;
  }
  return null;
}

// Setzt die Bauwerke auf die Karte und schreibt jedem den Ort zu, der ihm am
// nächsten liegt. Wem der Ort gehört, entscheidet sich später von Runde zu
// Runde - der Besitz wechselt mit der Stadt, nicht mit dem Bauwerk.
export function placeWonders(map, cities) {
  const placed = [];
  for (const def of WONDER_DEFS) {
    const spot = snapToLand(map, colOfLon(def.lon), rowOfLat(def.lat));
    if (!spot) continue;
    let home = null;
    let bestDistance = Infinity;
    for (const city of cities) {
      const distance = Math.abs(city.col - spot.col) + Math.abs(city.row - spot.row);
      if (distance > OWNER_RANGE || distance >= bestDistance) continue;
      bestDistance = distance;
      home = city;
    }
    placed.push({
      id: def.id,
      name: def.name,
      model: def.model,
      wonder: def.wonder,
      built: def.built,
      note: def.note,
      lon: def.lon,
      lat: def.lat,
      col: spot.col,
      row: spot.row,
      income: def.wonder ? WONDER_INCOME : LANDMARK_INCOME,
      cityId: home ? home.id : null,
    });
  }
  return placed;
}

export function wonderAt(state, col, row) {
  if (!state || !state.wonders) return null;
  return state.wonders.find((w) => w.col === col && w.row === row) || null;
}

export function wondersOfCity(state, cityId) {
  if (!state || !state.wonders) return [];
  return state.wonders.filter((w) => w.cityId === cityId);
}

// Was die Bauwerke einer Fraktion in dieser Runde einbringen.
export function wonderIncomeOf(state, factionId) {
  if (!state.wonders) return 0;
  let sum = 0;
  for (const wonder of state.wonders) {
    if (!wonder.cityId) continue;
    const city = state.cities.find((c) => c.id === wonder.cityId);
    if (city && city.factionId === factionId) sum += wonder.income;
  }
  return sum;
}
