import { TILE_TYPES } from './data.js';
import { unitTotalCount, factionById } from './state.js';

export const TILE_SIZE = 6;
const ELEV_SCALE = 2.2;

let renderer, scene, camera;
let canvasEl;
let mapCols = 0;
let mapRows = 0;

const cam = { col: 0, row: 0, zoom: 1 };
const ISO_DIR = new THREE.Vector3(1, 1.05, 1).normalize();
const BASE_DISTANCE = 130;

let terrainMesh = null;
let waterMesh = null;

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

  scene.add(new THREE.AmbientLight('#ffffff', 0.65));
  const sun = new THREE.DirectionalLight('#fff3d2', 1.05);
  sun.position.set(140, 220, 90);
  scene.add(sun);
}

function applyCamera() {
  const dist = BASE_DISTANCE / cam.zoom;
  const target = new THREE.Vector3(worldX(cam.col), 0, worldZ(cam.row));
  camera.position.copy(target).addScaledVector(ISO_DIR, dist);
  camera.lookAt(target);
  camera.up.set(0, 1, 0);
  camera.updateProjectionMatrix();
}

export function resize(width, height) {
  if (!renderer) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  applyCamera();
}

export function panCamera(dCol, dRow) {
  cam.col += dCol;
  cam.row += dRow;
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
  cam.zoom = Math.max(0.5, Math.min(2.5, cam.zoom * factor));
  applyCamera();
}

function addTreeProp(group, col, row, topY, rng) {
  const jx = (rng() - 0.5) * TILE_SIZE * 0.4;
  const jz = (rng() - 0.5) * TILE_SIZE * 0.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 1.1, 6),
    new THREE.MeshStandardMaterial({ color: '#5b3a22' })
  );
  trunk.position.set(worldX(col) + jx, topY + 0.55, worldZ(row) + jz);
  group.add(trunk);
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.4, 7),
    new THREE.MeshStandardMaterial({ color: '#2f6b34' })
  );
  leaves.position.set(worldX(col) + jx, topY + 1.9, worldZ(row) + jz);
  group.add(leaves);
}

function addPeakProp(group, col, row, topY, rng) {
  const jx = (rng() - 0.5) * TILE_SIZE * 0.5;
  const jz = (rng() - 0.5) * TILE_SIZE * 0.5;
  const size = 1.5 + rng() * 1.4;
  const height = 2.4 + rng() * 2.4;
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(size, height, 5),
    new THREE.MeshStandardMaterial({ color: rng() < 0.5 ? '#eef0f4' : '#c9c6c0', flatShading: true })
  );
  peak.rotation.y = rng() * Math.PI;
  peak.position.set(worldX(col) + jx, topY + height / 2, worldZ(row) + jz);
  group.add(peak);
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
  const propsGroup = new THREE.Group();
  scene.add(propsGroup);
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
        if (TILE_TYPES[tile.type].deco === 'tree' && rng() < 0.85) addTreeProp(propsGroup, col, row, tileTopY(tile.elevation), rng);
        if (TILE_TYPES[tile.type].deco === 'peak' && rng() < 0.75) addPeakProp(propsGroup, col, row, tileTopY(tile.elevation), rng);
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
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: makeNoiseTexture(),
    roughness: 0.95,
  });
  terrainMesh = new THREE.Mesh(geometry, material);
  scene.add(terrainMesh);

  const seaSize = Math.max(mapCols, mapRows) * TILE_SIZE * 1.6;
  waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(seaSize, seaSize),
    new THREE.MeshStandardMaterial({ color: TILE_TYPES.water.color, transparent: true, opacity: 0.82, roughness: 0.25 })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = tileTopY(TILE_TYPES.water.elevation) + 0.3;
  scene.add(waterMesh);

  buildRoads(state);
}

function elevationNear(state, col, row) {
  const c = Math.max(0, Math.min(mapCols - 1, Math.round(col)));
  const r = Math.max(0, Math.min(mapRows - 1, Math.round(row)));
  return state.map.tiles[r][c].elevation;
}

function buildRoad(state, from, to) {
  const steps = Math.max(10, Math.round(Math.hypot(to.col - from.col, to.row - from.row) * 2));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const col = from.col + (to.col - from.col) * t;
    const row = from.row + (to.row - from.row) * t;
    const elevation = elevationNear(state, col, row);
    points.push(new THREE.Vector3(worldX(col), tileTopY(elevation) + 0.14, worldZ(row)));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, steps * 2, 0.34, 5, false);
  const material = new THREE.MeshStandardMaterial({ color: '#a9895c', roughness: 1 });
  scene.add(new THREE.Mesh(geometry, material));
}

// Decorative roads linking each faction's two settlements together.
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
      if (city !== capital) buildRoad(state, capital, city);
    }
  }
}

function buildCityGroup(city) {
  const group = new THREE.Group();
  const scale = city.capital ? 1.35 : 1;

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
  label.position.y = 2.2 * scale + 4.6 * scale;
  group.add(label);

  return { group, roof, flag, label };
}

function tierForCount(count) {
  if (count >= 700) return 5;
  if (count >= 500) return 4;
  if (count >= 300) return 3;
  if (count >= 100) return 2;
  return 1;
}

function buildArmyGroup() {
  const group = new THREE.Group();
  const tents = new THREE.Group();
  group.add(tents);
  group.userData.tents = tents;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3.2, 5),
    new THREE.MeshStandardMaterial({ color: '#3a2c1d' })
  );
  pole.position.y = 1.6;
  group.add(pole);

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
  const topY = tileTopY(state.map.tiles[army.row][army.col].elevation);
  group.position.set(worldX(army.col), topY, worldZ(army.row));

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
  label.position.y = 3.6;
  group.add(label);
  group.userData.label = label;

  group.userData.ring.material.opacity = army.id === state.selectedArmyId ? 0.9 : 0;
}

function clearHighlights() {
  for (const mesh of highlightMeshes) scene.remove(mesh);
  highlightMeshes.length = 0;
}

function addHighlight(col, row, elevation, color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(worldX(col), tileTopY(elevation) + 0.15, worldZ(row));
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
      const topY = tileTopY(state.map.tiles[city.row][city.col].elevation);
      entry.group.position.set(worldX(city.col), topY, worldZ(city.row));
      scene.add(entry.group);
      cityGroups.set(city.id, entry);
    }
    const faction = factionById(state, city.factionId);
    entry.roof.material.color.set(faction.color);
    entry.flag.material.color.set(faction.color);
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
    if (!seenArmies.has(id)) {
      scene.remove(entry.group);
      armyGroups.delete(id);
    }
  }

  clearHighlights();
  if (state.reachable) {
    for (const [key, info] of state.reachable) {
      const [col, row] = key.split(',').map(Number);
      const elevation = state.map.tiles[row][col].elevation;
      addHighlight(col, row, elevation, info.combat ? '#ff4d3d' : '#4dffa0');
    }
  }
}

export function render() {
  if (renderer) renderer.render(scene, camera);
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
