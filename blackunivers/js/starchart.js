// --- Die Sternkarte -------------------------------------------------------
// Wie in Pax Aeterna die Geografie in Längen- und Breitengraden liegt, liegt
// hier der bekannte Raum in Chartkoordinaten: x läuft von der terranischen
// Kernwelt im Westen bis nach Kilrah im Osten, y vom Firekka-Rand im Norden
// bis in den Gemini-Sektor im Süden. Ein Feld ist ein Sprungabschnitt von
// rund acht Lichtjahren.
export const GRID_COLS = 76;
export const GRID_ROWS = 42;

// Der Ausschnitt der Karte in Chartkoordinaten.
export const CHART_X0 = 0;
export const CHART_X1 = 100;
export const CHART_Y0 = 0;
export const CHART_Y1 = 56;

export function colOfX(x) {
  const t = (x - CHART_X0) / (CHART_X1 - CHART_X0);
  return Math.max(0, Math.min(GRID_COLS - 1, Math.round(t * (GRID_COLS - 1))));
}
export function rowOfY(y) {
  const t = (y - CHART_Y0) / (CHART_Y1 - CHART_Y0);
  return Math.max(0, Math.min(GRID_ROWS - 1, Math.round(t * (GRID_ROWS - 1))));
}
export function xOfCol(col) {
  return CHART_X0 + (col / (GRID_COLS - 1)) * (CHART_X1 - CHART_X0);
}
export function yOfRow(row) {
  return CHART_Y0 + (row / (GRID_ROWS - 1)) * (CHART_Y1 - CHART_Y0);
}

// Die acht Sektoren des bekannten Raums. Sie sind Rechtecke auf der Chart und
// stehen im Kartenrand, damit man weiß, wo man gerade steht.
export const SECTORS = [
  { id: 'sol', name: 'Sol-Sektor', x0: 0, x1: 22, y0: 18, y1: 40 },
  { id: 'vega', name: 'Vega-Sektor', x0: 22, x1: 46, y0: 14, y1: 34 },
  { id: 'enigma', name: 'Enigma-Sektor', x0: 46, x1: 68, y0: 8, y1: 26 },
  { id: 'kilrah', name: 'Kilrah-Sektor', x0: 68, x1: 100, y0: 0, y1: 22 },
  { id: 'grenzwelten', name: 'Grenzwelten', x0: 34, x1: 62, y0: 26, y1: 42 },
  { id: 'gemini', name: 'Gemini-Sektor', x0: 8, x1: 34, y0: 40, y1: 56 },
  { id: 'landreich', name: 'Landreich', x0: 62, x1: 92, y0: 30, y1: 56 },
  { id: 'firekka', name: 'Firekka-Rand', x0: 28, x1: 52, y0: 0, y1: 12 },
];

export function sectorOfChart(x, y) {
  for (const s of SECTORS) {
    if (x >= s.x0 && x < s.x1 && y >= s.y0 && y < s.y1) return s;
  }
  return { id: 'tiefe', name: 'Tiefer Raum' };
}

export function sectorOfTile(col, row) {
  return sectorOfChart(xOfCol(col), yOfRow(row));
}

// Nebelbänke: dort stören die Sensoren, und Flotten verschwinden aus der
// Fernsicht. Jede Bank ist eine Ellipse auf der Chart.
export const NEBULA_ZONES = [
  { name: 'Enigma-Nebel', x: 55, y: 15, rx: 9, ry: 6 },
  { name: 'Der Schleier von Ghorah Khar', x: 63, y: 22, rx: 6, ry: 4 },
  { name: 'Charybdis-Wolke', x: 30, y: 44, rx: 8, ry: 5 },
  { name: 'Kilrah-Schleier', x: 88, y: 9, rx: 7, ry: 5 },
  { name: 'Tiefe der Grenzwelten', x: 46, y: 35, rx: 7, ry: 4 },
  { name: 'Firekka-Aureole', x: 38, y: 5, rx: 6, ry: 4 },
];

// Asteroidengürtel und Trümmerfelder: langsam zu durchfliegen, und wer es
// eilig hat, verliert Maschinen.
export const ASTEROID_ZONES = [
  { name: 'Ayers Rock', x: 42, y: 24, rx: 5, ry: 3 },
  { name: 'Der Wall von Tartarus', x: 26, y: 30, rx: 4, ry: 5 },
  { name: 'Vukar-Trümmer', x: 76, y: 16, rx: 5, ry: 3 },
  { name: 'Junction-Gürtel', x: 20, y: 47, rx: 6, ry: 3 },
  { name: 'Kruger-Riff', x: 78, y: 41, rx: 5, ry: 4 },
];

// Strahlungszonen: Pulsare und Sonnenstürme. Kosten Panzerung, wenn man dort
// die Nacht verbringt.
export const RADIATION_ZONES = [
  { name: 'Hell’s Kitchen', x: 34, y: 20, rx: 4, ry: 3 },
  { name: 'Der Ofen von Silenos', x: 60, y: 40, rx: 4, ry: 3 },
  { name: 'Baka-Kar-Fackel', x: 84, y: 25, rx: 4, ry: 3 },
];

// Gravitationsgräben: dort geht kein Sprung. Sie sind die Gebirge dieser
// Karte - man fliegt um sie herum, und darum liegen die Feldzüge, wo sie
// liegen.
export const RIFT_ZONES = [
  { name: 'Der Graben', x: 68, y: 30, rx: 3.4, ry: 6.5 },
  { name: 'Vega-Verwerfung', x: 33, y: 12, rx: 5.5, ry: 2.4 },
  { name: 'Sirius-Schlund', x: 14, y: 12, rx: 4.5, ry: 3.4 },
  { name: 'Cygnus-Riss', x: 52, y: 47, rx: 6.5, ry: 2.6 },
  { name: 'Perseus-Kante', x: 94, y: 36, rx: 3.4, ry: 5.5 },
];

// Liegt ein Punkt in einer der Zonen? Gibt den Namen zurück oder null.
export function zoneAt(zones, x, y) {
  for (const z of zones) {
    const dx = (x - z.x) / z.rx;
    const dy = (y - z.y) / z.ry;
    if (dx * dx + dy * dy <= 1) return z;
  }
  return null;
}

// Wie tief im Inneren einer Zone liegt der Punkt? 0 am Rand, 1 im Kern.
// Der Nebel wird davon dichter, und die Karte zeichnet ihn entsprechend.
export function zoneDepth(zones, x, y) {
  let best = 0;
  for (const z of zones) {
    const dx = (x - z.x) / z.rx;
    const dy = (y - z.y) / z.ry;
    const d = dx * dx + dy * dy;
    if (d <= 1) best = Math.max(best, 1 - Math.sqrt(d));
  }
  return best;
}
