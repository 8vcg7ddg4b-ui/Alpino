// --- Das Startbild in echt -----------------------------------------------
// Bisher war das Titelbild eine gezeichnete Tafel: Nebel, Planet und ein
// flacher Träger aus SVG-Pfaden. Jetzt steht dort dieselbe Werft wie im
// Spiel - der Träger der gewählten Flagge treibt in Echtzeit vor einem
// Nebel, eine Staffel zieht vorbei, und die Kamera atmet.
//
// Fällt WebGL aus, bleibt die gezeichnete Tafel: `main.js` legt sie darunter
// und blendet sie nur weg, wenn diese Szene wirklich läuft.
import { shipModel, SHIP_LENGTH } from './ships3d.js';
import { factionProfile } from './data.js';

let renderer, scene, camera, canvas;
let running = false;
let frame = null;
let hero = null;
let heroPivot = null;
let flight = [];
let nebulaLayers = [];
let planet = null;
let rimLight = null;
let keyLight = null;
let currentFaction = null;
let clock = 0;
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

// Eine Wolke aus Rauschen: sie ist der Nebel, den die Bänke auf der Karte
// später auch werfen.
function cloudTexture(seed = 1) {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, size, size);
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 18 + rnd() * 70;
    const a = 0.03 + rnd() * 0.07;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Die Ränder werden weich, damit die Fläche keine Kante zeigt.
  const fade = g.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.5);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

// Der Planet: eine Kugel mit Bändern, ein Ring, und eine Sichel Licht am
// Rand - mehr braucht es nicht, damit eine Welt eine Welt ist.
function planetTexture(profile) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, profile.colorDark);
  base.addColorStop(0.45, profile.color);
  base.addColorStop(1, '#0a0f18');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 256;
    const h = 2 + Math.random() * 14;
    g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    g.fillRect(0, y, 512, h);
    g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.07})`;
    g.fillRect(0, y + h, 512, h * 0.6);
  }
  // Ein Wirbelsturm, wie ihn Gasriesen tragen.
  const spot = g.createRadialGradient(360, 150, 4, 360, 150, 52);
  spot.addColorStop(0, 'rgba(255,240,220,0.35)');
  spot.addColorStop(1, 'rgba(255,200,160,0)');
  g.fillStyle = spot;
  g.beginPath();
  g.ellipse(360, 150, 52, 26, 0, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

function buildStars() {
  const geo = new THREE.BufferGeometry();
  const count = 900;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 240 + Math.random() * 140;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi) * 0.6;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const warm = 0.7 + Math.random() * 0.3;
    col[i * 3] = warm;
    col[i * 3 + 1] = warm * (0.9 + Math.random() * 0.1);
    col[i * 3 + 2] = 1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.5, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9,
  }));
}

// --- Aufbau ---------------------------------------------------------------
export function initTitleScene(container, factionId = 'confed') {
  if (typeof THREE === 'undefined' || !container) return false;
  try {
    canvas = document.createElement('canvas');
    canvas.className = 'title-canvas';
    container.appendChild(canvas);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (err) {
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x04070e, 1);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 900);
  camera.position.set(0, 2.4, 33);
  camera.lookAt(6.5, 0.2, 0);

  scene.add(buildStars());

  // Nebelschwaden: drei große Flächen, die langsam gegeneinander treiben.
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: cloudTexture(97 + i * 31),
      transparent: true,
      opacity: 0.72 - i * 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffffff,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(150 - i * 22, 150 - i * 22), mat);
    mesh.position.set(-4 + i * 14, 7 - i * 5, -46 - i * 18);
    mesh.userData.drift = 0.0025 + i * 0.0016;
    nebulaLayers.push(mesh);
    scene.add(mesh);
  }

  // Der Planet unten rechts, angeschnitten - er gibt dem Bild seinen Boden.
  planet = new THREE.Group();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(30, 48, 32),
    new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0x71829c }),
  );
  globe.name = 'globe';
  planet.add(globe);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(38, 52, 96),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  ring.rotation.set(-Math.PI / 2 + 0.5, 0, 0.24);
  ring.name = 'ring';
  planet.add(ring);
  planet.position.set(58, -40, -74);
  scene.add(planet);

  // Licht: der Schein der Sonne von links vorn, ein farbiger Saum von
  // hinten rechts - so bekommt der Rumpf eine Kante.
  scene.add(new THREE.AmbientLight(0x223247, 0.55));
  keyLight = new THREE.DirectionalLight(0xdce9ff, 0.95);
  keyLight.position.set(-14, 14, 20);
  scene.add(keyLight);
  rimLight = new THREE.DirectionalLight(0x6fb0ff, 1.8);
  rimLight.position.set(22, -2, -18);
  scene.add(rimLight);
  // Ein weiches Fülllicht aus der Kamera: ohne das steht der Rumpf als
  // schwarze Fläche im Bild, und die Aufbauten verschwinden.
  const fill = new THREE.DirectionalLight(0xa8c4e8, 0.55);
  fill.position.set(-2, 4, 30);
  scene.add(fill);

  heroPivot = new THREE.Group();
  scene.add(heroPivot);

  setTitleFaction(factionId);
  resizeTitleScene();

  window.addEventListener('pointermove', onPointerMove);
  running = true;
  loop();
  return true;
}

function onPointerMove(ev) {
  // Die Kamera folgt dem Zeiger ein Stück weit - das Bild bekommt Tiefe,
  // ohne dass etwas blinkt.
  pointer.tx = (ev.clientX / window.innerWidth - 0.5) * 2;
  pointer.ty = (ev.clientY / window.innerHeight - 0.5) * 2;
}

// Die Flagge wechselt: Träger, Staffel und alle Farben werden getauscht.
export function setTitleFaction(factionId) {
  if (!scene || currentFaction === factionId) return;
  currentFaction = factionId;
  const profile = factionProfile(factionId);

  while (heroPivot.children.length) heroPivot.remove(heroPivot.children[0]);
  flight = [];

  // Der Träger füllt die rechte Bildhälfte - rund achtzehn Einheiten lang.
  const scale = 16 / SHIP_LENGTH.traeger;
  hero = shipModel(profile.kind, 'traeger', profile.color, profile.accent, { scale });
  // Dreiviertelblick von schräg vorn: Bug zum Betrachter, Deck angeschnitten,
  // die Düsen zeigen ins Bild hinein.
  hero.rotation.set(0.13, -2.3, -0.06);
  hero.position.set(8.5, -0.6, -1);
  heroPivot.add(hero);

  // Drei Jäger im Anflug, gestaffelt wie eine Rotte.
  const fScale = 3.6 / SHIP_LENGTH.jaeger;
  for (let i = 0; i < 3; i++) {
    const f = shipModel(profile.kind, 'jaeger', profile.color, profile.accent, { scale: fScale });
    f.userData.offset = i * 1.6;
    f.userData.lane = [-2.2, 0.4, 2.6][i];
    f.userData.height = [3.4, 5.2, 1.6][i];
    heroPivot.add(f);
    flight.push(f);
  }

  const globe = planet.getObjectByName('globe');
  if (globe) {
    if (globe.material.map) globe.material.map.dispose();
    globe.material.map = planetTexture(profile);
    globe.material.needsUpdate = true;
  }
  const ring = planet.getObjectByName('ring');
  if (ring) ring.material.color.set(profile.accent);
  if (rimLight) rimLight.color.set(profile.color);
  for (const layer of nebulaLayers) layer.material.color.set(profile.color);
}

// Zwei Bildaufteilungen: im Startbild steht das Schiff rechts neben dem
// Titel, in der Auswahl rückt es in die Lücke zwischen den Spalten, damit
// die Tafeln es nicht verdecken.
export function setTitleLayout(mode) {
  if (!heroPivot) return;
  if (mode === 'setup') {
    heroPivot.position.set(-5.5, -3.6, -4);
    if (planet) planet.position.set(52, -46, -80);
  } else {
    heroPivot.position.set(0, 0, 0);
    if (planet) planet.position.set(58, -40, -74);
  }
}

export function resizeTitleScene() {
  if (!renderer || !canvas) return;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}

function loop() {
  if (!running) return;
  clock += 0.006;

  // Der Träger treibt: ein langsames Gieren, ein Heben und Senken. Nichts
  // dreht sich im Kreis - das Schiff liegt im Raum und arbeitet.
  if (hero) {
    hero.rotation.y = -2.3 + Math.sin(clock * 0.32) * 0.05;
    hero.rotation.z = -0.06 + Math.sin(clock * 0.21) * 0.02;
    hero.position.y = -0.6 + Math.sin(clock * 0.44) * 0.3;
  }

  // Die Staffel zieht von hinten links nach vorn rechts und beginnt von
  // vorn, sobald sie aus dem Bild ist.
  for (const f of flight) {
    // Die Rotte zieht schräg durchs Bild: von links unten hinter dem Träger
    // hervor nach rechts oben, dann von vorn.
    const t = ((clock * 0.5 + f.userData.offset) % 14) - 2;
    f.position.set(-14 + t * 2.6, f.userData.height + Math.sin(clock + f.userData.offset) * 0.25,
      9 + f.userData.lane - t * 0.9);
    f.rotation.set(0.06, Math.PI / 2 - 0.3, Math.sin(clock * 0.8 + f.userData.offset) * 0.24);
    f.visible = t > -1 && t < 11;
  }

  for (const layer of nebulaLayers) {
    layer.rotation.z += layer.userData.drift * 0.02;
    layer.position.x += Math.sin(clock * 0.1) * 0.004;
  }
  if (planet) planet.rotation.y += 0.0004;

  pointer.x += (pointer.tx - pointer.x) * 0.04;
  pointer.y += (pointer.ty - pointer.y) * 0.04;
  camera.position.x = pointer.x * 2.2;
  camera.position.y = 3.4 - pointer.y * 1.4;
  camera.lookAt(4, 0.5, 0);

  renderer.render(scene, camera);
  frame = requestAnimationFrame(loop);
}

export function stopTitleScene() {
  running = false;
  if (frame) cancelAnimationFrame(frame);
  frame = null;
}

export function resumeTitleScene() {
  if (running || !renderer) return;
  running = true;
  loop();
}

export function isTitleSceneRunning() {
  return running;
}
