// --- Die Darstellung ------------------------------------------------------
// Die Sternkarte liegt als Hologramm auf dem Kartentisch der Flaggbrücke
// eines Trägers: Deck ringsum, Konsolen, der Kommandosessel, die Fahnen der
// eigenen Flagge an den Schotten - und ein Panoramafenster, hinter dem das
// Heimatsystem steht. Wer die Kamera tief stellt, sieht die Brücke; wer von
// oben schaut, sieht die Karte. Gekämpft wird auf dieser Karte.
import {
  TILE_TYPES, sizeTier, shieldInfo, experienceStars, factionProfile,
  UNIT_ROLES, WATCH_ROLE, GREAT_WORKS,
} from './data.js';
import { GRID_COLS, GRID_ROWS, SECTORS, xOfCol, yOfRow } from './starchart.js';
import { tileAt } from './mapgen.js';
import {
  fleetTotalCount, factionById, systemAt, hasSeen, garrisonTotal, fleetsAt,
} from './state.js';
import { atWar } from './diplomacy.js';
import { emblemSVG } from './emblems.js';

export const TILE_SIZE = 6;
const MAP_W = GRID_COLS * TILE_SIZE;
const MAP_H = GRID_ROWS * TILE_SIZE;

let renderer, scene, camera, canvasEl;
let mapGroup, holoGroup, entityGroup, overlayGroup, bridgeGroup, starGroup;
let mapTexture, mapMaterial;
let raycaster, pointerVec, mapPlane;
let stateRef = null;
let mapMode = 'normal';
let guidesVisible = true;
let bridgeVisible = true;
let starsVisible = true;
let animating = false;
let ceilingMesh = null;

// Die Kamera kreist um ihr Ziel. Azimut dreht sie um den Tisch, Polar ist die
// Höhe über der Tischplatte - flach heißt: man sieht die Brücke.
const DEFAULT_AZIMUTH = Math.PI / 4;
const DEFAULT_POLAR = Math.atan2(1.05, Math.SQRT2);
const MIN_POLAR = 0.22;
const MAX_POLAR = 1.42;
const BASE_DISTANCE = 210;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 4.6;
const cam = { col: GRID_COLS / 2, row: GRID_ROWS / 2, zoom: 1.25, azimuth: DEFAULT_AZIMUTH, polar: DEFAULT_POLAR };
// Die Brücke muss die Kamera umschließen, auch ganz herausgezoomt: halbe
// Tischdiagonale plus größter Kameraabstand.
const BRIDGE_RADIUS = 520;
const BRIDGE_HEIGHT = 420;

export function worldOfTile(col, row) {
  return {
    x: (col - (GRID_COLS - 1) / 2) * TILE_SIZE,
    z: (row - (GRID_ROWS - 1) / 2) * TILE_SIZE,
  };
}
export function tileOfWorld(x, z) {
  return {
    col: Math.round(x / TILE_SIZE + (GRID_COLS - 1) / 2),
    row: Math.round(z / TILE_SIZE + (GRID_ROWS - 1) / 2),
  };
}

export function initScene(canvas) {
  canvasEl = canvas;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x04060c, 1);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x04060c, 900, 2600);
  camera = new THREE.PerspectiveCamera(46, 1, 1, 3000);

  mapGroup = new THREE.Group();
  holoGroup = new THREE.Group();
  entityGroup = new THREE.Group();
  overlayGroup = new THREE.Group();
  bridgeGroup = new THREE.Group();
  starGroup = new THREE.Group();
  scene.add(mapGroup, holoGroup, entityGroup, overlayGroup, bridgeGroup, starGroup);

  // Licht: kaltes Deckenlicht von oben, ein warmer Schein aus dem Hologramm
  // selbst - die Karte leuchtet, nicht der Raum.
  scene.add(new THREE.AmbientLight(0x4a6688, 1.15));
  scene.add(new THREE.HemisphereLight(0x9dc4ff, 0x0a1018, 0.5));
  const key = new THREE.DirectionalLight(0xbcd6ff, 0.7);
  key.position.set(120, 260, 160);
  scene.add(key);
  // Zwei Deckenlampen über dem Tisch: sie geben der Brücke Tiefe, wenn die
  // Kamera flach steht.
  for (const [lx, lz] of [[-160, -120], [180, 140]]) {
    const lamp = new THREE.PointLight(0xa8ccff, 0.8, 700, 2);
    lamp.position.set(lx, 150, lz);
    scene.add(lamp);
  }
  const holoLight = new THREE.PointLight(0x6fa8ff, 1.5, 620, 2);
  holoLight.position.set(0, 26, 0);
  scene.add(holoLight);
  const rim = new THREE.PointLight(0xff9a5a, 0.5, 700, 2);
  rim.position.set(-220, 60, -180);
  scene.add(rim);

  raycaster = new THREE.Raycaster();
  pointerVec = new THREE.Vector2();
  mapPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  buildStarfield();
  resize();
  return { renderer, scene, camera };
}

// --- Der Sternenhintergrund ---------------------------------------------
function buildStarfield() {
  starGroup.clear();
  const geo = new THREE.BufferGeometry();
  const count = 1400;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Sterne liegen auf einer Kugel weit außen - sie drehen nicht mit der
    // Karte, sondern stehen still, wie Sterne das tun.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1200 + Math.random() * 500;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.7;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const warm = Math.random();
    col[i * 3] = 0.7 + warm * 0.3;
    col[i * 3 + 1] = 0.75 + Math.random() * 0.25;
    col[i * 3 + 2] = 0.85 + Math.random() * 0.15;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 4.5, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9 });
  starGroup.add(new THREE.Points(geo, mat));
}

// --- Die Karte als Textur ------------------------------------------------
// Nebel, Trümmer, Strahlung, Gräben, Sektorgrenzen und das Raster werden in
// eine Leinwand gezeichnet und auf die Tischplatte gelegt. Das ist billiger
// als tausende Felder aus Geometrie - und es sieht aus wie eine Seekarte,
// was es ja auch ist.
function drawMapTexture(state) {
  const scale = 12;
  const cv = document.createElement('canvas');
  cv.width = GRID_COLS * scale;
  cv.height = GRID_ROWS * scale;
  const g = cv.getContext('2d');

  g.fillStyle = '#050a14';
  g.fillRect(0, 0, cv.width, cv.height);

  // Sektorflächen: jeder Sektor bekommt einen Hauch eigener Farbe, damit man
  // auf der Karte sieht, wo man ist.
  const sectorTint = {
    sol: 'rgba(70,120,200,0.10)',
    vega: 'rgba(90,150,190,0.09)',
    enigma: 'rgba(120,100,200,0.09)',
    kilrah: 'rgba(200,80,60,0.10)',
    grenzwelten: 'rgba(60,170,150,0.09)',
    gemini: 'rgba(180,150,80,0.08)',
    landreich: 'rgba(200,170,60,0.08)',
    firekka: 'rgba(160,110,200,0.08)',
    tiefe: 'rgba(20,30,50,0.05)',
  };

  for (const tile of state.map.tiles) {
    const x = tile.col * scale;
    const y = tile.row * scale;
    g.fillStyle = sectorTint[tile.sector] || sectorTint.tiefe;
    g.fillRect(x, y, scale, scale);
    if (tile.type === TILE_TYPES.NEBULA) {
      const a = 0.18 + tile.density * 0.5;
      const grd = g.createRadialGradient(x + scale / 2, y + scale / 2, 1, x + scale / 2, y + scale / 2, scale);
      grd.addColorStop(0, `rgba(120,90,220,${a})`);
      grd.addColorStop(1, 'rgba(60,40,140,0)');
      g.fillStyle = grd;
      g.fillRect(x - scale, y - scale, scale * 3, scale * 3);
    } else if (tile.type === TILE_TYPES.ASTEROIDS) {
      g.fillStyle = 'rgba(90,80,70,0.4)';
      g.fillRect(x, y, scale, scale);
      g.fillStyle = 'rgba(180,170,150,0.75)';
      for (let i = 0; i < 5; i++) {
        const px = x + ((tile.speck * 977 * (i + 3)) % scale);
        const py = y + ((tile.speck * 613 * (i + 5)) % scale);
        g.fillRect(px, py, 1.6, 1.6);
      }
    } else if (tile.type === TILE_TYPES.RADIATION) {
      const grd = g.createRadialGradient(x + scale / 2, y + scale / 2, 1, x + scale / 2, y + scale / 2, scale);
      grd.addColorStop(0, 'rgba(255,170,60,0.34)');
      grd.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = grd;
      g.fillRect(x - scale, y - scale, scale * 3, scale * 3);
    } else if (tile.type === TILE_TYPES.RIFT) {
      g.fillStyle = 'rgba(2,3,6,0.96)';
      g.fillRect(x, y, scale, scale);
      g.strokeStyle = 'rgba(90,40,120,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y + scale * (0.2 + tile.speck * 0.6));
      g.lineTo(x + scale, y + scale * (0.2 + ((tile.speck * 7) % 1) * 0.6));
      g.stroke();
    }
  }

  // Das Raster: dünn, damit es die Karte nicht erschlägt.
  g.strokeStyle = 'rgba(120,170,230,0.10)';
  g.lineWidth = 1;
  for (let c = 0; c <= GRID_COLS; c++) {
    g.beginPath();
    g.moveTo(c * scale, 0);
    g.lineTo(c * scale, cv.height);
    g.stroke();
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    g.beginPath();
    g.moveTo(0, r * scale);
    g.lineTo(cv.width, r * scale);
    g.stroke();
  }

  // Die Sektorgrenzen und ihre Namen - der Kartenrand einer Seekarte.
  g.font = `${scale * 1.1}px "Chakra Petch", "Eurostile", "Bahnschrift", system-ui, sans-serif`;
  for (const sector of SECTORS) {
    const x0 = (sector.x0 / 100) * cv.width;
    const x1 = (sector.x1 / 100) * cv.width;
    const y0 = (sector.y0 / 56) * cv.height;
    const y1 = (sector.y1 / 56) * cv.height;
    g.strokeStyle = 'rgba(140,190,255,0.22)';
    g.setLineDash([scale, scale]);
    g.lineWidth = 1.4;
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.setLineDash([]);
    g.fillStyle = 'rgba(170,205,255,0.24)';
    g.fillText(sector.name.toUpperCase(), x0 + scale, y0 + scale * 2.2);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
  tex.needsUpdate = true;
  return tex;
}

// Die Nebelschwaden über der Platte: flache Bänder, die im Nebel stehen und
// an den Kanten der Karte beschnitten sind.
const nebulaVolumes = [];
function buildNebulaVolumes(state) {
  nebulaVolumes.length = 0;
  const byZone = new Map();
  for (const tile of state.map.tiles) {
    if (tile.type !== TILE_TYPES.NEBULA || !tile.zoneName) continue;
    const entry = byZone.get(tile.zoneName) || { name: tile.zoneName, cols: 0, rows: 0, n: 0, dens: 0 };
    entry.cols += tile.col;
    entry.rows += tile.row;
    entry.dens += tile.density;
    entry.n += 1;
    byZone.set(tile.zoneName, entry);
  }
  for (const zone of byZone.values()) {
    const col = zone.cols / zone.n;
    const row = zone.rows / zone.n;
    const spread = Math.sqrt(zone.n) * TILE_SIZE * 0.9;
    const { x, z } = worldOfTile(col, row);
    for (let layer = 0; layer < 3; layer++) {
      const geo = new THREE.CircleGeometry(spread * (1 - layer * 0.18), 28);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x7a5cd6).lerp(new THREE.Color(0x2a1d66), layer / 3),
        transparent: true,
        opacity: 0.1 + (zone.dens / zone.n) * 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 2 + layer * 5, z);
      mesh.userData.tile = { col: Math.round(col), row: Math.round(row) };
      nebulaVolumes.push(mesh);
      holoGroup.add(mesh);
    }
  }
}

// --- Der Kartentisch und die Brücke -------------------------------------
function buildTable() {
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.7, roughness: 0.45 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x4f8fd6, transparent: true, opacity: 0.55 });

  // Die Platte selbst: die Karte liegt darauf.
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_W, MAP_H),
    mapMaterial,
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0;
  mapGroup.add(top);

  // Der Rahmen ringsum - vier Balken aus gebürstetem Metall.
  const border = 7;
  const bars = [
    [MAP_W + border * 2, border, 0, (MAP_H + border) / 2],
    [MAP_W + border * 2, border, 0, -(MAP_H + border) / 2],
    [border, MAP_H + border * 2, (MAP_W + border) / 2, 0],
    [border, MAP_H + border * 2, -(MAP_W + border) / 2, 0],
  ];
  for (const [w, d, x, z] of bars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), rimMat);
    bar.position.set(x, -2, z);
    mapGroup.add(bar);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.6, d * 0.35), glowMat);
    glow.position.set(x, 0.4, z);
    mapGroup.add(glow);
  }

  // Der Lichtsaum: ein Ring knapp über der Platte. Aus flacher Kamera ist er
  // das, was man vom Hologramm zuerst sieht.
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(MAP_W, MAP_H) * 0.52, Math.max(MAP_W, MAP_H) * 0.56, 64),
    new THREE.MeshBasicMaterial({ color: 0x4f9fd6, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 1.2;
  mapGroup.add(halo);

  // Der Sockel: ein Kasten unter der Platte, damit der Tisch ein Tisch ist.
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(MAP_W * 0.92, 26, MAP_H * 0.86),
    new THREE.MeshStandardMaterial({ color: 0x121821, metalness: 0.6, roughness: 0.6 }),
  );
  base.position.y = -16;
  mapGroup.add(base);

  // Vier Standfüße - man sieht sie nur aus flacher Kamera, und genau dann
  // sollen sie da sein.
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 40, 10), rimMat);
    leg.position.set(sx * MAP_W * 0.4, -44, sz * MAP_H * 0.36);
    mapGroup.add(leg);
  }
}

// Das Wappen als Bild auf der Fahne: dasselbe Zeichen wie im HUD, nur aus
// Stoff. Es wird nachgeladen; bis dahin hängt die Fahne einfarbig.
const emblemTextures = new Map();
function emblemTexture(profile) {
  if (emblemTextures.has(profile.id)) return emblemTextures.get(profile.id);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150" width="200" height="300">`
    + `<rect width="100" height="150" fill="${profile.colorDark}"/>`
    + `<rect x="3" y="3" width="94" height="144" fill="none" stroke="${profile.color}" stroke-width="1.5" opacity="0.8"/>`
    + `<g transform="translate(10 35) scale(0.8)">`
    + emblemSVG(profile.emblem, { size: 100, color: profile.accent }).replace(/^<svg[^>]*>|<\/svg>$/g, '')
    + '</g></svg>';
  const tex = new THREE.TextureLoader().load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  emblemTextures.set(profile.id, tex);
  return tex;
}

function paintCanvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), cv);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

// Die Brücke: Deck, Konsolenring, Sessel, Fahnen, Fluganzug, Fenster. Sie
// wird einmal gebaut und bleibt stehen - was sich ändert, ist die Farbe der
// Flagge.
function buildBridge(state) {
  bridgeGroup.clear();
  ceilingMesh = null;
  if (!bridgeVisible) return;
  const player = factionById(state, state.playerFactionId) || state.factions[0];
  const profile = factionProfile(player.id);
  const colour = new THREE.Color(profile.color);
  const dark = new THREE.Color(profile.colorDark);

  const deckMat = new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0.35, roughness: 0.85 });
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x161d28, metalness: 0.55, roughness: 0.6, side: THREE.DoubleSide });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x27313f, metalness: 0.8, roughness: 0.35 });

  // Deck unter dem Tisch, mit Rillenmuster.
  const deckTex = paintCanvas(512, 512, (g) => {
    g.fillStyle = '#0a0f16';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(90,120,160,0.16)';
    g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
    }
    g.fillStyle = 'rgba(120,160,210,0.08)';
    g.fillRect(0, 0, 512, 8);
  });
  deckTex.wrapS = THREE.RepeatWrapping;
  deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.repeat.set(8, 8);
  const deck = new THREE.Mesh(
    new THREE.CircleGeometry(BRIDGE_RADIUS, 48),
    new THREE.MeshStandardMaterial({ map: deckTex, color: 0x223040, metalness: 0.3, roughness: 0.9 }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = -66;
  bridgeGroup.add(deck);

  // Die Schotten: ein Zylinder ringsum, innen sichtbar.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(BRIDGE_RADIUS, BRIDGE_RADIUS, BRIDGE_HEIGHT, 48, 1, true),
    hullMat,
  );
  wall.position.y = BRIDGE_HEIGHT / 2 - 66;
  bridgeGroup.add(wall);
  // Lichtbänder in Augenhöhe: sie zeichnen die Rundung des Schotts nach.
  for (const y of [-30, 30, 96]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(BRIDGE_RADIUS - 1, BRIDGE_RADIUS - 1, 2.4, 48, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x6fb0ff, transparent: true, opacity: y === 30 ? 0.3 : 0.16, side: THREE.BackSide,
      }),
    );
    band.position.y = y;
    bridgeGroup.add(band);
  }

  // Die Decke mit Lichtbändern.
  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(BRIDGE_RADIUS, 48),
    new THREE.MeshStandardMaterial({ color: 0x0c1219, metalness: 0.4, roughness: 0.8, side: THREE.DoubleSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = BRIDGE_HEIGHT - 66;
  ceiling.name = 'ceiling';
  ceilingMesh = ceiling;
  bridgeGroup.add(ceiling);
  for (let i = 0; i < 6; i++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(BRIDGE_RADIUS * 1.5, 1.5, 8),
      new THREE.MeshBasicMaterial({ color: 0x8fc4ff, transparent: true, opacity: 0.32 }),
    );
    strip.position.y = BRIDGE_HEIGHT - 70;
    strip.rotation.y = (i / 6) * Math.PI;
    bridgeGroup.add(strip);
  }

  // Der Konsolenring um den Tisch: schräge Pulte mit Anzeigen.
  const consoleTex = paintCanvas(256, 128, (g) => {
    g.fillStyle = '#0d141d';
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${90 + Math.random() * 60},${170 + Math.random() * 60},255,${0.25 + Math.random() * 0.5})`;
      g.fillRect(10 + Math.random() * 236, 10 + Math.random() * 100, 6 + Math.random() * 22, 4);
    }
    g.strokeStyle = 'rgba(120,190,255,0.35)';
    g.strokeRect(6, 6, 244, 116);
  });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = MAP_W * 0.56;
    const pult = new THREE.Mesh(
      new THREE.BoxGeometry(44, 16, 20),
      new THREE.MeshStandardMaterial({ map: consoleTex, color: 0x243244, metalness: 0.5, roughness: 0.5 }),
    );
    pult.position.set(Math.cos(angle) * r, -52, Math.sin(angle) * r * (MAP_H / MAP_W));
    pult.rotation.y = -angle;
    pult.rotation.x = -0.28;
    bridgeGroup.add(pult);
  }

  // Der Kommandosessel auf seinem Podest, dem Betrachter gegenüber.
  const seatGroup = new THREE.Group();
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(30, 36, 12, 24), trimMat);
  podium.position.y = -60;
  seatGroup.add(podium);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 22), new THREE.MeshStandardMaterial({ color: 0x1b2432, metalness: 0.4, roughness: 0.7 }));
  seat.position.y = -50;
  seatGroup.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(22, 26, 5), new THREE.MeshStandardMaterial({ color: dark, metalness: 0.35, roughness: 0.65 }));
  back.position.set(0, -37, -9);
  seatGroup.add(back);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 18), trimMat);
    arm.position.set(side * 12, -44, 0);
    seatGroup.add(arm);
  }
  seatGroup.position.set(0, 0, -MAP_H * 0.78);
  bridgeGroup.add(seatGroup);

  // Zwei Feldzeichen neben dem Sessel: Stangen mit der Flagge der Fraktion.
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 90, 8), trimMat);
    pole.position.set(side * 54, -20, -MAP_H * 0.78);
    bridgeGroup.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 40),
      new THREE.MeshStandardMaterial({
        map: emblemTexture(profile), color: 0xffffff, transparent: true,
        opacity: 0.9, side: THREE.DoubleSide, roughness: 0.95,
      }),
    );
    flag.position.set(side * 54 + side * 15, -22, -MAP_H * 0.78);
    bridgeGroup.add(flag);
  }

  // Der Fluganzug auf seinem Ständer - das eine Stück auf der Brücke, an dem
  // man sieht, wessen Flotte man führt.
  const suit = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 5, 26, 10), trimMat);
  stand.position.y = -53;
  suit.add(stand);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(5, 11, 6, 12), new THREE.MeshStandardMaterial({ color: colour, metalness: 0.3, roughness: 0.7 }));
  suit.add(torso);
  torso.position.y = -32;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.7, 6, 16), new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.7, roughness: 0.35 }));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = -37;
  suit.add(belt);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xdfe8f5, metalness: 0.6, roughness: 0.25 }));
  helmet.position.y = -22;
  suit.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(4.35, 16, 12, 0, Math.PI, 0.9, 1.2), new THREE.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.9, roughness: 0.1 }));
  visor.position.y = -22;
  visor.rotation.y = Math.PI * 0.9;
  suit.add(visor);
  suit.position.set(-MAP_W * 0.66, 0, -MAP_H * 0.72);
  bridgeGroup.add(suit);

  // Das Panoramafenster: der Blick nach draußen, auf das Heimatsystem.
  const view = buildViewportTexture(state, profile);
  const window3d = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_W * 0.72, 96),
    new THREE.MeshBasicMaterial({ map: view, transparent: false }),
  );
  window3d.position.set(0, 20, MAP_H * 0.82);
  window3d.rotation.y = Math.PI;
  bridgeGroup.add(window3d);
  // Der Rahmen des Fensters, damit es ein Fenster ist und kein Bild.
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(MAP_W * 0.76, 106, 4),
    new THREE.MeshStandardMaterial({ color: 0x1c2634, metalness: 0.7, roughness: 0.4 }),
  );
  frame.position.set(0, 20, MAP_H * 0.83);
  bridgeGroup.add(frame);
  for (let i = 0; i < 5; i++) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(3, 100, 3), trimMat);
    mullion.position.set((i - 2) * MAP_W * 0.15, 20, MAP_H * 0.815);
    bridgeGroup.add(mullion);
  }
}

// Was hinter dem Fenster steht, richtet sich nach der eigenen Hauptwelt: ein
// Nebel, ein Gasriese, ein Trümmerring, zwei Sonnen - oder das eigene
// Flugdeck, wenn ringsum nichts Besonderes liegt.
function homeViewKind(state) {
  const player = state.playerFactionId;
  const home = state.systems.find((s) => s.factionId === player && s.capital)
    || state.systems.find((s) => s.factionId === player);
  if (!home) return 'flugdeck';
  let nebel = 0;
  let truemmer = 0;
  let strahlung = 0;
  for (let dr = -4; dr <= 4; dr++) {
    for (let dc = -4; dc <= 4; dc++) {
      const t = tileAt(state.map, home.col + dc, home.row + dr);
      if (!t) continue;
      if (t.type === TILE_TYPES.NEBULA) nebel += 1;
      else if (t.type === TILE_TYPES.ASTEROIDS) truemmer += 1;
      else if (t.type === TILE_TYPES.RADIATION) strahlung += 1;
    }
  }
  if (nebel > 12) return 'nebel';
  if (truemmer > 8) return 'truemmer';
  if (strahlung > 6) return 'doppelsonne';
  if (home.size >= 4) return 'gasriese';
  return 'flugdeck';
}

function buildViewportTexture(state, profile) {
  const kind = homeViewKind(state);
  return paintCanvas(1024, 256, (g) => {
    g.fillStyle = '#03060c';
    g.fillRect(0, 0, 1024, 256);
    // Sterne, immer.
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 256;
      g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.7})`;
      g.fillRect(x, y, 1.4, 1.4);
    }
    if (kind === 'nebel') {
      const grd = g.createRadialGradient(520, 150, 20, 520, 150, 480);
      grd.addColorStop(0, `${profile.color}bb`);
      grd.addColorStop(1, 'rgba(10,14,30,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 1024, 256);
    } else if (kind === 'gasriese') {
      g.fillStyle = profile.colorDark;
      g.beginPath();
      g.arc(760, 230, 210, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `${profile.accent}66`;
      g.lineWidth = 8;
      g.beginPath();
      g.ellipse(760, 230, 320, 42, -0.2, 0, Math.PI * 2);
      g.stroke();
    } else if (kind === 'truemmer') {
      for (let i = 0; i < 140; i++) {
        const x = Math.random() * 1024;
        const y = 90 + Math.random() * 160;
        g.fillStyle = `rgba(160,150,135,${0.3 + Math.random() * 0.6})`;
        g.fillRect(x, y, 2 + Math.random() * 5, 2 + Math.random() * 4);
      }
    } else if (kind === 'doppelsonne') {
      for (const [x, y, r, c] of [[300, 90, 46, '#ffd79a'], [420, 130, 24, '#ff9a6a']]) {
        const grd = g.createRadialGradient(x, y, 2, x, y, r * 4);
        grd.addColorStop(0, c);
        grd.addColorStop(0.25, `${c}66`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(x, y, r * 4, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // Das eigene Flugdeck: Landebahn, Positionslichter, ein Jäger im Anflug.
      g.fillStyle = '#0c131c';
      g.beginPath();
      g.moveTo(0, 200);
      g.lineTo(1024, 170);
      g.lineTo(1024, 256);
      g.lineTo(0, 256);
      g.closePath();
      g.fill();
      g.strokeStyle = `${profile.accent}88`;
      g.lineWidth = 4;
      g.setLineDash([28, 20]);
      g.beginPath();
      g.moveTo(40, 224);
      g.lineTo(984, 196);
      g.stroke();
      g.setLineDash([]);
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? '#ffb765' : profile.accent;
        g.beginPath();
        g.arc(60 + i * 100, 240 - i * 2, 5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#121b26';
      g.beginPath();
      g.moveTo(620, 110);
      g.lineTo(700, 128);
      g.lineTo(620, 146);
      g.lineTo(640, 128);
      g.closePath();
      g.fill();
      g.strokeStyle = profile.color;
      g.lineWidth = 2;
      g.stroke();
    }
  });
}

// --- Schrift auf der Karte ----------------------------------------------
// Namen und Zahlen werden als kleine Leinwände in den Raum gehängt. Sie
// werden zwischengespeichert: derselbe Text kostet nur einmal.
const labelCache = new Map();
function labelSprite(text, { color = '#dbe8ff', size = 34, weight = 600, background = null } = {}) {
  const key = `${text}|${color}|${size}|${weight}|${background}`;
  if (labelCache.has(key)) return labelCache.get(key).clone();
  const pad = 12;
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const font = `${weight} ${size}px "Chakra Petch", "Eurostile", "Bahnschrift", system-ui, sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  cv.width = w;
  cv.height = size + pad * 2;
  const g2 = cv.getContext('2d');
  g2.font = font;
  if (background) {
    g2.fillStyle = background;
    g2.fillRect(0, 0, cv.width, cv.height);
  }
  g2.fillStyle = 'rgba(4,8,16,0.75)';
  g2.fillText(text, pad + 1.5, size + pad - 6 + 1.5);
  g2.fillStyle = color;
  g2.fillText(text, pad, size + pad - 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(cv.width / 13, cv.height / 13, 1);
  sprite.userData.textWidth = cv.width;
  labelCache.set(key, sprite);
  return sprite.clone();
}

// --- Die Karte aufbauen --------------------------------------------------
export function buildMap(state) {
  stateRef = state;
  mapGroup.clear();
  holoGroup.clear();
  fogMesh = null;
  if (mapTexture) mapTexture.dispose();
  mapTexture = drawMapTexture(state);
  mapMaterial = new THREE.MeshBasicMaterial({ map: mapTexture });
  buildTable();
  buildNebulaVolumes(state);
  buildJumpPoints(state);
  buildSystems(state);
  buildBridge(state);
  centerOnFaction(state);
}

function buildJumpPoints(state) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x7ad4ff, transparent: true, opacity: 0.8 });
  const lineMat = new THREE.LineDashedMaterial({
    color: 0x4f9fd0, dashSize: 6, gapSize: 5, transparent: true, opacity: 0.45,
  });
  for (const jp of state.map.jumpPoints) {
    const a = worldOfTile(jp.a.col, jp.a.row);
    const b = worldOfTile(jp.b.col, jp.b.row);
    for (const p of [a, b]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(TILE_SIZE * 0.42, 0.5, 8, 20), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, 1.4, p.z);
      holoGroup.add(ring);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.85 }),
      );
      core.position.set(p.x, 1.6, p.z);
      holoGroup.add(core);
    }
    // Die Verbindung der beiden Enden: eine gestrichelte Linie über der
    // Karte, damit man sieht, wohin der Sprung führt.
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, 3, a.z),
      new THREE.Vector3((a.x + b.x) / 2, 16, (a.z + b.z) / 2),
      new THREE.Vector3(b.x, 3, b.z),
    ]);
    const line = new THREE.Line(geo, lineMat);
    line.computeLineDistances();
    holoGroup.add(line);
  }
}

const systemMeshes = new Map();

function buildSystems(state) {
  systemMeshes.clear();
  for (const sys of state.systems) {
    const group = new THREE.Group();
    const { x, z } = worldOfTile(sys.col, sys.row);
    group.position.set(x, 0, z);
    const tier = sizeTier(sys.size);
    const radius = 1.4 + sys.size * 0.55;

    // Der Planet: eine Kugel über der Platte, in der Farbe des Besitzers.
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.8, metalness: 0.1 }),
    );
    planet.position.y = radius + 2.5;
    planet.name = 'planet';
    group.add(planet);

    // Der Besitzring auf der Platte darunter - er ist die eigentliche Flagge.
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(radius + 1.4, radius + 2.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.6;
    disc.name = 'owner';
    group.add(disc);

    // Die Lichtsäule: sie macht ein System auf der weiten Karte auffindbar.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 14 + sys.size * 2, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
    );
    beam.position.y = (14 + sys.size * 2) / 2;
    beam.name = 'beam';
    group.add(beam);

    // Der Planetenschild als Blase - er steht nur, wenn er auch steht.
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(radius + 2.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
    );
    shield.position.y = radius + 2.5;
    shield.name = 'shield';
    group.add(shield);

    // Werftring: eine Scheibe um den Planeten, wenn dort gebaut wird.
    const yard = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 1.6, 0.28, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0.85 }),
    );
    yard.rotation.x = -Math.PI / 2.4;
    yard.position.y = radius + 2.5;
    yard.name = 'yard';
    group.add(yard);

    // Der Name steht daneben, die Größe entscheidet, wie groß er steht.
    const label = labelSprite(sys.name, { size: sys.capital ? 38 : 30 });
    label.position.set(0, radius * 2 + 5.5, 0);
    label.name = 'label';
    group.add(label);

    // Ein Großes Werk bekommt ein Zeichen darüber.
    if (sys.greatWork) {
      const work = GREAT_WORKS.find((w) => w.id === sys.greatWork);
      const mark = labelSprite(`◆ ${work ? work.name : 'Großes Werk'}`, { size: 20, color: '#ffe6a8' });
      mark.position.set(0, radius * 2 + 9.5, 0);
      mark.name = 'work';
      group.add(mark);
    }

    mapGroup.add(group);
    systemMeshes.set(sys.id, group);
  }
  updateSystems(state);
}

// Was sich an einem System ändern kann, ändert sich hier: Besitzer, Schild,
// Werft, Belagerung, Sichtbarkeit.
export function updateSystems(state) {
  for (const sys of state.systems) {
    const group = systemMeshes.get(sys.id);
    if (!group) continue;
    const profile = factionProfile(sys.factionId);
    const seen = hasSeen(state, sys.col, sys.row);
    const colour = new THREE.Color(profile.color);
    group.visible = seen;
    const planet = group.getObjectByName('planet');
    const owner = group.getObjectByName('owner');
    const beam = group.getObjectByName('beam');
    const shield = group.getObjectByName('shield');
    const yard = group.getObjectByName('yard');
    if (planet) {
      // Im Besitzmodus trägt der Planet die Farbe der Flagge, sonst seine
      // eigene - so kann man die Karte lesen wie eine politische Karte.
      planet.material.color.set(mapMode === 'besitz' ? colour
        : new THREE.Color().setHSL(((sys.name.length * 37) % 100) / 100, 0.32, 0.55));
      planet.material.emissive = new THREE.Color(profile.colorDark);
      planet.material.emissiveIntensity = sys.siege ? 0.9 : 0.35;
    }
    if (owner) owner.material.color.set(colour);
    if (beam) {
      beam.material.color.set(colour);
      beam.material.opacity = sys.capital ? 0.3 : 0.16;
    }
    if (shield) {
      shield.visible = sys.shield.level > 0;
      shield.material.opacity = Math.max(0.04, 0.16 * (1 - sys.shield.down))
        * (1 + sys.shield.level * 0.15);
      shield.material.color.set(sys.shield.down > 0.5 ? 0xff9a6a : 0x7fd4ff);
    }
    if (yard) {
      const werft = sys.buildings.werft;
      yard.visible = !!(werft && werft.level);
      if (yard.visible) yard.material.opacity = 0.4 + (werft.level * 0.2);
    }
  }
}

// --- Flotten, Auswahl, Reichweiten --------------------------------------
const fleetMeshes = new Map();

function fleetMesh(fleet) {
  const profile = factionProfile(fleet.factionId);
  const group = new THREE.Group();
  const colour = new THREE.Color(profile.color);

  // Der Verband als Pfeilspitze - drei Maschinen in Keilform.
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colour, emissive: new THREE.Color(profile.colorDark), emissiveIntensity: 0.6,
    metalness: 0.55, roughness: 0.4,
  });
  // Die Keile fliegen über der Platte - hoch genug, dass sie nicht in einem
  // Planeten stecken, wenn die Flotte über einem System steht.
  const shapes = [[0, 0, 0, 1], [-2.6, 0, 2.4, 0.72], [2.6, 0, 2.4, 0.72]];
  for (const [dx, dy, dz, s] of shapes) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 4.4 * s, 4), bodyMat);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(dx, 5 + dy, dz);
    group.add(cone);
  }
  // Ein dünner Halt zur Platte hinunter, damit man sieht, auf welchem Feld
  // der Verband steht.
  const tether = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 4.5, 5),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.35 }),
  );
  tether.position.y = 2.4;
  group.add(tether);
  // Der Schatten auf der Platte: ein Ring, der sagt, auf welchem Feld die
  // Flotte steht.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(TILE_SIZE * 0.3, TILE_SIZE * 0.4, 20),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.8;
  ring.name = 'ring';
  group.add(ring);

  const count = labelSprite(String(fleetTotalCount(fleet)), { size: 24, color: '#eaf3ff' });
  count.position.set(0, 11, 0);
  count.name = 'count';
  group.add(count);

  return group;
}

export function syncEntities(state, view = {}) {
  stateRef = state;
  const seenIds = new Set();
  for (const fleet of state.fleets) {
    // Fremde Flotten sieht man nur, wo die eigenen Sensoren hinreichen.
    const visible = fleet.factionId === state.playerFactionId
      || (view.visibleFleets ? view.visibleFleets.has(fleet.id) : hasSeen(state, fleet.col, fleet.row));
    let mesh = fleetMeshes.get(fleet.id);
    if (!mesh) {
      mesh = fleetMesh(fleet);
      fleetMeshes.set(fleet.id, mesh);
      entityGroup.add(mesh);
    }
    seenIds.add(fleet.id);
    mesh.visible = visible;
    if (!visible) continue;
    const { x, z } = worldOfTile(fleet.col, fleet.row);
    // Steht die Flotte über einem System, rückt sie zur Seite: sonst
    // verschwindet der Verband im Planeten.
    const overSystem = systemAt(state, fleet.col, fleet.row);
    const shift = overSystem ? TILE_SIZE * 0.52 : 0;
    if (!mesh.userData.animating) mesh.position.set(x + shift, 0, z + shift);
    // Mehrere Flotten auf einem Feld stehen versetzt, sonst stecken sie
    // ineinander.
    const stack = fleetsAt(state, fleet.col, fleet.row);
    const idx = stack.indexOf(fleet);
    if (stack.length > 1 && !mesh.userData.animating) {
      mesh.position.x += (idx - (stack.length - 1) / 2) * 1.8;
      mesh.position.z += (idx % 2) * 1.6;
    }
    const old = mesh.getObjectByName('count');
    const total = fleetTotalCount(fleet);
    if (old && mesh.userData.count !== total) {
      mesh.remove(old);
      const count = labelSprite(String(total), { size: 24, color: '#eaf3ff' });
      count.position.set(0, 11, 0);
      count.name = 'count';
      mesh.add(count);
      mesh.userData.count = total;
    }
    const ring = mesh.getObjectByName('ring');
    if (ring) {
      const selected = view.selectedFleetId === fleet.id;
      ring.material.opacity = selected ? 1 : 0.5;
      ring.scale.setScalar(selected ? 1.25 : 1);
    }
    // Die Spitze zeigt, wohin die Flotte zuletzt flog - ein Verband hat eine
    // Richtung, auch wenn er steht.
    if (fleet.stance === 'belagern' || fleet.stance === 'blockade') {
      mesh.rotation.y += 0.004;
    }
  }
  for (const [id, mesh] of fleetMeshes) {
    if (seenIds.has(id)) continue;
    entityGroup.remove(mesh);
    fleetMeshes.delete(id);
  }
  updateSystems(state);
  updateFogOfWar(state);
  drawOverlay(state, view);
}

// Reichweite, Ziele, Fluglinie und die Marken für Belagerung und Blockade.
function drawOverlay(state, view) {
  overlayGroup.clear();
  if (!guidesVisible) return;

  if (view.reach && view.reach.size) {
    const geo = new THREE.PlaneGeometry(TILE_SIZE * 0.82, TILE_SIZE * 0.82);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x69b7ff, transparent: true, opacity: 0.3, depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, view.reach.size);
    const dummy = new THREE.Object3D();
    let i = 0;
    for (const key of view.reach.keys()) {
      const [col, row] = key.split(',').map(Number);
      const { x, z } = worldOfTile(col, row);
      dummy.position.set(x, 1.1, z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    overlayGroup.add(mesh);
  }

  if (view.attacks && view.attacks.size) {
    for (const key of view.attacks.keys()) {
      const [col, row] = key.split(',').map(Number);
      const { x, z } = worldOfTile(col, row);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(TILE_SIZE * 0.34, TILE_SIZE * 0.52, 4),
        new THREE.MeshBasicMaterial({ color: 0xff6b52, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = Math.PI / 4;
      ring.position.set(x, 1.3, z);
      overlayGroup.add(ring);
    }
  }

  if (view.path && view.path.length > 1) {
    const points = view.path.map((p) => {
      const { x, z } = worldOfTile(p.col, p.row);
      return new THREE.Vector3(x, 3.4, z);
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.9 }),
    );
    overlayGroup.add(line);
    const last = points[points.length - 1];
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(TILE_SIZE * 0.24, TILE_SIZE * 0.34, 18),
      new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(last.x, 1.5, last.z);
    overlayGroup.add(marker);
  }

  if (view.selectedTile) {
    const { x, z } = worldOfTile(view.selectedTile.col, view.selectedTile.row);
    const box = new THREE.Mesh(
      new THREE.RingGeometry(TILE_SIZE * 0.44, TILE_SIZE * 0.52, 4),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    box.rotation.x = -Math.PI / 2;
    box.rotation.z = Math.PI / 4;
    box.position.set(x, 1.6, z);
    overlayGroup.add(box);
  }

  // Belagerte und blockierte Systeme bekommen einen Ring aus Strichen.
  for (const sys of state.systems) {
    if (!sys.siege && !sys.blockade) continue;
    if (!hasSeen(state, sys.col, sys.row)) continue;
    const { x, z } = worldOfTile(sys.col, sys.row);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(TILE_SIZE * 0.55, TILE_SIZE * 0.66, 16, 1, 0, Math.PI * 1.6),
      new THREE.MeshBasicMaterial({
        color: sys.siege ? 0xff7a4f : 0xffd166, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 1.2, z);
    overlayGroup.add(ring);
  }
}

// --- Das Dunkel ----------------------------------------------------------
// Was die eigenen Sensoren nie erreicht haben, liegt unter einer schwarzen
// Decke: die Karte zeigt es erst, wenn jemand dort war.
let fogMesh = null;
export function updateFogOfWar(state) {
  if (!fogMesh) {
    const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x060c18, transparent: true, opacity: 0.76, depthWrite: false,
    });
    fogMesh = new THREE.InstancedMesh(geo, mat, GRID_COLS * GRID_ROWS);
    fogMesh.frustumCulled = false;
    mapGroup.add(fogMesh);
  }
  const dummy = new THREE.Object3D();
  let i = 0;
  for (const tile of state.map.tiles) {
    if (hasSeen(state, tile.col, tile.row)) continue;
    const { x, z } = worldOfTile(tile.col, tile.row);
    dummy.position.set(x, 0.9, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    fogMesh.setMatrixAt(i++, dummy.matrix);
  }
  fogMesh.count = i;
  fogMesh.instanceMatrix.needsUpdate = true;
  // Nebelbänke, die nie jemand angeflogen hat, leuchten auch nicht: sonst
  // stünde die schönste Bank der Karte über unerforschtem Raum.
  for (const mesh of nebulaVolumes) {
    const t = mesh.userData.tile;
    mesh.visible = hasSeen(state, t.col, t.row);
  }
}

// Ein kurzes Aufblitzen auf einem Feld - für Treffer, Funde, Meldungen.
export function flashTile(col, row, color = 0xffd166) {
  const { x, z } = worldOfTile(col, row);
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(1, TILE_SIZE * 0.7, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 2, z);
  overlayGroup.add(mesh);
  const start = performance.now();
  const step = () => {
    const t = (performance.now() - start) / 700;
    if (t >= 1) { overlayGroup.remove(mesh); return; }
    mesh.scale.setScalar(1 + t * 1.6);
    mesh.material.opacity = 0.9 * (1 - t);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// --- Die Kamera -----------------------------------------------------------
// Sie kreist um ein Feld der Karte. Flach heißt Brücke, steil heißt Karte;
// dazwischen liegt der Blick, in dem man beides sieht.
function updateLabelVisibility() {
  // Aus der Ferne stehen zu viele Namen übereinander; aus der Brückensicht
  // stören sie ganz. Also blenden sie mit der Kamera aus.
  const showNames = cam.zoom > 0.85 && cam.polar > 0.45;
  const showWorks = cam.zoom > 1.25 && cam.polar > 0.55;
  for (const group of systemMeshes.values()) {
    const label = group.getObjectByName('label');
    const work = group.getObjectByName('work');
    if (label) label.visible = showNames;
    if (work) work.visible = showWorks;
  }
}

function applyCamera() {
  const dist = BASE_DISTANCE / cam.zoom;
  const target = worldOfTile(cam.col, cam.row);
  const sinP = Math.sin(cam.polar);
  camera.position.set(
    target.x + dist * sinP * Math.cos(cam.azimuth),
    dist * Math.cos(cam.polar) + 12,
    target.z + dist * sinP * Math.sin(cam.azimuth),
  );
  camera.lookAt(target.x, 0, target.z);
  // Steigt die Kamera über die Decke, wird sie ausgeblendet: sonst schaut man
  // von oben auf ein geschlossenes Dach und sieht seine eigene Karte nicht.
  if (ceilingMesh) ceilingMesh.visible = camera.position.y < ceilingMesh.position.y - 14;
  updateLabelVisibility();
}

export function centerOn(col, row, immediate = true) {
  cam.col = Math.max(0, Math.min(GRID_COLS - 1, col));
  cam.row = Math.max(0, Math.min(GRID_ROWS - 1, row));
  applyCamera();
}

export function centerOnFaction(state) {
  const home = state.systems.find((s) => s.factionId === state.playerFactionId && s.capital)
    || state.systems.find((s) => s.factionId === state.playerFactionId);
  if (home) centerOn(home.col, home.row);
  else centerOn(GRID_COLS / 2, GRID_ROWS / 2);
}

export function zoomCamera(factor) {
  cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
  applyCamera();
}

export function rotateCamera(dAzimuth, dPolar) {
  cam.azimuth += dAzimuth;
  cam.polar = Math.max(MIN_POLAR, Math.min(MAX_POLAR, cam.polar + dPolar));
  applyCamera();
}

export function resetCameraOrientation() {
  cam.azimuth = DEFAULT_AZIMUTH;
  cam.polar = DEFAULT_POLAR;
  applyCamera();
}

// Schwenken in Bildschirmrichtung: was rechts liegt, kommt nach links,
// gleich wie die Kamera gedreht ist.
export function panCameraRelative(dx, dy) {
  const forward = new THREE.Vector3(Math.cos(cam.azimuth), 0, Math.sin(cam.azimuth));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const scale = 0.6 / cam.zoom;
  const worldDx = right.x * dx * scale + forward.x * dy * scale;
  const worldDz = right.z * dx * scale + forward.z * dy * scale;
  cam.col = Math.max(0, Math.min(GRID_COLS - 1, cam.col + worldDx / TILE_SIZE));
  cam.row = Math.max(0, Math.min(GRID_ROWS - 1, cam.row + worldDz / TILE_SIZE));
  applyCamera();
}

// Die Eröffnungsansicht: weit genug zurück, dass die ganze Brücke mit dem
// Tisch darin im Bild liegt - die erste Einstellung eines Feldzugs.
export function setOpeningView() {
  cam.zoom = MIN_ZOOM;
  cam.polar = 1.05;
  cam.azimuth = Math.PI / 2 + 0.35;
  cam.col = GRID_COLS / 2;
  cam.row = GRID_ROWS / 2;
  applyCamera();
}

export function cameraState() {
  return { ...cam };
}

// Für das Gefecht: die Kamera geht heran und danach wieder zurück.
export function zoomTo(value, ms = 400) {
  const from = cam.zoom;
  const to = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      cam.zoom = from + (to - from) * (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
      applyCamera();
      render();
      if (t >= 1) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// Wohin auf dem Bildschirm Norden zeigt - die Kompassrose hängt daran.
export function northOnScreen() {
  return -cam.azimuth - Math.PI / 2;
}

export function setMapMode(mode) {
  mapMode = mode;
  if (stateRef) updateSystems(stateRef);
}
export function getMapMode() { return mapMode; }

export function setGuidesVisible(on) { guidesVisible = !!on; }
export function setStarsVisible(on) {
  starsVisible = !!on;
  if (starGroup) starGroup.visible = starsVisible;
}
export function setBridgeVisible(on) {
  bridgeVisible = !!on;
  if (bridgeGroup) bridgeGroup.visible = bridgeVisible;
  if (stateRef && bridgeVisible && bridgeGroup.children.length === 0) buildBridge(stateRef);
}
export function isBridgeVisible() { return bridgeVisible; }

// --- Zeigen und Treffen ---------------------------------------------------
// Vom Mauszeiger auf ein Feld: ein Strahl durch die Kamera auf die
// Tischplatte, und dann zurückgerechnet auf Spalte und Zeile.
export function pickTile(clientX, clientY) {
  if (!canvasEl || !camera) return null;
  const rect = canvasEl.getBoundingClientRect();
  pointerVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerVec, camera);

  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(mapPlane, point)) return null;
  const { col, row } = tileOfWorld(point.x, point.z);
  if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return null;
  return { col, row };
}

// Wo ein Feld auf dem Bildschirm liegt - für Beschriftungen im HUD.
export function tileToScreen(col, row) {
  if (!camera || !canvasEl) return null;
  const { x, z } = worldOfTile(col, row);
  const v = new THREE.Vector3(x, 0, z).project(camera);
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * rect.width,
    y: (-v.y * 0.5 + 0.5) * rect.height,
    behind: v.z > 1,
  };
}

export function resize() {
  if (!renderer || !camera || !canvasEl) return;
  const w = canvasEl.clientWidth || window.innerWidth;
  const h = canvasEl.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  applyCamera();
}

export function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

export function captureFrame() {
  if (!renderer) return null;
  render();
  try {
    return renderer.domElement.toDataURL('image/png');
  } catch (err) {
    return null;
  }
}

export function isAnimating() {
  return animating;
}

// --- Der Flug -------------------------------------------------------------
// Eine Flotte zieht nicht von Feld zu Feld, sie fliegt: das Modell wandert
// den Weg entlang, dreht sich in die Flugrichtung, und am Sprungpunkt
// verschwindet es und kommt drüben wieder heraus.
export function animateFleet(fleetId, path, { speed = 1, onStep = null } = {}) {
  return new Promise((resolve) => {
    const mesh = fleetMeshes.get(fleetId);
    if (!mesh || !path || path.length < 2) { resolve(); return; }
    animating = true;
    mesh.userData.animating = true;
    let index = 0;
    const stepTime = 320 / Math.max(0.2, speed);
    let start = performance.now();
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const setLeg = () => {
      const a = worldOfTile(path[index].col, path[index].row);
      const b = worldOfTile(path[index + 1].col, path[index + 1].row);
      from.set(a.x, 0, a.z);
      to.set(b.x, 0, b.z);
      mesh.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      start = performance.now();
    };
    setLeg();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / stepTime);
      const jump = !!path[index + 1].jump;
      if (jump) {
        // Der Sprung: die Flotte wird klein, verschwindet und steht drüben.
        mesh.scale.setScalar(t < 0.5 ? 1 - t * 1.8 : (t - 0.5) * 1.8);
        mesh.position.copy(t < 0.5 ? from : to);
      } else {
        mesh.position.lerpVectors(from, to, t);
        mesh.position.y = Math.sin(t * Math.PI) * 2.2;
      }
      if (t >= 1) {
        mesh.scale.setScalar(1);
        mesh.position.copy(to);
        mesh.position.y = 0;
        index += 1;
        if (onStep) onStep(path[index]);
        if (index >= path.length - 1) {
          animating = false;
          mesh.userData.animating = false;
          resolve();
          return;
        }
        setLeg();
      }
      render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// Der Blick auf ein Feld, weich statt sprunghaft: die Kamera zieht hinüber.
export function glideTo(col, row, ms = 500) {
  return new Promise((resolve) => {
    const startCol = cam.col;
    const startRow = cam.row;
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      cam.col = startCol + (col - startCol) * ease;
      cam.row = startRow + (row - startRow) * ease;
      applyCamera();
      render();
      if (t >= 1) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function sceneHandles() {
  return { scene, camera, renderer, entityGroup, overlayGroup, worldOfTile };
}
