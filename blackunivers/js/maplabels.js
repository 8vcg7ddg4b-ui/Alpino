// --- Beschriftung auf der Karte ------------------------------------------
// Namen als Sprites im Raum werden mit der Kamera klein, verdecken einander
// und franst aus, sobald man zoomt. Deshalb liegen sie jetzt als HTML über
// dem Bild: immer gleich groß, immer scharf, und wenn zwei einander im Weg
// stehen, weicht der unwichtigere.
import { factionProfile, sizeTier, GREAT_WORKS } from './data.js';
import { hasSeen, fleetTotalCount, fleetsAt } from './state.js';
import { tileToScreen, cameraState } from './scene3d.js';

let layer = null;
const systemNodes = new Map();
const fleetNodes = new Map();

export function initMapLabels(container) {
  layer = container;
  if (!layer) return false;
  layer.innerHTML = '';
  systemNodes.clear();
  fleetNodes.clear();
  return true;
}

function node(kind) {
  const el = document.createElement('div');
  el.className = kind;
  layer.appendChild(el);
  return el;
}

// Rechtecke, die schon belegt sind - der Rest weicht.
function overlaps(taken, rect) {
  for (const r of taken) {
    if (rect.x < r.x + r.w && rect.x + rect.w > r.x
      && rect.y < r.y + r.h && rect.y + rect.h > r.y) return true;
  }
  return false;
}

// Wie wichtig ein Name ist: die eigene Hauptwelt zuerst, dann Hauptwelten,
// große Systeme, Großwerke - und ganz zuletzt der Außenposten am Rand.
function systemRank(state, sys, selectedId) {
  let rank = sys.size * 10;
  if (sys.capital) rank += 45;
  if (sys.greatWork) rank += 20;
  if (sys.factionId === state.playerFactionId) rank += 25;
  if (sys.id === selectedId) rank += 500;
  if (sys.siege || sys.blockade) rank += 30;
  return rank;
}

export function updateMapLabels(state, view = {}) {
  if (!layer || !state) return;
  const cam = cameraState();
  const width = layer.clientWidth || window.innerWidth;
  const height = layer.clientHeight || window.innerHeight;
  const taken = [];
  const seenSystems = new Set();
  const seenFleets = new Set();

  // Aus der Ferne stehen nur die großen Namen; je näher die Kamera, desto
  // mehr Welten bekommen ihren Namen zurück.
  const zoom = cam.zoom;
  const fontSize = Math.max(10, Math.min(15, 9 + zoom * 2.2));
  const minRank = zoom > 2.2 ? 0 : zoom > 1.4 ? 22 : zoom > 0.95 ? 38 : 58;

  const systems = [...state.systems]
    .filter((sys) => hasSeen(state, sys.col, sys.row))
    .map((sys) => ({ sys, rank: systemRank(state, sys, view.selectedSystemId) }))
    .sort((a, b) => b.rank - a.rank);

  for (const { sys, rank } of systems) {
    const point = tileToScreen(sys.col, sys.row);
    if (!point || point.behind) continue;
    if (point.x < -80 || point.y < -40 || point.x > width + 80 || point.y > height + 40) continue;
    if (rank < minRank) continue;

    let el = systemNodes.get(sys.id);
    if (!el) {
      el = node('map-label');
      systemNodes.set(sys.id, el);
    }
    const profile = factionProfile(sys.factionId);
    const tier = sizeTier(sys.size);
    const work = sys.greatWork ? GREAT_WORKS.find((w) => w.id === sys.greatWork) : null;
    const key = `${sys.name}|${sys.factionId}|${sys.capital}|${!!work}|${sys.siege ? 1 : 0}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.innerHTML = `<i style="background:${profile.color}"></i>`
        + `<span>${sys.name}</span>`
        + (sys.capital ? '<b>★</b>' : '')
        + (work ? '<em title="Großes Werk">◆</em>' : '');
      el.title = `${sys.name} – ${tier.label}, ${profile.name}`;
    }
    el.classList.toggle('is-mine', sys.factionId === state.playerFactionId);
    el.classList.toggle('is-siege', !!sys.siege);
    el.classList.toggle('is-selected', sys.id === view.selectedSystemId);
    el.style.fontSize = `${fontSize}px`;

    // Messen, dann setzen: ohne die Breite kann man nichts ausweichen lassen.
    // Gemessen wird nur, wenn sich Inhalt oder Schriftgröße geändert haben -
    // sonst kostet jede Bewegung der Karte einen Umbruch der ganzen Seite.
    const measure = el.dataset.m !== `${el.dataset.key}|${fontSize}`;
    if (measure) {
      el.dataset.m = `${el.dataset.key}|${fontSize}`;
      el.dataset.w = String(el.offsetWidth || 80);
      el.dataset.h = String(el.offsetHeight || 18);
    }
    const w = Number(el.dataset.w) || 80;
    const h = Number(el.dataset.h) || 18;
    const x = point.x - w / 2;
    const y = point.y + Math.max(6, 2 + zoom * 3);
    const rect = { x, y, w, h: h + 2 };
    if (overlaps(taken, rect)) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      seenSystems.add(sys.id);
      continue;
    }
    taken.push(rect);
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    el.style.opacity = '1';
    seenSystems.add(sys.id);
  }

  // Flottenstärke als Plakette am Verband - dieselbe Ebene, damit sich Namen
  // und Zahlen gegenseitig aus dem Weg gehen.
  for (const fleet of state.fleets) {
    const visible = fleet.factionId === state.playerFactionId
      || (view.visibleFleets ? view.visibleFleets.has(fleet.id) : hasSeen(state, fleet.col, fleet.row));
    if (!visible) continue;
    const point = tileToScreen(fleet.col, fleet.row);
    if (!point || point.behind) continue;
    if (point.x < -60 || point.y < -30 || point.x > width + 60 || point.y > height + 30) continue;

    let el = fleetNodes.get(fleet.id);
    if (!el) {
      el = node('fleet-badge');
      fleetNodes.set(fleet.id, el);
    }
    const profile = factionProfile(fleet.factionId);
    const total = fleetTotalCount(fleet);
    const stack = fleetsAt(state, fleet.col, fleet.row).length;
    if (el.dataset.key !== `${total}|${fleet.factionId}|${stack}`) {
      el.dataset.key = `${total}|${fleet.factionId}|${stack}`;
      el.innerHTML = `<i style="background:${profile.color}"></i><span>${total}</span>`
        + (stack > 1 ? `<b>×${stack}</b>` : '');
      el.style.borderColor = profile.color;
    }
    el.classList.toggle('is-selected', fleet.id === view.selectedFleetId);
    if (el.dataset.m !== el.dataset.key) {
      el.dataset.m = el.dataset.key;
      el.dataset.w = String(el.offsetWidth || 34);
      el.dataset.h = String(el.offsetHeight || 16);
    }
    const w = Number(el.dataset.w) || 34;
    const h = Number(el.dataset.h) || 16;
    const x = point.x - w / 2 + 20;
    const y = point.y - h - Math.max(10, 6 + zoom * 4);
    taken.push({ x, y, w, h });
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    el.style.opacity = '1';
    seenFleets.add(fleet.id);
  }

  // Was nicht mehr auf der Karte steht, verschwindet auch aus der Ebene.
  for (const [id, el] of systemNodes) {
    if (seenSystems.has(id)) continue;
    el.remove();
    systemNodes.delete(id);
  }
  for (const [id, el] of fleetNodes) {
    if (seenFleets.has(id)) continue;
    el.remove();
    fleetNodes.delete(id);
  }
}

export function clearMapLabels() {
  if (!layer) return;
  layer.innerHTML = '';
  systemNodes.clear();
  fleetNodes.clear();
}
