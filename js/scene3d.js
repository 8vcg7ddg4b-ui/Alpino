import { TILE_TYPES, settlementTier, WALL_LEVELS, experienceStars } from './data.js';
import { unitTotalCount, factionById, harbourTile } from './state.js';

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

let terrainMesh = null;
let waterMesh = null;
let deepSeaMesh = null;
let currentMap = null;
let propsGroup = null;
let roadsGroup = null;
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
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

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

function applyCamera() {
  updateWeatherForCamera();
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

export function resetCameraOrientation() {
  cam.azimuth = DEFAULT_AZIMUTH;
  cam.polar = DEFAULT_POLAR;
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
  cam.zoom = Math.max(0.35, Math.min(4.5, cam.zoom * factor));
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

  const seaSize = Math.max(mapCols, mapRows) * TILE_SIZE * 1.8;
  // An opaque deep-ocean floor under the translucent surface. Without it the
  // sea beyond the edge of the heightmap shows the sky through it and the map
  // ends in a visible pale shelf.
  deepSeaMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(seaSize, seaSize),
    new THREE.MeshStandardMaterial({ color: '#1d3f66', roughness: 0.9 })
  );
  deepSeaMesh.rotation.x = -Math.PI / 2;
  deepSeaMesh.position.y = tileTopY(TILE_TYPES.water.elevation) - 0.6;
  scene.add(deepSeaMesh);

  waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(seaSize, seaSize),
    new THREE.MeshStandardMaterial({
      color: TILE_TYPES.water.color, transparent: true, opacity: 0.82, roughness: 0.25,
    })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = SEA_LEVEL_Y;
  scene.add(waterMesh);

  buildProps(props);
  buildRoadNetwork(state);
  roadVersionDrawn = state.roadVersion || 0;
}

// Das Straßennetz als ein einziges Gitter: für jedes Straßenfeld ein Plättchen
// und je ein halber Balken zu jedem Straßennachbarn. Beide Hälften treffen
// sich in der Mitte, damit Kurven und Kreuzungen von selbst zusammenpassen.
let roadVersionDrawn = -1;

function pushQuad(positions, ax, az, bx, bz, halfWidth) {
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
      positions.push(corner[0], surfaceY(colFromWorldX(corner[0]), rowFromWorldZ(corner[1])) + 0.18, corner[1]);
    }
  }
}

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
    // A row of sharpened stakes: a shaft with a point on top, per stake.
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5433', roughness: 1 });
    const height = 1.15 * scale;
    const perSide = 9;
    for (let side = 0; side < 4; side++) {
      const angle = (side * Math.PI) / 2;
      for (let i = 0; i < perSide; i++) {
        const t = (i / (perSide - 1) - 0.5) * span;
        const x = Math.cos(angle) * t + Math.sin(angle) * half;
        const z = -Math.sin(angle) * t + Math.cos(angle) * half;
        const stake = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11 * scale, 0.13 * scale, height, 5),
          wood
        );
        stake.position.set(x, height / 2, z);
        ring.add(stake);
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(0.13 * scale, 0.26 * scale, 5),
          wood
        );
        tip.position.set(x, height + 0.13 * scale, z);
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
  const height = (stone ? 1.7 : 1.35) * scale;
  const thickness = (stone ? 0.42 : 0.34) * scale;

  for (let i = 0; i < 4; i++) {
    const segment = new THREE.Mesh(new THREE.BoxGeometry(span, height, thickness), material);
    segment.position.y = height / 2;
    segment.rotation.y = (i * Math.PI) / 2;
    segment.position.x = Math.sin(segment.rotation.y) * half;
    segment.position.z = Math.cos(segment.rotation.y) * half;
    ring.add(segment);
    // The parapet a defender actually stands behind.
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(span, 0.16 * scale, thickness * 1.9),
      material
    );
    walk.position.copy(segment.position);
    walk.position.y = height + 0.08 * scale;
    walk.rotation.y = segment.rotation.y;
    ring.add(walk);
  }

  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    const tower = stone
      ? new THREE.Mesh(
        new THREE.CylinderGeometry(0.42 * scale, 0.48 * scale, height * 1.45, 8),
        material
      )
      : new THREE.Mesh(
        new THREE.BoxGeometry(0.72 * scale, height * 1.35, 0.72 * scale),
        material
      );
    tower.position.set(
      Math.cos(angle) * half * Math.SQRT2,
      height * (stone ? 0.72 : 0.68),
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
function addHouse(group, tinted, x, z, width, depth, height, rotation) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), CITY_MATERIALS.plaster);
  body.position.set(x, height / 2, z);
  body.rotation.y = rotation;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.78, height * 0.62, 4),
    // Each roof gets its own material: they are tinted per faction, and a
    // shared one would repaint every city on the map at once.
    new THREE.MeshStandardMaterial({ color: '#b5432f', roughness: 0.6 })
  );
  roof.position.set(x, height + height * 0.31, z);
  roof.rotation.y = rotation + Math.PI / 4;
  roof.scale.set(1, 1, Math.min(1, depth / Math.max(0.001, width)) * 1.1);
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

  // Der Giebel: eine vierseitige Spitze, auf einer Achse flachgedrückt, damit
  // sie als Dreiecksgiebel und nicht als Zeltdach liest.
  const pediment = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.55, width * 0.3, 4),
    new THREE.MeshStandardMaterial({ color: '#c65a41', roughness: 0.6 })
  );
  pediment.position.y = width * 0.14 + columnHeight + width * 0.25;
  pediment.rotation.y = Math.PI / 4;
  pediment.scale.set(1, 1, depth / width * 1.15);
  temple.add(pediment);
  tinted.push(pediment);

  temple.position.set(x, 0, z);
  temple.rotation.y = rotation;
  group.add(temple);
}

// Ein Feldzeichen: Stange, Banner in der Fraktionsfarbe, vergoldete Spitze.
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

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(bannerWidth, bannerWidth * 0.72),
    new THREE.MeshStandardMaterial({ color: '#999', side: THREE.DoubleSide, roughness: 0.85 })
  );
  banner.position.set(bannerWidth / 2, height - bannerWidth * 0.5, 0);
  group.add(banner);
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
function buildShip(color) {
  const ship = new THREE.Group();

  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.34, 3.4, 8, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.85, side: THREE.DoubleSide })
  );
  hull.rotation.z = Math.PI / 2;
  hull.rotation.y = Math.PI / 2;
  hull.position.y = 0.42;
  ship.add(hull);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.16, 3.2),
    new THREE.MeshStandardMaterial({ color: '#8a5c2e', roughness: 0.9 })
  );
  deck.position.y = 0.62;
  ship.add(deck);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6),
    new THREE.MeshStandardMaterial({ color: '#4a3520' })
  );
  mast.position.y = 1.9;
  ship.add(mast);

  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.5),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide })
  );
  sail.position.set(0, 2.1, 0);
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

  return ship;
}

function buildArmyGroup() {
  const group = new THREE.Group();
  const tents = new THREE.Group();
  group.add(tents);
  group.userData.tents = tents;

  const ship = buildShip('#999999');
  ship.visible = false;
  group.add(ship);
  group.userData.ship = ship;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3.2, 5),
    new THREE.MeshStandardMaterial({ color: '#3a2c1d' })
  );
  pole.position.y = 1.6;
  group.add(pole);
  group.userData.pole = pole;

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.6),
    new THREE.MeshStandardMaterial({ color: '#999', side: THREE.DoubleSide })
  );
  banner.position.set(0.7, 2.6, 0);
  group.add(banner);
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
  const ship = group.userData.ship;
  if (ship) {
    ship.visible = afloat;
    ship.userData.sail.material.color.set(faction.color);
  }
  group.userData.tents.visible = !afloat;
  if (group.userData.pole) group.userData.pole.visible = !afloat;
  group.userData.banner.visible = !afloat;

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
  group.userData.banner.scale.setScalar(scale);
  group.userData.banner.position.set(0.7 * scale, 2.6 * scale, 0);
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
      scene.remove(entry.group);
      armyGroups.delete(id);
    }
  }

  // Roads change rarely; the whole network is rebuilt only when one is
  // finished rather than on every state change.
  if (roadsGroup && (state.roadVersion || 0) !== roadVersionDrawn) {
    buildRoadNetwork(state);
    roadVersionDrawn = state.roadVersion || 0;
  }

  if (mapMode === 'tactical') refreshTacticalColors(state);

  clearHighlights();
  if (state.reachable) {
    for (const [key, info] of state.reachable) {
      const [col, row] = key.split(',').map(Number);
      // A shore a fleet can land on is its own kind of move, and ground an
      // enemy army holds costs extra to enter - both deserve their own colour
      // so the player can read the cost before paying it.
      const color = info.combat ? '#ff4d3d'
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
      if (TILE_TYPES[tiles[r][c].type].impassable) continue;
      owner[next] = owner[index];
      queue.push(next);
    }
  }
  return owner;
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
      } else if (TILE_TYPES[tile.type].impassable) {
        colour.copy(ROCK_COLOUR);
      } else {
        colour.copy(owner[index] >= 0 ? palette[owner[index]] : UNCLAIMED_COLOUR);
        // A darker seam wherever two spheres of influence meet, so the
        // frontier is a line the eye follows rather than a colour change.
        const border = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => {
          const c = col + dc;
          const r = row + dr;
          if (c < 0 || c >= cols || r < 0 || r >= rows) return false;
          if (TILE_TYPES[tiles[r][c].type].impassable) return false;
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
// props and roads that make terrain readable only clutter the tactical view,
// and flat light keeps the faction colours honest.
export function setMapMode(mode, state) {
  mapMode = mode === 'tactical' ? 'tactical' : 'terrain';
  const tactical = mapMode === 'tactical';
  if (propsGroup) propsGroup.visible = !tactical;
  if (roadsGroup) roadsGroup.visible = !tactical;
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
const WEATHER_HEIGHT = 120;
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
  const shared = { color: look.colour, transparent: true, opacity: 0.7, depthWrite: false };
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
    const marching = advanceAnimations(dt);
    const effecting = advanceEffects(dt);
    const raining = advanceWeatherPoints(dt);
    render();
    if (marching || effecting || raining) {
      animationFrameId = requestAnimationFrame(step);
      return;
    }
    animationFrameId = null;
    // Callbacks may start the next stage (a march ending in a clash), which
    // restarts the loop on its own.
    for (const done of completionQueue.splice(0)) if (done) done();
  };
  animationFrameId = requestAnimationFrame(step);
}

export function isAnimating() {
  return armyAnimations.size > 0 || effects.length > 0;
}

const CLASH_DURATION = 1.35;

// A clash where the armies actually meet: a shockwave ring races outward along
// the ground, sparks are thrown up and fall back, and a light flares and dies.
export function playBattleClash(col, row, onComplete) {
  if (!scene) {
    if (onComplete) onComplete();
    return;
  }
  const centre = new THREE.Vector3(worldX(col), surfaceY(col, row), worldZ(row));
  const group = new THREE.Group();
  group.position.copy(centre);
  scene.add(group);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 1.15, 40),
    new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  group.add(ring);

  const flash = new THREE.PointLight('#ffb347', 0, 26);
  flash.position.y = 2.4;
  group.add(flash);

  const rng = seededRandomFactory(col * 977 + row * 131 + 7);
  const sparks = [];
  for (let i = 0; i < 18; i++) {
    const spark = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.24 + rng() * 0.2),
      new THREE.MeshBasicMaterial({ color: rng() < 0.5 ? '#ffd27a' : '#e8663d', transparent: true })
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
