// --- Die Schiffe ----------------------------------------------------------
// Bisher war eine Flotte ein Kegel und ein Jäger ein Dreieck. Hier stehen die
// wirklichen Umrisse: der terranische Träger mit Flugdeck, Insel und vier
// Triebwerksdüsen, der kilrathische Klanträger als Klinge mit Rückenkamm, der
// Rapier mit gepfeilten Tragflächen, der Dralthi als fliegender Flügel.
//
// Alle Modelle blicken nach +Z. Wer sie dreht, dreht um Y - so wie die Karte
// es tut, wenn eine Flotte ihren Kurs nimmt.
//
// Gebaut wird aus wenigen Körpern: Sie sollen auf einem Kartentisch zu
// erkennen sein, nicht in einer Werft nachgebaut werden.

// Geometrien und Werkstoffe werden geteilt: dreißig Flotten und dreißig
// Jäger im Gefecht sollen nicht dreihundert Puffer belegen.
const modelCache = new Map();

function hullMaterial(colour, accent, { metal = 0.5, rough = 0.5, glow = 0.1 } = {}) {
  // Der Rumpf trägt die Farbe der Flagge, aber gedämpft: ein Schiff ist
  // graues Metall mit einem Farbton darin. Hell wird nur, was leuchtet -
  // Düsen, Decksbeleuchtung, Kanzeln. So liest sich die Silhouette auf der
  // dunklen Karte, statt als heller Fleck zu verschwimmen.
  const hue = new THREE.Color(colour).lerp(new THREE.Color(0x161d28), 0.68);
  return new THREE.MeshStandardMaterial({
    color: hue,
    emissive: new THREE.Color(accent).multiplyScalar(0.22),
    emissiveIntensity: glow,
    metalness: metal,
    roughness: rough,
    flatShading: true,
  });
}

function darkMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x0f1720, metalness: 0.5, roughness: 0.7, flatShading: true,
  });
}

function glowMaterial(colour, opacity = 0.95) {
  return new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity });
}

// Ein Block. Alle Maße in Modelleinheiten; ein Jäger ist rund drei lang.
function box(mat, w, h, d, x = 0, y = 0, z = 0, rot = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  return mesh;
}

// Eine Spitze, die nach vorn zeigt.
function nose(mat, radius, length, x = 0, y = 0, z = 0, segments = 4) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, length, segments), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

// Eine Triebwerksdüse: Rohr, heiße Scheibe, Schleppfahne.
function engine(mat, glowColour, radius, length, x, y, z, flame = 1) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.86, length, 8), mat);
  tube.rotation.x = Math.PI / 2;
  g.add(tube);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.82, 10), glowMaterial(glowColour));
  disc.position.z = -length / 2 - 0.01;
  disc.rotation.y = Math.PI;
  g.add(disc);
  if (flame > 0) {
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.72, length * 1.9 * flame, 8, 1, true),
      glowMaterial(glowColour, 0.32),
    );
    trail.rotation.x = -Math.PI / 2;
    trail.position.z = -length / 2 - (length * 1.9 * flame) / 2;
    // Die Schleppfahne ist durchsichtig und damit die teuerste Fläche am
    // Schiff. Sie trägt einen Namen, damit sie bei vielen Schiffen auf
    // einmal wegfallen kann.
    trail.name = 'flamme';
    g.add(trail);
  }
  g.position.set(x, y, z);
  return g;
}

// Positionslichter: rot backbord, grün steuerbord - auch im Weltraum.
function runningLights(group, halfWidth, z) {
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), glowMaterial(0xff5a4a));
  red.position.set(-halfWidth, 0, z);
  red.name = 'licht';
  const green = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), glowMaterial(0x5affa0));
  green.position.set(halfWidth, 0, z);
  green.name = 'licht';
  group.add(red, green);
}

// --- Terranische Werften -------------------------------------------------

// Rapier: schmaler Rumpf, gepfeilte Flächen, zwei Düsen. Der Jäger, den die
// Konföderation seit McAuliffe fliegt.
function terranFighter(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent);
  const dark = darkMaterial();
  g.add(box(hull, 0.5, 0.34, 1.7, 0, 0, 0.1));
  g.add(nose(hull, 0.26, 0.95, 0, 0, 1.35));
  // Kanzel
  const canopy = box(glowMaterial(0x9fd4ff, 0.55), 0.28, 0.2, 0.55, 0, 0.19, 0.5);
  g.add(canopy);
  // Tragflächen, nach hinten gepfeilt
  for (const side of [-1, 1]) {
    g.add(box(hull, 1.15, 0.07, 0.62, side * 0.72, -0.02, -0.05, [0, side * -0.32, side * 0.12]));
    g.add(box(dark, 0.14, 0.16, 0.5, side * 1.22, 0.02, -0.18));
  }
  // Leitwerk
  g.add(box(hull, 0.07, 0.42, 0.4, 0, 0.24, -0.7));
  g.add(engine(dark, accent, 0.17, 0.42, -0.24, -0.02, -0.95));
  g.add(engine(dark, accent, 0.17, 0.42, 0.24, -0.02, -0.95));
  return g;
}

// Broadsword: schwerer Bomber, vier Düsen, Doppelleitwerk, Torpedowanne.
function terranBomber(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.5, rough: 0.5 });
  const dark = darkMaterial();
  g.add(box(hull, 0.78, 0.52, 2.1, 0, 0, 0));
  g.add(nose(hull, 0.38, 0.9, 0, 0, 1.5, 6));
  g.add(box(dark, 0.5, 0.2, 1.2, 0, -0.34, 0.1));
  for (const side of [-1, 1]) {
    g.add(box(hull, 0.9, 0.1, 0.9, side * 0.8, 0.04, -0.2));
    g.add(box(hull, 0.09, 0.5, 0.5, side * 1.14, 0.3, -0.6));
    g.add(engine(dark, accent, 0.16, 0.4, side * 0.55, -0.02, -1.2, 0.8));
    g.add(engine(dark, accent, 0.16, 0.4, side * 0.2, -0.02, -1.2, 0.8));
  }
  g.add(box(glowMaterial(0x9fd4ff, 0.5), 0.4, 0.22, 0.5, 0, 0.3, 0.7));
  return g;
}

// Gilgamesch: Korvette. Ein Rumpf, zwei Türme, drei Düsen.
function terranCorvette(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.68, rough: 0.35 });
  const dark = darkMaterial();
  g.add(box(hull, 0.9, 0.62, 3.4, 0, 0, 0));
  g.add(nose(hull, 0.44, 1.1, 0, 0, 2.25, 6));
  g.add(box(hull, 0.6, 0.34, 1.0, 0, 0.44, -0.4));
  for (const side of [-1, 1]) {
    g.add(box(dark, 0.24, 0.24, 0.24, side * 0.5, 0.36, 0.7));
    g.add(box(dark, 0.06, 0.06, 0.5, side * 0.5, 0.36, 0.95));
    g.add(box(hull, 0.34, 0.1, 1.1, side * 0.66, -0.08, -0.6, [0, 0, side * 0.25]));
    g.add(box(glowMaterial(accent, 0.5), 0.03, 0.07, 2.2, side * 0.46, 0.04, 0.2));
  }
  g.add(engine(dark, accent, 0.2, 0.5, 0, -0.05, -1.9, 1.1));
  g.add(engine(dark, accent, 0.15, 0.45, -0.42, -0.05, -1.85, 0.9));
  g.add(engine(dark, accent, 0.15, 0.45, 0.42, -0.05, -1.85, 0.9));
  runningLights(g, 0.55, 0.2);
  return g;
}

// Tallahassee: Kreuzer. Hammerkopfbug, Türme auf dem Rücken, vier Düsen.
function terranCruiser(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.7, rough: 0.32 });
  const dark = darkMaterial();
  g.add(box(hull, 1.15, 0.8, 4.6, 0, 0, 0));
  g.add(box(hull, 2.0, 0.5, 1.1, 0, 0.05, 2.5));          // Hammerkopf
  g.add(nose(hull, 0.42, 0.9, 0, 0.05, 3.4, 6));
  g.add(box(hull, 0.75, 0.45, 1.7, 0, 0.6, -0.6));        // Aufbau
  g.add(box(glowMaterial(0xbfe4ff, 0.45), 0.5, 0.14, 0.3, 0, 0.78, 0.15));
  for (const side of [-1, 1]) {
    for (const z of [1.4, 0.2, -1.4]) {
      g.add(box(dark, 0.3, 0.26, 0.3, side * 0.42, 0.5, z));
      g.add(box(dark, 0.07, 0.07, 0.6, side * 0.42, 0.52, z + 0.4));
    }
    g.add(box(hull, 0.5, 0.14, 1.6, side * 0.82, -0.12, -1.0, [0, 0, side * 0.2]));
    g.add(box(glowMaterial(accent, 0.5), 0.03, 0.08, 3.0, side * 0.59, 0.06, 0.2));
    g.add(engine(dark, accent, 0.24, 0.6, side * 0.3, 0.12, -2.6, 1.2));
    g.add(engine(dark, accent, 0.24, 0.6, side * 0.3, -0.28, -2.6, 1.2));
  }
  runningLights(g, 1.0, 2.4);
  return g;
}

// Bengal: der Träger. Langes Deck, Insel an Steuerbord, offenes Hangartor am
// Bug, vier schwere Düsen - das Schiff, um das der Krieg geführt wird.
function terranCarrier(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.66, rough: 0.4 });
  const dark = darkMaterial();
  g.add(box(hull, 1.7, 1.0, 7.2, 0, -0.25, 0));
  g.add(box(dark, 1.3, 0.5, 1.2, 0, -0.25, 3.7));         // Hangarmaul
  g.add(box(glowMaterial(accent, 0.8), 1.0, 0.34, 0.1, 0, -0.25, 4.28));
  // Flugdeck mit Landebahn
  g.add(box(hull, 2.5, 0.16, 6.2, 0, 0.34, 0.2));
  const deck = box(glowMaterial(accent, 0.75), 0.5, 0.03, 5.2, -0.35, 0.45, 0.2);
  g.add(deck);
  // Insel mit Brücke und Mast
  g.add(box(hull, 0.5, 0.62, 1.5, 0.86, 0.72, -0.6));
  g.add(box(glowMaterial(0xbfe4ff, 0.55), 0.42, 0.16, 0.6, 0.9, 0.9, -0.3));
  g.add(box(dark, 0.06, 0.7, 0.06, 0.86, 1.35, -1.0));
  // Katapultwülste und Geschützstände
  for (const side of [-1, 1]) {
    g.add(box(hull, 0.3, 0.24, 2.6, side * 1.4, 0.1, 0.4));
    g.add(box(glowMaterial(accent, 0.55), 0.04, 0.1, 4.4, side * 0.86, 0.1, 0));
    for (const z of [2.0, -0.4, -2.2]) {
      g.add(box(dark, 0.24, 0.2, 0.28, side * 1.35, 0.42, z));
    }
    g.add(engine(dark, accent, 0.3, 0.7, side * 0.45, -0.2, -3.9, 1.3));
    g.add(engine(dark, accent, 0.22, 0.6, side * 1.15, -0.2, -3.8, 1.0));
  }
  runningLights(g, 1.35, 3.2);
  return g;
}

// Marineinfanterie fliegt in Landungsschiffen: kastig, mit Bugklappe.
function terranTransport(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.45, rough: 0.6 });
  const dark = darkMaterial();
  g.add(box(hull, 1.0, 0.8, 2.6, 0, 0, 0));
  g.add(box(dark, 0.8, 0.6, 0.3, 0, -0.05, 1.42));
  g.add(box(hull, 0.5, 0.3, 0.6, 0, 0.5, 0.7));
  for (const side of [-1, 1]) {
    g.add(box(dark, 0.22, 0.5, 1.4, side * 0.65, 0, -0.3));
    g.add(engine(dark, accent, 0.2, 0.45, side * 0.65, 0, -1.35, 0.8));
  }
  return g;
}

// --- Klanwerften von Kilrah ---------------------------------------------

// Dralthi: der fliegende Flügel. Kein Rumpf, den man von vorn trifft - nur
// eine Sichel mit einer Kanzel in der Mitte.
function kilrathiFighter(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.55, rough: 0.45 });
  const dark = darkMaterial();
  const pod = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), hull);
  pod.scale.set(1, 0.62, 1.5);
  g.add(pod);
  g.add(nose(hull, 0.22, 0.7, 0, 0, 0.75, 5));
  for (const side of [-1, 1]) {
    // Der Flügel in zwei Segmenten, nach vorn gebogen wie eine Klaue.
    g.add(box(hull, 1.0, 0.08, 0.62, side * 0.6, 0, 0.05, [0, side * 0.42, side * 0.1]));
    g.add(box(hull, 0.62, 0.07, 0.44, side * 1.28, 0.06, 0.42, [0, side * 0.75, side * 0.3]));
    g.add(box(dark, 0.1, 0.2, 0.3, side * 1.5, 0.14, 0.55));
  }
  g.add(engine(dark, accent, 0.18, 0.4, 0, 0, -0.72));
  return g;
}

// Paktahn: der Bomber des Imperiums. Breit, schwer, mit Torpedoklauen.
function kilrathiBomber(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.5, rough: 0.5 });
  const dark = darkMaterial();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), hull);
  body.scale.set(1.1, 0.7, 1.9);
  g.add(body);
  g.add(nose(hull, 0.3, 0.8, 0, 0, 1.3, 5));
  for (const side of [-1, 1]) {
    g.add(box(hull, 1.1, 0.1, 0.8, side * 0.8, -0.05, -0.1, [0, side * 0.3, side * 0.18]));
    g.add(box(dark, 0.16, 0.16, 0.9, side * 1.2, -0.14, 0.1));  // Torpedoklaue
    g.add(engine(dark, accent, 0.19, 0.45, side * 0.34, 0, -1.2, 0.9));
  }
  return g;
}

// Kamekh: die Korvette. Eine Klinge mit Rückenkamm.
function kilrathiCorvette(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.6, rough: 0.42 });
  const dark = darkMaterial();
  g.add(box(hull, 0.8, 0.5, 3.2, 0, 0, 0, [0, 0, 0]));
  g.add(nose(hull, 0.45, 1.6, 0, 0, 2.3, 4));
  g.add(box(hull, 0.12, 0.5, 2.0, 0, 0.45, -0.3));            // Kamm
  for (const side of [-1, 1]) {
    g.add(box(hull, 0.6, 0.1, 1.2, side * 0.6, -0.12, -0.8, [0, 0, side * 0.35]));
    g.add(box(dark, 0.18, 0.18, 0.22, side * 0.35, 0.3, 0.9));
    g.add(engine(dark, accent, 0.2, 0.5, side * 0.28, -0.05, -1.8, 1.1));
  }
  return g;
}

// Fralthi: der Kreuzer. Ein Keil mit Kamm und aufgesetzten Türmen.
function kilrathiCruiser(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.62, rough: 0.4 });
  const dark = darkMaterial();
  g.add(box(hull, 1.3, 0.85, 4.4, 0, 0, 0));
  g.add(nose(hull, 0.7, 2.2, 0, 0, 3.2, 4));
  g.add(box(hull, 0.16, 0.9, 3.0, 0, 0.8, -0.4));             // Rückenkamm
  g.add(box(hull, 0.16, 0.6, 2.0, 0, -0.65, -0.6));           // Kiel
  for (const side of [-1, 1]) {
    g.add(box(hull, 0.9, 0.14, 1.8, side * 0.9, -0.1, -0.9, [0, 0, side * 0.3]));
    for (const z of [1.2, -0.6]) {
      g.add(box(dark, 0.28, 0.24, 0.3, side * 0.45, 0.5, z));
      g.add(box(dark, 0.07, 0.07, 0.55, side * 0.45, 0.52, z + 0.4));
    }
    g.add(engine(dark, accent, 0.26, 0.62, side * 0.36, 0, -2.5, 1.2));
  }
  runningLights(g, 0.85, 2.0);
  return g;
}

// Snakeir: der Klanträger. Eine Klinge mit Hangarschlund und Kammrücken.
function kilrathiCarrier(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.6, rough: 0.45 });
  const dark = darkMaterial();
  g.add(box(hull, 2.0, 1.2, 6.4, 0, 0, 0));
  g.add(nose(hull, 1.0, 2.6, 0, 0, 4.4, 4));
  g.add(box(hull, 0.2, 1.5, 4.4, 0, 1.2, -0.6));              // Rückenkamm
  g.add(box(dark, 1.4, 0.7, 1.0, 0, -0.35, 3.0));             // Hangarschlund
  g.add(box(glowMaterial(accent, 0.8), 1.1, 0.44, 0.1, 0, -0.35, 3.52));
  g.add(box(glowMaterial(accent, 0.5), 0.06, 0.1, 3.6, 0, 1.9, -0.6));
  for (const side of [-1, 1]) {
    g.add(box(hull, 1.4, 0.2, 2.6, side * 1.4, -0.2, -0.6, [0, 0, side * 0.28]));
    for (const z of [1.8, 0.2, -1.6]) {
      g.add(box(dark, 0.3, 0.3, 0.34, side * 0.8, 0.66, z));
    }
    g.add(engine(dark, accent, 0.36, 0.8, side * 0.6, -0.1, -3.6, 1.3));
    g.add(engine(dark, accent, 0.24, 0.6, side * 1.5, -0.3, -3.4, 1.0));
  }
  runningLights(g, 1.6, 2.6);
  return g;
}

function kilrathiTransport(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.45, rough: 0.6 });
  const dark = darkMaterial();
  g.add(box(hull, 1.1, 0.9, 2.4, 0, 0, 0));
  g.add(nose(hull, 0.6, 1.2, 0, 0, 1.7, 4));
  g.add(box(hull, 0.14, 0.5, 1.6, 0, 0.68, -0.2));
  for (const side of [-1, 1]) {
    g.add(engine(dark, accent, 0.22, 0.5, side * 0.4, 0, -1.35, 0.9));
  }
  return g;
}

// --- Firekka: Schwingen statt Rümpfe ------------------------------------
function firekkanFighter(colour, accent) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.3, rough: 0.65 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), hull);
  body.scale.set(0.9, 0.8, 1.8);
  g.add(body);
  g.add(nose(hull, 0.18, 0.8, 0, 0.05, 0.9, 5));
  for (const side of [-1, 1]) {
    // Drei Federn je Seite, nach hinten gefächert.
    for (let i = 0; i < 3; i++) {
      g.add(box(hull, 1.0 - i * 0.18, 0.05, 0.22, side * (0.55 + i * 0.12), i * 0.06,
        -0.1 - i * 0.28, [0, side * (0.25 + i * 0.12), side * (0.12 + i * 0.08)]));
    }
  }
  g.add(box(hull, 0.06, 0.4, 0.5, 0, 0.28, -0.6));
  g.add(engine(darkMaterial(), accent, 0.13, 0.3, 0, 0, -0.85, 0.7));
  return g;
}

function firekkanCapital(colour, accent, scale = 1) {
  const g = new THREE.Group();
  const hull = hullMaterial(colour, accent, { metal: 0.35, rough: 0.6 });
  const dark = darkMaterial();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7 * scale, 12, 9), hull);
  body.scale.set(1, 0.7, 2.6);
  g.add(body);
  g.add(nose(hull, 0.5 * scale, 1.6 * scale, 0, 0, 2.2 * scale, 6));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      g.add(box(hull, (1.9 - i * 0.3) * scale, 0.08, 0.4 * scale,
        side * (1.0 + i * 0.16) * scale, i * 0.1, (-0.3 - i * 0.5) * scale,
        [0, side * (0.2 + i * 0.1), side * (0.1 + i * 0.06)]));
    }
    g.add(engine(dark, accent, 0.2 * scale, 0.5 * scale, side * 0.5 * scale, 0, -2.2 * scale, 1));
  }
  return g;
}

// --- Der Schwarm: gewachsen, nicht gebaut -------------------------------
function nephilimShip(colour, accent, scale = 1) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: colour, emissive: new THREE.Color(accent).multiplyScalar(0.4),
    emissiveIntensity: 0.5, metalness: 0.1, roughness: 0.85, flatShading: true,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6 * scale, 10, 8), skin);
  body.scale.set(1, 0.8, 1.8);
  g.add(body);
  g.add(nose(skin, 0.34 * scale, 1.1 * scale, 0, 0, 1.4 * scale, 6));
  // Ranken statt Flügel
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07 * scale, 0.02 * scale, 1.5 * scale, 5), skin,
    );
    arm.position.set(Math.cos(a) * 0.45 * scale, Math.sin(a) * 0.35 * scale, -0.9 * scale);
    arm.rotation.set(Math.PI / 2 + 0.25, 0, a);
    g.add(arm);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 8, 6), glowMaterial(accent, 0.8));
  core.position.z = 0.3 * scale;
  g.add(core);
  return g;
}

// --- Auswahl --------------------------------------------------------------
const BUILDERS = {
  terran: {
    jaeger: terranFighter,
    bomber: terranBomber,
    korvette: terranCorvette,
    kreuzer: terranCruiser,
    traeger: terranCarrier,
    marines: terranTransport,
    wache: terranCorvette,
  },
  kilrathi: {
    jaeger: kilrathiFighter,
    bomber: kilrathiBomber,
    korvette: kilrathiCorvette,
    kreuzer: kilrathiCruiser,
    traeger: kilrathiCarrier,
    marines: kilrathiTransport,
    wache: kilrathiCorvette,
  },
  firekkan: {
    jaeger: firekkanFighter,
    bomber: (c, a) => firekkanCapital(c, a, 0.55),
    korvette: (c, a) => firekkanCapital(c, a, 0.8),
    kreuzer: (c, a) => firekkanCapital(c, a, 1.1),
    traeger: (c, a) => firekkanCapital(c, a, 1.5),
    marines: (c, a) => firekkanCapital(c, a, 0.6),
    wache: (c, a) => firekkanCapital(c, a, 0.7),
  },
  nephilim: {
    jaeger: (c, a) => nephilimShip(c, a, 0.7),
    bomber: (c, a) => nephilimShip(c, a, 1),
    korvette: (c, a) => nephilimShip(c, a, 1.3),
    kreuzer: (c, a) => nephilimShip(c, a, 1.8),
    traeger: (c, a) => nephilimShip(c, a, 2.6),
    marines: (c, a) => nephilimShip(c, a, 1),
    wache: (c, a) => nephilimShip(c, a, 1.1),
  },
};

// Wie lang ein Schiff seiner Klasse nach ist - daran wird der Maßstab auf der
// Karte gerechnet, damit ein Träger neben einem Jäger nach Träger aussieht.
export const SHIP_LENGTH = {
  jaeger: 3, bomber: 3.4, korvette: 5, kreuzer: 6.6, traeger: 9, marines: 3.6, wache: 4,
};

// Ein Modell für Fraktionsart und Rolle. Es wird einmal gebaut und danach
// geklont: Geometrie und Werkstoff teilen sich alle Kopien.
// `detail: 'low'` lässt Schleppfahnen und Positionslichter weg. Das kostet
// wenig Bild und viel Rechenzeit - im Gefecht fliegen zwei Dutzend Schiffe
// gleichzeitig, und durchsichtige Flächen sind das Teuerste daran.
export function shipModel(kind, role, colour, accent, { scale = 1, detail = 'full' } = {}) {
  const key = `${kind}|${role}|${colour}|${accent}`;
  let master = modelCache.get(key);
  if (!master) {
    const table = BUILDERS[kind] || BUILDERS.terran;
    const build = table[role] || table.jaeger;
    master = build(colour, accent);
    modelCache.set(key, master);
  }
  const clone = master.clone(true);
  if (detail === 'low') {
    const drop = [];
    clone.traverse((node) => {
      if (node.name === 'flamme' || node.name === 'licht') drop.push(node);
    });
    for (const node of drop) node.parent.remove(node);
  }
  if (scale !== 1) clone.scale.setScalar(scale);
  return clone;
}

// Die schwerste Klasse einer Flotte - sie gibt der Flotte ihr Gesicht.
const WEIGHT = ['traeger', 'kreuzer', 'korvette', 'bomber', 'marines', 'jaeger'];
export function flagshipRole(fleet) {
  for (const role of WEIGHT) {
    if (fleet.units.some((u) => u.role === role && u.count > 0)) return role;
  }
  return 'jaeger';
}
