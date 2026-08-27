import { TILE_TYPES, settlementTier, WALL_LEVELS } from './data.js';
import { unitTotalCount, factionById } from './state.js';

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

// The height an army, fleet or town actually stands at on a given tile.
// Waypoints may sit between tile centres (a repelled army lunges partway into
// the defender's tile), so the lookup rounds to the nearest tile.
function surfaceY(col, row) {
  if (!currentMap) return 0;
  const c = Math.max(0, Math.min(currentMap.cols - 1, Math.round(col)));
  const r = Math.max(0, Math.min(currentMap.rows - 1, Math.round(row)));
  const tile = currentMap.tiles[r][c];
  return tile.type === 'water' ? SEA_LEVEL_Y : tileTopY(tile.elevation);
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
function collectTree(props, col, row, topY, rng) {
  const jx = (rng() - 0.5) * TILE_SIZE * 0.4;
  const jz = (rng() - 0.5) * TILE_SIZE * 0.4;
  const scale = 0.8 + rng() * 0.5;
  props.trunks.push({ x: worldX(col) + jx, y: topY + 0.55 * scale, z: worldZ(row) + jz, s: scale, r: 0 });
  props.leaves.push({
    x: worldX(col) + jx, y: topY + 1.9 * scale, z: worldZ(row) + jz,
    s: scale, r: rng() * Math.PI,
  });
}

// Peaks scale with how high the underlying crest already is, so a tile on the
// spine grows a tall cluster while a saddle only gets low rocks - the range
// then reads as a varied silhouette rather than a row of identical cones.
function collectPeak(props, col, row, elevation, rng) {
  const topY = tileTopY(elevation);
  const prominence = Math.min(1, Math.max(0, (elevation - 1.2) / 1.9));
  const count = 1 + Math.floor(rng() * 2 + prominence * 1.6);

  for (let i = 0; i < count; i++) {
    const jx = (rng() - 0.5) * TILE_SIZE * 0.75;
    const jz = (rng() - 0.5) * TILE_SIZE * 0.75;
    const height = (1.1 + prominence * 3.4) * (0.55 + rng() * 0.75);
    const snowy = prominence > 0.55 && rng() < 0.55 + prominence * 0.4;
    (snowy ? props.snowPeaks : props.rockPeaks).push({
      x: worldX(col) + jx,
      y: topY + height / 2 - 0.25,
      z: worldZ(row) + jz,
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
        if (TILE_TYPES[tile.type].deco === 'tree' && rng() < 0.85) collectTree(props, col, row, tileTopY(tile.elevation), rng);
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
  terrainColors = colors;
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
    new THREE.MeshStandardMaterial({ color: TILE_TYPES.water.color, transparent: true, opacity: 0.82, roughness: 0.25 })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = SEA_LEVEL_Y;
  scene.add(waterMesh);

  buildProps(props);
  buildRoads(state);
}

// A road follows the ground: a least-cost path over passable land, so it winds
// round the sea and through the passes instead of ruling a straight line
// across the Adriatic.
function landRoute(state, from, to) {
  const { cols, rows, tiles } = state.map;
  const key = (col, row) => row * cols + col;
  // Step costs are small integers, so the frontier is a row of buckets keyed
  // by cost - no sorting, and the whole search stays linear.
  const start = key(from.col, from.row);
  const goal = key(to.col, to.row);
  const cost = new Int32Array(cols * rows).fill(-1);
  const prev = new Int32Array(cols * rows).fill(-1);
  const buckets = [[start]];
  cost[start] = 0;

  for (let level = 0; level < buckets.length; level++) {
    const bucket = buckets[level];
    if (!bucket) continue;
    for (const currentKey of bucket) {
      if (cost[currentKey] !== level) continue;
      if (currentKey === goal) { level = buckets.length; break; }
      const col = currentKey % cols;
      const row = (currentKey - col) / cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const def = TILE_TYPES[tiles[nr][nc].type];
        if (def.impassable) continue;
        const next = level + def.cost;
        const nextKey = key(nc, nr);
        if (cost[nextKey] !== -1 && cost[nextKey] <= next) continue;
        cost[nextKey] = next;
        prev[nextKey] = currentKey;
        (buckets[next] || (buckets[next] = [])).push(nextKey);
      }
    }
  }

  if (cost[goal] === -1) return null;
  const path = [];
  for (let k = goal; k !== -1; k = prev[k]) {
    path.push({ col: k % cols, row: (k - (k % cols)) / cols });
    if (k === start) break;
  }
  return path.reverse();
}

function buildRoad(state, route) {
  const points = route.map((tile) => new THREE.Vector3(
    worldX(tile.col), surfaceY(tile.col, tile.row) + 0.16, worldZ(tile.row)
  ));
  if (points.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(points);
  const segments = Math.min(600, points.length * 4);
  const geometry = new THREE.TubeGeometry(curve, segments, 0.34, 5, false);
  const material = new THREE.MeshStandardMaterial({ color: '#a9895c', roughness: 1 });
  roadsGroup.add(new THREE.Mesh(geometry, material));
}

// Each faction's roads run from its capital out to its own settlements. An
// island holding gets none: there is no road to build.
function buildRoads(state) {
  const byFaction = new Map();
  for (const city of state.cities) {
    if (!byFaction.has(city.factionId)) byFaction.set(city.factionId, []);
    byFaction.get(city.factionId).push(city);
  }
  for (const [factionId, cities] of byFaction) {
    if (factionId === 'neutral' || cities.length < 2) continue;
    const capital = cities.find((c) => c.capital) || cities[0];
    for (const city of cities) {
      if (city === capital) continue;
      const route = landRoute(state, capital, city);
      if (route) buildRoad(state, route);
    }
  }
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

function buildCityGroup(city) {
  const group = new THREE.Group();
  // A große Stadt towers over a Dorf; being the seat of a faction adds a
  // little more on top of whatever tier the settlement belongs to.
  const scale = settlementTier(city.size).modelScale * (city.capital ? 1.12 : 1);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.6 * scale, 2.2 * scale, 2.6 * scale),
    new THREE.MeshStandardMaterial({ color: '#cbb98c', roughness: 0.8 })
  );
  base.position.y = 1.1 * scale;
  group.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2 * scale, 1.8 * scale, 4),
    new THREE.MeshStandardMaterial({ color: '#b5432f', roughness: 0.6 })
  );
  roof.position.y = 2.2 * scale + 0.9 * scale;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 3 * scale, 5),
    new THREE.MeshStandardMaterial({ color: '#3a2c1d' })
  );
  pole.position.y = 2.2 * scale + 1.9 * scale;
  group.add(pole);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1 * scale, 0.7 * scale),
    new THREE.MeshStandardMaterial({ color: '#999', side: THREE.DoubleSide })
  );
  flag.position.set(0.6 * scale, 2.2 * scale + 2.9 * scale, 0);
  group.add(flag);

  const label = makeLabelSprite(city.name, { scale: city.capital ? 1.15 : 0.95 });
  // Big towns get outbuildings, so the three tiers read apart at a glance.
  const outbuildings = Math.round(settlementTier(city.size).modelScale * 3);
  for (let i = 0; i < outbuildings; i++) {
    const angle = (i / Math.max(1, outbuildings)) * Math.PI * 2 + 0.6;
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 * scale, 0.8 * scale, 0.9 * scale),
      new THREE.MeshStandardMaterial({ color: '#c3b184', roughness: 0.9 })
    );
    hut.position.set(Math.cos(angle) * 1.9 * scale, 0.4 * scale, Math.sin(angle) * 1.9 * scale);
    hut.rotation.y = angle;
    group.add(hut);
  }
  label.position.y = 2.2 * scale + 4.6 * scale;
  group.add(label);

  // Three rings of fortification, one per stage, all built up front and shown
  // according to how far the settlement has got. A palisade has to read as
  // stakes and a stone wall as masonry - a recoloured box would not.
  const walls = WALL_LEVELS.map((stage) => {
    const ring = buildFortification(stage.key, scale);
    ring.visible = false;
    group.add(ring);
    return ring;
  });

  return { group, roof, flag, label, walls };
}

function tierForCount(count) {
  if (count >= 700) return 5;
  if (count >= 500) return 4;
  if (count >= 300) return 3;
  if (count >= 100) return 2;
  return 1;
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

  const tierCount = tierForCount(unitTotalCount(army.units));
  const tents = group.userData.tents;
  while (tents.children.length < tierCount) {
    const tent = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: faction.color })
    );
    const idx = tents.children.length;
    const angle = (idx / 6) * Math.PI * 2;
    tent.position.set(Math.cos(angle) * 1.1, 0.55, Math.sin(angle) * 1.1);
    tents.add(tent);
  }
  while (tents.children.length > tierCount) {
    tents.remove(tents.children[tents.children.length - 1]);
  }
  tents.children.forEach((tent) => { tent.material.color.set(faction.color); });
  group.userData.banner.material.color.set(faction.color);

  if (group.userData.label) group.remove(group.userData.label);
  const label = makeLabelSprite(String(unitTotalCount(army.units)), { fontSize: 40, scale: 0.85 });
  label.position.y = afloat ? 4.2 : 3.6;
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
    entry.roof.material.color.set(faction.color);
    entry.flag.material.color.set(faction.color);
    // Only the highest stage that actually stands is shown.
    if (entry.walls) {
      entry.walls.forEach((ring, index) => { ring.visible = (city.wallLevel || 0) === index + 1; });
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

  if (mapMode === 'tactical') refreshTacticalColors(state);

  clearHighlights();
  if (state.reachable) {
    for (const [key, info] of state.reachable) {
      const [col, row] = key.split(',').map(Number);
      // A shore a fleet can land on is its own kind of move: neither a free
      // march nor necessarily a fight.
      const color = info.combat ? '#ff4d3d' : info.landing ? '#ffd166' : '#4dffa0';
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
  if (ambientLight) ambientLight.intensity = tactical ? 0.78 : 0.65;
  if (sunLight) sunLight.intensity = tactical ? 0.32 : 1.05;
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
    let budget = MARCH_TILES_PER_SECOND * TILE_SIZE * dt;

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
    render();
    if (marching || effecting) {
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
  if (!entry || !tiles || !tiles.length) {
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
