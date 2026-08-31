// --- Die Schlacht von Nahem ------------------------------------------------
// Ein eigenes kleines Schaubild neben der Feldzugskarte: zwei Linien treten
// gegeneinander an, und was der Bericht in Zahlen sagt, ist hier zu sehen.
//
// Diese erste Fassung ist mit Absicht sehr einfach gehalten. Jeder Block ist
// ein Quader, jede Waffengattung eine Farbe und eine Form, die Mauer ein Riegel
// aus Kästen. Nichts davon würfelt: gezeigt wird ausschließlich, was in
// `combat.js` bereits ausgerechnet wurde - Runde für Runde, Verlust für
// Verlust. Das Schaubild entscheidet nichts, es erzählt nur.
//
// Es hängt an einer eigenen Leinwand, einer eigenen Szene und einem eigenen
// Renderer; mit der Karte teilt es nur die three.js-Bibliothek. Beim Schließen
// wird alles wieder abgeräumt, damit ein Feldzug mit dreißig Schlachten nicht
// dreißig Renderer offen hält.

import { COMBAT_ROLES, SHIP_ROLE, TILE_TYPES, unitDefs, transportCount } from './data.js';
import { emblemTexture } from './scene3d.js';
import { weatherInfo } from './weather.js';

// Wie viele Mann ein Klotz darstellt und wie viele Klötze eine Seite höchstens
// bekommt. Ein Heer von 2.000 Mann als 2.000 Würfel zu zeichnen sähe nicht
// genauer aus, es liefe nur langsamer.
const MEN_PER_BLOCK = 15;
const MAX_BLOCKS = 110;

// Die Bühne in Weltmaßen: die beiden Linien stehen sich über diese Entfernung
// gegenüber und treffen sich in der Mitte.
const FIELD_WIDTH = 46;
const START_GAP = 16;
// Wie nah sich die beiden Fronten kommen. Solange auf dem Feld Quader
// standen, durfte hier eine Lücke bleiben; Gestalten, die sich mit dem Speer
// erreichen sollen, müssen dicht aneinander stehen.
const CLASH_GAP = 1.6;
// Zur See ist mehr Platz nötig: ein Schiff ist länger als ein Mann.
const CLASH_GAP_SEE = 3.3;

// Wie lange die Abschnitte dauern (Sekunden).
const T_MARCH = 1.5;
const T_ROUND = 1.15;
const T_END = 2.2;

// Wie hoch eine Gestalt steht - daran hängt alles andere auf dem Feld.
const FIGURE = 1.0;

let schauRenderer = null;
let schauScene = null;
let schauCamera = null;
let schauRaf = null;
let stage = null;      // was gerade läuft
let onFinished = null; // was danach geschieht

// --- Aufbau ---------------------------------------------------------------

// Das Schaubild braucht einen zweiten WebGL-Zusammenhang neben dem der Karte,
// und den gibt nicht jedes Gerät her. Manche Browser - allen voran Safari auf
// dem Telefon - halten nur einen einzigen offen: der zweite wird stillschweigend
// verweigert, und three.js stolpert dann über die erste Abfrage an ihm
// ("null is not an object ... getShaderPrecisionFormat"). Das riss bisher das
// ganze Spiel mit: der Fehler lief bis ans Fenster durch, und dort steht die
// Tafel "Pax Aeterna konnte nicht starten" - mitten im laufenden Feldzug, nur
// weil ein Angriff angesehen werden sollte.
//
// Deshalb wird hier erst geprüft und dann gebaut, und beides in einem Netz:
// gibt das Gerät keinen zweiten Zusammenhang her, kommt der Angriff ohne
// Schaubild aus. Die Schlacht selbst ist davon unberührt - sie ist längst
// ausgefochten, wenn dieses Fenster aufgeht.
function makeRenderer(canvas) {
  try {
    // Erst fragen: gibt der Browser überhaupt einen Zusammenhang her, und
    // antwortet er auf die Frage, an der three.js sonst zerbricht?
    // Mit denselben Merkmalen, die three.js gleich anfordert: ein Browser gibt
    // für dieselbe Leinwand denselben Zusammenhang zurück und überliest die
    // zweite Wunschliste. Fragte man hier ohne `preserveDrawingBuffer`, wäre
    // es später auch nicht gesetzt - und jedes gegriffene Bild zeigte
    // irgendeinen früheren Zustand.
    const wunsch = {
      alpha: false, depth: true, stencil: true, antialias: true,
      premultipliedAlpha: true, preserveDrawingBuffer: true,
    };
    const probe = canvas.getContext('webgl2', wunsch)
      || canvas.getContext('webgl', wunsch)
      || canvas.getContext('experimental-webgl', wunsch);
    if (!probe || typeof probe.getShaderPrecisionFormat !== 'function') return null;
    if (!probe.getShaderPrecisionFormat(probe.VERTEX_SHADER, probe.HIGH_FLOAT)) return null;
    // `preserveDrawingBuffer` kostet auf dieser kleinen Leinwand kaum etwas und
    // sorgt dafür, dass das gezeigte Bild auch außerhalb des Zeichenaufrufs noch
    // dasteht - sonst zeigt jeder Griff nach dem Bild (ein Bildschirmfoto, eine
    // Prüfung) irgendeinen früheren Zustand statt des aktuellen.
    const r = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, preserveDrawingBuffer: true,
    });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = false;
    return r;
  } catch (fehler) {
    return null;
  }
}

function makeLights(target, wetter) {
  // Unter einer Wolkendecke steht die Sonne nicht wie an einem klaren Tag:
  // im Regen und im Sandsturm fällt das Licht flach und stumpf.
  const trueb = wetter ? 0.6 : 1;
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.05 * trueb);
  sun.position.set(18, 30, 14);
  target.add(sun);
  target.add(new THREE.HemisphereLight(0xbfd4ff, 0x4a4030, wetter ? 0.95 : 0.75));
}

// Der Boden in der Farbe des Geländes, auf dem wirklich gefochten wurde.
// --- Der Boden hat Relief -------------------------------------------------
// Das Feld war eine Ebene, auch wenn im Bericht "Hügel · +2 Verteidigung"
// stand. Jetzt hat es Relief - und zwar genau das, was der Bericht sagt: wo
// der Verteidiger einen Geländevorteil hat, steht er höher, und der Angreifer
// muss den Hang hinauf. Dazu eine leichte Welle, damit die Fläche keine
// Tischplatte ist.
//
// Die Höhe wird als Formel geführt, nicht als Datenfeld: die Gestalten, die
// Mauer, die Fahnen und der Boden selbst fragen dieselbe Funktion, und alles
// steht auf demselben Grund.
function makeHeightField(terrainType, naval, terrainBonus) {
  if (naval) return () => 0;
  // Der Hang: er steigt zum Verteidiger hin (+X). Ein Punkt Geländevorteil
  // ist gut einen Meter Höhenunterschied über das Feld.
  const hang = Math.min(3, (terrainBonus || 0) * 0.75);
  // Die Welligkeit hängt am Gelände: die Ebene ist eben, der Wald leicht
  // bewegt, Hügel und Gebirge sind es deutlich.
  const welle = terrainType === 'hills' ? 0.5
    : terrainType === 'mountain' ? 0.8
      : terrainType === 'forest' ? 0.28 : 0.14;
  return (x, z) => {
    const steigung = hang * Math.tanh(x / 14);
    const boden = welle * (Math.sin(x * 0.115 + 1.7) + Math.cos(z * 0.097 - 0.6)) * 0.5;
    return steigung + boden;
  };
}

function makeGround(terrainType, naval, hoeheBei) {
  const def = TILE_TYPES[terrainType] || TILE_TYPES.plains;
  const color = naval ? TILE_TYPES.water.color : def.color;
  // Der Boden reicht weit über das Bild hinaus: sonst sieht man seine Kante,
  // und eine Schlacht auf einem schwebenden Teppich sieht albern aus.
  const geometry = new THREE.PlaneGeometry(FIELD_WIDTH * 6, FIELD_WIDTH * 5, 90, 70);
  if (!naval) {
    // Die Fläche liegt noch flach in der X-Y-Ebene; gekippt wird sie gleich.
    // Deshalb ist die zweite Achse hier y und wird zu -z.
    const lage = geometry.attributes.position;
    for (let i = 0; i < lage.count; i++) {
      lage.setZ(i, hoeheBei(lage.getX(i), -lage.getY(i)));
    }
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(
    geometry, new THREE.MeshLambertMaterial({ color: new THREE.Color(color) })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Die Mauer, wenn hinter einer gefochten wurde: ein Riegel quer vor der
// Verteidigerlinie. Je stärker die Befestigung, desto höher - und aus dem,
// woraus sie gebaut ist: eine Palisade ist eine Reihe gespitzter Stämme, eine
// Stadtmauer ein durchgehender Quaderriegel mit Zinnenkranz und Torhaus.
const MAUER_LAENGE = 13;
const TOR_BREITE = 2;

// Wie tief der Ort hinter seiner Frontmauer liegt, und wie breit er ist.
const ORT_TIEFE = 12;

// Ein Tor: zwei Flügel aus Bohlen und der Sturz darüber. `dicke` ist die Stärke
// der Mauer, in der es sitzt, `laengs` die Achse, entlang der es sich öffnet.
function makeGate(hoehe, dicke, breite, material) {
  const gruppe = new THREE.Group();
  const holz = new THREE.MeshLambertMaterial({ color: 0x5b4223 });
  for (const seite of [-1, 1]) {
    const fluegel = new THREE.Mesh(
      new THREE.BoxGeometry(dicke, hoehe * 0.72, breite / 2 - 0.04), holz
    );
    fluegel.position.set(0, hoehe * 0.36, seite * breite / 4);
    gruppe.add(fluegel);
  }
  const sturz = new THREE.Mesh(
    new THREE.BoxGeometry(dicke * 1.06, hoehe * 0.28, breite), material
  );
  sturz.position.set(0, hoehe * 0.86, 0);
  gruppe.add(sturz);
  return gruppe;
}

// Ein Mauerlauf mit einem Tor in der Mitte, gebaut entlang der z-Achse und
// danach als Ganzes gedreht. Stein bekommt Zinnen, Holz gespitzte Stämme.
function makeWallRun(laenge, hoehe, stein, material, torBreite) {
  const lauf = new THREE.Group();
  const halb = laenge / 2;
  const dicke = stein ? 1 : 0.34;
  if (stein) {
    for (const seite of [-1, 1]) {
      const stueck = (laenge - torBreite) / 2;
      const mauer = new THREE.Mesh(new THREE.BoxGeometry(dicke, hoehe, stueck), material);
      mauer.position.set(0, hoehe / 2, seite * (torBreite / 2 + stueck / 2));
      lauf.add(mauer);
    }
    const zinne = new THREE.BoxGeometry(dicke * 1.14, 0.46, 0.42);
    for (let z = -halb + 0.3; z <= halb; z += 0.84) {
      if (Math.abs(z) < torBreite / 2) continue;
      const stueck = new THREE.Mesh(zinne, material);
      stueck.position.set(0, hoehe + 0.23, z);
      lauf.add(stueck);
    }
  } else {
    // Die Palisade: gespitzte Stämme, dicht an dicht. Sie stehen nicht in
    // Reih und Glied - eine Palisade wird gerammt, nicht gemauert.
    const stamm = new THREE.CylinderGeometry(0.17, 0.19, hoehe, 6);
    const spitze = new THREE.ConeGeometry(0.19, 0.34, 6);
    for (let z = -halb; z <= halb; z += 0.34) {
      if (Math.abs(z) < torBreite / 2) continue;
      const wank = (Math.random() - 0.5) * 0.06;
      const pfahl = new THREE.Mesh(stamm, material);
      pfahl.position.set((Math.random() - 0.5) * 0.08, hoehe / 2, z);
      pfahl.rotation.x = wank;
      lauf.add(pfahl);
      const kopf = new THREE.Mesh(spitze, material);
      kopf.position.set(pfahl.position.x, hoehe + 0.17, z);
      kopf.rotation.x = wank;
      lauf.add(kopf);
    }
  }
  lauf.add(makeGate(hoehe, dicke, torBreite, material));
  return lauf;
}

// Der Ort hinter der Mauer: ein paar Häuser mit Satteldach, damit der Sturm
// auf etwas geht und nicht auf eine Wand vor leerem Gras.
function makeTownHouses(tiefe, breite, farbe) {
  const gruppe = new THREE.Group();
  const wand = new THREE.MeshLambertMaterial({ color: 0xd8c9a3 });
  const dach = new THREE.MeshLambertMaterial({ color: new THREE.Color(farbe) });
  const rng = (n) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
  let n = 1;
  for (let reihe = 0; reihe < 3; reihe++) {
    const x = 4.4 + reihe * 3.1;
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * (breite / 4.6) + (rng(n++) - 0.5) * 0.7;
      const b = 1.5 + rng(n++) * 0.7;
      const t = 1.2 + rng(n++) * 0.5;
      const h = 1.1 + rng(n++) * 0.5;
      const haus = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), wand);
      haus.position.set(x + (rng(n++) - 0.5) * 0.6, h / 2, z);
      gruppe.add(haus);
      const first = new THREE.Mesh(new THREE.ConeGeometry(Math.max(b, t) * 0.72, 0.6, 4), dach);
      first.position.set(haus.position.x, h + 0.3, z);
      first.rotation.y = Math.PI / 4;
      gruppe.add(first);
    }
  }
  return gruppe;
}

// Der Ort, wie ihn der Angreifer sieht: eine geschlossene Anlage mit vier
// Toren, Türmen an den Ecken und Häusern darin - nicht mehr ein Mauerstück,
// das links und rechts ins Nichts läuft. Der Nullpunkt der Gruppe bleibt die
// Mitte der Frontmauer; alles andere liegt dahinter, in +x.
function makeWall(multiplier, color, hausFarbe) {
  const group = new THREE.Group();
  const hoehe = multiplier >= 2 ? 3.2 : multiplier >= 1.6 ? 2.4 : 1.7;
  const stein = multiplier >= 2;
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const tiefe = ORT_TIEFE;

  // Die Häuser zuerst, damit die Mauern davor stehen.
  const haeuser = makeTownHouses(tiefe, MAUER_LAENGE, hausFarbe || color);
  group.add(haeuser);

  // Vier Mauerläufe mit je einem Tor: vorn, hinten, links, rechts.
  const front = makeWallRun(MAUER_LAENGE, hoehe, stein, material, TOR_BREITE);
  group.add(front);
  const hinten = makeWallRun(MAUER_LAENGE, hoehe, stein, material, TOR_BREITE);
  hinten.position.x = tiefe;
  group.add(hinten);
  for (const seite of [-1, 1]) {
    const flanke = makeWallRun(tiefe, hoehe, stein, material, TOR_BREITE);
    flanke.rotation.y = Math.PI / 2;
    flanke.position.set(tiefe / 2, 0, seite * MAUER_LAENGE / 2);
    group.add(flanke);
  }

  // Türme an den vier Ecken - und zwei am vorderen Tor, denn dort geht der
  // Sturm hin.
  const turmForm = stein
    ? new THREE.CylinderGeometry(0.75, 0.85, hoehe * 1.35, 8)
    : new THREE.BoxGeometry(1.3, hoehe * 1.28, 1.3);
  const stellen = [
    [0, -MAUER_LAENGE / 2], [0, MAUER_LAENGE / 2],
    [tiefe, -MAUER_LAENGE / 2], [tiefe, MAUER_LAENGE / 2],
    [0, -(TOR_BREITE / 2 + 0.55)], [0, TOR_BREITE / 2 + 0.55],
  ];
  for (const [x, z] of stellen) {
    const turm = new THREE.Mesh(turmForm, material);
    turm.position.set(x, hoehe * (stein ? 0.675 : 0.64), z);
    group.add(turm);
  }

  // Der Wehrgang: der Erdwall hinter der Frontmauer, auf dem die Verteidiger
  // stehen. Ohne ihn stünden sie hinter der Mauer und niemand sähe, wie ihre
  // Reihen dünner werden - und gestanden haben sie dort auch wirklich.
  const gang = hoehe * 0.62;
  const wehrgang = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, gang, MAUER_LAENGE),
    new THREE.MeshLambertMaterial({ color: stein ? 0x8c8377 : 0x6b5b45 })
  );
  wehrgang.position.set(1.5, gang / 2, 0);
  group.add(wehrgang);

  group.userData = { hoehe, gang };
  return group;
}

// --- Sturmgerät -----------------------------------------------------------
// Vor der Mauer gab es Leitern und sonst nichts. Wer eine Stadt nimmt, bringt
// mehr mit: einen Widder unter seinem Schutzdach, einen Turm, aus dem heraus
// man auf die Brüstung tritt, und ein Katapult hinter der Linie. Alles rollt
// heran, während gefochten wird - und nichts davon entscheidet etwas: was das
// Tor kostet, steht längst im Bericht.
function makeRam(scale = 1) {
  const gruppe = new THREE.Group();
  const holz = new THREE.MeshLambertMaterial({ color: 0x6b4f2c });
  const dunkel = new THREE.MeshLambertMaterial({ color: 0x4a3620 });
  // Das Schutzdach über dem Widder - ohne es käme keine Mannschaft ans Tor.
  // Es ist ein Satteldach, kein Brett: ein flaches Dach auf vier Beinen sah
  // aus wie ein Tisch, der vor das Tor gestellt wurde.
  for (const seite of [-1, 1]) {
    const flaeche = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.0), holz);
    flaeche.position.set(0, 1.32, seite * 0.4);
    flaeche.rotation.x = seite * -0.55;
    gruppe.add(flaeche);
  }
  // Der Firstbalken schließt die beiden Hälften oben ab.
  const first = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 0.16), dunkel);
  first.position.y = 1.56;
  gruppe.add(first);
  // Und die Giebel schließen es vorn und hinten.
  for (const x of [-1.1, 1.1]) {
    const giebel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 1.5), dunkel);
    giebel.position.set(x, 1.24, 0);
    gruppe.add(giebel);
  }
  for (const x of [-0.9, 0.9]) {
    for (const z of [-0.6, 0.6]) {
      const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 0.12), dunkel);
      pfosten.position.set(x, 0.63, z);
      gruppe.add(pfosten);
      const rad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8), dunkel
      );
      rad.position.set(x, 0.22, z);
      rad.rotation.x = Math.PI / 2;
      gruppe.add(rad);
    }
  }
  // Der Widder selbst hängt an zwei Seilen und schwingt nach vorn.
  const balken = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.6, 7), holz);
  balken.rotation.z = Math.PI / 2;
  balken.position.set(0.2, 0.78, 0);
  const kopf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 6),
    new THREE.MeshLambertMaterial({ color: 0x8b8378 }));
  kopf.rotation.z = -Math.PI / 2;
  kopf.position.set(1.6, 0.78, 0);
  const widder = new THREE.Group();
  widder.add(balken, kopf);
  gruppe.add(widder);
  gruppe.userData = { widder };
  gruppe.scale.setScalar(scale);
  return gruppe;
}

function makeSiegeTower(hoehe, scale = 1) {
  const gruppe = new THREE.Group();
  const holz = new THREE.MeshLambertMaterial({ color: 0x6b4f2c });
  const dunkel = new THREE.MeshLambertMaterial({ color: 0x4a3620 });
  const h = hoehe + 0.9;
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.7), holz);
  kasten.position.y = h / 2 + 0.24;
  gruppe.add(kasten);
  // Die Fallbrücke oben, halb heruntergelassen.
  const bruecke = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.3), dunkel);
  bruecke.position.set(1.3, h * 0.86, 0);
  bruecke.rotation.z = -0.5;
  gruppe.add(bruecke);
  for (const z of [-0.75, 0.75]) {
    for (const x of [-0.5, 0.5]) {
      const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 8), dunkel);
      rad.position.set(x, 0.26, z);
      rad.rotation.x = Math.PI / 2;
      gruppe.add(rad);
    }
  }
  gruppe.scale.setScalar(scale);
  return gruppe;
}

function makeCatapult(scale = 1) {
  const gruppe = new THREE.Group();
  const holz = new THREE.MeshLambertMaterial({ color: 0x6b4f2c });
  const dunkel = new THREE.MeshLambertMaterial({ color: 0x4a3620 });
  const rahmen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.9), holz);
  rahmen.position.y = 0.35;
  gruppe.add(rahmen);
  for (const x of [-0.55, 0.55]) {
    const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), dunkel);
    rad.position.set(x, 0.2, 0.5);
    rad.rotation.x = Math.PI / 2;
    gruppe.add(rad);
    const rad2 = rad.clone();
    rad2.position.z = -0.5;
    gruppe.add(rad2);
  }
  const stuetze = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), holz);
  stuetze.position.set(-0.3, 0.75, 0);
  gruppe.add(stuetze);
  // Der Wurfarm dreht sich um seine Achse - deshalb eine eigene Gruppe.
  const arm = new THREE.Group();
  const balken = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), holz);
  balken.position.x = 0.6;
  arm.add(balken);
  const schale = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    dunkel);
  schale.position.set(1.3, 0.06, 0);
  arm.add(schale);
  arm.position.set(-0.3, 0.9, 0);
  gruppe.add(arm);
  gruppe.userData = { arm };
  gruppe.scale.setScalar(scale);
  return gruppe;
}

// --- Staub ----------------------------------------------------------------
// Über einer Kampflinie steht Staub. Er ist das Einzige im Schaubild, das
// keine Zahl im Bericht hat - aber ohne ihn sieht ein Handgemenge aus wie eine
// Aufstellung. Die Wolke ist ein Punktfeld mit einer weichen, im Browser
// gezeichneten Scheibe als Bild: eckige Punkte sähen aus wie Konfetti.
let staubBild = null;
function staubTextur() {
  if (staubBild) return staubBild;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const lauf = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  lauf.addColorStop(0, 'rgba(255,255,255,0.85)');
  lauf.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  lauf.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lauf;
  ctx.fillRect(0, 0, 64, 64);
  staubBild = new THREE.CanvasTexture(c);
  return staubBild;
}

const STAUB_KOERNER = 320;

function makeDust(farbe) {
  const lage = new Float32Array(STAUB_KOERNER * 3);
  const start = new Float32Array(STAUB_KOERNER * 3);
  for (let i = 0; i < STAUB_KOERNER; i++) {
    start[i * 3] = (Math.random() - 0.5) * 5;
    start[i * 3 + 1] = Math.random();
    start[i * 3 + 2] = (Math.random() - 0.5) * 17;
  }
  lage.set(start);
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(lage, 3));
  // Aufgewirbelter Boden ist heller als der Boden selbst - er hängt in der
  // Luft und fängt Licht. In der Farbe des Bodens gemischt sähe er aus wie
  // ein Fleck darauf.
  const ton = new THREE.Color(farbe).lerp(new THREE.Color('#efe6d2'), 0.62);
  const punkte = new THREE.Points(geometrie, new THREE.PointsMaterial({
    color: ton, size: 1.9, map: staubTextur(),
    transparent: true, opacity: 0, depthWrite: false,
  }));
  punkte.frustumCulled = false;
  punkte.userData = { start };
  return punkte;
}

// Der Staub steigt und verweht, solange gefochten wird.
function treibeStaub(punkte, t, dichte) {
  if (!punkte) return;
  punkte.material.opacity = Math.min(0.5, dichte * 0.5);
  if (dichte <= 0.01) return;
  const { start } = punkte.userData;
  const lage = punkte.geometry.attributes.position.array;
  for (let i = 0; i < lage.length; i += 3) {
    const eigen = start[i + 1];
    const steig = ((t * 0.35 + eigen) % 1);
    lage[i] = start[i] + Math.sin(t * 0.5 + eigen * 9) * 0.7;
    // Über den Köpfen, nicht auf dem Gras: unten sah er aus wie ein Fleck.
    lage[i + 1] = 0.6 + steig * 2.8;
    lage[i + 2] = start[i + 2];
  }
  punkte.geometry.attributes.position.needsUpdate = true;
}

// --- Das Gelände ----------------------------------------------------------
// Bisher war das Schlachtfeld eine eingefärbte Fläche: man las die Farbe und
// wusste, es war ein Wald. Jetzt steht der Wald auch da. Alles bleibt am
// Rand - hinter den Linien und weit auf den Flanken -, denn was zählt, ist
// wer noch steht, und davor darf kein Baum stehen.
//
// Der Maßstab ist derselbe wie auf der Karte: ein Baum ist zweieinhalb Mann
// hoch, ein Busch reicht bis zur Hüfte, ein Fels ist ein Fels.
const FELD_TIEFE = -18;   // dahinter beginnt die Landschaft
const FELD_FLANKE = 21;   // davor bleiben die Flanken frei

// Streut `anzahl` Plätze in die Landschaft und ruft für jeden zurück.
function streuePlaetze(anzahl, rng, fn, nurHinten = false) {
  for (let i = 0; i < anzahl; i++) {
    let x; let z;
    if (nurHinten) {
      // Was groß ist - ein Hügelrücken, eine Düne -, gehört weit nach hinten:
      // neben dem Feld stünde es quer vor der Schlacht.
      x = (rng() - 0.5) * 190;
      z = FELD_TIEFE - 22 - rng() * 60;
      fn(x, z, i);
      continue;
    }
    if (rng() < 0.55) {
      // Hinter den Linien, quer über die ganze Breite.
      x = (rng() - 0.5) * 150;
      z = FELD_TIEFE - rng() * 58;
    } else {
      // Auf den Flanken, links und rechts vom Feld.
      x = (rng() < 0.5 ? -1 : 1) * (FELD_FLANKE + rng() * 52);
      z = (rng() - 0.5) * 70;
    }
    fn(x, z, i);
  }
}

// Ein Baum in Kartengröße: Stamm und Krone, zu einer Geometrie verschmolzen.
function baumGeometrie(nadel) {
  const hoehe = 2.6;
  const teile = [
    teil(new THREE.CylinderGeometry(0.1, 0.16, hoehe * 0.4, 5), 0, hoehe * 0.2, 0),
  ];
  if (nadel) {
    teile.push(teil(new THREE.ConeGeometry(hoehe * 0.26, hoehe * 0.75, 6), 0, hoehe * 0.62, 0));
  } else {
    teile.push(teil(new THREE.SphereGeometry(hoehe * 0.3, 6, 5), 0, hoehe * 0.66, 0));
  }
  return mergeParts(teile);
}

// Alles, was auf einem Schlachtfeld herumsteht, in einer Wolke je Art.
function streuung(geometrie, farbe, anzahl, rng, platz, nurHinten = false) {
  const wolke = new THREE.InstancedMesh(
    geometrie, new THREE.MeshLambertMaterial({ color: new THREE.Color(farbe) }), anzahl
  );
  wolke.frustumCulled = false;
  const hilfe = new THREE.Object3D();
  let n = 0;
  streuePlaetze(anzahl, rng, (x, z, i) => {
    platz(hilfe, x, z, i, rng);
    hilfe.updateMatrix();
    wolke.setMatrixAt(n++, hilfe.matrix);
  }, nurHinten);
  return wolke;
}

// Das Gelände zum Geländetyp des Berichts. Zur See bleibt das Wasser leer:
// dort steht nichts herum, und der Horizont ist die Landschaft.
function makeField(terrainType, naval) {
  const group = new THREE.Group();
  if (naval) return group;
  // Immer dasselbe Gelände für dieselbe Schlacht: ein eigener kleiner
  // Zufall, aus dem Geländenamen gezogen.
  let saat = 1;
  for (const c of String(terrainType || 'plains')) saat = (saat * 31 + c.charCodeAt(0)) % 65536;
  const rng = () => {
    saat = (saat * 1103515245 + 12345) % 2147483648;
    return saat / 2147483648;
  };
  const setze = (hilfe, x, z, skala, drehung) => {
    hilfe.position.set(x, 0, z);
    hilfe.rotation.set(0, drehung, 0);
    hilfe.scale.setScalar(skala);
  };

  if (terrainType === 'forest') {
    group.add(streuung(baumGeometrie(false), '#3d6b34', 110, rng,
      (h, x, z, i, r) => setze(h, x, z, 0.8 + r() * 0.6, r() * 6.3)));
    group.add(streuung(baumGeometrie(true), '#2f5a30', 60, rng,
      (h, x, z, i, r) => setze(h, x, z, 0.85 + r() * 0.7, r() * 6.3)));
  } else if (terrainType === 'hills') {
    // Hügel: flache Kuppen, die sich hinter der Linie stapeln.
    const kuppe = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    group.add(streuung(kuppe, '#a08f5f', 18, rng, (h, x, z, i, r) => {
      h.position.set(x, -0.4, z);
      h.rotation.set(0, r() * 6.3, 0);
      h.scale.set(11 + r() * 20, 2.4 + r() * 4, 11 + r() * 18);
    }, true));
    group.add(streuung(baumGeometrie(false), '#5c7a3c', 26, rng,
      (h, x, z, i, r) => setze(h, x, z, 0.6 + r() * 0.4, r() * 6.3)));
  } else if (terrainType === 'desert') {
    // Dünen und ein paar Steine: mehr gibt die Wüste nicht her.
    const duene = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    group.add(streuung(duene, '#cdb47c', 16, rng, (h, x, z, i, r) => {
      h.position.set(x, -0.3, z);
      h.rotation.set(0, r() * 6.3, 0);
      h.scale.set(12 + r() * 22, 1.6 + r() * 2.6, 10 + r() * 16);
    }, true));
    group.add(streuung(new THREE.DodecahedronGeometry(0.5, 0), '#b09a6c', 22, rng,
      (h, x, z, i, r) => setze(h, x, z, 0.5 + r() * 1.1, r() * 6.3)));
  } else if (terrainType === 'mountain') {
    group.add(streuung(new THREE.ConeGeometry(1, 2.2, 5), '#7d7d7d', 34, rng,
      (h, x, z, i, r) => {
        h.position.set(x, 0, z);
        h.rotation.set(0, r() * 6.3, 0);
        h.scale.set(2 + r() * 6, 2 + r() * 7, 2 + r() * 6);
      }));
  } else {
    // Ebene: Büsche und ein einzelner Baum, damit die Weite eine Weite ist.
    group.add(streuung(new THREE.SphereGeometry(0.34, 5, 4), '#7c964f', 90, rng,
      (h, x, z, i, r) => {
        h.position.set(x, 0.1, z);
        h.rotation.set(0, r() * 6.3, 0);
        h.scale.set(0.8 + r() * 1.4, 0.5 + r() * 0.7, 0.8 + r() * 1.4);
      }));
    group.add(streuung(baumGeometrie(false), '#4f7a3a', 18, rng,
      (h, x, z, i, r) => setze(h, x, z, 0.8 + r() * 0.5, r() * 6.3)));
  }
  return group;
}

// --- Das Wetter -----------------------------------------------------------
// Dasselbe Wetter, unter dem der Feldzug steht, steht auch über der Schlacht:
// wenn der Bericht sagt, es habe geregnet und deshalb keine Salve gegeben,
// dann regnet es hier auch.
const SCHAU_WETTER = {
  rain: {
    anzahl: 900, farbe: '#bcd8f0', groesse: 0.3, fall: 34, drift: 5,
    himmel: '#4e5a63', nebel: [38, 105],
  },
  storm: {
    anzahl: 1300, farbe: '#d2e4f2', groesse: 0.32, fall: 46, drift: 18,
    himmel: '#3a444c', nebel: [30, 88],
  },
  snow: {
    anzahl: 750, farbe: '#ffffff', groesse: 0.5, fall: 6, drift: 4,
    himmel: '#8d98a1', nebel: [38, 105],
  },
  sand: {
    anzahl: 1200, farbe: '#f4dfae', groesse: 0.55, fall: 2, drift: 36,
    himmel: '#a98c58', nebel: [22, 66],
  },
  fog: { anzahl: 0, himmel: '#8b908c', nebel: [16, 58] },
  clouds: { anzahl: 0, himmel: '#57616a', nebel: [50, 125] },
  heat: {
    anzahl: 260, farbe: '#fff0cc', groesse: 0.6, fall: -3, drift: 7,
    himmel: '#9c8757', nebel: [48, 122],
  },
};

const WETTER_RAUM = 130;
const WETTER_HOEHE = 26;

// Die Wolke aus Tropfen, Flocken oder Sand. Bewegt wird sie rein rechnerisch
// aus der verstrichenen Zeit - kein eigener Takt, kein eigener Zustand.
function makeSchauWetter(look) {
  if (!look || !look.anzahl) return null;
  const lage = new Float32Array(look.anzahl * 3);
  for (let i = 0; i < look.anzahl; i++) {
    lage[i * 3] = (Math.random() - 0.5) * WETTER_RAUM;
    lage[i * 3 + 1] = Math.random() * WETTER_HOEHE;
    lage[i * 3 + 2] = (Math.random() - 0.5) * WETTER_RAUM;
  }
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(lage, 3));
  const punkte = new THREE.Points(geometrie, new THREE.PointsMaterial({
    color: new THREE.Color(look.farbe), size: look.groesse,
    transparent: true, opacity: 0.8, depthWrite: false,
  }));
  punkte.frustumCulled = false;
  punkte.userData = { start: Float32Array.from(lage), look };
  return punkte;
}

function treibeWetter(punkte, t) {
  if (!punkte) return;
  const { start, look } = punkte.userData;
  const lage = punkte.geometry.attributes.position.array;
  const rund = (wert, spanne) => ((wert % spanne) + spanne) % spanne;
  for (let i = 0; i < lage.length; i += 3) {
    lage[i] = rund(start[i] + look.drift * t + WETTER_RAUM / 2, WETTER_RAUM) - WETTER_RAUM / 2;
    lage[i + 1] = rund(start[i + 1] - look.fall * t, WETTER_HOEHE);
    lage[i + 2] = start[i + 2];
  }
  punkte.geometry.attributes.position.needsUpdate = true;
}

// --- Der Sturm auf die Mauer ----------------------------------------------
// Wer eine Mauer angreift, kommt nicht durch sie hindurch, sondern über sie:
// die Leitern lehnen an der Brüstung, sobald das Handgemenge beginnt.
function makeLadders(hoehe) {
  const group = new THREE.Group();
  const holz = new THREE.MeshLambertMaterial({ color: 0x7a5c33 });
  const laenge = hoehe + 1.1;
  const teile = [];
  for (const seite of [-0.22, 0.22]) {
    teile.push(teil(new THREE.BoxGeometry(0.08, laenge, 0.08), 0, laenge / 2, seite));
  }
  for (let i = 1; i * 0.42 < laenge - 0.2; i++) {
    teile.push(teil(new THREE.BoxGeometry(0.06, 0.05, 0.5), 0, i * 0.42, 0));
  }
  const leiterGeometrie = mergeParts(teile);
  for (const z of [-4.4, -1.5, 1.5, 4.4]) {
    const leiter = new THREE.Mesh(leiterGeometrie, holz);
    // Die Leiter lehnt von der Angreiferseite an die Mauer.
    leiter.position.set(-0.9, 0, z + (Math.random() - 0.5) * 0.6);
    leiter.rotation.z = -0.34;
    group.add(leiter);
  }
  group.visible = false;
  return group;
}

// Die Fahne über einer Aufstellung: Stange, Tuch, Wappen. Dasselbe Tuch wie
// im Zelt - eine zweite Sammlung derselben Wappen wäre eine zu viel.
function makeBanner(factionId, color) {
  const group = new THREE.Group();
  const stange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 5.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b5433 })
  );
  stange.position.y = 2.6;
  group.add(stange);
  const tuch = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.4),
    new THREE.MeshLambertMaterial({
      map: emblemTexture(factionId, color), side: THREE.DoubleSide,
    })
  );
  tuch.position.set(0.78, 3.9, 0);
  group.add(tuch);
  group.userData = { tuch };
  return group;
}

// Ein Schiff in derselben Sprache wie die Klötze: Rumpf, Mast, Segel. Für die
// Seeschlacht - auf dem Wasser stünde ein Würfel schlecht.
function makeShip(color, scale = 1) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const holz = new THREE.MeshLambertMaterial({ color: 0x6b5433 });
  const rumpf = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), material);
  rumpf.position.y = 0.25;
  group.add(rumpf);
  // Der Bug läuft spitz zu: ein zweiter, schmalerer Kasten davor.
  const bug = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.36), material);
  bug.position.set(1.5, 0.3, 0);
  group.add(bug);
  // Der Rammsporn dicht über der Wasserlinie - damit endeten die meisten
  // Seeschlachten dieser Zeit.
  const sporn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7, 5), material);
  sporn.position.set(2.1, 0.12, 0);
  sporn.rotation.z = -Math.PI / 2;
  group.add(sporn);
  // Das Heck steigt an und trägt das Steuerruder.
  const heck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.72), material);
  heck.position.set(-1.15, 0.5, 0);
  group.add(heck);
  const ruder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.16), holz);
  ruder.position.set(-1.45, 0.16, 0.32);
  ruder.rotation.z = 0.5;
  group.add(ruder);
  // Die Riemen: eine Reihe je Seite, alle im selben Schlag.
  const riemen = new THREE.BoxGeometry(0.06, 0.05, 0.62);
  for (let i = -3; i <= 3; i++) {
    for (const seite of [-1, 1]) {
      const r = new THREE.Mesh(riemen, holz);
      r.position.set(i * 0.28, 0.3, seite * 0.62);
      r.rotation.x = seite * 0.42;
      group.add(r);
    }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 5), holz);
  mast.position.set(-0.1, 1.3, 0);
  group.add(mast);
  // Die Rah, an der das Segel hängt.
  const rah = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 4), holz);
  rah.position.set(-0.1, 2.16, 0);
  rah.rotation.x = Math.PI / 2;
  group.add(rah);
  const segel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.15),
    new THREE.MeshLambertMaterial({ color: 0xf0e6d0, side: THREE.DoubleSide })
  );
  // Das Segel steht längs statt quer: von der Seite - und von dort sieht man
  // die Schlacht - wäre ein quer gerafftes Rahsegel nur ein Strich.
  segel.position.set(-0.1, 1.6, 0.02);
  group.add(segel);
  group.scale.setScalar(scale);
  return group;
}

// Ein Transportschiff: bauchiger Rumpf, ein breites Rahsegel, kein Rammsporn.
// Wo ein Heer über See fährt, fährt es auf diesen und nicht auf Kriegsschiffen
// - das Schaubild einer Seeschlacht mit einem verladenen Heer zeigte bisher
// Rammsporne, wo Getreidesegler liegen.
function makeTransport(color, scale = 1) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const holz = new THREE.MeshLambertMaterial({ color: 0x6b5433 });
  // Bauchig und kurz: ein Frachtsegler ist kein Ruderer.
  const rumpf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 1.05), material);
  rumpf.position.y = 0.31;
  group.add(rumpf);
  for (const seite of [-1, 1]) {
    const steven = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.72, 0.6), material);
    steven.position.set(seite * 1.05, 0.42, 0);
    group.add(steven);
  }
  // Die Schilde des Heeres hängen an der Reling - daran sieht man, dass hier
  // Truppen fahren und keine Fracht.
  for (let i = -1; i <= 1; i++) {
    for (const seite of [-1, 1]) {
      const schild = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.06), material);
      schild.position.set(i * 0.5, 0.6, seite * 0.55);
      group.add(schild);
    }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 5), holz);
  mast.position.set(0, 1.4, 0);
  group.add(mast);
  const rah = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 4), holz);
  rah.position.set(0, 2.1, 0);
  rah.rotation.x = Math.PI / 2;
  group.add(rah);
  const segel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.2),
    new THREE.MeshLambertMaterial({ color: 0xe8dcc0, side: THREE.DoubleSide })
  );
  segel.position.set(0, 1.5, 0.02);
  group.add(segel);
  group.scale.setScalar(scale);
  return group;
}

// Die Eröffnungssalve: eine Handvoll Pfeile, die im Bogen hinüberfliegen.
// Sie treffen niemanden - was sie anrichten, steht schon im Bericht -, aber
// sie sagen, warum die erste Runde anders aussieht als die zweite.
const ARROWS = 60;

// Ein Pfeil ist Schaft, Spitze und Fiederung. Vorher war er ein Zylinder von
// zwölf Zentimetern Dicke - neben den gegliederten Gestalten sah das aus wie
// ein geworfener Balken. Jetzt ist der Schaft so dünn, wie ein Schaft ist, und
// man erkennt, wohin die Spitze zeigt.
function arrowGeometry() {
  const schaft = new THREE.CylinderGeometry(0.028, 0.028, 1.0, 4);
  const spitze = new THREE.ConeGeometry(0.07, 0.22, 4);
  const feder = new THREE.BoxGeometry(0.012, 0.2, 0.13);
  const ganz = mergeParts([
    teil(schaft, 0, 0, 0),
    teil(spitze, 0, 0.6, 0),
    teil(feder, 0, -0.42, 0),
    teil(feder, 0, -0.42, 0, 0, Math.PI / 2, 0),
  ]);
  schaft.dispose();
  spitze.dispose();
  feder.dispose();
  return ganz;
}

function makeArrows(color) {
  const group = new THREE.Group();
  // Ein Pfeil in der Luft ist dunkles Holz mit einem Hauch der Feldzeichen-
  // farbe: ganz in Rot oder Blau sähe eine Salve aus wie Konfetti.
  const ton = new THREE.Color(color).lerp(new THREE.Color('#4a3a26'), 0.62);
  const material = new THREE.MeshLambertMaterial({ color: ton });
  const geometry = arrowGeometry();
  for (let i = 0; i < ARROWS; i++) {
    const pfeil = new THREE.Mesh(geometry, material);
    pfeil.userData = {
      // Jeder Pfeil startet ein wenig anders und fliegt ein wenig anders weit.
      versatz: (Math.random() - 0.5) * 11,
      hoehe: 3.4 + Math.random() * 3.4,
      start: Math.random() * 0.45,
    };
    pfeil.visible = false;
    group.add(pfeil);
  }
  group.visible = false;
  return group;
}

// Setzt die Pfeile auf ihre Flugbahn. `p` läuft von 0 (Abschuss) bis 1
// (Einschlag); außerhalb sind sie unsichtbar.
function flyArrows(group, p, vonX, nachX) {
  if (p <= 0 || p >= 1) {
    group.visible = false;
    return;
  }
  group.visible = true;
  for (const pfeil of group.children) {
    const { versatz, hoehe, start } = pfeil.userData;
    const q = (p - start) / (1 - start);
    if (q <= 0 || q >= 1) { pfeil.visible = false; continue; }
    pfeil.visible = true;
    const x = vonX + (nachX - vonX) * q;
    pfeil.position.set(x, 0.4 + Math.sin(q * Math.PI) * hoehe, versatz);
    // Die Spitze zeigt in die Flugrichtung: erst steigend, dann fallend. Ein
    // Zylinder liegt entlang seiner Y-Achse, deshalb der Viertelkreis Abzug.
    const dy = Math.cos(q * Math.PI) * hoehe * Math.PI;
    const dx = nachX - vonX;
    pfeil.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  }
}

// --- Die Kämpfer ----------------------------------------------------------
// In der dritten Fassung steht auf dem Feld keine Reihe von Quadern mehr,
// sondern eine Reihe von Gestalten: Fußvolk mit Schild und Speer, Reiter zu
// Pferd, Schützen mit dem Bogen, die Stadtwache hinter einem großen Schild.
//
// Damit das bezahlbar bleibt, wird jede Gattung aus ihren Teilen zu EINER
// Geometrie verschmolzen und als Instanz gezeichnet: hundert Fußsoldaten
// kosten dann einen Zeichenaufruf statt fünfhundert. Three.js bringt in
// dieser Fassung kein Werkzeug zum Verschmelzen mit; für unsere Teile - alle
// ohne Index, alle nur mit Lage und Normale - genügen ein paar Zeilen.
function mergeParts(parts) {
  let laenge = 0;
  const fertig = parts.map(({ geometry, matrix }) => {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone());
    g.applyMatrix4(matrix);
    laenge += g.attributes.position.count * 3;
    return g;
  });
  const lage = new Float32Array(laenge);
  const norm = new Float32Array(laenge);
  let versatz = 0;
  for (const g of fertig) {
    lage.set(g.attributes.position.array, versatz);
    norm.set(g.attributes.normal.array, versatz);
    versatz += g.attributes.position.count * 3;
    g.dispose();
  }
  const ganz = new THREE.BufferGeometry();
  ganz.setAttribute('position', new THREE.Float32BufferAttribute(lage, 3));
  ganz.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  return ganz;
}

// Ein Teil an seinen Platz: Geometrie, Verschiebung, Drehung.
function teil(geometry, x, y, z, rx = 0, ry = 0, rz = 0) {
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  matrix.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
  return { geometry, matrix };
}

// Die Bausätze. Jede Gestalt schaut nach +X - das ist die Richtung, in die
// eine Aufstellung blickt; gedreht wird sie später als Ganzes.
//
// In der vierten Fassung ist eine Gestalt nicht mehr ein Stück, sondern vier:
// Rumpf, linkes Bein, rechtes Bein, Waffenarm. Jedes Teil bekommt einen
// Drehpunkt - Hüfte, Schulter - und seine eigene Instanzenwolke; die Beine
// können damit gehen und der Arm zustoßen. Das kostet vier Zeichenaufrufe je
// Gattung statt einem; bei zweihundert Gestalten ist das nichts, und aus einer
// Reihe wackelnder Kegel wird ein marschierendes Heer.
//
// Die Teile sind um ihren Drehpunkt herum gebaut, nicht um den Boden: eine
// Drehung um die Z-Achse schwingt dann das Bein aus der Hüfte und nicht die
// ganze Gestalt.
function fighterParts(rolle) {
  const kopf = new THREE.SphereGeometry(0.115, 7, 5);

  if (rolle === 'cavalry') {
    // Das Pferd: Leib, Hals, Kopf - und der Reiter darauf. Die Beine hängen
    // paarweise an Bug und Heck des Leibes und schlagen im Galopp aus.
    const leib = [];
    leib.push(teil(new THREE.BoxGeometry(0.78, 0.26, 0.24), 0, 0, 0));
    leib.push(teil(new THREE.BoxGeometry(0.16, 0.3, 0.16), 0.42, 0.16, 0, 0, 0, -0.4));
    leib.push(teil(new THREE.BoxGeometry(0.24, 0.14, 0.14), 0.56, 0.3, 0));
    leib.push(teil(new THREE.CylinderGeometry(0.14, 0.17, 0.34, 6), -0.02, 0.28, 0));
    leib.push(teil(kopf, -0.02, 0.52, 0));
    const beinPaar = (bx) => {
      const t = [];
      for (const bz of [0.1, -0.1]) {
        t.push(teil(new THREE.CylinderGeometry(0.045, 0.04, 0.42, 4), 0, -0.21, bz));
      }
      return mergeParts(t);
    };
    return [
      { key: 'rumpf', geometry: mergeParts(leib), pivot: [0, 0.62, 0] },
      { key: 'beinL', geometry: beinPaar(0.3), pivot: [0.3, 0.42, 0] },
      { key: 'beinR', geometry: beinPaar(-0.28), pivot: [-0.28, 0.42, 0] },
      {
        key: 'arm',
        geometry: mergeParts([teil(
          new THREE.CylinderGeometry(0.025, 0.025, 0.9, 4), 0, 0, 0, 0, 0, 0.35
        )]),
        pivot: [0.12, 1.0, 0.16],
      },
    ];
  }

  // Fußvolk: zwei Beine aus der Hüfte, Rumpf mit Schultern und Kopf, dazu ein
  // Waffenarm aus der Schulter. Erst die Beine machen aus dem Kegel, der hier
  // einmal stand, einen Mann - auf dieser Entfernung sieht man keine
  // Gesichter, aber man sieht, ob einer geht oder steht.
  const HUEFTE = FIGURE * 0.34;
  const bein = () => mergeParts([teil(
    new THREE.CylinderGeometry(0.05, 0.045, FIGURE * 0.34, 4), 0, -FIGURE * 0.17, 0
  )]);

  const rumpfTeile = [
    teil(new THREE.CylinderGeometry(0.15, 0.19, FIGURE * 0.42, 6), 0, FIGURE * 0.21, 0),
    teil(new THREE.BoxGeometry(0.19, 0.12, 0.36), 0, FIGURE * 0.41, 0),
    teil(kopf, 0, FIGURE * 0.56, 0),
  ];
  const teile = [];

  if (rolle === 'ranged') {
    // Der Bogen sitzt im Arm: er hebt sich beim Schuss.
    teile.push({
      key: 'arm',
      geometry: mergeParts([teil(new THREE.TorusGeometry(0.2, 0.022, 4, 9, Math.PI),
        0.09, -0.06, 0, Math.PI / 2, 0, 0)]),
      pivot: [0.05, FIGURE * 0.66, 0],
    });
  } else if (rolle === 'watch') {
    // Die Stadtwache trägt den großen Schild am Arm - im Schildwall hebt sie
    // ihn, sonst hält sie ihn tief.
    teile.push({
      key: 'arm',
      geometry: mergeParts([teil(new THREE.BoxGeometry(0.06, 0.58, 0.42), 0, 0, 0)]),
      pivot: [0.19, FIGURE * 0.52, 0],
    });
  } else {
    // Fußvolk: Schild fest am Rumpf, Speer im Arm.
    rumpfTeile.push(teil(new THREE.BoxGeometry(0.05, 0.4, 0.32),
      0.18, FIGURE * 0.22, 0.06));
    teile.push({
      key: 'arm',
      geometry: mergeParts([teil(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 4),
        0, 0, 0, 0, 0, 0.12)]),
      pivot: [-0.02, FIGURE * 0.72, -0.18],
    });
  }

  return [
    { key: 'rumpf', geometry: mergeParts(rumpfTeile), pivot: [0, HUEFTE, 0] },
    { key: 'beinL', geometry: bein(), pivot: [0, HUEFTE, 0.09] },
    { key: 'beinR', geometry: bein(), pivot: [0, HUEFTE, -0.09] },
    ...teile,
  ];
}

// Wie hoch eine Gestalt jeder Gattung steht - daran hängt, wie sie umfällt.
const FIGUR_HOEHE = { cavalry: 1.35, infantry: 1, ranged: 1, watch: 1 };

// Zwei Behelfskörper und eine Matrix, um die Lage eines Teils auszurechnen:
// Instanzen haben keine eigene Lage, sie haben nur eine Matrix.
//
// Die Rechnung ist zweistufig. Die Gestalt selbst steht irgendwo im Feld und
// schaut irgendwohin (`F`); jedes ihrer Teile hängt an einem Drehpunkt und ist
// um ihn gedreht (`P`). Was die Instanz braucht, ist F · P.
let behelf = null;
let behelfTeil = null;
let behelfMatrix = null;

function setzeInstanz(stueck) {
  if (stueck.schiff) {
    stueck.gruppe.position.set(stueck.x, stueck.y, stueck.z);
    stueck.gruppe.rotation.set(0, stueck.ry, stueck.rz);
    stueck.gruppe.visible = stueck.sichtbar;
    return;
  }
  if (!behelf) {
    behelf = new THREE.Object3D();
    behelfTeil = new THREE.Object3D();
    behelfMatrix = new THREE.Matrix4();
  }
  behelf.position.set(stueck.x, stueck.y, stueck.z);
  behelf.rotation.set(0, stueck.ry, stueck.rz);
  // Ein Gefallener, der ganz verschwinden soll, wird auf null geschrumpft:
  // eine einzelne Instanz lässt sich nicht ausblenden.
  behelf.scale.setScalar(stueck.sichtbar ? stueck.skala : 0);
  behelf.updateMatrix();
  for (const teilchen of stueck.teile) {
    behelfTeil.position.set(teilchen.pivot[0], teilchen.pivot[1], teilchen.pivot[2]);
    behelfTeil.rotation.set(0, 0, stueck.winkel[teilchen.key] || 0);
    behelfTeil.updateMatrix();
    behelfMatrix.multiplyMatrices(behelf.matrix, behelfTeil.matrix);
    teilchen.wolke.setMatrixAt(stueck.instanz, behelfMatrix);
    teilchen.wolke.instanceMatrix.needsUpdate = true;
  }
}

// --- Wie sich eine Gestalt bewegt -----------------------------------------
// Vier Gangarten, und der Zustand entscheidet, welche gilt: aufmarschieren,
// stehen, fechten, fallen. Gerechnet werden nur Winkel - die Lage der Gestalt
// selbst steht anderswo.
function bewegeGlieder(stueck, t, modus, gefecht) {
  const w = stueck.winkel;
  if (modus === 'gefallen') return;
  if (modus === 'marsch') {
    // Der Schritt: die Beine gegenläufig, der Arm mit dem Gegenbein, der
    // Rumpf wiegt sich leicht. Reiter galoppieren doppelt so schnell.
    const takt = stueck.rolle === 'cavalry' ? 9.5 : 6.6;
    const a = Math.sin(t * takt + stueck.phase) * (stueck.rolle === 'cavalry' ? 0.5 : 0.55);
    w.beinL = a;
    w.beinR = -a;
    w.rumpf = Math.abs(a) * 0.06;
    w.arm = stueck.grundArm + a * 0.25;
    return;
  }
  if (modus === 'kampf') {
    // Der Stoß: der Arm holt aus und fährt vor. Jeder in seinem eigenen Takt -
    // eine Linie, die im Gleichschritt zusticht, sieht aus wie ein Uhrwerk.
    const schwung = Math.max(0, Math.sin(t * 5.2 + stueck.phase * 2.3));
    w.arm = stueck.grundArm - schwung * schwung * 0.8 * gefecht;
    // Die Beine treten auf der Stelle, der Rumpf beugt sich in den Stoß.
    const tritt = Math.sin(t * 5.2 + stueck.phase * 2.3) * 0.16;
    w.beinL = tritt;
    w.beinR = -tritt;
    w.rumpf = -schwung * 0.14 * gefecht;
    return;
  }
  // Stehen: fast nichts, aber nicht nichts.
  const ruhe = Math.sin(t * 1.6 + stueck.phase) * 0.03;
  w.beinL = ruhe;
  w.beinR = -ruhe;
  w.rumpf = ruhe * 0.5;
  w.arm = stueck.grundArm;
}

// --- Die Schlachtordnung auf dem Feld -------------------------------------
// Seit v1.28 ist die Schlachtordnung eine Regel: sie entscheidet mit, wer
// gewinnt. Zu sehen war davon nichts - beide Seiten standen im selben
// Rechteck. Jetzt stellt jede Ordnung ihre Reihen selbst:
//
//   Keil          eine Spitze, die sich nach hinten öffnet
//   Umfassung     breit und flach, die Reiterei auf den Flügeln
//   Beschuss      die Schützen als Plänklerlinie davor
//   Schildwall    dicht und tief, die Schilde erhoben
//   Breite Front  weit gezogen, dünn
//   Gegenstoß     wie gewohnt - aber er wartet nicht, sondern geht vor
const ORDNUNG_FORM = {
  keil: { reihen: 1, breite: 1, tiefe: 1, keil: true },
  umfassung: { reihen: 0.62, breite: 1.12, tiefe: 1, fluegel: true },
  beschuss: { reihen: 1, breite: 1, tiefe: 1, plaenkler: true },
  schildwall: { reihen: 1.4, breite: 0.78, tiefe: 0.82, schilde: true },
  breiteFront: { reihen: 0.55, breite: 1.2, tiefe: 1 },
  gegenstoss: { reihen: 1, breite: 1, tiefe: 1, vorstoss: true },
};

function ordnungForm(key) {
  return ORDNUNG_FORM[key] || ORDNUNG_FORM.keil;
}

// Wo der Mann mit der Nummer `platz` steht - Reihe und Glied. Der Keil rechnet
// anders als das Rechteck: seine Reihen wachsen nach hinten.
function keilReihen(gesamt) {
  const reihen = [];
  let rest = gesamt;
  let breite = 2;
  while (rest > 0) {
    const n = Math.min(rest, breite);
    reihen.push(n);
    rest -= n;
    breite += 2;
  }
  return reihen;
}

// Eine Aufstellung: so viele Gestalten, wie die Truppe Blöcke hat, in Reihen
// und Gliedern. Zurückgegeben wird die Liste in der Reihenfolge, in der sie
// fallen sollen - von vorn nach hinten, damit die Front ausdünnt und nicht
// die Mitte Löcher bekommt.
//
// Gezeichnet wird je Gattung eine Instanzenwolke je Körperteil: hundert
// Fußsoldaten kosten dann vier Zeichenaufrufe statt fünfhundert. Ein Block ist
// deshalb kein Mesh, sondern ein Merkzettel - Platz, Drehung, Winkel der
// Glieder, Zeitpunkt des Falls -, aus dem jede Bildfolge die Matrizen seiner
// Instanzen neu schreibt.
function makeFormation(units, factionId, color, facing, naval = false, ordnungKey = null) {
  const group = new THREE.Group();
  const bloecke = [];
  const defs = unitDefs(factionId);
  const form = ordnungForm(ordnungKey);
  // Wie viele Gestalten auf diese Seite entfallen - bei sehr großen Heeren
  // gedeckelt, damit die Zahl der Figuren beherrschbar bleibt.
  const mann = COMBAT_ROLES.reduce((sum, key) => sum + (units[key] || 0), 0);
  // Ein Heer, das über See fährt, fährt nicht auf Kriegsschiffen: hat diese
  // Seite keine Schiffe, aber Mannschaft, dann liegt sie auf Transportern -
  // so viele, wie das Heer braucht, und keine mehr.
  const transport = naval && !(units[SHIP_ROLE] > 0) && mann > 0;
  // Schiffe zählen anders als Mann: ein Geschwader sind sechzig Schiffe, und
  // vier davon je Modell sehen nach Flotte aus, sechzig nach Gewimmel.
  const proBlock = naval ? 4 : MEN_PER_BLOCK;
  const gesamt = transport
    ? Math.max(1, Math.min(MAX_BLOCKS, transportCount(mann)))
    : Math.max(1, Math.min(MAX_BLOCKS, Math.ceil(mann / proBlock)));
  const proMann = mann > 0 ? gesamt / mann : 0;

  // Ein Block, kein Gänsemarsch: ungefähr doppelt so breit wie tief. Auf See
  // fahren die Schiffe in loserer Ordnung und brauchen mehr Platz. Wie viele
  // Reihen es werden, sagt die Ordnung mit.
  const reihen = Math.max(1, Math.min(naval ? 4 : 9,
    Math.round(Math.sqrt(gesamt / (naval ? 4 : 2.2)) * (naval ? 1 : form.reihen))));
  const jeReihe = Math.ceil(gesamt / reihen);
  // Eine Gestalt ist schmaler als der Quader, der hier früher stand: die
  // Reihen rücken enger zusammen, sonst steht dort eine Menschenkette.
  const tiefe = (naval ? 3.6 : 1.15) * (naval ? 1 : form.tiefe);
  const breite = (naval ? 2.7 : 0.95) * (naval ? 1 : form.breite);
  // Die Gestalten schauen zum Feind: der Angreifer steht links und blickt
  // nach +X, der Verteidiger rechts und blickt zurück.
  const blick = facing < 0 ? 0 : Math.PI;
  // Der Keil stellt seine Reihen selbst.
  const keil = !naval && form.keil ? keilReihen(gesamt) : null;
  const keilVon = [];
  if (keil) {
    let summe = 0;
    for (const n of keil) { keilVon.push(summe); summe += n; }
  }

  // Erst der Plan, dann der Bau: eine Instanzenwolke muss ihre Größe beim
  // Anlegen kennen, also wird vorher gezählt, wer wie viele stellt.
  const plan = [];
  let index = 0;
  for (const key of COMBAT_ROLES) {
    const anzahl = Math.min(Math.round((units[key] || 0) * proMann), gesamt - index);
    if (anzahl > 0) {
      plan.push({ key, anzahl, von: index });
      index += anzahl;
    }
    if (index >= gesamt) break;
  }
  if (!plan.length) plan.push({ key: naval ? 'ships' : 'infantry', anzahl: 1, von: 0 });

  // Wie weit die Flügel der Umfassung ausgreifen - so weit wie die breiteste
  // Reihe und noch ein Stück.
  const fluegelZ = ((jeReihe - 1) / 2) * breite + breite * 1.4;
  let fluegelZaehler = 0;

  for (const { key, anzahl, von } of plan) {
    const schiff = naval || key === 'ships';
    // Je Gattung eine Wolke je Körperteil.
    const wolken = schiff ? null : fighterParts(key).map((teilchen) => ({
      key: teilchen.key,
      pivot: teilchen.pivot,
      wolke: new THREE.InstancedMesh(
        teilchen.geometry,
        new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }),
        anzahl
      ),
    }));
    if (wolken) {
      for (const { wolke } of wolken) {
        // Beim Fliehen und Fallen wandern die Instanzen weit aus der Hülle,
        // mit der three.js sie sonst wegsortiert - deshalb keine Prüfung.
        wolke.frustumCulled = false;
        group.add(wolke);
      }
    }
    for (let i = 0; i < anzahl; i++) {
      const platz = von + i;
      let reihe = Math.floor(platz / jeReihe);
      let glied = platz % jeReihe;
      let inReihe = jeReihe;
      if (keil) {
        // Im Keil sucht man die Reihe, in die dieser Platz fällt.
        reihe = keilVon.findIndex((start, r) => platz < start + keil[r]);
        if (reihe < 0) reihe = keil.length - 1;
        glied = platz - keilVon[reihe];
        inReihe = keil[reihe];
      }
      let z = (glied - (inReihe - 1) / 2) * breite;
      let x = facing * reihe * tiefe;
      // Die Reiterei der Umfassung reitet auf den Flügeln, nicht in der Mitte.
      const amFluegel = !schiff && form.fluegel && key === 'cavalry';
      if (amFluegel) {
        const seite = fluegelZaehler % 2 === 0 ? 1 : -1;
        const tief = Math.floor(fluegelZaehler / 2);
        fluegelZaehler += 1;
        z = seite * (fluegelZ + (tief % 3) * breite * 0.8);
        x = facing * Math.floor(tief / 3) * tiefe;
      }
      // Die Schützen des Beschusses stehen als Plänkler vor der Linie.
      const plaenkler = !schiff && form.plaenkler && key === 'ranged';
      if (plaenkler) x = -facing * tiefe * 1.5;

      const teile = wolken ? wolken.map((w) => ({ ...w, instanz: i })) : [];
      // Wo der Waffenarm im Ruhezustand hängt: der Schildwall hält den Schild
      // erhoben, alle anderen tragen ihn tief.
      const grundArm = form.schilde && (key === 'watch' || key === 'infantry') ? -0.35 : 0;
      const stueck = {
        reihe, rolle: key, schiff,
        teile, instanz: i, gruppe: null,
        amFluegel, plaenkler,
        // Keine Zinnsoldaten: jeder steht ein wenig anders in der Reihe.
        x: x + (schiff ? 0 : (Math.random() - 0.5) * 0.18),
        // Auf welcher Höhe dieser Mann steht: null auf dem Feld, der Wehrgang
        // für die, die auf der Mauer stehen.
        grund: 0,
        y: 0,
        z: z + (schiff ? 0 : (Math.random() - 0.5) * 0.16),
        // Wo er im Handgemenge hintritt: jeder sucht sich seinen Mann.
        nahX: (Math.random() * 0.5 + 0.35),
        nahZ: (Math.random() - 0.5) * 0.5,
        ry: blick + (schiff ? 0 : (Math.random() - 0.5) * 0.28),
        rz: 0,
        skala: schiff ? 1 : 1.08 + Math.random() * 0.14,
        hoehe: schiff ? 0.5 : (FIGUR_HOEHE[key] || FIGUR_HOEHE.infantry),
        // Zu welcher Seite dieser Mann fällt.
        seite: Math.random() < 0.5 ? -1 : 1,
        gefallen: 0, phase: Math.random() * 6.3, sichtbar: true,
        grundArm,
        winkel: { rumpf: 0, beinL: 0, beinR: 0, arm: grundArm },
      };
      // Wohin er zurückkehrt, wenn das Handgemenge vorbei ist.
      stueck.ruheX = stueck.x;
      stueck.ruheZ = stueck.z;
      stueck.ruheRy = stueck.ry;
      if (schiff) {
        // Auf dem Wasser fährt ein Schiff, keine Gestalt - und mit dem Bug
        // zum Feind. Ein verladenes Heer fährt auf Transportern.
        stueck.gruppe = transport ? makeTransport(color, 1.05) : makeShip(color, 1.05);
        stueck.ry = blick;
        group.add(stueck.gruppe);
      }
      setzeInstanz(stueck);
      bloecke.push(stueck);
    }
  }
  // Von vorn nach hinten - die Flügel der Reiterei fallen zuletzt.
  bloecke.sort((a, b) => (a.amFluegel ? 1 : 0) - (b.amFluegel ? 1 : 0) || a.reihe - b.reihe);
  return { group, bloecke, defs, form };
}

// Was mit einer Gestalt geschieht, die gefallen ist: sie kippt zur Seite und
// sinkt ein. Vorher verschwanden die Verluste einfach - jetzt liegt am Ende
// dort, was die Schlacht gekostet hat. Wer noch steht, bewegt sich: die
// vorderste Reihe stößt zu, der Rest tritt auf der Stelle.
const FALLZEIT = 0.45;

function updateFallen(bloecke, t, lage) {
  const { gefecht = 0, gruppeX = 0, marsch = 0, facing = -1, boden = null } = lage || {};
  for (const stueck of bloecke) {
    if (!stueck.gefallen) {
      if (stueck.schiff) {
        // Auf See schaukeln die Schiffe.
        stueck.y = Math.sin(t * 1.6 + stueck.phase) * 0.12;
        stueck.rz = Math.sin(t * 1.3 + stueck.phase) * 0.07;
      } else {
        // Welche Gangart gerade gilt. Wer noch aufmarschiert, geht; wer an
        // der Front steht und ficht, stößt zu; alle anderen stehen.
        const vorn = stueck.reihe === 0 || stueck.amFluegel;
        const modus = marsch < 1 ? 'marsch'
          : gefecht > 0.05 && (vorn || gefecht > 0.6) ? 'kampf' : 'stehen';
        bewegeGlieder(stueck, t, modus, gefecht);
        // --- Das Handgemenge ---------------------------------------------
        // Die vorderste Reihe löst sich auf: jeder tritt in die Lücke vor
        // sich und sucht seinen Mann. Vorher schoben zwei geschlossene Blöcke
        // gegeneinander, und dazwischen blieb eine Gasse.
        const nah = vorn ? gefecht : gefecht * 0.25;
        stueck.x = stueck.ruheX + facing * -1 * stueck.nahX * nah;
        stueck.z = stueck.ruheZ + stueck.nahZ * nah;
        // Und er dreht sich dem zu, auf den er einsticht.
        stueck.ry = stueck.ruheRy + stueck.nahZ * nah * 0.7;
        stueck.y = (boden ? boden(stueck.x + gruppeX, stueck.z) : 0) + stueck.grund
          + Math.abs(Math.sin(t * 3.1 + stueck.phase)) * 0.03;
        stueck.rz = 0;
      }
      setzeInstanz(stueck);
      continue;
    }
    // Ein Gefallener bleibt liegen, wo er gefallen ist. Er hängt an derselben
    // Aufstellung wie die Lebenden, und die weicht am Ende vom Feld - ohne
    // diesen Anker zog sich mit dem geschlagenen Heer auch sein Leichenfeld
    // zurück, und am Ende lag auf dem Schlachtfeld niemand mehr.
    if (stueck.weltX === undefined) {
      stueck.weltX = stueck.x + gruppeX;
      stueck.weltY = stueck.y;
    }
    stueck.x = stueck.weltX - gruppeX;
    const p = Math.min(1, (t - stueck.gefallen) / FALLZEIT);
    const weich = p * p;
    if (stueck.schiff) {
      // Ein Wrack legt sich auf die Seite und geht unter.
      stueck.rz = weich * 1.3;
      stueck.y = -weich * 1.1;
      stueck.sichtbar = p < 1;
    } else {
      stueck.rz = weich * (Math.PI / 2) * stueck.seite;
      // Der Gefallene sinkt zu Boden - und wer auf der Mauer stand, stürzt
      // von ihr herunter. Der Boden unter ihm bleibt, wo er lag.
      const grundHier = (boden ? boden(stueck.weltX, stueck.z) : 0);
      stueck.y = grundHier + stueck.grund * (1 - weich) - weich * 0.06;
    }
    setzeInstanz(stueck);
  }
}

// --- Der Ablauf ------------------------------------------------------------

// Aus dem Bericht wird ein Drehbuch: Aufmarsch, dann je Kampfrunde ein
// Zusammenprall mit den Verlusten dieser Runde, dann der Ausgang.
function drehbuch(report) {
  const runden = (report.rounds || []).map((r) => ({
    nummer: r.round,
    volley: !!r.volley,
    angreiferLinks: r.attackerLeft,
    verteidigerLinks: r.defenderLeft,
    angreiferVerlust: r.attackerLost,
    verteidigerVerlust: r.defenderLost,
  }));
  return { runden, dauer: T_MARCH + runden.length * T_ROUND + T_END };
}

function mannZahl(units) {
  return COMBAT_ROLES.reduce((sum, key) => sum + (units[key] || 0), 0);
}

// Wie viele Klötze noch stehen dürfen, wenn von `start` Mann noch `rest` übrig
// sind.
function bloeckeFuer(bloecke, start, rest) {
  if (start <= 0) return 0;
  return Math.round(bloecke * Math.max(0, rest) / start);
}

// --- Öffentlich ------------------------------------------------------------

// Zeigt die Schlacht. `canvas` ist die Leinwand im Fenster, `report` der
// fertige Schlachtbericht, `hooks` bekommt den Fortschritt gemeldet.
export function playBattle(canvas, report, hooks = {}) {
  stopBattle();
  if (!canvas || !report || typeof THREE === 'undefined') {
    if (hooks.onEnd) hooks.onEnd();
    return null;
  }

  // Derselbe Renderer wie beim letzten Mal, wenn es dieselbe Leinwand ist.
  if (!schauRenderer || schauRenderer.domElement !== canvas) {
    schauRenderer = makeRenderer(canvas);
  }
  // Kein zweiter Zusammenhang: dann gibt es kein Schaubild, und der Angriff
  // geht ohne es weiter. Wer danach fragt, bekommt eine Antwort statt eines
  // schwarzen Fensters.
  if (!schauRenderer) {
    if (hooks.onUnavailable) hooks.onUnavailable();
    if (hooks.onEnd) hooks.onEnd();
    return null;
  }
  schauScene = new THREE.Scene();
  // Das Wetter des Feldzugs steht auch über der Schlacht: es färbt den
  // Himmel, zieht den Dunst näher heran und schickt seine Tropfen.
  const wetterBild = SCHAU_WETTER[weatherInfo(report.weatherKey).effect] || null;
  // Bei klarem Wetter ein dunstiger Tageshimmel: derselbe Ton wie der Nebel,
  // damit die Ebene am Horizont in ihn übergeht statt an einer Kante zu enden.
  const himmel = new THREE.Color(wetterBild ? wetterBild.himmel : '#93a9ba');
  const dunst = wetterBild ? wetterBild.nebel : [55, 130];
  schauScene.background = himmel;
  schauScene.fog = new THREE.Fog(himmel.getHex(), dunst[0], dunst[1]);
  makeLights(schauScene, wetterBild);
  // Der Boden und sein Relief: dieselbe Formel für die Fläche und für alles,
  // was auf ihr steht.
  const bodenY = makeHeightField(report.terrainType, report.naval, report.terrainBonus);
  schauScene.add(makeGround(report.terrainType, report.naval, bodenY));
  // Wald, Hügel, Dünen: die Landschaft, in der gefochten wird - immer am
  // Rand, nie zwischen den Linien.
  schauScene.add(makeField(report.terrainType, report.naval));
  const wetter = makeSchauWetter(wetterBild);
  if (wetter) schauScene.add(wetter);

  const angreiferFarbe = hooks.attackerColor || '#c0392b';
  const verteidigerFarbe = hooks.defenderColor || '#3f6fa8';

  const zurSee = !!report.naval;
  const treffen = zurSee ? CLASH_GAP_SEE : CLASH_GAP;
  // Jede Seite stellt sich in ihrer Schlachtordnung auf - der Keil als Keil,
  // die Umfassung mit der Reiterei auf den Flügeln, der Schildwall dicht.
  const angreifer = makeFormation(report.attackerEngaged || {},
    report.attackerFactionId, angreiferFarbe, -1, zurSee, report.attackerTactic);
  const verteidiger = makeFormation(report.defenderEngaged || {},
    report.defenderFactionId, verteidigerFarbe, 1, zurSee, report.defenderTactic);
  angreifer.group.position.x = -START_GAP;
  verteidiger.group.position.x = START_GAP;
  schauScene.add(angreifer.group);
  schauScene.add(verteidiger.group);

  // Über jeder Aufstellung die Fahne ihres Reichs: so weiß man auch nach dem
  // dritten Zusammenprall noch, wer wer ist.
  const fahneA = makeBanner(report.attackerFactionId, angreiferFarbe);
  const fahneD = makeBanner(report.defenderFactionId, verteidigerFarbe);
  fahneA.position.set(-2.6, bodenY(-START_GAP - 2.6, -4.2), -(zurSee ? 5.5 : 4.2));
  fahneD.position.set(2.6, bodenY(START_GAP + 2.6, -4.2), -(zurSee ? 5.5 : 4.2));
  angreifer.group.add(fahneA);
  verteidiger.group.add(fahneD);

  // Die Pfeile der Eröffnungssalve - eine Wolke je Seite, aber nur, wenn dort
  // auch Schützen stehen.
  const hatSchuetzen = (units) => (units && units.ranged > 0);
  const pfeileA = hatSchuetzen(report.attackerEngaged) ? makeArrows('#efe0bc') : null;
  const pfeileD = hatSchuetzen(report.defenderEngaged) ? makeArrows('#efe0bc') : null;
  if (pfeileA) schauScene.add(pfeileA);
  if (pfeileD) schauScene.add(pfeileD);

  let wall = null;
  let leitern = null;
  if ((report.wallMultiplier || 1) > 1) {
    // Holz für die Palisade, Quaderstein für die Mauer - dieselbe Unter-
    // scheidung wie auf der Karte.
    wall = makeWall(report.wallMultiplier,
      report.wallMultiplier >= 2 ? '#9c968a' : '#6f5433',
      // Die Dächer im Ort tragen die Farbe dessen, der ihn hält.
      verteidigerFarbe);
    // Die Mauer steht dicht vor der Verteidigerlinie - der Angreifer
    // rennt gegen sie an, nicht gegen die Männer dahinter.
    wall.position.x = treffen - 0.7;
    schauScene.add(wall);
    // Und die Leitern, mit denen der Angreifer hinaufwill.
    wall.position.y = bodenY(wall.position.x, 0);
    leitern = makeLadders(wall.userData.hoehe);
    leitern.position.x = wall.position.x;
    leitern.position.y = wall.position.y;
    schauScene.add(leitern);
    // Die vorderen Glieder des Verteidigers stehen auf dem Wehrgang - über
    // der Brüstung, sichtbar, und mit dem weiten Weg nach unten.
    for (const stueck of verteidiger.bloecke) {
      if (stueck.reihe <= 1 && !stueck.schiff) {
        stueck.grund = wall.userData.gang;
        stueck.y = stueck.grund;
        setzeInstanz(stueck);
      }
    }
  }

  // --- Das Sturmgerät ------------------------------------------------------
  // Es gehört zur Mauer: ohne sie steht nichts davon auf dem Feld. Der Widder
  // rollt an das Tor, der Turm an die Brüstung, das Katapult bleibt hinter
  // der eigenen Linie stehen und schießt.
  // Auf dem Feld steht genau das Gerät, das der Angreifer wirklich mitgebracht
  // hat - nicht mehr eines von jeder Sorte, weil da eine Mauer ist. Wer ohne
  // Widder gegen ein Tor läuft, sieht das jetzt auch.
  const gerät = report.engines || {};
  const widderZahl = Math.min(3, gerät.ram || 0);
  const katapultZahl = Math.min(3, gerät.catapult || 0);
  const widderListe = [];
  const katapultListe = [];
  let turm = null;
  if (wall) {
    for (let i = 0; i < widderZahl; i++) {
      const stueck = makeRam(1);
      stueck.rotation.y = 0;
      // Nebeneinander vor dem Tor, nicht ineinander.
      stueck.userData.seite = (i - (widderZahl - 1) / 2) * 3.6;
      schauScene.add(stueck);
      widderListe.push(stueck);
    }
    // Der Turm gehört zu einer Belagerung, die ihren Namen verdient: erst ab
    // zwei Stücken Gerät und vor einer Mauer, die ihn nötig macht.
    if ((report.wallMultiplier || 1) >= 1.7 && widderZahl + katapultZahl >= 2) {
      turm = makeSiegeTower(wall.userData.hoehe, 1);
      schauScene.add(turm);
    }
    // Die Katapulte stehen auf der Flanke hinter der eigenen Linie - weit
    // genug zurück, dass sie niemandem im Weg stehen.
    for (let i = 0; i < katapultZahl; i++) {
      const stueck = makeCatapult(1.35);
      const x = -START_GAP + 4 - i * 2.6;
      const z = -9.5 - i * 2.2;
      stueck.position.set(x, bodenY(x, z), z);
      stueck.rotation.y = Math.PI;
      schauScene.add(stueck);
      katapultListe.push(stueck);
    }
  }

  // Der Staub über der Kampflinie - in der Farbe des Bodens, auf dem
  // gefochten wird.
  const staub = zurSee ? null : makeDust(
    (TILE_TYPES[report.terrainType] || TILE_TYPES.plains).color
  );
  if (staub) schauScene.add(staub);

  schauCamera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 320);
  const blick = new THREE.Vector3(0, 1.6, 0);
  schauCamera.position.set(0, 9.5, 22);
  schauCamera.lookAt(blick);

  const buch = drehbuch(report);
  const startA = mannZahl(report.attackerEngaged || {});
  const startD = mannZahl(report.defenderEngaged || {});
  const zahlA = angreifer.bloecke.length;
  const zahlD = verteidiger.bloecke.length;

  let t0 = null;
  let letzteRunde = -1;
  // Der Widder schlägt in seinem eigenen Takt, nicht im Takt der Runden.
  // Gezählt wird, damit der Klang genau auf den Aufprall fällt und nicht
  // sechzigmal je Sekunde.
  let letzterWidder = -1;
  let fertig = false;
  const sieger = report.outcome === 'attacker' ? 'attacker' : 'defender';

  const resize = () => {
    const breite = canvas.clientWidth || 640;
    const hoehe = canvas.clientHeight || 360;
    schauRenderer.setSize(breite, hoehe, false);
    schauCamera.aspect = breite / Math.max(1, hoehe);
    schauCamera.updateProjectionMatrix();
  };
  resize();

  // Wer über die Zahl hinaus in der Liste steht, ist gefallen: er bekommt
  // seinen Zeitpunkt und kippt von da an um. Rückwärts geht das nicht - eine
  // Schlacht gibt niemanden zurück.
  const zeige = (bloecke, wieViele, t) => {
    for (let i = wieViele; i < bloecke.length; i++) {
      if (!bloecke[i].gefallen) bloecke[i].gefallen = t;
    }
  };

  const schritt = (now) => {
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;
    resize();

    // 1. Aufmarsch: beide Linien gehen aufeinander zu.
    const marsch = Math.min(1, t / T_MARCH);
    const weich = marsch * marsch * (3 - 2 * marsch);
    const abstand = START_GAP + (treffen - START_GAP) * weich;
    angreifer.group.position.x = -abstand;
    // Wer hinter einer Mauer steht, marschiert nicht: er steht schon, wo er
    // hingehört, und wartet.
    verteidiger.group.position.x = wall ? treffen : abstand;

    // 2. Die Runden: je Runde ein Ruck nach vorn und die Verluste danach.
    // `gefecht` sagt den Gestalten, ob gerade gefochten wird - dann stoßen
    // sie zu, sonst stehen sie ruhig.
    let gefecht = 0;
    const nachMarsch = Math.max(0, t - T_MARCH);
    const rundenIndex = Math.min(buch.runden.length - 1,
      Math.floor(nachMarsch / T_ROUND));
    if (buch.runden.length && nachMarsch > 0) {
      const runde = buch.runden[rundenIndex];
      const inRunde = (nachMarsch % T_ROUND) / T_ROUND;
      // Der Zusammenprall: ein kurzer Stoß aufeinander zu und zurück.
      const stoss = Math.sin(Math.min(1, inRunde * 2.2) * Math.PI) * 1.5;
      gefecht = Math.min(1, stoss / 1.1);
      angreifer.group.position.x = -abstand + stoss;
      // Der Gegenstoß wartet nicht: er geht dem Angreifer entgegen, weiter
      // als jede andere Ordnung. Wer hinter einer Mauer steht, bleibt stehen.
      const gegenSchub = verteidiger.form.vorstoss ? 1.7 : 1;
      if (!wall) verteidiger.group.position.x = abstand - stoss * gegenSchub;
      // Die Verluste dieser Runde erscheinen in ihrer zweiten Hälfte.
      const anteil = Math.max(0, Math.min(1, (inRunde - 0.45) / 0.4));
      const vorherA = rundenIndex > 0 ? buch.runden[rundenIndex - 1].angreiferLinks : startA;
      const vorherD = rundenIndex > 0 ? buch.runden[rundenIndex - 1].verteidigerLinks : startD;
      const jetztA = vorherA + (runde.angreiferLinks - vorherA) * anteil;
      const jetztD = vorherD + (runde.verteidigerLinks - vorherD) * anteil;
      zeige(angreifer.bloecke, bloeckeFuer(zahlA, startA, jetztA), t);
      zeige(verteidiger.bloecke, bloeckeFuer(zahlD, startD, jetztD), t);
      // Die Salve fliegt in der ersten Hälfte der Runde, in der sie fällt.
      if (runde.volley) {
        // Die Salve fliegt über drei Viertel der Runde - lang genug, dass man
        // sie sieht, kurz genug, dass sie vor dem Handgemenge einschlägt.
        const flug = inRunde / 0.75;
        if (pfeileA) flyArrows(pfeileA, flug, -abstand + stoss, abstand - stoss);
        if (pfeileD) flyArrows(pfeileD, flug, abstand - stoss, -abstand + stoss);
      } else {
        if (pfeileA) pfeileA.visible = false;
        if (pfeileD) pfeileD.visible = false;
      }
      if (rundenIndex !== letzteRunde) {
        letzteRunde = rundenIndex;
        if (hooks.onRound) {
          hooks.onRound({
            nummer: runde.nummer,
            von: buch.runden.length,
            volley: runde.volley,
            angreifer: runde.angreiferLinks,
            verteidiger: runde.verteidigerLinks,
          });
        }
      }
    }

    // 3. Der Ausgang: der Verlierer weicht zurück, der Sieger rückt nach.
    const nachRunden = T_MARCH + buch.runden.length * T_ROUND;
    if (t > nachRunden) {
      const flucht = Math.min(1, (t - nachRunden) / T_END);
      const weg = flucht * 16;
      // Wer flieht, steht nicht mehr auf der Mauer.
      if (wall && sieger === 'attacker') {
        for (const stueck of verteidiger.bloecke) stueck.grund = 0;
      }
      if (sieger === 'attacker') {
        verteidiger.group.position.x = treffen + weg;
        angreifer.group.position.x = -treffen + weg * 0.35;
      } else {
        angreifer.group.position.x = -treffen - weg;
        verteidiger.group.position.x = treffen - weg * 0.35;
      }
      if (!fertig && flucht >= 1) {
        fertig = true;
        if (hooks.onEnd) hooks.onEnd();
      }
    }

    // Was gefallen ist, kippt um; was auf See schwimmt, schaukelt; wer
    // marschiert, geht; wer ficht, stößt zu.
    updateFallen(angreifer.bloecke, t, {
      gefecht, marsch, facing: -1, boden: bodenY,
      gruppeX: angreifer.group.position.x,
    });
    updateFallen(verteidiger.bloecke, t, {
      gefecht, marsch, facing: 1, boden: bodenY,
      gruppeX: verteidiger.group.position.x,
    });

    // Der Staub steht über der Linie, solange gefochten wird.
    if (staub) {
      staub.position.x = (angreifer.group.position.x + verteidiger.group.position.x) / 2;
      treibeStaub(staub, t, gefecht);
    }

    // --- Das Sturmgerät -----------------------------------------------------
    for (let i = 0; i < widderListe.length; i++) {
      const stueck = widderListe[i];
      // Jeder Widder rollt in der ersten Runde an das Tor und schlägt dann zu.
      const anfahrt = Math.min(1, Math.max(0, (t - T_MARCH * 0.4 - i * 0.2) / (T_MARCH * 1.2)));
      const ziel = wall.position.x - 2.1;
      const start = -START_GAP + 2;
      stueck.position.x = start + (ziel - start) * anfahrt;
      stueck.position.z = stueck.userData.seite;
      stueck.position.y = bodenY(stueck.position.x, stueck.position.z);
      // Sie schlagen nicht im Gleichtakt: das klänge nach einer Maschine.
      const takt = 2.6 + i * 0.24;
      const schlag = anfahrt >= 1 ? Math.max(0, Math.sin(t * takt)) : 0;
      stueck.userData.widder.position.x = schlag * schlag * 0.9;
      if (i === 0) {
        if (anfahrt >= 1) {
          const zaehler = Math.floor(t * takt / (Math.PI * 2) - 0.25);
          if (zaehler !== letzterWidder) {
            letzterWidder = zaehler;
            if (hooks.onRam) hooks.onRam();
          }
        }
        // Und das Tor bebt unter dem Schlag des ersten.
        wall.position.x = (treffen - 0.7) + schlag * schlag * 0.12;
      }
    }
    if (turm) {
      const anfahrt = Math.min(1, Math.max(0, (t - T_MARCH) / (T_ROUND * 2.5)));
      const ziel = wall.position.x - 1.6;
      const start = -START_GAP + 4;
      turm.position.x = start + (ziel - start) * anfahrt;
      turm.position.z = -5.5;
      turm.position.y = bodenY(turm.position.x, turm.position.z);
    }
    katapultListe.forEach((stueck, i) => {
      // Ein Wurf alle paar Sekunden, jedes für sich - sie laden nicht im Takt.
      const takt = ((t + i * 1.1) % 3.4) / 3.4;
      stueck.userData.arm.rotation.z = takt < 0.75
        ? -0.9 + takt * 0.4
        : -0.6 + (takt - 0.75) * 4.6;
    });
    // Die Fahne des Geschlagenen senkt sich am Ende.
    const senken = (fahne, fallen) => {
      const tuch = fahne.userData.tuch;
      if (tuch) tuch.position.y = 3.9 - fallen * 2.6;
      fahne.rotation.z = fallen * 0.5;
    };
    const endeT = T_MARCH + buch.runden.length * T_ROUND;
    const fallen = Math.max(0, Math.min(1, (t - endeT) / T_END));
    senken(fahneA, sieger === 'attacker' ? 0 : fallen);
    senken(fahneD, sieger === 'defender' ? 0 : fallen);

    // Das Wetter zieht weiter, gleichgültig wie es steht.
    if (wetter) treibeWetter(wetter, t);
    // Die Leitern gehen hoch, sobald das Handgemenge beginnt.
    if (leitern) leitern.visible = t > T_MARCH * 0.9;

    // Die Kamera geht mit: beim Aufmarsch steht sie weit weg und zeigt beide
    // Linien, beim Zusammenprall rückt sie heran - nah genug, dass man die
    // Gestalten unterscheidet -, und wenn der Verlierer flieht, weicht sie
    // zurück, damit man sieht, wohin. Ein Schwenk rundherum wäre hübsch und
    // würde den Blick auf das Wesentliche jede Sekunde ändern; also nur ein
    // langsames Wiegen.
    const heran = Math.max(0, Math.min(1, (t - T_MARCH * 0.5) / (T_MARCH * 0.9)));
    const zurueck = Math.max(0, Math.min(1, (t - nachRunden) / T_END));
    const ferne = 26 - 6.5 * heran + 8 * zurueck;
    // Über einer Mauer steht die Kamera höher: sonst sieht man vom
    // Verteidiger nur die Brüstung, hinter der er steht.
    const hoehe = 10.2 - 2.8 * heran + 3.4 * zurueck + (wall ? 3.4 : 0);
    // Vor einer Mauer tritt die Kamera auf die Seite des Angreifers: von
    // genau der Seite gesehen liefe die Mauer als Zaun in den Vordergrund und
    // stünde vor allem, was dahinter geschieht.
    const schwenk = Math.sin(t * 0.16) * 0.22 - (wall ? 0.6 : 0);
    schauCamera.position.set(Math.sin(schwenk) * ferne, hoehe, Math.cos(schwenk) * ferne);
    schauCamera.lookAt(blick);

    schauRenderer.render(schauScene, schauCamera);
    // Wer das fertige Bild braucht - eine Prüfung, ein Bildschirmfoto -,
    // bekommt es hier, unmittelbar nach dem Zeichnen.
    if (hooks.onFrame) hooks.onFrame(t, canvas);
    schauRaf = requestAnimationFrame(schritt);
  };

  schauRaf = requestAnimationFrame(schritt);
  stage = { report, dauer: buch.dauer };
  onFinished = hooks.onEnd || null;
  return { dauer: buch.dauer, runden: buch.runden.length };
}

// Räumt Szene und Renderer ab. Ohne das hielte jede gesehene Schlacht ihren
// eigenen WebGL-Kontext offen, und der Browser gibt nur eine Handvoll her.
export function stopBattle() {
  if (schauRaf !== null) {
    cancelAnimationFrame(schauRaf);
    schauRaf = null;
  }
  if (schauScene) {
    schauScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    schauScene = null;
  }
  // Der Renderer bleibt stehen. Ein WebGL-Zusammenhang lässt sich nicht
  // zurückgeben - `forceContextLoss` macht die Leinwand für immer unbrauchbar,
  // und ohne ihn bliebe er offen. Ein Browser gibt nur eine Handvoll her; nach
  // dreißig angesehenen Schlachten wäre keiner mehr zu haben. Deshalb behält
  // das Schaubild seinen einen Zusammenhang und baut nur die Szene neu.
  if (schauRenderer) schauRenderer.clear();
  schauCamera = null;
  stage = null;
  onFinished = null;
}

// Läuft gerade eine Schlacht?
export function battleRunning() {
  return stage !== null;
}
