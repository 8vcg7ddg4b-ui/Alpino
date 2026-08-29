import {
  TILE_TYPES, settlementTier, WALL_LEVELS, experienceStars, shipTypeOf, tileImpassable,
} from './data.js';
import { unitTotalCount, factionById, harbourTile } from './state.js';
import { emblemSVG } from './emblems.js';

export const TILE_SIZE = 6;
const ELEV_SCALE = 2.9;

let renderer, scene, camera;
let canvasEl;
let mapCols = 0;
let mapRows = 0;

// The camera orbits its target: azimuth turns it around the map, polar is the
// tilt above the horizon. The defaults reproduce the original fixed isometric
// direction (1, 1.05, 1).
const DEFAULT_AZIMUTH = Math.PI / 4;
const DEFAULT_POLAR = Math.atan2(1.05, Math.SQRT2);
const MIN_POLAR = 0.25;
const MAX_POLAR = 1.35;

const cam = { col: 0, row: 0, zoom: 1, azimuth: DEFAULT_AZIMUTH, polar: DEFAULT_POLAR };
const BASE_DISTANCE = 235;
// Das Zelt muss die Kamera umschließen, auch ganz herausgezoomt - deshalb
// hängen Zeltmaß und kleinster Zoom zusammen.
const MIN_ZOOM = 0.62;
const MAX_ZOOM = 4.5;
// Weit genug, dass die Kamera auch ganz herausgezoomt unter dem Tuch bleibt.
// Das Zelt muss den Kartentisch samt der Kamera fassen, die um ihn herumläuft:
// halbe Tischdiagonale plus der größte Kameraabstand, sonst stünde der Blick
// bei weit herausgezogener Sicht auf einmal draußen.
const TENT_RADIUS = 820;
const TENT_HEIGHT = 680;
const TENT_WALL = 170;
// So weit bleibt die Kamera von den Zeltbahnen weg.
const TENT_CAMERA_MARGIN = 60;

let terrainMesh = null;
let waterMesh = null;
let deepSeaMesh = null;
let currentMap = null;
let propsGroup = null;
let roadsGroup = null;
let tableGroup = null;
let tentGroup = null;
let ambientLight = null;
let sunLight = null;

// The map is drawn either as the ground it is or as the political picture the
// player needs to plan: same relief, same tiles, different question answered.
let mapMode = 'terrain';
let terrainColors = null;
let tacticalColors = null;
let noiseTexture = null;

// Armies march tile by tile instead of teleporting. While an army is animating
// it owns its own position, so syncEntities must not snap it to the state's
// (already updated) destination, and must not despatch a group whose army was
// destroyed until it has finished walking up to the fight.
const armyAnimations = new Map();
const effects = [];
const completionQueue = [];
let animationFrameId = null;
const MARCH_TILES_PER_SECOND = 4.2;
// A multiplier the player sets; zero means the army is simply there.
let marchSpeedFactor = 1;

export function setMarchSpeed(factor) {
  marchSpeedFactor = Math.max(0, factor);
}

const cityGroups = new Map(); // cityId -> { group, roof, flag, label }
const armyGroups = new Map(); // armyId -> THREE.Group
const highlightMeshes = [];
let selectionRing = null;

function worldX(col) {
  return (col - mapCols / 2) * TILE_SIZE;
}
function worldZ(row) {
  return (row - mapRows / 2) * TILE_SIZE;
}
function colFromWorldX(x) {
  return Math.round(x / TILE_SIZE + mapCols / 2);
}
function rowFromWorldZ(z) {
  return Math.round(z / TILE_SIZE + mapRows / 2);
}
function tileTopY(elevation) {
  return elevation * ELEV_SCALE;
}

// The sea is drawn as its own plane slightly above the sunken water tiles, so
// anything afloat has to sit on that plane rather than on the sea bed.
const SEA_LEVEL_Y = TILE_TYPES.water.elevation * ELEV_SCALE + 0.3;

// Die Höhe des Geländes an einer beliebigen Stelle - auch zwischen zwei
// Feldmitten. Das Gelände ist ein Netz aus Dreiecken, und genau dieselbe
// Dreiecksteilung wird hier nachgerechnet: sonst schwebt oder versinkt alles,
// was nicht genau auf einer Feldmitte steht - Bäume, Berge, eine marschierende
// Armee zwischen zwei Feldern.
function groundY(colF, rowF) {
  if (!currentMap) return 0;
  const { cols, rows, tiles } = currentMap;
  const c = Math.max(0, Math.min(cols - 2, Math.floor(colF)));
  const r = Math.max(0, Math.min(rows - 2, Math.floor(rowF)));
  const u = Math.max(0, Math.min(1, colF - c));
  const v = Math.max(0, Math.min(1, rowF - r));
  const h = (dc, dr) => tileTopY(tiles[r + dr][c + dc].elevation);
  // Die Quads sind entlang der Diagonale von (1,0) nach (0,1) geteilt.
  if (u + v <= 1) {
    const a = h(0, 0);
    return a + (h(1, 0) - a) * u + (h(0, 1) - a) * v;
  }
  const d = h(1, 1);
  return d + (h(1, 0) - d) * (1 - v) + (h(0, 1) - d) * (1 - u);
}

// The height an army, fleet or town actually stands at on a given tile.
// Waypoints may sit between tile centres (a repelled army lunges partway into
// the defender's tile), which is why the ground is sampled, not looked up.
function surfaceY(col, row) {
  if (!currentMap) return 0;
  const c = Math.max(0, Math.min(currentMap.cols - 1, Math.round(col)));
  const r = Math.max(0, Math.min(currentMap.rows - 1, Math.round(row)));
  if (currentMap.tiles[r][c].type === 'water') return SEA_LEVEL_Y;
  return groundY(col, row);
}

function makeLabelSprite(text, opts = {}) {
  const { fontSize = 46, color = '#ffffff', stroke = 'rgba(0,0,0,0.85)', scale = 1 } = opts;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  const width = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = width;
  canvas.height = fontSize + 24;
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  const worldHeight = 2.6 * scale;
  sprite.scale.set((canvas.width / canvas.height) * worldHeight, worldHeight, 1);
  sprite.renderOrder = 10;
  return sprite;
}

const SKY_COLOR = '#bcd8ec';

export function initScene(canvas) {
  canvasEl = canvas;
  // Jede Partie baut eine neue Szene. Die Liste der Fahnen hängt am Modul und
  // müsste sonst noch die Banner der vorigen Partie ausrichten.
  billboards.length = 0;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Für das Wetter: Regen und Schnee werden an der Tischkante beschnitten,
  // sonst fielen sie auch vor den Zeltbahnen herunter.
  renderer.localClippingEnabled = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.Fog(SKY_COLOR, BASE_DISTANCE * 2.6, BASE_DISTANCE * 8);

  camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);

  ambientLight = new THREE.AmbientLight('#ffffff', 0.65);
  scene.add(ambientLight);
  sunLight = new THREE.DirectionalLight('#fff3d2', 1.05);
  sunLight.position.set(140, 220, 90);
  scene.add(sunLight);
}

function cameraDirection() {
  const horizontal = Math.cos(cam.polar);
  return new THREE.Vector3(
    Math.cos(cam.azimuth) * horizontal,
    Math.sin(cam.polar),
    Math.sin(cam.azimuth) * horizontal
  );
}

// Der Feldherr bleibt in seinem Zelt. Der Blick darf über die ganze Karte
// wandern, aber die Kamera nicht durch die Zeltbahnen: käme sie hinaus, wird
// der Blickpunkt so weit zurückgezogen, dass sie drinnen bleibt.
function keepCameraInsideTent() {
  if (!mapCols) return;
  // Erst bleibt der Blick über dem Tisch: von der Karte herunterzufahren hieße,
  // im leeren Zelt zu stehen und die Karte zu suchen.
  cam.col = Math.max(0, Math.min(mapCols - 1, cam.col));
  cam.row = Math.max(0, Math.min(mapRows - 1, cam.row));
  const direction = cameraDirection();
  const distance = BASE_DISTANCE / cam.zoom;
  const targetX = worldX(cam.col);
  const targetZ = worldZ(cam.row);
  const x = targetX + direction.x * distance;
  const z = targetZ + direction.z * distance;
  const radius = Math.hypot(x, z);
  const limit = TENT_RADIUS - TENT_CAMERA_MARGIN;
  if (radius <= limit) return;
  const pull = radius - limit;
  cam.col = (targetX - (x / radius) * pull) / TILE_SIZE + mapCols / 2;
  cam.row = (targetZ - (z / radius) * pull) / TILE_SIZE + mapRows / 2;
}

function applyCamera() {
  keepCameraInsideTent();
  updateWeatherForCamera();
  alignBillboards();
  const dist = BASE_DISTANCE / cam.zoom;
  const target = new THREE.Vector3(worldX(cam.col), 0, worldZ(cam.row));
  camera.position.copy(target).addScaledVector(cameraDirection(), dist);
  camera.lookAt(target);
  camera.up.set(0, 1, 0);
  camera.updateProjectionMatrix();
}

export function rotateCamera(deltaAzimuth, deltaPolar = 0) {
  cam.azimuth += deltaAzimuth;
  cam.polar = Math.max(MIN_POLAR, Math.min(MAX_POLAR, cam.polar + deltaPolar));
  applyCamera();
}

// Die Eröffnung: der Blick, mit dem ein Feldzug beginnt. Die Kamera steht tief
// und weit hinten in der Mitte des Zelts, sodass der ganze Kartentisch im Bild
// liegt und dahinter der Thron mit den Feldzeichen. Erst wenn der Spieler die
// Ansprache wegklickt, geht es hinunter auf die Karte.
// Weiter draußen als der Spieler von Hand zoomen kann: nur so liegt der ganze
// Tisch im Bild und der Thron noch dahinter.
const OPENING_ZOOM = 0.55;
const OPENING_POLAR = 0.35;

export function setOpeningView() {
  cam.col = mapCols / 2;
  // Ein Stück in Richtung des Betrachters, damit der vordere Rand des Tisches
  // nicht aus dem Bild läuft.
  cam.row = mapRows / 2 + 2;
  cam.azimuth = DEFAULT_AZIMUTH;
  cam.polar = OPENING_POLAR;
  cam.zoom = OPENING_ZOOM;
  applyCamera();
}

// Zurück zur Ausgangsansicht: Blickwinkel, Neigung und Zoom wie beim Aufbau.
// Wohin die Kamera dabei blickt, entscheidet der Aufrufer - im Spiel ist das
// die eigene Hauptstadt.
export function resetCameraOrientation() {
  cam.azimuth = DEFAULT_AZIMUTH;
  cam.polar = DEFAULT_POLAR;
  cam.zoom = 1;
  applyCamera();
}

// Screen-relative panning: with a rotated camera, "up" on the D-pad has to
// mean away from the viewer, not north on the tile grid.
export function panCameraRelative(right, forward) {
  const sin = Math.sin(cam.azimuth);
  const cos = Math.cos(cam.azimuth);
  cam.col += right * sin + forward * cos;
  cam.row += -right * cos + forward * sin;
  applyCamera();
}

// Freies Verschieben mit gedrücktem Mausrad: Pixel werden in Weltmaß
// umgerechnet, damit die Karte unter dem Zeiger bleibt - nah herangezoomt
// bewegt derselbe Weg entsprechend weniger.
export function panCameraByScreen(dxPixels, dyPixels, viewHeightPx) {
  if (!camera || !viewHeightPx) return;
  const dist = BASE_DISTANCE / cam.zoom;
  const worldPerPixel = (2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / viewHeightPx;
  // Die Kamera blickt schräg von oben: was am Bildschirm senkrecht ist, liegt
  // am Boden flacher, je flacher der Blickwinkel.
  const forwardScale = 1 / Math.max(0.35, Math.sin(cam.polar));
  panCameraRelative(
    (-dxPixels * worldPerPixel) / TILE_SIZE,
    (dyPixels * worldPerPixel * forwardScale) / TILE_SIZE
  );
}

export function resize(width, height) {
  if (!renderer) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  applyCamera();
}


export function panCameraByWorld(dx, dz) {
  cam.col += dx / TILE_SIZE;
  cam.row += dz / TILE_SIZE;
  applyCamera();
}

// Intersects the ray through the given NDC point with the y=planeY ground
// plane. Used for "grab the map and drag" panning, independent of terrain.
export function groundPointAt(ndcX, ndcY, planeY = 0) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

export function centerOn(col, row) {
  cam.col = col;
  cam.row = row;
  applyCamera();
}

export function zoomCamera(factor) {
  cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
  applyCamera();
}

// Props are collected as plain transforms first and drawn as instanced meshes
// afterwards. On a map this size there are thousands of them, and one draw
// call per tree would cost more than everything else on screen put together.
function collectTree(props, col, row, rng) {
  const jx = (rng() - 0.5) * 0.4;
  const jz = (rng() - 0.5) * 0.4;
  const scale = 0.8 + rng() * 0.5;
  // Auf dem Boden dort, wo der Baum wirklich steht - nicht auf der Höhe der
  // Feldmitte, die am Hang mehrere Meter daneben liegt.
  const topY = groundY(col + jx, row + jz) - 0.1;
  const x = worldX(col) + jx * TILE_SIZE;
  const z = worldZ(row) + jz * TILE_SIZE;
  props.trunks.push({ x, y: topY + 0.55 * scale, z, s: scale, r: 0 });
  props.leaves.push({ x, y: topY + 1.9 * scale, z, s: scale, r: rng() * Math.PI });
}

// Peaks scale with how high the underlying crest already is, so a tile on the
// spine grows a tall cluster while a saddle only gets low rocks - the range
// then reads as a varied silhouette rather than a row of identical cones.
function collectPeak(props, col, row, elevation, rng) {
  const prominence = Math.min(1, Math.max(0, (elevation - 1.2) / 1.9));
  const count = 1 + Math.floor(rng() * 2 + prominence * 1.6);

  for (let i = 0; i < count; i++) {
    const jx = (rng() - 0.5) * 0.75;
    const jz = (rng() - 0.5) * 0.75;
    const height = (1.1 + prominence * 3.4) * (0.55 + rng() * 0.75);
    const snowy = prominence > 0.55 && rng() < 0.55 + prominence * 0.4;
    // Der Fuß des Kegels steckt ein Stück im Hang: am Rand eines Gebirgsfelds
    // fällt das Gelände steil ab, und ein Kegel auf der Höhe der Feldmitte
    // stünde dort in der Luft.
    const base = groundY(col + jx, row + jz) - height * 0.18;
    (snowy ? props.snowPeaks : props.rockPeaks).push({
      x: worldX(col) + jx * TILE_SIZE,
      y: base + height / 2,
      z: worldZ(row) + jz * TILE_SIZE,
      s: height,
      r: rng() * Math.PI * 2,
    });
  }
}

function addInstanced(geometry, material, transforms) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  transforms.forEach((t, i) => {
    position.set(t.x, t.y, t.z);
    quaternion.setFromAxisAngle(axis, t.r);
    scale.setScalar(t.s);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  propsGroup.add(mesh);
  return mesh;
}

// Cones and cylinders are authored at unit height so a single scale puts each
// instance at its own size.
function buildProps(props) {
  addInstanced(
    new THREE.CylinderGeometry(0.18, 0.24, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: '#5b3a22', roughness: 1 }),
    props.trunks
  );
  addInstanced(
    new THREE.ConeGeometry(1.1, 2.4, 7),
    new THREE.MeshStandardMaterial({ color: '#2f6b34', roughness: 0.9 }),
    props.leaves
  );
  const peakGeometry = new THREE.ConeGeometry(0.5, 1, 6);
  addInstanced(
    peakGeometry,
    new THREE.MeshStandardMaterial({ color: '#9c958a', flatShading: true, roughness: 0.95 }),
    props.rockPeaks
  );
  addInstanced(
    peakGeometry,
    new THREE.MeshStandardMaterial({ color: '#eef1f5', flatShading: true, roughness: 0.9 }),
    props.snowPeaks
  );
}

function seededRandomFactory(seed) {
  let s = seed;
  return function seededRandom() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 10000) / 10000;
  };
}

// A small tileable speckle-noise texture, layered on top of the vertex
// colors to break up the flat, plasticky look of a pure color material.
function makeNoiseTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = seededRandomFactory(7);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 205 + Math.floor(rng() * 50);
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function colorFor(type, rng) {
  const c = new THREE.Color(TILE_TYPES[type].color);
  const jitter = 0.92 + rng() * 0.16;
  c.multiplyScalar(jitter);
  return c;
}

// Builds a single smooth, vertex-colored heightmap mesh for the whole map
// (one vertex per tile centre, so slopes blend naturally between tiles),
// a translucent sea surface, decorative props, and roads between cities.
export function buildMap(state) {
  mapCols = state.map.cols;
  mapRows = state.map.rows;
  currentMap = state.map;
  const props = { trunks: [], leaves: [], rockPeaks: [], snowPeaks: [] };
  propsGroup = new THREE.Group();
  roadsGroup = new THREE.Group();
  scene.add(propsGroup);
  scene.add(roadsGroup);
  const rng = seededRandomFactory(11);

  const positions = new Float32Array(mapCols * mapRows * 3);
  const colors = new Float32Array(mapCols * mapRows * 3);
  const uvs = new Float32Array(mapCols * mapRows * 2);
  const idx = (col, row) => row * mapCols + col;

  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      const tile = state.map.tiles[row][col];
      const i = idx(col, row);
      positions[i * 3] = worldX(col);
      positions[i * 3 + 1] = tileTopY(tile.elevation);
      positions[i * 3 + 2] = worldZ(row);
      const color = colorFor(tile.type, rng);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      uvs[i * 2] = col / 3;
      uvs[i * 2 + 1] = row / 3;

      if (tile.type !== 'water') {
        if (TILE_TYPES[tile.type].deco === 'tree' && rng() < 0.85) collectTree(props, col, row, rng);
        if (TILE_TYPES[tile.type].deco === 'peak') collectPeak(props, col, row, tile.elevation, rng);
      }
    }
  }

  const indices = [];
  for (let row = 0; row < mapRows - 1; row++) {
    for (let col = 0; col < mapCols - 1; col++) {
      const a = idx(col, row);
      const b = idx(col + 1, row);
      const c = idx(col, row + 1);
      const d = idx(col + 1, row + 1);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // A copy, not the array itself: the attribute below keeps the original, and
  // the tactical view writes straight into it. Sharing them would mean the
  // first switch to the political map overwrites the ground colours, and the
  // way back would restore the tactical ones.
  terrainColors = Float32Array.from(colors);
  tacticalColors = new Float32Array(colors.length);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  noiseTexture = makeNoiseTexture();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: noiseTexture,
    roughness: 0.95,
  });
  terrainMesh = new THREE.Mesh(geometry, material);
  scene.add(terrainMesh);

  // Die Karte liegt auf einem Tisch: das Meer endet am Rahmen, es läuft nicht
  // mehr ins Unendliche.
  const boardW = mapCols * TILE_SIZE + TILE_SIZE * 0.6;
  const boardH = mapRows * TILE_SIZE + TILE_SIZE * 0.6;
  deepSeaMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(boardW, boardH),
    new THREE.MeshStandardMaterial({ color: '#1d3f66', roughness: 0.9 })
  );
  deepSeaMesh.rotation.x = -Math.PI / 2;
  deepSeaMesh.position.y = tileTopY(TILE_TYPES.water.elevation) - 0.6;
  scene.add(deepSeaMesh);

  waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(boardW, boardH),
    new THREE.MeshStandardMaterial({
      color: TILE_TYPES.water.color, transparent: true, opacity: 0.82, roughness: 0.25,
    })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = SEA_LEVEL_Y;
  scene.add(waterMesh);

  buildTable(boardW, boardH);
  buildTent(state);
  buildProps(props);
  buildWonders(state);
  buildRoadNetwork(state);
  buildRivers(state);
  roadVersionDrawn = state.roadVersion || 0;
}

// --- Kartentisch und Feldherrnzelt ---------------------------------------
// Der Feldzug wird nicht aus dem Himmel betrachtet, sondern über einer Karte,
// die auf einem Tisch im eigenen Zelt liegt: Holzrahmen ringsum, Zeltbahnen
// darüber, in den Farben der eigenen Fraktion.

const TABLE_WOOD = new THREE.MeshStandardMaterial({ color: '#5a3d24', roughness: 0.85 });
const TABLE_WOOD_DARK = new THREE.MeshStandardMaterial({ color: '#3f2a17', roughness: 0.9 });

function buildTable(boardW, boardH) {
  if (tableGroup) scene.remove(tableGroup);
  tableGroup = new THREE.Group();

  const rim = TILE_SIZE * 1.15;
  const rimTop = SEA_LEVEL_Y + 1.1;
  const rimHeight = 3.2;
  const slabY = tileTopY(TILE_TYPES.water.elevation) - 1.4;

  // Die Tischplatte unter der Karte, damit von unten nichts durchscheint.
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(boardW + rim * 2, 1.6, boardH + rim * 2),
    TABLE_WOOD_DARK
  );
  slab.position.y = slabY;
  tableGroup.add(slab);

  // Vier Leisten als Rahmen, an den Ecken überlappend.
  const beams = [
    [boardW + rim * 2, rim, 0, (boardH + rim) / 2],
    [boardW + rim * 2, rim, 0, -(boardH + rim) / 2],
    [rim, boardH + rim * 2, (boardW + rim) / 2, 0],
    [rim, boardH + rim * 2, -(boardW + rim) / 2, 0],
  ];
  for (const [w, d, x, z] of beams) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, rimHeight, d), TABLE_WOOD);
    beam.position.set(x, rimTop - rimHeight / 2 + 1.4, z);
    tableGroup.add(beam);
  }

  scene.add(tableGroup);
}

// Zeltbahnen als Streifentuch: Leinen und die Farbe der eigenen Fraktion.
function tentFabric(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cbb894';
  ctx.fillRect(0, 0, 128, 8);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.55;
  for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 13, 8);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#000';
  for (let x = 0; x < 128; x += 8) ctx.fillRect(x, 0, 2, 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 1);
  return texture;
}

// Das Zeichen einer Fraktion als Textur: ein Tuch in ihrer Farbe, darauf das
// Wappen. Gezeichnet wird das SVG einmal in eine Leinwand - danach kostet es
// nichts mehr.
const emblemTextures = new Map();

function emblemTexture(factionId, colour) {
  const key = `${factionId}|${colour}`;
  if (emblemTextures.has(key)) return emblemTextures.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 208;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Ein Saum oben und unten, damit das Tuch nicht wie ein Farbfeld wirkt.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(0, 0, canvas.width, 10);
  ctx.fillRect(0, canvas.height - 16, canvas.width, 16);
  const texture = new THREE.CanvasTexture(canvas);
  emblemTextures.set(key, texture);

  // Das Wappen kommt aus einem SVG und ist deshalb erst nach dem Laden da.
  const image = new Image();
  const svg = emblemSVG(factionId, { size: 116, color: '#f6ecd2' });
  image.onload = () => {
    ctx.drawImage(image, 6, 44, 116, 116);
    texture.needsUpdate = true;
    render();
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return texture;
}

// --- Der Feldherrnsitz -----------------------------------------------------
// Hinter dem Kartentisch, dem Betrachter gegenüber, steht der Thron: das Zelt
// ist das Hauptquartier, und ein Hauptquartier hat einen Platz, an dem
// entschieden wird. Links und rechts die Feldzeichen, daneben zwei Stücke
// Ausstattung, die zur Fraktion passen - Schilde und Speere bei Rom,
// Elefantenzähne bei Karthago, Felle beim Norden, Palme bei den Ptolemäern.
//
// Gebaut wird in Throneinheiten (Sitzhöhe 1) und am Ende auf Zeltmaß
// hochskaliert; so bleiben die Maße hier lesbar.

const TENT_MATERIALS = {
  wood: new THREE.MeshStandardMaterial({ color: '#6b4a28', roughness: 0.9 }),
  darkWood: new THREE.MeshStandardMaterial({ color: '#432c17', roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: '#ded6c2', roughness: 0.7 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d9b451', roughness: 0.4, metalness: 0.18 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#b08040', roughness: 0.5, metalness: 0.15 }),
  fur: new THREE.MeshStandardMaterial({ color: '#7a6247', roughness: 1 }),
  clay: new THREE.MeshStandardMaterial({ color: '#a4633c', roughness: 0.95 }),
  ivory: new THREE.MeshStandardMaterial({ color: '#e9e2cc', roughness: 0.6 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#3f7a3a', roughness: 0.9 }),
  ember: new THREE.MeshBasicMaterial({ color: '#ff9a3c' }),
};

function tentBox(group, material, w, h, d, x, y, z, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = rotation;
  group.add(mesh);
  return mesh;
}

// Drei Bauarten Thron: Roms Klappstuhl aus Elfenbein, der steinerne Sitz der
// hellenistischen Höfe, der geschnitzte Hochsitz des Nordens.
const THRONE_STYLE = {
  rom: 'curule', griechen: 'stone', seleukiden: 'stone', ptolemaeer: 'stone',
  karthago: 'stone', gallier: 'wood', germanen: 'wood', britannier: 'wood',
  iberer: 'wood', daker: 'wood', illyrer: 'wood', sarmaten: 'wood',
  numidien: 'wood', parther: 'stone', armenien: 'stone', pontus: 'stone',
};

// Zwei Stücke Ausstattung je Fraktion.
const TENT_FURNISHINGS = {
  rom: ['shields', 'spears'],
  karthago: ['tusks', 'amphorae'],
  gallier: ['pelts', 'spears'],
  griechen: ['shields', 'amphorae'],
  germanen: ['pelts', 'spears'],
  britannier: ['shields', 'pelts'],
  iberer: ['spears', 'amphorae'],
  daker: ['spears', 'pelts'],
  seleukiden: ['tusks', 'brazier'],
  ptolemaeer: ['palm', 'amphorae'],
  illyrer: ['shields', 'brazier'],
  sarmaten: ['pelts', 'brazier'],
  numidien: ['spears', 'palm'],
  parther: ['brazier', 'pelts'],
  armenien: ['shields', 'brazier'],
  pontus: ['amphorae', 'shields'],
};

function buildThrone(style, colour) {
  const group = new THREE.Group();
  const frame = style === 'stone' ? TENT_MATERIALS.stone
    : style === 'curule' ? TENT_MATERIALS.ivory : TENT_MATERIALS.wood;
  const cushion = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.85 });

  // Podest, auf dem der Sitz steht - zwei Stufen, damit er über den Tisch sieht.
  tentBox(group, TENT_MATERIALS.darkWood, 4.2, 0.22, 3.4, 0, 0, 0);
  tentBox(group, TENT_MATERIALS.darkWood, 3.4, 0.22, 2.8, 0, 0.22, 0);
  const base = 0.44;

  if (style === 'curule') {
    // Der kurulische Stuhl: gekreuzte Beine, kein Rücken, ein Kissen darauf.
    for (const side of [-1, 1]) {
      for (const lean of [-1, 1]) {
        const leg = tentBox(group, frame, 0.16, 1.5, 0.16, side * 0.62, base, lean * 0.05);
        leg.rotation.z = lean * 0.42;
      }
    }
    tentBox(group, frame, 1.9, 0.16, 1.4, 0, base + 1.05, 0);
    tentBox(group, cushion, 1.75, 0.22, 1.25, 0, base + 1.21, 0);
  } else {
    for (const side of [-1, 1]) {
      tentBox(group, frame, 0.26, 1.1, 0.26, side * 0.78, base, 0.55);
      tentBox(group, frame, 0.26, 2.6, 0.26, side * 0.78, base, -0.62);
    }
    tentBox(group, frame, 1.95, 0.2, 1.5, 0, base + 1.1, 0);
    tentBox(group, cushion, 1.8, 0.24, 1.35, 0, base + 1.3, 0);
    // Rückenlehne mit Aufsatz
    tentBox(group, frame, 1.95, 1.7, 0.22, 0, base + 1.3, -0.62);
    tentBox(group, style === 'stone' ? TENT_MATERIALS.gold : TENT_MATERIALS.bronze,
      2.15, 0.2, 0.32, 0, base + 3.0, -0.62);
    // Armlehnen
    for (const side of [-1, 1]) {
      tentBox(group, frame, 0.22, 0.2, 1.5, side * 0.86, base + 1.75, 0);
    }
  }
  return group;
}

const FURNISHING_BUILDERS = {
  // Schilde, an den Bock gelehnt.
  shields(group, colour) {
    const face = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.85 });
    // Ein Balken auf zwei Böcken, dagegen lehnen die Schilde - sonst schweben
    // sie in der Luft.
    for (const side of [-1, 1]) {
      tentBox(group, TENT_MATERIALS.darkWood, 0.14, 0.95, 0.14, side * 1.25, 0, -0.35);
    }
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.7, 6), TENT_MATERIALS.darkWood
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.95, -0.35);
    group.add(rail);
    for (let i = 0; i < 3; i++) {
      const lean = 0.32;
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.11, 16), face);
      shield.rotation.set(Math.PI / 2 - lean, 0, 0);
      shield.position.set((i - 1) * 0.78, 0.58, 0.05 + Math.sin(lean) * 0.55);
      group.add(shield);
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), TENT_MATERIALS.bronze);
      boss.position.set((i - 1) * 0.78, 0.6, 0.2 + Math.sin(lean) * 0.55);
      group.add(boss);
    }
  },

  // Ein Speerbock: die Schäfte lehnen zusammen, die Spitzen nach oben.
  spears(group) {
    // Ein Speerbock: die Schäfte stehen fast aufrecht am Querbalken, die
    // Spitzen sitzen oben auf dem Schaft und nicht daneben.
    for (const side of [-1, 1]) {
      tentBox(group, TENT_MATERIALS.darkWood, 0.13, 1.3, 0.13, side * 1.1, 0, -0.3);
    }
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 2.4, 6), TENT_MATERIALS.darkWood
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 1.3, -0.3);
    group.add(rail);

    const length = 3.4;
    for (let i = 0; i < 5; i++) {
      const lean = (i - 2) * 0.055;
      const x = (i - 2) * 0.42;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, length, 6), TENT_MATERIALS.wood
      );
      shaft.position.set(x, length / 2, 0);
      shaft.rotation.z = lean;
      group.add(shaft);
      // Die Spitze sitzt am oberen Ende des Schafts. Der Schaft dreht sich um
      // seine Mitte, also wird vom Mittelpunkt aus gerechnet und nicht vom
      // Boden - sonst steckt die Spitze auf halber Höhe im Holz.
      const reach = length / 2 + 0.22;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.46, 6), TENT_MATERIALS.bronze);
      head.position.set(x - Math.sin(lean) * reach, length / 2 + Math.cos(lean) * reach, 0);
      head.rotation.z = lean;
      group.add(head);
    }
  },

  // Ein Kohlebecken auf Dreifuß, das noch glüht.
  brazier(group) {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 1.3, 5), TENT_MATERIALS.bronze
      );
      leg.position.set(Math.cos(angle) * 0.35, 0.65, Math.sin(angle) * 0.35);
      leg.rotation.set(Math.sin(angle) * 0.22, 0, -Math.cos(angle) * 0.22);
      group.add(leg);
    }
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.42, 0.42, 12), TENT_MATERIALS.bronze
    );
    bowl.position.y = 1.5;
    group.add(bowl);
    const coals = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 6), TENT_MATERIALS.ember);
    coals.scale.y = 0.3;
    coals.position.y = 1.68;
    group.add(coals);
  },

  // Amphoren im Ständer.
  amphorae(group) {
    for (let i = 0; i < 3; i++) {
      const jar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.42, 1.5, 10), TENT_MATERIALS.clay
      );
      jar.position.set((i - 1) * 0.72, 0.75, (i % 2) * 0.35);
      jar.rotation.z = (i - 1) * 0.1;
      group.add(jar);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.16, 0.4, 8), TENT_MATERIALS.clay
      );
      neck.position.set((i - 1) * 0.72, 1.62, (i % 2) * 0.35);
      group.add(neck);
    }
  },

  // Felle über einem Gestell.
  pelts(group) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.11, 2.1, 6), TENT_MATERIALS.darkWood
      );
      post.position.set(side * 0.95, 1.05, 0);
      group.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 6), TENT_MATERIALS.darkWood);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.05;
    group.add(bar);
    const hide = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.7, 4, 3), TENT_MATERIALS.fur);
    const pos = hide.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, Math.sin((pos.getX(i) + 0.9) * 2.6) * 0.12);
    }
    hide.geometry.computeVertexNormals();
    hide.material.side = THREE.DoubleSide;
    hide.position.set(0, 1.15, 0.06);
    group.add(hide);
  },

  // Zwei Stoßzähne, mit den Spitzen nach innen aufgestellt.
  tusks(group) {
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.13, 8, 14, Math.PI * 0.62), TENT_MATERIALS.ivory
      );
      tusk.position.set(side * 0.9, 0.15, 0);
      tusk.rotation.set(0, side > 0 ? 0 : Math.PI, side > 0 ? 0.35 : -0.35);
      group.add(tusk);
      tentBox(group, TENT_MATERIALS.darkWood, 0.5, 0.3, 0.5, side * 0.9, 0, 0);
    }
  },

  // Eine Dattelpalme im Kübel.
  palm(group) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.7, 10), TENT_MATERIALS.clay);
    pot.position.y = 0.35;
    group.add(pot);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 2.6, 7), TENT_MATERIALS.wood);
    trunk.position.y = 2.0;
    group.add(trunk);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.7, 4), TENT_MATERIALS.leaf);
      frond.position.set(Math.cos(angle) * 0.62, 3.35, Math.sin(angle) * 0.62);
      frond.rotation.set(Math.sin(angle) * 1.15, 0, -Math.cos(angle) * 1.15);
      group.add(frond);
    }
  },
};

// Ein Feldzeichen: Stange, Querbalken, Tuch mit dem Wappen, vergoldete Spitze.
function buildFieldStandard(factionId, colour) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 5.4, 7), TENT_MATERIALS.darkWood
  );
  pole.position.y = 2.7;
  group.add(pole);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), TENT_MATERIALS.gold);
  finial.position.y = 5.5;
  group.add(finial);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.12), TENT_MATERIALS.gold);
  bar.position.y = 5.05;
  group.add(bar);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.3),
    new THREE.MeshStandardMaterial({
      map: emblemTexture(factionId, colour), side: THREE.DoubleSide,
      roughness: 1, transparent: true,
    })
  );
  cloth.position.set(0, 3.85, 0.03);
  group.add(cloth);
  return group;
}

// Setzt den ganzen Hintergrund zusammen und stellt ihn dem Betrachter
// gegenüber - dorthin, wohin die Grundansicht der Kamera blickt.
function buildTentBackdrop(tent, state, colour, floorY) {
  const player = state.factions.find((f) => f.isPlayer);
  const id = player ? player.id : 'neutral';
  const stage = new THREE.Group();

  const throne = buildThrone(THRONE_STYLE[id] || 'wood', colour);
  throne.scale.setScalar(1.25);
  stage.add(throne);
  for (const side of [-1, 1]) {
    const standard = buildFieldStandard(id, colour);
    standard.position.set(side * 3.4, 0, -0.3);
    stage.add(standard);
  }
  const furnishings = TENT_FURNISHINGS[id] || ['shields', 'spears'];
  furnishings.forEach((kind, index) => {
    const build = FURNISHING_BUILDERS[kind];
    if (!build) return;
    const piece = new THREE.Group();
    build(piece, colour);
    piece.position.set((index === 0 ? -1 : 1) * 5.8, 0, 1.1);
    piece.rotation.y = (index === 0 ? 1 : -1) * 0.42;
    stage.add(piece);
  });

  // Auf Zeltmaß bringen und in die Blickachse der Grundansicht stellen.
  const scale = 26;
  stage.scale.setScalar(scale);
  // Fester Abstand hinter dem Tisch, nicht am Zeltrand: sonst rückte der Thron
  // mit jeder Vergrößerung des Zelts weiter fort.
  const away = 380;
  stage.position.set(
    -Math.cos(DEFAULT_AZIMUTH) * away, floorY, -Math.sin(DEFAULT_AZIMUTH) * away
  );
  stage.rotation.y = Math.PI / 2 - DEFAULT_AZIMUTH;
  tent.add(stage);
}

// --- Der Zeltausgang -------------------------------------------------------
// Ein Zelt ohne Ausgang ist eine Kiste. Die Bahnen sind an einer Stelle
// zurückgeschlagen und mit Stricken an zwei Pfosten gebunden; dahinter steht
// das Tageslicht des Lagers. Hinausgehen kann man nicht - der Feldzug wird an
// diesem Tisch geführt -, aber man sieht, dass es ein Draußen gibt.
function buildTentExit(tent, colour, floorY) {
  const doorway = new THREE.Group();
  const width = 250;
  const height = TENT_WALL * 0.94;

  // Draußen: oben der Himmel, unten der Boden des Lagers. Eine einzelne helle
  // Fläche reichte nicht - die Zeltbahn ist selbst hell, und ohne den kühlen
  // Himmel darüber liest sich das Loch nicht als Ausgang, sondern als Fleck.
  const horizon = height * 0.42;
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height - horizon),
    new THREE.MeshBasicMaterial({ color: '#dbe9f7', side: THREE.DoubleSide })
  );
  sky.position.y = horizon + (height - horizon) / 2;
  doorway.add(sky);
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(width, horizon),
    new THREE.MeshBasicMaterial({ color: '#b8a276', side: THREE.DoubleSide })
  );
  outside.position.y = horizon / 2;
  doorway.add(outside);

  // Ein Streifen Boden davor, damit der Ausgang nicht in der Luft hängt.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 46),
    new THREE.MeshBasicMaterial({ color: '#c9b98d', side: THREE.DoubleSide })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0.5, -22);
  doorway.add(ground);

  // Das Lager draußen: ein paar Zeltspitzen als Schattenriss vor dem Licht.
  // Sie liegen dicht vor der hellen Fläche, nicht dahinter - was hinter der
  // Zeltwand steht, wäre von innen ohnehin verdeckt.
  const silhouette = new THREE.MeshBasicMaterial({ color: '#8f7f5c' });
  for (const [x, size] of [[-88, 40], [-26, 54], [44, 34], [98, 46]]) {
    const hut = new THREE.Mesh(new THREE.ConeGeometry(size * 0.62, size, 4), silhouette);
    hut.position.set(x, horizon * 0.55 + size / 2 - 6, 1.5);
    hut.rotation.y = Math.PI / 4;
    doorway.add(hut);
  }

  // Pfosten und Sturz.
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 6, height + 14, 7), TABLE_WOOD_DARK
    );
    post.position.set(side * (width / 2 + 5), (height + 14) / 2, 4);
    doorway.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 26, 9, 9), TABLE_WOOD_DARK);
  lintel.position.set(0, height + 6, 4);
  doorway.add(lintel);

  // Die zurückgeschlagenen Bahnen links und rechts, in der Farbe des Zelts.
  const flapMaterial = new THREE.MeshStandardMaterial({
    map: tentFabric(colour), side: THREE.DoubleSide, roughness: 1, color: '#e8dcc0',
  });
  for (const side of [-1, 1]) {
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(64, height), flapMaterial);
    flap.position.set(side * (width / 2 - 16), height / 2, 20);
    flap.rotation.y = side * 0.85;
    doorway.add(flap);
    // Der Strick, mit dem die Bahn zurückgebunden ist.
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 34, 5),
      new THREE.MeshStandardMaterial({ color: '#b9a170', roughness: 1 })
    );
    rope.rotation.z = Math.PI / 2;
    rope.position.set(side * (width / 2 - 4), height * 0.55, 16);
    doorway.add(rope);
  }

  // Etwas Licht fällt herein.
  const glow = new THREE.PointLight('#ffeec4', 0.5, 420);
  glow.position.set(0, height * 0.6, 60);
  doorway.add(glow);

  // Quer zur Grundansicht, damit der Ausgang neben dem Thron im Bild liegt und
  // ihn nicht verdeckt.
  // Deutlich innerhalb des Zeltrands: die Wand ist ein Sechzehneck, ihre
  // Flächen liegen in der Mitte jedes Segments gut zehn Einheiten weiter innen
  // als der Radius - ein Ausgang direkt an der Radiuslinie verschwände bis auf
  // einen schmalen Streifen dahinter.
  const angle = DEFAULT_AZIMUTH - Math.PI / 2;
  const seat = TENT_RADIUS * Math.cos(Math.PI / 16) - 26;
  doorway.position.set(Math.cos(angle) * seat, floorY, Math.sin(angle) * seat);
  doorway.rotation.y = -angle + Math.PI / 2;
  tent.add(doorway);
}

function buildTent(state) {
  if (tentGroup) scene.remove(tentGroup);
  tentGroup = new THREE.Group();

  const player = factionById(state, (state.factions.find((f) => f.isPlayer) || {}).id);
  const colour = player ? player.color : '#8a6134';
  const radius = TENT_RADIUS;
  const height = TENT_HEIGHT;

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.02, 32),
    new THREE.MeshStandardMaterial({ color: '#4a3b26', roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = tileTopY(TILE_TYPES.water.elevation) - 2.6;
  tentGroup.add(floor);

  // Das Dach: ein Kegel von innen gesehen.
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 16, 1, true),
    new THREE.MeshStandardMaterial({
      map: tentFabric(colour), side: THREE.BackSide, roughness: 1,
    })
  );
  roof.position.y = floor.position.y + TENT_WALL + height / 2 - 8;
  tentGroup.add(roof);

  // Die Wände: ein niedriger Zylinder unter dem Dach, damit das Zelt steht
  // und nicht auf dem Boden aufsitzt.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, TENT_WALL, 16, 1, true),
    new THREE.MeshStandardMaterial({
      map: tentFabric(colour), side: THREE.BackSide, roughness: 1, color: '#e8dcc0',
    })
  );
  wall.position.y = floor.position.y + TENT_WALL / 2;
  tentGroup.add(wall);

  // Fahnen an den Zeltbahnen: sie sagen auf einen Blick, wessen Zelt das ist -
  // in der Farbe der Fraktion und mit ihrem Zeichen darauf.
  const bannerMaterial = new THREE.MeshStandardMaterial({
    map: emblemTexture(player ? player.id : 'neutral', colour),
    side: THREE.DoubleSide,
    roughness: 1,
    transparent: true,
  });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(58, 96), bannerMaterial);
    banner.position.set(
      Math.cos(angle) * (radius - 10), floor.position.y + TENT_WALL * 0.62, Math.sin(angle) * (radius - 10)
    );
    banner.rotation.y = -angle + Math.PI / 2;
    tentGroup.add(banner);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(66, 4, 4), TABLE_WOOD_DARK);
    bar.position.copy(banner.position);
    bar.position.y += 50;
    bar.rotation.y = banner.rotation.y;
    tentGroup.add(bar);
  }

  // Ein paar Stangen, damit man die Größe des Zelts sieht.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.8, TENT_WALL, 6),
      TABLE_WOOD_DARK
    );
    pole.position.set(
      Math.cos(angle) * (radius - 5), floor.position.y + TENT_WALL / 2, Math.sin(angle) * (radius - 5)
    );
    tentGroup.add(pole);
  }

  buildTentBackdrop(tentGroup, state, colour, floor.position.y);
  buildTentExit(tentGroup, colour, floor.position.y);

  scene.add(tentGroup);
}

// Das Straßennetz als ein einziges Gitter: für jedes Straßenfeld ein Plättchen
// und je ein halber Balken zu jedem Straßennachbarn. Beide Hälften treffen
// sich in der Mitte, damit Kurven und Kreuzungen von selbst zusammenpassen.
let roadVersionDrawn = -1;

// Die Höhe an einer beliebigen Stelle des Geländes, nicht die der nächsten
// Feldmitte. Ein Band, das auf einer Feldgrenze liegt - und genau dort liegt
// ein Fluss -, bekäme sonst je Eckpunkt die Höhe irgendeines der vier
// angrenzenden Felder und liefe treppenförmig durchs Gelände.
function bandY(x, z) {
  const colF = x / TILE_SIZE + mapCols / 2;
  const rowF = z / TILE_SIZE + mapRows / 2;
  return Math.max(groundY(colF, rowF), SEA_LEVEL_Y);
}

function pushQuad(positions, ax, az, bx, bz, halfWidth, lift = 0.18) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz) || 1;
  const nx = (-dz / length) * halfWidth;
  const nz = (dx / length) * halfWidth;
  const corners = [
    [ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz],
  ];
  for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
    for (const corner of [corners[i], corners[j], corners[k]]) {
      positions.push(corner[0], bandY(corner[0], corner[1]) + lift, corner[1]);
    }
  }
}

// --- Flüsse und Brücken ----------------------------------------------------
// Der Fluss läuft auf der Feldgrenze, nicht durch ein Feld: für jede Kante ein
// schmales Band entlang der gemeinsamen Kante, alle zu einer Geometrie
// verschmolzen. Wo eine Straße hinüberführt, liegt eine Brücke darüber - das
// ist genau die Stelle, an der ein Heer trockenen Fußes über den Fluss kommt.

let riversGroup = null;
// In so viele Stücke wird ein Uferstück zerlegt, und so hoch liegt es über
// dem Boden - hoch genug, dass ein Knick im Gelände es nicht verschluckt,
// flach genug, dass es nicht über der Landschaft schwebt.
const RIVER_PIECES = 5;
const RIVER_LIFT = 0.2;

// Die beiden Feldmitten einer Kante und der Punkt dazwischen.
function riverEdgeTiles(key, cols) {
  const [a, b] = key.split('|').map(Number);
  const ac = a % cols;
  const bc = b % cols;
  return {
    a: { col: ac, row: (a - ac) / cols },
    b: { col: bc, row: (b - bc) / cols },
  };
}

function buildRivers(state) {
  if (riversGroup) scene.remove(riversGroup);
  riversGroup = new THREE.Group();
  scene.add(riversGroup);
  const rivers = state.map.rivers;
  if (!rivers || !rivers.size) return;

  const positions = [];
  const bridges = [];
  const half = TILE_SIZE / 2;

  for (const key of rivers) {
    const { a, b } = riverEdgeTiles(key, state.map.cols);
    // Die gemeinsame Kante liegt quer zur Verbindung der beiden Feldmitten.
    const mx = (worldX(a.col) + worldX(b.col)) / 2;
    const mz = (worldZ(a.row) + worldZ(b.row)) / 2;
    const alongX = a.row === b.row;
    // Jedes Band reicht um seine halbe Breite über die Feldgrenze hinaus.
    // Zwei Stücke, die im rechten Winkel aufeinandertreffen, überlappen sich
    // dadurch in der Ecke; ohne diesen Überstand blieb dort außen ein Zwickel
    // frei, und ein Lauf über viele Ecken sah aus wie eine gestrichelte Linie.
    const width = TILE_SIZE * 0.12;
    const reach = half + width;
    const from = alongX ? [mx, mz - reach] : [mx - reach, mz];
    const to = alongX ? [mx, mz + reach] : [mx + reach, mz];
    // In Stücke zerlegt, damit das Band dem Gelände folgt. Ein Uferstück ist
    // ein ganzes Feld lang und läuft dabei über ein Dreiecksfeld des Geländes
    // hinweg; als eine einzige Fläche zwischen zwei Endpunkten schnitt es in
    // hügeligem Land in den Boden, und der Fluss wirkte unterbrochen.
    for (let piece = 0; piece < RIVER_PIECES; piece++) {
      const t0 = piece / RIVER_PIECES;
      const t1 = (piece + 1) / RIVER_PIECES;
      pushQuad(positions,
        from[0] + (to[0] - from[0]) * t0, from[1] + (to[1] - from[1]) * t0,
        from[0] + (to[0] - from[0]) * t1, from[1] + (to[1] - from[1]) * t1,
        width, RIVER_LIFT);
    }

    const roads = state.roads || {};
    // Eine Brücke steht dort, wo eine Straße den Fluss quert - aber nicht am
    // Rand einer Stadt: dort führt der Weg durch den Ort, und ein Brückenbogen
    // stünde mitten in den Häusern. Für die Bewegung zählt der Übergang
    // trotzdem, die Stadt ist die Brücke.
    const amOrt = state.cities.some((city) => (city.col === a.col && city.row === a.row)
      || (city.col === b.col && city.row === b.row));
    if (!amOrt && roads[`${a.col},${a.row}`] && roads[`${b.col},${b.row}`]) {
      bridges.push({ mx, mz, alongX });
    }
  }

  if (positions.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: '#3f7fb8', roughness: 0.35, side: THREE.DoubleSide,
    }));
    mesh.frustumCulled = false;
    riversGroup.add(mesh);
  }

  for (const bridge of bridges) buildBridge(riversGroup, bridge);
}

// Eine Brücke, die den Namen verdient: ein leicht gewölbter Bogen von Ufer zu
// Ufer, das Geländer mit Pfosten, zwei Pfeiler im Wasser. Gebaut wird sie
// entlang der eigenen x-Achse und danach quer zum Fluss gedreht; die Höhe an
// beiden Enden kommt vom Gelände, damit sie an den Ufern aufsitzt und nicht
// darüber schwebt.
// Eine gerade Holzbrücke: ein flacher Bohlenbelag von Ufer zu Ufer, ein
// Geländer auf jeder Seite, Pfähle ins Flussbett gerammt. Kein Bogen, keine
// Wölbung - was ein Trupp Pioniere an einem Tag hinbekommt, und aus der
// Feldherrnperspektive auf Anhieb als Brücke zu lesen.
const BRIDGE_PILES = 3;

function buildBridge(parent, bridge) {
  const { mx, mz, alongX } = bridge;
  const dirX = alongX ? 1 : 0;
  const dirZ = alongX ? 0 : 1;
  const span = TILE_SIZE * 0.98;
  const half = span / 2;
  const bankA = bandY(mx - dirX * half, mz - dirZ * half);
  const bankB = bandY(mx + dirX * half, mz + dirZ * half);
  const base = Math.max(bankA, bankB);
  const width = TILE_SIZE * 0.34;
  // Knapp über dem Wasser: eine Holzbrücke steigt nicht an.
  const deck = 0.46;

  const group = new THREE.Group();

  // Der Belag - eine durchgehende Platte. Einzelne, gegeneinander gekippte
  // Bohlen lasen sich aus der Ferne als Schutthaufen und nicht als Brücke.
  const road = new THREE.Mesh(new THREE.BoxGeometry(span, 0.2, width), BRIDGE_TIMBER);
  road.position.y = deck - 0.1;
  group.add(road);

  // Zwei Querbalken unter dem Belag, auf denen er aufliegt.
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(span, 0.16, 0.16), BRIDGE_TIMBER_DARK
    );
    beam.position.set(0, deck - 0.26, side * width * 0.34);
    group.add(beam);
  }

  // Geländer: eine Latte auf Pfosten, auf beiden Seiten.
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(span, 0.09, 0.09), BRIDGE_TIMBER
    );
    rail.position.set(0, deck + 0.44, side * width * 0.44);
    group.add(rail);
    for (let i = 0; i <= BRIDGE_PILES + 1; i++) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.5, 0.11), BRIDGE_TIMBER_DARK
      );
      post.position.set(-half + (span / (BRIDGE_PILES + 1)) * i, deck + 0.2, side * width * 0.44);
      group.add(post);
    }
  }

  // Die Pfähle stehen im Wasser und tragen die Querbalken. Sie reichen unter
  // die Wasserlinie, damit sie nicht auf ihr aufzusitzen scheinen.
  const foot = Math.min(bankA, bankB) - base - 1.0;
  for (let i = 1; i <= BRIDGE_PILES; i++) {
    const x = -half + (span / (BRIDGE_PILES + 1)) * i;
    for (const side of [-1, 1]) {
      const height = deck - 0.26 - foot;
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, height, 6), BRIDGE_TIMBER_DARK
      );
      pile.position.set(x, foot + height / 2, side * width * 0.34);
      group.add(pile);
    }
    // Eine Strebe quer, damit das Gerüst nicht wie aufgestellte Stäbe wirkt.
    const brace = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, width * 0.72), BRIDGE_TIMBER_DARK
    );
    brace.position.set(x, deck - 0.62, 0);
    group.add(brace);
  }

  // Die Auflager an den Ufern: ein Holzkasten, der den Belag abfängt.
  for (const [t, bank] of [[-1, bankA], [1, bankB]]) {
    const ground = bank - base - 0.4;
    const height = deck - 0.2 - ground;
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, height, width * 1.06), BRIDGE_TIMBER_DARK
    );
    sill.position.set(t * (half - 0.25), ground + height / 2, 0);
    group.add(sill);
  }

  group.position.set(mx, base, mz);
  // Die Brücke liegt quer zum Fluss: läuft der Fluss in z-Richtung, führt sie
  // in x-Richtung darüber.
  group.rotation.y = alongX ? 0 : Math.PI / 2;
  parent.add(group);
}

const BRIDGE_TIMBER = new THREE.MeshStandardMaterial({ color: '#a97c46', roughness: 0.95 });
const BRIDGE_TIMBER_DARK = new THREE.MeshStandardMaterial({ color: '#6f4d29', roughness: 1 });

function buildRoadNetwork(state) {
  while (roadsGroup.children.length) {
    const child = roadsGroup.children.pop();
    child.geometry.dispose();
    child.material.dispose();
  }
  const roads = state.roads || {};
  const positions = [];
  const half = TILE_SIZE * 0.17;

  for (const key of Object.keys(roads)) {
    const [col, row] = key.split(',').map(Number);
    const x = worldX(col);
    const z = worldZ(row);
    pushQuad(positions, x - half, z, x + half, z, half);
    pushQuad(positions, x, z - half, x, z + half, half);
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      if (!roads[`${col + dc},${row + dr}`]) continue;
      pushQuad(positions, x, z, worldX(col + dc), worldZ(row + dr), half);
    }
  }
  if (!positions.length) return;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: '#a9895c', roughness: 1, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  roadsGroup.add(mesh);
}

// One ring of fortification. `span` is the same for all three so a settlement
// keeps its footprint as it is upgraded; what changes is the material, the
// height and whether there are towers.
function buildFortification(kind, scale) {
  const ring = new THREE.Group();
  const span = 4.4 * scale;
  const half = span / 2;

  if (kind === 'palisade') {
    // Eine Palisade ist eine Wand, kein Zaun: die Stämme stehen dicht an
    // dicht, und dahinter läuft ein durchgehender Balken, damit zwischen den
    // Pfählen kein Tageslicht steht.
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5433', roughness: 1 });
    const height = 0.92 * scale;
    const radius = 0.13 * scale;
    // So viele Stämme, dass sie sich berühren.
    const perSide = Math.max(12, Math.round(span / (radius * 1.7)));
    for (let side = 0; side < 4; side++) {
      const angle = (side * Math.PI) / 2;
      // Der geschlossene Wall hinter den Stämmen.
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(span, height * 0.86, radius * 1.1),
        wood
      );
      wall.rotation.y = angle;
      wall.position.set(
        Math.sin(angle) * half, height * 0.43, Math.cos(angle) * half
      );
      ring.add(wall);
      for (let i = 0; i < perSide; i++) {
        const t = (i / (perSide - 1) - 0.5) * span;
        const x = Math.cos(angle) * t + Math.sin(angle) * half;
        const z = -Math.sin(angle) * t + Math.cos(angle) * half;
        const stake = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 0.82, radius, height, 5),
          wood
        );
        stake.position.set(x, height / 2, z);
        ring.add(stake);
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(radius, 0.22 * scale, 5),
          wood
        );
        tip.position.set(x, height + 0.11 * scale, z);
        ring.add(tip);
      }
    }
    return ring;
  }

  const stone = kind === 'stone';
  const material = new THREE.MeshStandardMaterial({
    color: stone ? '#b8ab90' : '#8a6134',
    roughness: stone ? 0.9 : 1,
  });
  const height = (stone ? 1.28 : 1.02) * scale;
  const thickness = (stone ? 0.28 : 0.22) * scale;

  for (let i = 0; i < 4; i++) {
    const segment = new THREE.Mesh(new THREE.BoxGeometry(span, height, thickness), material);
    segment.position.y = height / 2;
    segment.rotation.y = (i * Math.PI) / 2;
    segment.position.x = Math.sin(segment.rotation.y) * half;
    segment.position.z = Math.cos(segment.rotation.y) * half;
    ring.add(segment);
    // The parapet a defender actually stands behind.
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(span, 0.12 * scale, thickness * 1.7),
      material
    );
    walk.position.copy(segment.position);
    walk.position.y = height + 0.06 * scale;
    walk.rotation.y = segment.rotation.y;
    ring.add(walk);
  }

  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    const tower = stone
      ? new THREE.Mesh(
        new THREE.CylinderGeometry(0.3 * scale, 0.34 * scale, height * 1.32, 8),
        material
      )
      : new THREE.Mesh(
        new THREE.BoxGeometry(0.54 * scale, height * 1.26, 0.54 * scale),
        material
      );
    tower.position.set(
      Math.cos(angle) * half * Math.SQRT2,
      height * (stone ? 0.66 : 0.63),
      Math.sin(angle) * half * Math.SQRT2
    );
    tower.rotation.y = angle;
    ring.add(tower);
  }
  return ring;
}

// --- Siedlungen ----------------------------------------------------------
// Ein Dorf, eine Stadt und eine große Stadt sollen sich schon an der
// Silhouette unterscheiden lassen, nicht erst am Maßstab: Rundhütten mit
// Strohdach, ein Rechteckbau mit Walmdach, ein Tempel mit Säulen und Giebel.

const CITY_MATERIALS = {
  plaster: new THREE.MeshStandardMaterial({ color: '#d8c9a3', roughness: 0.85 }),
  timber: new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 1 }),
  thatch: new THREE.MeshStandardMaterial({ color: '#b39456', roughness: 1 }),
  marble: new THREE.MeshStandardMaterial({ color: '#eee6d2', roughness: 0.55 }),
  wood: new THREE.MeshStandardMaterial({ color: '#5a4127', roughness: 1 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d9b451', roughness: 0.4, metalness: 0.35 }),
};

// Ein Haus mit Walmdach. Das Dach trägt die Fraktionsfarbe - es ist das, was
// aus der Vogelperspektive zu sehen ist.
// Ein Satteldach, das genau auf sein Haus passt. Vorher war es ein
// vierseitiger Kegel, um 45 Grad gedreht und danach entlang einer Achse
// gestaucht - die Stauchachse lag nach der Drehung schief zum Haus, und das
// Dach saß verkantet darauf. Hier wird die Form direkt aus den Maßen des
// Hauses gebaut: First entlang der langen Seite, Traufe mit etwas Überstand.
function makeGableRoof(width, depth, height) {
  const hw = (width / 2) * 1.12;
  const hd = (depth / 2) * 1.12;
  const alongX = width >= depth;
  const ridge = (alongX ? hw : hd) * 0.42;
  const v = alongX
    ? [
      [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd],
      [-ridge, height, 0], [ridge, height, 0],
    ]
    : [
      [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd],
      [0, height, -ridge], [0, height, ridge],
    ];
  // 0..3 Traufe im Uhrzeigersinn, 4/5 die Firstpunkte.
  const faces = alongX
    ? [[0, 1, 5], [0, 5, 4], [2, 3, 4], [2, 4, 5], [1, 2, 5], [3, 0, 4]]
    : [[1, 2, 5], [1, 5, 4], [3, 0, 4], [3, 4, 5], [2, 3, 5], [0, 1, 4]];
  const positions = [];
  for (const [a, b, c] of faces) {
    positions.push(...v[a], ...v[b], ...v[c]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addHouse(group, tinted, x, z, width, depth, height, rotation) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), CITY_MATERIALS.plaster);
  body.position.set(x, height / 2, z);
  body.rotation.y = rotation;
  group.add(body);

  const roof = new THREE.Mesh(
    makeGableRoof(width, depth, height * 0.55),
    // Each roof gets its own material: they are tinted per faction, and a
    // shared one would repaint every city on the map at once.
    new THREE.MeshStandardMaterial({
      color: '#b5432f', roughness: 0.6, side: THREE.DoubleSide,
    })
  );
  roof.position.set(x, height, z);
  roof.rotation.y = rotation;
  group.add(roof);
  tinted.push(roof);
  return roof;
}

// Eine Rundhütte mit Strohdach - das Bild, das ein Dorf abgeben soll.
function addHut(group, x, z, radius, height) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.06, height, 8),
    CITY_MATERIALS.timber
  );
  body.position.set(x, height / 2, z);
  group.add(body);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 1.35, height * 0.95, 8),
    CITY_MATERIALS.thatch
  );
  roof.position.set(x, height + height * 0.47, z);
  group.add(roof);
}

// Podium, Säulen, Gebälk, Giebel: ein Tempel, der als Tempel zu erkennen ist.
function addTemple(group, tinted, x, z, width, rotation) {
  const temple = new THREE.Group();
  const depth = width * 0.62;
  const columnHeight = width * 0.52;

  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(width, width * 0.14, depth),
    CITY_MATERIALS.marble
  );
  podium.position.y = width * 0.07;
  temple.add(podium);

  const columns = 6;
  const columnGeometry = new THREE.CylinderGeometry(width * 0.045, width * 0.05, columnHeight, 7);
  for (let i = 0; i < columns; i++) {
    const front = i < columns / 2;
    const along = (i % (columns / 2)) / (columns / 2 - 1) - 0.5;
    const column = new THREE.Mesh(columnGeometry, CITY_MATERIALS.marble);
    column.position.set(along * width * 0.72, width * 0.14 + columnHeight / 2,
      (front ? 1 : -1) * depth * 0.34);
    temple.add(column);
  }

  const entablature = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.92, width * 0.1, depth * 0.86),
    CITY_MATERIALS.marble
  );
  entablature.position.y = width * 0.14 + columnHeight + width * 0.05;
  temple.add(entablature);

  // Das Tempeldach: derselbe Satteldachschnitt wie über einem Haus, nur
  // breiter und flacher - der First läuft über die lange Seite.
  const pediment = new THREE.Mesh(
    makeGableRoof(width * 0.98, depth * 0.92, width * 0.26),
    new THREE.MeshStandardMaterial({
      color: '#c65a41', roughness: 0.6, side: THREE.DoubleSide,
    })
  );
  pediment.position.y = width * 0.14 + columnHeight + width * 0.1;
  temple.add(pediment);
  tinted.push(pediment);

  temple.position.set(x, 0, z);
  temple.rotation.y = rotation;
  group.add(temple);
}

// Ein Feldzeichen: Stange, Banner in der Fraktionsfarbe, vergoldete Spitze.
// --- Fahnen ---------------------------------------------------------------
// Eine Fahne ist eine Fläche, und eine Fläche verschwindet, sobald man von der
// Seite darauf sieht - beim Drehen der Karte wurde aus jedem Banner ein Strich.
// Die Tücher hängen deshalb in einer eigenen Gruppe, die sich mit der Kamera
// dreht: die Stange bleibt stehen, das Tuch zeigt immer zum Betrachter.
const billboards = [];

function alignBillboards() {
  const facing = Math.atan2(Math.cos(cam.azimuth), Math.sin(cam.azimuth));
  for (const group of billboards) group.rotation.y = facing;
}

// Ein Tuch mit Faltenwurf statt einer geraden Fläche: schmaler zum Mast hin,
// leicht gewellt, damit es auch im Streiflicht als Stoff zu erkennen ist.
function makeBannerCloth(width, height, material) {
  const geometry = new THREE.PlaneGeometry(width, height, 4, 1);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    // Am Mast (x = -width/2) liegt das Tuch an, außen weht es aus.
    const t = (x + width / 2) / width;
    position.setZ(i, Math.sin(t * Math.PI * 1.6) * height * 0.16);
    position.setY(i, position.getY(i) * (1 - t * 0.12));
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = width / 2;
  return mesh;
}

function addStandard(group, tinted, height, bannerWidth) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, height, 6),
    CITY_MATERIALS.wood
  );
  pole.position.y = height / 2;
  group.add(pole);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), CITY_MATERIALS.gold);
  finial.position.y = height + 0.1;
  group.add(finial);

  const flag = new THREE.Group();
  flag.position.y = height - bannerWidth * 0.5;
  group.add(flag);
  billboards.push(flag);

  const banner = makeBannerCloth(
    bannerWidth, bannerWidth * 0.72,
    new THREE.MeshStandardMaterial({ color: '#999', side: THREE.DoubleSide, roughness: 0.85 })
  );
  flag.add(banner);
  tinted.push(banner);
  return banner;
}

function buildCityGroup(city) {
  const group = new THREE.Group();
  const tier = settlementTier(city.size);
  const scale = tier.modelScale * (city.capital ? 1.12 : 1);
  const tinted = [];
  const rng = seededRandomFactory(city.col * 733 + city.row * 197 + 11);

  if (city.size === 'village') {
    // Ein Weiler: eine größere Hütte, ein paar kleinere darum.
    addHut(group, 0, 0, 0.85 * scale, 1.15 * scale);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + rng() * 0.7;
      addHut(group, Math.cos(angle) * 1.7 * scale, Math.sin(angle) * 1.7 * scale,
        0.52 * scale, 0.78 * scale);
    }
    // Am Dorf ist das Banner das Einzige, was die Zugehörigkeit zeigt - es
    // muss also von weitem zu sehen sein.
    addStandard(group, tinted, 3.6 * scale, 1.15 * scale);
  } else {
    const large = city.size === 'large';
    // Die Halle in der Mitte, quer gestellt, damit sie nicht wie ein Würfel
    // wirkt.
    // Die Halle nach hinten, damit der Tempel in der Standardansicht davor
    // steht und nicht dahinter verschwindet.
    addHouse(group, tinted, 0, -0.85 * scale, 2.7 * scale, 1.7 * scale, 1.5 * scale, 0);
    const houses = large ? 7 : 5;
    const ring = (large ? 2.6 : 2.3) * scale;
    for (let i = 0; i < houses; i++) {
      // Die Häuser weichen dem Tempel im Süden aus.
      const angle = (i / houses) * Math.PI * 2 + (large ? 2.0 : 0.4);
      const width = (0.85 + rng() * 0.5) * scale;
      addHouse(group, tinted,
        Math.cos(angle) * ring, Math.sin(angle) * ring,
        width, width * 0.72, (0.75 + rng() * 0.45) * scale, angle);
    }
    // Innerhalb des Mauerrings (halbe Spannweite 2,2 · scale), sonst steht der
    // Tempel vor den Toren.
    if (large) addTemple(group, tinted, 0, 1.35 * scale, 2.1 * scale, 0);
    addStandard(group, tinted, (large ? 4.6 : 3.8) * scale, (large ? 1.3 : 1.05) * scale);
  }

  const label = makeLabelSprite(city.name, { scale: city.capital ? 1.15 : 0.95 });
  label.position.y = (city.size === 'village' ? 4.2 : city.size === 'large' ? 6.6 : 5.6) * scale;
  group.add(label);

  // Die Befestigungen entstehen erst, wenn sie gebaut sind: die meisten Orte
  // haben keine, und jedes ungenutzte Modell kostet Zeichenaufrufe.
  return {
    group, label, tinted, scale, walls: [null, null, null], harbour: null,
  };
}

// --- Weltwunder und Wahrzeichen ------------------------------------------
// Die Bauwerke der Alten Welt stehen auf ihrem echten Feld. Teilt sich eines
// das Feld mit einer Stadt - der Parthenon mit Athen, der Jupitertempel mit
// Rom -, rückt es an den Rand des Felds und auf einen Felsen darüber: so
// steht es neben der Stadt statt zwischen ihren Dächern, und beim Kapitol und
// bei der Akropolis ist der Burgberg ohnehin der historische Ort.

const WONDER_MATERIALS = {
  limestone: new THREE.MeshStandardMaterial({ color: '#ded1ab', roughness: 0.9 }),
  sandstone: new THREE.MeshStandardMaterial({ color: '#cbb083', roughness: 0.95 }),
  marble: new THREE.MeshStandardMaterial({ color: '#f0ead8', roughness: 0.5 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#c98f3e', roughness: 0.45, metalness: 0.12 }),
  gold: new THREE.MeshStandardMaterial({ color: '#e6c65c', roughness: 0.4, metalness: 0.15 }),
  roof: new THREE.MeshStandardMaterial({ color: '#b8503a', roughness: 0.7, side: THREE.DoubleSide }),
  rock: new THREE.MeshStandardMaterial({ color: '#8f8779', roughness: 1, flatShading: true }),
  fire: new THREE.MeshBasicMaterial({ color: '#ffcb6b' }),
};

function addBox(group, material, width, height, depth, x, y, z, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y + height / 2, z);
  mesh.rotation.y = rotation;
  group.add(mesh);
  return mesh;
}

// Eine Reihe Säulen auf einem Stufenbau, mit Gebälk und Satteldach darüber -
// der Bauplan, aus dem Ephesos, der Parthenon, Delphi und das Kapitol jeweils
// eine eigene Größe machen.
function makeColonnade(width, columnHeight, { columns = 6 } = {}) {
  const group = new THREE.Group();
  const depth = width * 0.6;
  addBox(group, WONDER_MATERIALS.marble, width, width * 0.09, depth, 0, 0, 0);
  addBox(group, WONDER_MATERIALS.marble, width * 0.9, width * 0.07, depth * 0.9, 0, width * 0.09, 0);
  const base = width * 0.16;

  const shaft = new THREE.CylinderGeometry(width * 0.035, width * 0.042, columnHeight, 8);
  for (let i = 0; i < columns; i++) {
    for (const side of [-1, 1]) {
      const along = (i / (columns - 1) - 0.5) * width * 0.78;
      const column = new THREE.Mesh(shaft, WONDER_MATERIALS.marble);
      column.position.set(along, base + columnHeight / 2, side * depth * 0.33);
      group.add(column);
    }
  }

  addBox(group, WONDER_MATERIALS.marble, width * 0.86, width * 0.08, depth * 0.78,
    0, base + columnHeight, 0);
  const pediment = new THREE.Mesh(
    makeGableRoof(width * 0.92, depth * 0.84, width * 0.22), WONDER_MATERIALS.roof
  );
  pediment.position.y = base + columnHeight + width * 0.08;
  group.add(pediment);
  return group;
}

// Ein stehender Mensch, grob aus Kästen - genug, um aus der Feldherrnperspektive
// als Statue durchzugehen.
function addFigure(group, material, height, { armUp = false, stride = 0.5 } = {}) {
  const unit = height / 8;
  // Die Beine stehen auseinander: aus der Feldherrnperspektive ist eine
  // einzelne Säule kein Mensch, zwei Beine mit Lücke dazwischen schon.
  for (const side of [-1, 1]) {
    addBox(group, material, unit * 0.62, unit * 3.3, unit * 0.7,
      side * unit * stride, 0, 0);
  }
  addBox(group, material, unit * 1.9, unit * 2.9, unit * 1.15, 0, unit * 3.3, 0);
  addBox(group, material, unit * 1.2, unit * 0.5, unit * 0.9, 0, unit * 6.2, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(unit * 0.8, 10, 8), material);
  head.position.y = unit * 7.1;
  group.add(head);
  for (const side of [-1, 1]) {
    const raised = armUp && side > 0;
    const arm = addBox(group, material, unit * 0.6, raised ? unit * 3.4 : unit * 2.8, unit * 0.6,
      side * unit * 1.3, raised ? unit * 4.9 : unit * 3.3, 0);
    if (raised) arm.rotation.z = -0.2;
  }
}

const WONDER_BUILDERS = {
  // Drei Pyramiden, die größte vorn, dazu ein Rest der Sphinx davor.
  pyramid(group) {
    const sizes = [[3.9, 3.6, 0, 0], [2.9, 2.7, -3.6, 1.7], [2.0, 1.8, 3.2, 2.2]];
    for (const [radius, height, x, z] of sizes) {
      const pyramid = new THREE.Mesh(
        new THREE.ConeGeometry(radius, height, 4), WONDER_MATERIALS.limestone
      );
      pyramid.position.set(x, height / 2, z);
      pyramid.rotation.y = Math.PI / 4;
      group.add(pyramid);
    }
    addBox(group, WONDER_MATERIALS.sandstone, 1.7, 0.55, 0.7, 0.5, 0, -3.1);
    addBox(group, WONDER_MATERIALS.sandstone, 0.55, 0.85, 0.55, 1.15, 0.55, -3.1);
  },

  // Der Pharos: quadratischer Unterbau, achteckiger Mittelteil, runder Turm,
  // und ganz oben das Feuer.
  lighthouse(group) {
    addBox(group, WONDER_MATERIALS.limestone, 2.6, 0.5, 2.6, 0, 0, 0);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.6, 1.9), WONDER_MATERIALS.limestone);
    lower.position.y = 2.3;
    group.add(lower);
    const middle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.95, 2.4, 8), WONDER_MATERIALS.limestone
    );
    middle.position.y = 5.3;
    group.add(middle);
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.6, 1.2, 10), WONDER_MATERIALS.marble
    );
    top.position.y = 7.1;
    group.add(top);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 7), WONDER_MATERIALS.fire);
    flame.position.y = 8.2;
    group.add(flame);
  },

  // Der Koloss, breitbeinig über dem Hafen, den Arm mit der Fackel erhoben.
  colossus(group) {
    addBox(group, WONDER_MATERIALS.marble, 3.0, 0.5, 3.0, 0, 0, 0);
    addBox(group, WONDER_MATERIALS.marble, 2.4, 0.5, 2.4, 0, 0.5, 0);
    const figure = new THREE.Group();
    figure.position.y = 1.0;
    // Breitbeinig über der Hafeneinfahrt, die Fackel im erhobenen Arm.
    addFigure(figure, WONDER_MATERIALS.bronze, 7.4, { armUp: true, stride: 0.85 });
    const torch = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 6), WONDER_MATERIALS.fire);
    torch.position.set(1.55, 7.3, 0);
    figure.add(torch);
    group.add(figure);
  },

  // Das Mausoleum: Stufensockel, Säulenkranz, Stufenpyramide, Viergespann.
  mausoleum(group) {
    addBox(group, WONDER_MATERIALS.marble, 3.6, 1.5, 3.0, 0, 0, 0);
    addBox(group, WONDER_MATERIALS.marble, 3.2, 0.3, 2.6, 0, 1.5, 0);
    const shaft = new THREE.CylinderGeometry(0.16, 0.18, 2.2, 8);
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const column = new THREE.Mesh(shaft, WONDER_MATERIALS.marble);
        column.position.set((i / 3 - 0.5) * 2.5, 2.9, side * 1.0);
        group.add(column);
      }
    }
    addBox(group, WONDER_MATERIALS.marble, 3.0, 0.28, 2.4, 0, 4.0, 0);
    for (let i = 0; i < 4; i++) {
      addBox(group, WONDER_MATERIALS.marble, 2.6 - i * 0.55, 0.3, 2.1 - i * 0.45,
        0, 4.28 + i * 0.3, 0);
    }
    addBox(group, WONDER_MATERIALS.gold, 1.0, 0.5, 0.6, 0, 5.48, 0);
  },

  // Die Hängenden Gärten: Terrassen über Terrassen, jede schmaler als die
  // darunter, jede bewachsen - und ein Schöpfwerk an der Seite, das das Wasser
  // aus dem Euphrat nach oben bringt.
  gardens(group) {
    const green = new THREE.MeshStandardMaterial({ color: '#4f8a3c', roughness: 0.95 });
    const levels = 4;
    for (let i = 0; i < levels; i++) {
      const width = 5.2 - i * 1.0;
      const depth = 4.0 - i * 0.78;
      const y = i * 1.15;
      addBox(group, WONDER_MATERIALS.sandstone, width, 0.95, depth, 0, y, 0);
      // Der Bewuchs steht auf der Terrasse und hängt über ihre Kante.
      addBox(group, green, width * 0.94, 0.42, depth * 0.94, 0, y + 0.95, 0);
      for (let b = 0; b < 3; b++) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), green);
        bush.scale.y = 0.75;
        bush.position.set((b - 1) * width * 0.3, y + 1.3, depth * 0.36);
        group.add(bush);
      }
      // Bögen entlang der Vorderkante
      for (let a = 0; a < 4; a++) {
        addBox(group, WONDER_MATERIALS.sandstone, 0.24, 0.95, 0.24,
          (a - 1.5) * width * 0.26, y, depth / 2 - 0.1);
      }
    }
    // Das Schöpfwerk: Rad und Rinne an der Flanke.
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.12, 6, 12), WONDER_MATERIALS.sandstone
    );
    wheel.position.set(-3.1, 1.0, 1.4);
    wheel.rotation.y = Math.PI / 2;
    group.add(wheel);
    addBox(group, WONDER_MATERIALS.sandstone, 0.2, 4.2, 0.2, -3.1, 0, 1.4);
  },

  // Ein Tempel - das Maß gibt der Aufrufer über die Skalierung vor.
  temple(group) {
    group.add(makeColonnade(4.4, 2.3, { columns: 7 }));
  },

  // Der Zeustempel von Olympia, und darin die Statue, die aus ihm herausragt.
  statue(group) {
    // Der Tempel steht hinten, die Statue davor: im Inneren wäre von zwölf
    // Metern Gold und Elfenbein nichts zu sehen als ein Dach.
    const temple = makeColonnade(4.6, 2.4, { columns: 6 });
    temple.position.z = -1.6;
    group.add(temple);
    const figure = new THREE.Group();
    figure.position.set(0, 0.4, 1.5);
    addBox(group, WONDER_MATERIALS.marble, 2.2, 0.4, 1.8, 0, 0, 1.5);
    addFigure(figure, WONDER_MATERIALS.gold, 4.6);
    group.add(figure);
  },

  // Zwei Felsen zu beiden Seiten der Meerenge.
  pillars(group) {
    for (const [x, z, height, radius] of [[-1.5, 0.8, 3.6, 1.0], [1.7, -1.0, 2.8, 0.85]]) {
      const rock = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.55, radius, height, 6, 1), WONDER_MATERIALS.rock
      );
      rock.position.set(x, height / 2, z);
      rock.rotation.y = x;
      group.add(rock);
    }
  },

  // Der Steinkreis: aufrechte Blöcke, über je zweien ein Deckstein.
  stones(group) {
    const count = 9;
    const radius = 2.1;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      addBox(group, WONDER_MATERIALS.rock, 0.75, 2.4, 0.45, x, 0, z, -angle);
      if (i % 2 === 0) {
        const next = ((i + 1) / count) * Math.PI * 2;
        addBox(group, WONDER_MATERIALS.rock, 1.5, 0.35, 0.45,
          (x + Math.cos(next) * radius) / 2, 2.4, (z + Math.sin(next) * radius) / 2,
          -(angle + next) / 2);
      }
    }
    for (const [x, z] of [[0, -0.7], [0, 0.7]]) {
      addBox(group, WONDER_MATERIALS.rock, 0.9, 3.1, 0.5, x, 0, z);
    }
  },
};

let wondersGroup = null;

function buildWonders(state) {
  wondersGroup = new THREE.Group();
  scene.add(wondersGroup);
  if (!state.wonders) return;

  const cityTiles = new Set(state.cities.map((c) => `${c.col},${c.row}`));
  for (const wonder of state.wonders) {
    const build = WONDER_BUILDERS[wonder.model];
    if (!build) continue;
    const group = new THREE.Group();
    build(group);

    // Ein Bauwerk, das sich sein Feld mit einer Stadt teilt, weicht nach
    // Nordwesten aus und steht auf einem Felsen darüber - beim Kapitol und
    // bei der Akropolis ist genau das der historische Ort, und in der
    // Draufsicht verschwindet es sonst zwischen den Dächern.
    // Quer zur Blickrichtung an den Rand des Felds: nach hinten gerückt
    // verschwände das Bauwerk hinter den Dächern, nach vorn verdeckte sein
    // Felsen die Stadt. So stehen beide nebeneinander.
    const shared = cityTiles.has(`${wonder.col},${wonder.row}`);
    const dx = shared ? 0.38 : 0;
    const dz = shared ? -0.38 : 0;
    const scale = wonder.wonder ? 0.72 : 0.58;
    // Hoch genug, um über die Dächer zu ragen: Kapitol und Akropolis sind
    // Burgberge, und nur so ist das Bauwerk in der Stadt überhaupt zu sehen.
    const lift = shared ? 3.4 : 0;
    if (shared) {
      const rock = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 3.4, (lift + 3) / scale, 7, 1), WONDER_MATERIALS.rock
      );
      rock.position.y = -(lift + 3) / (2 * scale);
      group.add(rock);
    }
    group.position.set(
      worldX(wonder.col) + dx * TILE_SIZE,
      groundY(wonder.col + dx, wonder.row + dz) - 0.15 + lift,
      worldZ(wonder.row) + dz * TILE_SIZE
    );
    group.scale.setScalar(scale);

    // Über den Stadtnamen, sonst überschreiben sich beide.
    const label = makeLabelSprite(wonder.name, { scale: 0.78, color: '#ffe4a6' });
    label.position.y = shared ? 13.5 : 12;
    group.add(label);
    wondersGroup.add(group);
  }
}

// Ein Hafen: Steg, Poller und ein vertäutes Boot. Er steht nicht in der
// Stadt, sondern am Wasser daneben - der Steg zeigt vom Ufer aufs Meer hinaus.
// Damit ist die Regel zu sehen: nur wo dieser Steg steht, geht eine Armee an
// Bord.
function buildHarbour(scale) {
  const harbour = new THREE.Group();
  const length = 3.4 * scale;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.2 * scale, 1.1 * scale),
    CITY_MATERIALS.wood
  );
  deck.position.set(length / 2, 0.35 * scale, 0);
  harbour.add(deck);

  for (let i = 0; i < 4; i++) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * scale, 0.14 * scale, 1.1 * scale, 6),
      CITY_MATERIALS.timber
    );
    post.position.set((0.35 + i * 0.95) * scale, 0.05 * scale, (i % 2 ? 0.5 : -0.5) * scale);
    harbour.add(post);
  }

  // Das Boot liegt am Kopf des Stegs, längs vertäut.
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(0.6 * scale, 0.4 * scale, 1.7 * scale),
    CITY_MATERIALS.timber
  );
  hull.position.set(length + 0.45 * scale, 0.25 * scale, 0);
  harbour.add(hull);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 1.6 * scale, 5),
    CITY_MATERIALS.wood
  );
  mast.position.set(length + 0.45 * scale, 1.2 * scale, 0);
  harbour.add(mast);
  return harbour;
}

// Setzt den Steg ans Ufer zwischen Stadt und offenem Wasser, mit dem Kopf zum
// Meer. Alles in lokalen Koordinaten der Stadtgruppe.
function placeHarbour(harbour, city, sea, cityY) {
  const dx = sea.col - city.col;
  const dz = sea.row - city.row;
  const distance = Math.max(1, Math.abs(dx) + Math.abs(dz));
  // Am Ufer beginnen: ein halbes Feld vor dem Wasserfeld.
  const startX = (dx / distance) * TILE_SIZE * (distance - 0.5);
  const startZ = (dz / distance) * TILE_SIZE * (distance - 0.5);
  harbour.position.set(startX, SEA_LEVEL_Y - cityY, startZ);
  harbour.rotation.y = Math.atan2(-dz, dx);
}

// Wie groß ein Heer auf der Karte erscheint. Ein Trupp von 80 Mann und ein
// Heer von 900 sollen sich schon von weitem unterscheiden - deshalb wächst
// beides: die Zahl der Zelte und die Größe des ganzen Lagers.
function tierForCount(count) {
  if (count >= 900) return 8;
  if (count >= 700) return 7;
  if (count >= 520) return 6;
  if (count >= 380) return 5;
  if (count >= 260) return 4;
  if (count >= 160) return 3;
  if (count >= 80) return 2;
  return 1;
}

// 0,68 für eine Handvoll Männer bis 1,45 für ein volles Heer.
function armyScale(count) {
  return 0.68 + Math.min(1, count / 850) * 0.77;
}

// A single ship: hull, mast and sail. The whole fleet is drawn as one vessel
// with the army's banner on it, the same way a camp stands in for an army.
// Drei Bauarten, wie sie das Spiel unterscheidet: die schwere Quinquereme mit
// Turm und Enterbrücke, der leichte Ruderer der Ägäis und der Adria, und das
// hochbordige Segelschiff des Nordens. Was eine Fraktion fährt, sagt data.js.
const SHIP_TIMBER = new THREE.MeshStandardMaterial({
  color: '#6b4423', roughness: 0.85, side: THREE.DoubleSide,
});
const SHIP_DECK = new THREE.MeshStandardMaterial({ color: '#8a5c2e', roughness: 0.9 });
const SHIP_MAST = new THREE.MeshStandardMaterial({ color: '#4a3520' });

function buildShip(color, kind = 'lembos') {
  const ship = new THREE.Group();
  const heavy = kind === 'quinquereme';
  const sailer = kind === 'keltenschiff';
  const length = heavy ? 4.2 : sailer ? 3.3 : 3.6;
  const beam = heavy ? 0.78 : sailer ? 0.86 : 0.58;

  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(beam, beam * 0.55, length, 8, 1, false, 0, Math.PI),
    SHIP_TIMBER
  );
  hull.rotation.z = Math.PI / 2;
  hull.rotation.y = Math.PI / 2;
  hull.position.y = beam * 0.68;
  ship.add(hull);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(beam * 1.85, 0.16, length * 0.94),
    SHIP_DECK
  );
  deck.position.y = beam + 0.06;
  ship.add(deck);

  if (sailer) {
    // Der Kelten-Segler: hohe Bordwände, keine Ruder, ein breites Ledersegel.
    for (const side of [-1, 1]) {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.62, length * 0.9),
        SHIP_TIMBER
      );
      board.position.set(side * beam * 0.9, beam + 0.36, 0);
      ship.add(board);
    }
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.3), SHIP_TIMBER);
    stem.position.set(0, beam + 0.6, -length * 0.46);
    ship.add(stem);
  } else {
    // Ruderer: eine Reihe Riemen je Seite, bei der Quinquereme zwei.
    const banks = heavy ? 2 : 1;
    for (let bank = 0; bank < banks; bank++) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
          const oar = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.05, 0.95),
            SHIP_MAST
          );
          oar.position.set(
            side * (beam + 0.28), beam - 0.06 - bank * 0.2,
            -length * 0.34 + (i / 6) * length * 0.68
          );
          oar.rotation.y = side * 1.15;
          ship.add(oar);
        }
      }
    }
    // Der Rammsporn am Bug.
    const ram = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: '#7c6a4a', roughness: 0.6, metalness: 0.3 })
    );
    ram.rotation.x = -Math.PI / 2;
    ram.position.set(0, beam * 0.5, -length * 0.6);
    ship.add(ram);
  }

  if (heavy) {
    // Turm und Enterbrücke - was die römische Flotte aus einer Seeschlacht
    // eine Landschlacht machen ließ.
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), SHIP_DECK);
    tower.position.set(0, beam + 0.55, length * 0.22);
    ship.add(tower);
    const corvus = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 1.7), SHIP_TIMBER);
    corvus.position.set(0, beam + 0.28, -length * 0.42);
    corvus.rotation.x = 0.22;
    ship.add(corvus);
  }

  const mastHeight = sailer ? 2.9 : 2.4;
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, mastHeight, 6),
    SHIP_MAST
  );
  mast.position.y = mastHeight / 2 + beam;
  ship.add(mast);

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(sailer ? 2.3 : 1.7, sailer ? 1.9 : 1.4),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide })
  );
  sail.position.set(0, beam + mastHeight * 0.66, 0);
  sail.rotation.y = Math.PI / 2;
  ship.add(sail);
  ship.userData.sail = sail;

  // A wake, so a fleet at sea does not look like it is standing on glass.
  const wake = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.4, 24),
    new THREE.MeshBasicMaterial({
      color: '#dff0ff', transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.y = 0.06;
  ship.add(wake);

  ship.userData.kind = kind;
  return ship;
}

function buildArmyGroup() {
  const group = new THREE.Group();
  const tents = new THREE.Group();
  group.add(tents);
  group.userData.tents = tents;

  // Welche Bauart gefahren wird, steht erst fest, wenn die Armee bekannt ist -
  // das Modell entsteht deshalb beim ersten Auslaufen.
  group.userData.ship = null;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3.2, 5),
    new THREE.MeshStandardMaterial({ color: '#3a2c1d' })
  );
  pole.position.y = 1.6;
  group.add(pole);
  group.userData.pole = pole;

  const flag = new THREE.Group();
  flag.position.set(0, 2.6, 0);
  group.add(flag);
  billboards.push(flag);
  group.userData.flag = flag;
  const banner = makeBannerCloth(
    1.3, 1.6,
    new THREE.MeshStandardMaterial({ color: '#999', side: THREE.DoubleSide })
  );
  flag.add(banner);
  group.userData.banner = banner;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.12, 8, 24),
    new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.userData.ring = ring;

  return group;
}

function syncArmyGroup(state, army, entry) {
  const { group } = entry;
  const faction = factionById(state, army.factionId);
  if (!armyAnimations.has(army.id)) {
    group.position.set(worldX(army.col), surfaceY(army.col, army.row), worldZ(army.row));
  }

  // At sea the army is its fleet: the camp strikes its tents and boards.
  const afloat = !!army.embarked;
  const kind = shipTypeOf(army.factionId).key;
  let ship = group.userData.ship;
  if (afloat && (!ship || ship.userData.kind !== kind)) {
    if (ship) group.remove(ship);
    ship = buildShip(faction.color, kind);
    group.add(ship);
    group.userData.ship = ship;
  }
  if (ship) {
    ship.visible = afloat;
    ship.userData.sail.material.color.set(faction.color);
  }
  group.userData.tents.visible = !afloat;
  if (group.userData.pole) group.userData.pole.visible = !afloat;
  group.userData.flag.visible = !afloat;

  const strength = unitTotalCount(army.units);
  const tierCount = tierForCount(strength);
  const scale = armyScale(strength);
  const tents = group.userData.tents;
  while (tents.children.length < tierCount) {
    const idx = tents.children.length;
    // Das erste Zelt ist das Führungszelt in der Mitte, die übrigen stehen im
    // Ring darum - und je mehr es werden, desto weiter wird der Ring.
    const big = idx === 0;
    const tent = new THREE.Mesh(
      new THREE.ConeGeometry(big ? 0.72 : 0.5, big ? 1.5 : 1, 6),
      new THREE.MeshStandardMaterial({ color: faction.color })
    );
    const angle = ((idx - 1) / 7) * Math.PI * 2 + 0.4;
    const radius = idx > 4 ? 1.85 : 1.15;
    tent.position.set(
      big ? 0 : Math.cos(angle) * radius,
      big ? 0.75 : 0.5,
      big ? 0 : Math.sin(angle) * radius
    );
    tents.add(tent);
  }
  while (tents.children.length > tierCount) {
    tents.remove(tents.children[tents.children.length - 1]);
  }
  tents.children.forEach((tent) => { tent.material.color.set(faction.color); });
  group.userData.banner.material.color.set(faction.color);

  // Das ganze Lager - Zelte, Stange, Banner, Schiff - wächst mit der Stärke.
  tents.scale.setScalar(scale);
  if (ship) ship.scale.setScalar(0.8 + (scale - 0.68) * 0.55);
  if (group.userData.pole) {
    group.userData.pole.scale.set(1, scale, 1);
    group.userData.pole.position.y = 1.6 * scale;
  }
  group.userData.flag.scale.setScalar(scale);
  group.userData.flag.position.set(0, 2.6 * scale, 0);
  group.userData.ring.scale.setScalar(Math.max(1, scale));

  if (group.userData.label) group.remove(group.userData.label);
  // Strength, and the stars it has earned - both belong on the counter itself.
  const stars = experienceStars(army.experience);
  const caption = stars
    ? `${unitTotalCount(army.units)} ${'★'.repeat(stars)}`
    : String(unitTotalCount(army.units));
  const label = makeLabelSprite(caption, {
    fontSize: 40, scale: 0.85, color: stars ? '#ffe9a8' : '#ffffff',
  });
  label.position.y = (afloat ? 4.0 : 3.4) * scale + 0.5;
  group.add(label);
  group.userData.label = label;

  group.userData.ring.material.opacity = army.id === state.selectedArmyId ? 0.9 : 0;
}

function clearHighlights() {
  for (const mesh of highlightMeshes) scene.remove(mesh);
  highlightMeshes.length = 0;
}

function addHighlight(col, row, color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(worldX(col), surfaceY(col, row) + 0.15, worldZ(row));
  scene.add(mesh);
  highlightMeshes.push(mesh);
}

// Called after every game-state change: syncs city ownership visuals, army
// groups (creating/removing as armies are raised or destroyed), and the
// green/red movement-range overlay for the currently selected army.
export function syncEntities(state) {
  for (const city of state.cities) {
    let entry = cityGroups.get(city.id);
    if (!entry) {
      entry = buildCityGroup(city);
      entry.group.position.set(worldX(city.col), surfaceY(city.col, city.row), worldZ(city.row));
      scene.add(entry.group);
      cityGroups.set(city.id, entry);
    }
    const faction = factionById(state, city.factionId);
    // Roofs, pediments and banners all carry the owner's colour; the walls and
    // the stonework stay stone.
    for (const part of entry.tinted) part.material.color.set(faction.color);

    // Der Steg entsteht erst mit dem Hafen - die meisten Orte haben keinen.
    if (city.harbour && !entry.harbour) {
      const sea = harbourTile(state, city);
      if (sea) {
        entry.harbour = buildHarbour(entry.scale);
        placeHarbour(entry.harbour, city, sea, surfaceY(city.col, city.row));
        entry.group.add(entry.harbour);
      }
    }
    if (entry.harbour) entry.harbour.visible = !!city.harbour;

    // Only the stage that actually stands is built, and only when it is built.
    const level = city.wallLevel || 0;
    for (let index = 0; index < entry.walls.length; index++) {
      if (index + 1 === level && !entry.walls[index]) {
        entry.walls[index] = buildFortification(WALL_LEVELS[index].key, entry.scale);
        entry.group.add(entry.walls[index]);
      }
      if (entry.walls[index]) entry.walls[index].visible = index + 1 === level;
    }
  }

  const seenArmies = new Set();
  for (const army of state.armies) {
    seenArmies.add(army.id);
    let entry = armyGroups.get(army.id);
    if (!entry) {
      const group = buildArmyGroup();
      scene.add(group);
      entry = { group };
      armyGroups.set(army.id, entry);
    }
    syncArmyGroup(state, army, entry);
  }
  for (const [id, entry] of armyGroups) {
    // A destroyed army keeps its group until it has finished marching to the
    // battle; the animation's completion callback triggers the next sync.
    if (!seenArmies.has(id) && !armyAnimations.has(id)) {
      // Die Fahne der Armee war bei den mitgedrehten Tüchern angemeldet; sonst
      // wüchse die Liste mit jeder vernichteten Armee weiter.
      const flagIndex = billboards.indexOf(entry.group.userData.flag);
      if (flagIndex !== -1) billboards.splice(flagIndex, 1);
      scene.remove(entry.group);
      armyGroups.delete(id);
    }
  }

  // Roads change rarely; the whole network is rebuilt only when one is
  // finished rather than on every state change.
  if (roadsGroup && (state.roadVersion || 0) !== roadVersionDrawn) {
    buildRoadNetwork(state);
    // Eine neue Straße kann eine neue Brücke bedeuten - die Flüsse werden
    // deshalb im selben Zug neu gezeichnet.
    buildRivers(state);
    roadVersionDrawn = state.roadVersion || 0;
  }

  if (mapMode === 'tactical') refreshTacticalColors(state);
  // Die Grenzen hängen an denselben Besitzverhältnissen wie die taktische
  // Sicht - fällt eine Stadt, verschiebt sich beides.
  if (bordersVisible) buildBorders(state);

  clearHighlights();
  if (state.reachable) {
    for (const [key, info] of state.reachable) {
      const [col, row] = key.split(',').map(Number);
      // A shore a fleet can land on is its own kind of move, and ground an
      // enemy army holds costs extra to enter - both deserve their own colour
      // so the player can read the cost before paying it.
      const color = info.combat ? '#ff4d3d'
        : info.merge ? '#7ecbff'
          : info.landing ? '#ffd166'
            : info.contested ? '#ff8c42' : '#4dffa0';
      addHighlight(col, row, color);
    }
  }
}

// --- Taktische Sicht -----------------------------------------------------
// Who holds which ground: every passable tile takes the colour of the faction
// whose settlement is nearest by land. That is a sphere of influence rather
// than a border treaty, but it is the picture a commander plans from.
// Was überhaupt jemandem gehören kann: bestelltes Land. Meer nicht, und das
// Gebirge auch nicht - weder der Fels noch der Pass darunter.
function claimable(tile) {
  return tile.type !== 'water' && tile.type !== 'mountain';
}

function computeTerritory(state) {
  const { cols, rows, tiles } = state.map;
  const owner = new Int32Array(cols * rows).fill(-1);
  const queue = [];
  const factionIndex = new Map(state.factions.map((f, i) => [f.id, i]));

  for (const city of state.cities) {
    const index = city.row * cols + city.col;
    owner[index] = factionIndex.get(city.factionId) ?? -1;
    queue.push(index);
  }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const col = index % cols;
    const row = (index - col) / cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const next = r * cols + c;
      if (owner[next] !== -1) continue;
      // Das Gebirge gehört niemandem: ein Pass ist ein Weg hindurch, kein
      // Land, das eine Stadt verwaltet. Sonst liefe die Grenze quer über den
      // Kamm, statt an seinem Fuß zu enden.
      if (!claimable(tiles[r][c])) continue;
      owner[next] = owner[index];
      queue.push(next);
    }
  }
  return owner;
}

// --- Grenzen ---------------------------------------------------------------
// Dieselbe Einflussrechnung wie in der taktischen Sicht, aber als Linie auf
// der Geländekarte: überall dort, wo zwei Herrschaftsbereiche aneinander
// stoßen, liegt ein schmales Band in der Farbe dessen, dem das Feld gehört.
// Zwei halbe Bänder Rücken an Rücken - so hat jede Seite ihre eigene Farbe,
// und man sieht auf einen Blick, wessen Grenze man vor sich hat.
let bordersGroup = null;
let bordersVisible = false;
const BORDER_WIDTH = 0.13;
const BORDER_LIFT = 0.24;
const BORDER_PIECES = 4;

export function buildBorders(state) {
  if (bordersGroup) scene.remove(bordersGroup);
  bordersGroup = new THREE.Group();
  bordersGroup.visible = bordersVisible;
  scene.add(bordersGroup);
  if (!state) return;

  const { cols, rows, tiles } = state.map;
  const owner = computeTerritory(state);
  // Je Fraktion ein eigener Satz Flächen, damit jede ihre Farbe behält.
  const byFaction = new Map();
  const half = TILE_SIZE / 2;
  const width = TILE_SIZE * BORDER_WIDTH;

  const grenzstueck = (index, col, row, dc, dr) => {
    const eigen = owner[index];
    if (eigen < 0) return;
    const c = col + dc;
    const r = row + dr;
    const drueben = c < 0 || c >= cols || r < 0 || r >= rows
      ? -1 : owner[r * cols + c];
    if (drueben === eigen) return;
    // Gegen das offene Meer und gegen den Fels zieht niemand eine Grenze.
    if (c >= 0 && c < cols && r >= 0 && r < rows) {
      // Gegen das offene Meer und gegen das Gebirge zieht niemand eine Grenze:
      // dort endet das Land, und eine Linie im Fels sagt nichts.
      if (!claimable(tiles[r][c])) return;
    } else {
      return;
    }
    const positions = byFaction.get(eigen) || byFaction.set(eigen, []).get(eigen);
    // Das Band liegt auf der eigenen Seite der Kante, nicht mittendrauf.
    const mx = worldX(col) + dc * (half - width);
    const mz = worldZ(row) + dr * (half - width);
    const alongX = dr !== 0;
    const from = alongX ? [mx - half, mz] : [mx, mz - half];
    const to = alongX ? [mx + half, mz] : [mx, mz + half];
    for (let piece = 0; piece < BORDER_PIECES; piece++) {
      const t0 = piece / BORDER_PIECES;
      const t1 = (piece + 1) / BORDER_PIECES;
      pushQuad(positions,
        from[0] + (to[0] - from[0]) * t0, from[1] + (to[1] - from[1]) * t0,
        from[0] + (to[0] - from[0]) * t1, from[1] + (to[1] - from[1]) * t1,
        width / 2, BORDER_LIFT);
    }
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (owner[index] < 0) continue;
      if (!claimable(tiles[row][col])) continue;
      grenzstueck(index, col, row, 1, 0);
      grenzstueck(index, col, row, -1, 0);
      grenzstueck(index, col, row, 0, 1);
      grenzstueck(index, col, row, 0, -1);
    }
  }

  for (const [factionIndex, positions] of byFaction) {
    if (!positions.length) continue;
    const faction = state.factions[factionIndex];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: (faction && faction.color) || '#cccccc',
      roughness: 0.55, emissive: (faction && faction.color) || '#cccccc',
      emissiveIntensity: 0.35, side: THREE.DoubleSide,
    }));
    mesh.frustumCulled = false;
    bordersGroup.add(mesh);
  }
}

export function setBordersVisible(flag, state) {
  bordersVisible = !!flag;
  // Erst beim Einschalten gebaut: wer sie nie ansieht, zahlt auch nichts.
  if (bordersVisible && state && (!bordersGroup || !bordersGroup.children.length)) {
    buildBorders(state);
  }
  if (bordersGroup) bordersGroup.visible = bordersVisible;
  return bordersVisible;
}

export function areBordersVisible() {
  return bordersVisible;
}

const UNCLAIMED_COLOUR = new THREE.Color('#514d45');
const SEA_COLOUR = new THREE.Color('#243f5e');
const ROCK_COLOUR = new THREE.Color('#3e3c40');

function refreshTacticalColors(state) {
  if (!terrainMesh || !tacticalColors) return;
  const { cols, rows, tiles } = state.map;
  const owner = computeTerritory(state);
  const palette = state.factions.map((f) => new THREE.Color(f.color));
  const colour = new THREE.Color();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const tile = tiles[row][col];
      if (tile.type === 'water') {
        colour.copy(SEA_COLOUR);
      } else if (!claimable(tile)) {
        colour.copy(ROCK_COLOUR);
      } else {
        colour.copy(owner[index] >= 0 ? palette[owner[index]] : UNCLAIMED_COLOUR);
        // A darker seam wherever two spheres of influence meet, so the
        // frontier is a line the eye follows rather than a colour change.
        const border = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => {
          const c = col + dc;
          const r = row + dr;
          if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
          if (!claimable(tiles[r][c])) return false;
          return owner[r * cols + c] !== owner[index];
        });
        // Keep just enough relief shading that the mountains and coasts still
        // read through the political colour.
        colour.multiplyScalar((border ? 0.5 : 1) * (0.86 + Math.min(0.4, tile.elevation * 0.12)));
      }
      tacticalColors[index * 3] = colour.r;
      tacticalColors[index * 3 + 1] = colour.g;
      tacticalColors[index * 3 + 2] = colour.b;
    }
  }
  if (mapMode === 'tactical') applyTerrainColors(tacticalColors);
}

function applyTerrainColors(source) {
  const attribute = terrainMesh.geometry.getAttribute('color');
  attribute.array.set(source);
  attribute.needsUpdate = true;
}

export function getMapMode() {
  return mapMode;
}

// Switches the whole map between the ground and the political picture: the
// props that make terrain readable only clutter the tactical view, and flat
// light keeps the faction colours honest. Die Straßen bleiben, weil sie zum
// politischen Bild gehören - sie sagen, wie schnell wo ein Heer steht.
export function setMapMode(mode, state) {
  mapMode = mode === 'tactical' ? 'tactical' : 'terrain';
  const tactical = mapMode === 'tactical';
  if (propsGroup) propsGroup.visible = !tactical;
  // Straßen bleiben auch in der taktischen Sicht stehen: wer Grenzen liest,
  // will wissen, wo die Heere schnell hinkommen.
  if (roadsGroup) roadsGroup.visible = true;
  if (riversGroup) riversGroup.visible = !tactical;
  // Daylight adds up to about 1.7 and washes a flat colour out to near white.
  // The tactical view trades most of the sun for even light, keeping just
  // enough of it that the relief still shows.
  if (ambientLight) {
    ambientLight.intensity = tactical ? 0.78 : (weatherLook && weatherLook.ambient) || 0.65;
  }
  if (sunLight) {
    sunLight.intensity = tactical ? 0.32 : (weatherLook && weatherLook.sun) || 1.05;
  }
  if (terrainMesh) {
    terrainMesh.material.map = tactical ? null : noiseTexture;
    terrainMesh.material.needsUpdate = true;
    if (tactical && state) refreshTacticalColors(state);
    else if (terrainColors) applyTerrainColors(terrainColors);
  }
  // In the tactical view the sea is context, not subject: it steps back so
  // the faction colours are what the eye lands on.
  if (waterMesh) {
    waterMesh.material.opacity = tactical ? 0.95 : 0.82;
    waterMesh.material.color.set(tactical ? '#33506e' : TILE_TYPES.water.color);
  }
  if (deepSeaMesh) deepSeaMesh.material.color.set(tactical ? '#2b435c' : '#1d3f66');
  return mapMode;
}

// --- Wetter --------------------------------------------------------------
// Über der ganzen Karte gleichzeitig Regen und Schnee zu zeichnen wäre weder
// machbar noch lesbar. Gezeigt wird deshalb das Wetter dort, wo die Kamera
// hinsieht - fährt man im Winter nach Norden, fängt es an zu schneien.

const WEATHER_LOOKS = {
  rain: {
    count: 2400, colour: '#bcd8f0', size: 0.5, fall: 78, drift: 10, streak: 3.4,
    sky: '#7d8b98', fog: 0.62, ambient: 0.5, sun: 0.55,
  },
  storm: {
    count: 3200, colour: '#d2e4f2', size: 0.55, fall: 96, drift: 30, streak: 4.6,
    sky: '#5c6873', fog: 0.5, ambient: 0.42, sun: 0.38, lightning: true,
  },
  snow: {
    count: 1900, colour: '#ffffff', size: 1.15, fall: 13, drift: 7, streak: 0,
    sky: '#c3ccd4', fog: 0.7, ambient: 0.82, sun: 0.6,
  },
  sand: {
    count: 3400, colour: '#f4dfae', size: 1.45, fall: 5, drift: 74, streak: 0,
    sky: '#c9a86a', fog: 0.34, ambient: 0.7, sun: 0.5,
  },
  fog: {
    count: 0, sky: '#c8ccc9', fog: 0.3, ambient: 0.85, sun: 0.35,
  },
  clouds: {
    count: 0, sky: '#a9bccb', fog: 1.35, ambient: 0.6, sun: 0.72,
  },
  heat: {
    count: 900, colour: '#fff0cc', size: 1.5, fall: -6, drift: 11, streak: 0,
    sky: '#d9c48d', fog: 0.85, ambient: 0.78, sun: 1.2,
  },
};

const WEATHER_VOLUME = 240;
// Flach über der Tischplatte: das Wetter gehört zur Karte, und ein Vorhang von
// hundert Metern Höhe stünde bei tiefer Kamera quer vor den Zeltbahnen.
const WEATHER_HEIGHT = 34;
let weatherPoints = null;
let weatherLook = null;
let weatherEffect = null;
let weatherVelocity = null;
let weatherVisible = true;
let weatherLookup = null;
let lightningTimer = 0;
let onWeatherChange = null;

export function setWeatherVisualsEnabled(enabled) {
  weatherVisible = !!enabled;
  if (!weatherVisible) applyWeatherEffect(null);
  else if (weatherLookup) updateWeatherForCamera();
}

export function setWeatherReporter(callback) {
  onWeatherChange = callback;
}

function disposeWeatherPoints() {
  if (!weatherPoints) return;
  scene.remove(weatherPoints);
  weatherPoints.geometry.dispose();
  weatherPoints.material.dispose();
  weatherPoints = null;
  weatherVelocity = null;
}

// Die Kanten der Tischplatte als Schnittebenen. Sie werden bei jedem Aufbau
// neu gerechnet, weil sie von der Größe der Karte abhängen, und sie wirken im
// Weltkoordinatensystem - das Verschieben und Skalieren der Wetterwolke mit
// der Kamera stört sie also nicht.
function boardClipPlanes() {
  const halfW = (mapCols * TILE_SIZE) / 2;
  const halfD = (mapRows * TILE_SIZE) / 2;
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), halfW),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfW),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), halfD),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), halfD),
    // und ein Deckel darüber, damit auch nach oben nichts hinausragt
    new THREE.Plane(new THREE.Vector3(0, -1, 0), WEATHER_HEIGHT + 4),
  ];
}

// Rain falls as streaks and snow as flakes, which needs two different objects:
// a point cannot be stretched, and a line segment cannot be round. Everything
// else about them - the volume, the wrapping, the per-mote speed - is shared.
function buildWeatherPoints(look) {
  disposeWeatherPoints();
  if (!look.count) return;
  const streaked = look.streak > 0;
  const perMote = streaked ? 2 : 1;
  const positions = new Float32Array(look.count * perMote * 3);
  weatherVelocity = new Float32Array(look.count);
  const rng = seededRandomFactory(613);

  for (let i = 0; i < look.count; i++) {
    const x = (rng() - 0.5) * WEATHER_VOLUME;
    const y = rng() * WEATHER_HEIGHT;
    const z = (rng() - 0.5) * WEATHER_VOLUME;
    const base = i * perMote * 3;
    positions[base] = x;
    positions[base + 1] = y;
    positions[base + 2] = z;
    if (streaked) {
      positions[base + 3] = x + look.drift * 0.02;
      positions[base + 4] = y - look.streak;
      positions[base + 5] = z;
    }
    // Each mote falls at its own pace, which is what stops the curtain from
    // reading as one sheet coming down.
    weatherVelocity[i] = 0.65 + rng() * 0.7;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const shared = {
    color: look.colour, transparent: true, opacity: 0.7, depthWrite: false,
    // Das Wetter gehört zur Karte, nicht zum Zelt: vier Ebenen an den Kanten
    // des Tisches schneiden alles weg, was daneben fiele.
    clippingPlanes: boardClipPlanes(),
  };
  weatherPoints = streaked
    ? new THREE.LineSegments(geometry, new THREE.LineBasicMaterial(shared))
    : new THREE.Points(geometry, new THREE.PointsMaterial({
      ...shared, size: look.size, sizeAttenuation: true,
    }));
  weatherPoints.frustumCulled = false;
  scene.add(weatherPoints);
}

function applyWeatherEffect(effect) {
  if (weatherEffect === effect) return;
  weatherEffect = effect;
  const look = (effect && WEATHER_LOOKS[effect]) || null;
  weatherLook = look;
  buildWeatherPoints(look || { count: 0 });

  // Clear weather is the scene's own daylight; anything else tints the sky,
  // draws the fog in and takes the edge off the sun.
  const skyColour = look && look.sky ? look.sky : SKY_COLOR;
  scene.background = new THREE.Color(skyColour);
  const fogScale = look && look.fog ? look.fog : 1;
  scene.fog = new THREE.Fog(skyColour, BASE_DISTANCE * 2.6 * fogScale, BASE_DISTANCE * 8 * fogScale);
  if (ambientLight) {
    ambientLight.intensity = mapMode === 'tactical' ? 0.78 : (look && look.ambient ? look.ambient : 0.65);
  }
  if (sunLight) {
    sunLight.intensity = mapMode === 'tactical' ? 0.32 : (look && look.sun ? look.sun : 1.05);
  }
  if (weatherPoints || look) startAnimationLoop();
}

function updateWeatherForCamera() {
  if (!weatherLookup) return;
  const col = Math.max(0, Math.min(mapCols - 1, Math.round(cam.col)));
  const row = Math.max(0, Math.min(mapRows - 1, Math.round(cam.row)));
  const weather = weatherLookup(col, row);
  if (onWeatherChange) onWeatherChange(weather, col, row);
  applyWeatherEffect(weatherVisible ? weather.effect : null);
}

// The scene asks the game what the weather is rather than being told, so
// panning the camera is enough to change what falls out of the sky.
export function setWeatherSource(lookup) {
  weatherLookup = lookup;
  // Ohne Quelle - etwa nach dem Beenden eines Feldzugs - fällt nichts mehr vom
  // Himmel, statt dass die Szene ins Leere greift.
  if (!lookup) applyWeatherEffect(null);
  updateWeatherForCamera();
}

function advanceWeatherPoints(dt) {
  if (!weatherPoints || !weatherLook) return false;
  const positions = weatherPoints.geometry.attributes.position;
  const array = positions.array;
  const streaked = weatherLook.streak > 0;
  const perMote = streaked ? 2 : 1;
  const half = WEATHER_VOLUME / 2;
  const rising = weatherLook.fall < 0;

  for (let i = 0; i < weatherVelocity.length; i++) {
    const speed = weatherVelocity[i];
    const dx = weatherLook.drift * speed * dt;
    const dy = -weatherLook.fall * speed * dt;
    const dz = weatherLook.drift * 0.35 * speed * dt;
    const base = i * perMote * 3;

    for (let v = 0; v < perMote; v++) {
      array[base + v * 3] += dx;
      array[base + v * 3 + 1] += dy;
      array[base + v * 3 + 2] += dz;
    }

    const y = array[base + 1];
    if (rising ? y > WEATHER_HEIGHT : y < 0) {
      // Back to the other end of the volume, at a fresh spot, so the curtain
      // never thins out where the wind has been carrying it.
      const nx = (Math.random() - 0.5) * WEATHER_VOLUME;
      const nz = (Math.random() - 0.5) * WEATHER_VOLUME;
      const ny = rising ? 0 : WEATHER_HEIGHT;
      for (let v = 0; v < perMote; v++) {
        array[base + v * 3] = nx + (v ? weatherLook.drift * 0.02 : 0);
        array[base + v * 3 + 1] = ny - (v ? weatherLook.streak : 0);
        array[base + v * 3 + 2] = nz;
      }
      continue;
    }

    const x = array[base];
    const z = array[base + 2];
    const wrapX = x > half ? -WEATHER_VOLUME : x < -half ? WEATHER_VOLUME : 0;
    const wrapZ = z > half ? -WEATHER_VOLUME : z < -half ? WEATHER_VOLUME : 0;
    if (wrapX || wrapZ) {
      for (let v = 0; v < perMote; v++) {
        array[base + v * 3] += wrapX;
        array[base + v * 3 + 2] += wrapZ;
      }
    }
  }
  positions.needsUpdate = true;

  // The curtain travels with the view and widens as the camera pulls back, so
  // it covers what is on screen at any zoom without simulating the whole map.
  const spread = Math.max(1, Math.min(2.8, (BASE_DISTANCE / cam.zoom) / 180));
  weatherPoints.position.set(worldX(cam.col), 0, worldZ(cam.row));
  weatherPoints.scale.set(spread, 1, spread);

  if (weatherLook.lightning && sunLight) {
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightningTimer = 3 + Math.random() * 7;
      sunLight.intensity = 2.6;
    } else {
      sunLight.intensity += (weatherLook.sun - sunLight.intensity) * Math.min(1, dt * 6);
    }
  }
  return true;
}

export function render() {
  if (renderer) renderer.render(scene, camera);
}

function waypointVector(tile) {
  return new THREE.Vector3(worldX(tile.col), surfaceY(tile.col, tile.row), worldZ(tile.row));
}

function faceHeading(group, dx, dz) {
  if (Math.abs(dx) < 1e-5 && Math.abs(dz) < 1e-5) return;
  group.rotation.y = Math.atan2(dx, dz);
}

function setMarchBob(group, height) {
  const tents = group.userData.tents;
  if (tents) tents.position.y = height;
}

function advanceAnimations(dt) {
  for (const [armyId, anim] of armyAnimations) {
    anim.elapsed += dt;
    let budget = MARCH_TILES_PER_SECOND * marchSpeedFactor * TILE_SIZE * dt;

    while (budget > 0 && anim.segment < anim.points.length - 1) {
      const from = anim.points[anim.segment];
      const to = anim.points[anim.segment + 1];
      const length = from.distanceTo(to);
      if (length < 1e-4) {
        anim.segment++;
        anim.progress = 0;
        continue;
      }
      anim.progress += budget / length;
      if (anim.progress >= 1) {
        budget = (anim.progress - 1) * length;
        anim.segment++;
        anim.progress = 0;
      } else {
        budget = 0;
      }
    }

    if (anim.segment >= anim.points.length - 1) {
      anim.group.position.copy(anim.points[anim.points.length - 1]);
      setMarchBob(anim.group, 0);
      completionQueue.push(anim.onComplete);
      armyAnimations.delete(armyId);
    } else {
      const from = anim.points[anim.segment];
      const to = anim.points[anim.segment + 1];
      anim.group.position.lerpVectors(from, to, anim.progress);
      faceHeading(anim.group, to.x - from.x, to.z - from.z);
      setMarchBob(anim.group, Math.abs(Math.sin(anim.elapsed * 11)) * 0.28);
    }
  }
  return armyAnimations.size > 0;
}

function advanceEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.elapsed += dt;
    effect.update(effect.elapsed / effect.duration, dt);
    if (effect.elapsed >= effect.duration) {
      effect.dispose();
      completionQueue.push(effect.onComplete);
      effects.splice(i, 1);
    }
  }
  return effects.length > 0;
}

function startAnimationLoop() {
  if (animationFrameId !== null) return;
  let last = performance.now();
  const step = (now) => {
    // Cap the step so a stalled tab cannot jump an animation to its end, but
    // keep the cap loose enough that a slow GPU plays it at roughly the right
    // speed instead of in slow motion.
    const dt = Math.min(0.12, (now - last) / 1000);
    last = now;
    advanceAnimations(dt);
    advanceEffects(dt);
    const raining = advanceWeatherPoints(dt);
    render();

    // Fertige Märsche und Effekte melden sich sofort - noch in dem Bild, in
    // dem sie zu Ende gehen. Früher wurde die Warteschlange erst geleert,
    // wenn die Schleife ganz anhielt; bei Regen oder Schnee treiben aber
    // dauernd Tropfen über die Karte, die Schleife hielt nie an, und so
    // liefen der Marschton weiter und der Schlachtbericht kam erst mit dem
    // nächsten Wetterumschwung.
    // Ein Rückruf darf dabei die nächste Stufe starten (der Marsch, der in
    // einen Zusammenstoß mündet): animationFrameId steht noch, sein
    // startAnimationLoop() fällt also durch, und die Schleife läuft unten
    // ohnehin weiter.
    for (const done of completionQueue.splice(0)) if (done) done();

    if (armyAnimations.size > 0 || effects.length > 0 || raining) {
      animationFrameId = requestAnimationFrame(step);
      return;
    }
    animationFrameId = null;
  };
  animationFrameId = requestAnimationFrame(step);
}

export function isAnimating() {
  return armyAnimations.size > 0 || effects.length > 0;
}

const CLASH_DURATION = 1.35;

// A clash where the armies actually meet: a shockwave ring races outward along
// the ground, sparks are thrown up and fall back, and a light flares and dies.
export function playBattleClash(col, row, onComplete, options = {}) {
  if (!scene) {
    if (onComplete) onComplete();
    return;
  }
  // Zur See sieht ein Zusammenstoß anders aus: keine Funken und kein Staub,
  // sondern Gischt und Trümmer. Dieselbe Bewegung, andere Farben.
  const naval = !!options.naval;
  const centre = new THREE.Vector3(worldX(col), surfaceY(col, row), worldZ(row));
  const group = new THREE.Group();
  group.position.copy(centre);
  scene.add(group);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 1.15, 40),
    new THREE.MeshBasicMaterial({
      color: naval ? '#cfe9ff' : '#ffd98a',
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  group.add(ring);

  const flash = new THREE.PointLight(naval ? '#9fd8ff' : '#ffb347', 0, 26);
  flash.position.y = 2.4;
  group.add(flash);

  const rng = seededRandomFactory(col * 977 + row * 131 + 7);
  const sparks = [];
  for (let i = 0; i < 18; i++) {
    const spark = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.24 + rng() * 0.2),
      new THREE.MeshBasicMaterial({
        color: naval
          ? (rng() < 0.5 ? '#e8f4ff' : '#7fb2d8')
          : (rng() < 0.5 ? '#ffd27a' : '#e8663d'),
        transparent: true,
      })
    );
    const angle = rng() * Math.PI * 2;
    const speed = 5 + rng() * 7;
    spark.position.set(0, 0.6, 0);
    group.add(spark);
    sparks.push({
      mesh: spark,
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed,
      vy: 5 + rng() * 6,
      spin: (rng() - 0.5) * 12,
    });
  }

  effects.push({
    elapsed: 0,
    duration: CLASH_DURATION,
    onComplete,
    update(t, dt) {
      const eased = Math.min(1, t * 1.5);
      ring.scale.setScalar(1 + eased * 7);
      ring.material.opacity = Math.max(0, 0.85 * (1 - eased));
      flash.intensity = t < 0.28 ? 5.5 * (1 - t / 0.28) : 0;

      for (const s of sparks) {
        s.vy -= 22 * dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.position.z += s.vz * dt;
        s.mesh.rotation.x += s.spin * dt;
        s.mesh.rotation.y += s.spin * dt;
        if (s.mesh.position.y < 0.1) {
          s.mesh.position.y = 0.1;
          s.vy = 0;
          s.vx *= 0.7;
          s.vz *= 0.7;
        }
        s.mesh.material.opacity = Math.max(0, 1 - t * 1.15);
      }
    },
    dispose() {
      group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      scene.remove(group);
    },
  });
  startAnimationLoop();
}

// Walks an army's 3D group from where it currently stands through `tiles`.
// The caller composes the route, so an attack that gets repelled can march
// out, lunge at the defender and fall back.
export function animateArmyPath(armyId, tiles, onComplete) {
  const entry = armyGroups.get(armyId);
  if (!entry || !tiles || !tiles.length || marchSpeedFactor === 0) {
    if (onComplete) onComplete();
    return;
  }
  armyAnimations.set(armyId, {
    group: entry.group,
    points: [entry.group.position.clone(), ...tiles.map(waypointVector)],
    segment: 0,
    progress: 0,
    elapsed: 0,
    onComplete,
  });
  startAnimationLoop();
}

// Raycasts against whichever of the terrain or sea surface is closer to the
// camera, then derives the tile from the hit point (vertices sit exactly at
// tile centres, so a simple round-to-nearest is exact for the terrain and a
// good approximation for open water).
export function pickTile(ndcX, ndcY) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

  const candidates = [terrainMesh, waterMesh].filter(Boolean);
  const hits = raycaster.intersectObjects(candidates, false);
  if (!hits.length) return null;
  const p = hits[0].point;
  const col = colFromWorldX(p.x);
  const row = rowFromWorldZ(p.z);
  if (col < 0 || col >= mapCols || row < 0 || row >= mapRows) return null;
  return { col, row };
}
