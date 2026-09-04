// --- Wem der Raum gehört --------------------------------------------------
// Systeme haben Grenzen, auch wenn zwischen ihnen nichts als Leere liegt: Ein
// Feld gehört der Welt, die ihm am nächsten liegt - solange sie nah genug ist.
// Große Welten greifen weiter aus als Außenposten, Hauptwelten am weitesten.
//
// Daraus entsteht zweierlei: eine Fläche in der Farbe der Flagge und eine
// Linie dort, wo zwei Reiche aneinanderstoßen.
import { GRID_COLS, GRID_ROWS } from './starchart.js';
import { sizeTier } from './data.js';

// Wie weit eine Welt ausgreift, in Feldern.
export function claimRange(system) {
  const base = 1.6 + system.size * 0.9;
  return system.capital ? base + 1.6 : base;
}

let cache = null;

// Das Feldraster der Zugehörigkeit. `owner[i]` ist die Fraktion des Feldes
// oder null, wo niemandes Raum ist.
export function territoryMap(state, { force = false } = {}) {
  const stamp = `${state.turn}|${state.systems.map((s) => s.factionId).join(',')}`;
  if (!force && cache && cache.stamp === stamp) return cache;

  const owner = new Array(GRID_COLS * GRID_ROWS).fill(null);
  const strength = new Float32Array(GRID_COLS * GRID_ROWS).fill(Infinity);

  for (const sys of state.systems) {
    const range = claimRange(sys);
    const r = Math.ceil(range);
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        const col = sys.col + dc;
        const row = sys.row + dr;
        if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) continue;
        const dist = Math.sqrt(dc * dc + dr * dr);
        if (dist > range) continue;
        // Näher gewinnt; bei gleichem Abstand die größere Welt.
        const score = dist - sys.size * 0.05;
        const idx = row * GRID_COLS + col;
        if (score < strength[idx]) {
          strength[idx] = score;
          owner[idx] = sys.factionId;
        }
      }
    }
  }

  // Die Kanten: überall dort, wo zwei Nachbarfelder verschiedenen Flaggen
  // gehören - und am Rand eines Reiches gegen die Leere.
  const edges = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const me = owner[row * GRID_COLS + col];
      if (!me) continue;
      const right = col + 1 < GRID_COLS ? owner[row * GRID_COLS + col + 1] : null;
      const down = row + 1 < GRID_ROWS ? owner[(row + 1) * GRID_COLS + col] : null;
      if (right !== me) edges.push({ col, row, side: 'ost', factionId: me });
      if (down !== me) edges.push({ col, row, side: 'sued', factionId: me });
      // Auch die Westseite und die Nordseite brauchen ihre Linie, wenn dort
      // ein fremdes Reich oder nichts liegt.
      const left = col > 0 ? owner[row * GRID_COLS + col - 1] : null;
      const up = row > 0 ? owner[(row - 1) * GRID_COLS + col] : null;
      if (left !== me) edges.push({ col, row, side: 'west', factionId: me });
      if (up !== me) edges.push({ col, row, side: 'nord', factionId: me });
    }
  }

  cache = { stamp, owner, edges };
  return cache;
}

export function ownerOfTile(state, col, row) {
  if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return null;
  return territoryMap(state).owner[row * GRID_COLS + col];
}

// Wie viele Felder ein Reich hält - die Zahl steht im Reichsfenster.
export function territorySize(state, factionId) {
  const { owner } = territoryMap(state);
  let count = 0;
  for (const o of owner) if (o === factionId) count += 1;
  return count;
}

export function clearTerritoryCache() {
  cache = null;
}
