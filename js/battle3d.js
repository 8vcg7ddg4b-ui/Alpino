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

function makeRenderer(canvas) {
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
function makeGround(terrainType, naval) {
  const def = TILE_TYPES[terrainType] || TILE_TYPES.plains;
  const color = naval ? TILE_TYPES.water.color : def.color;
  // Der Boden reicht weit über das Bild hinaus: sonst sieht man seine Kante,
  // und eine Schlacht auf einem schwebenden Teppich sieht albern aus.
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_WIDTH * 6, FIELD_WIDTH * 5),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(color) })
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

function makeWall(multiplier, color) {
  const group = new THREE.Group();
  const hoehe = multiplier >= 2 ? 3.2 : multiplier >= 1.6 ? 2.4 : 1.7;
  const stein = multiplier >= 2;
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const halb = MAUER_LAENGE / 2;

  if (stein) {
    // Zwei Mauerläufe, dazwischen das Tor.
    const lauf = (MAUER_LAENGE - TOR_BREITE) / 2;
    for (const seite of [-1, 1]) {
      const mauer = new THREE.Mesh(new THREE.BoxGeometry(1, hoehe, lauf), material);
      mauer.position.set(0, hoehe / 2, seite * (TOR_BREITE / 2 + lauf / 2));
      group.add(mauer);
    }
    // Der Zinnenkranz: jede zweite Lücke bleibt offen.
    const zinne = new THREE.BoxGeometry(1.14, 0.46, 0.42);
    for (let z = -halb + 0.3; z <= halb; z += 0.84) {
      if (Math.abs(z) < TOR_BREITE / 2) continue;
      const stueck = new THREE.Mesh(zinne, material);
      stueck.position.set(0, hoehe + 0.23, z);
      group.add(stueck);
    }
    // Zwei Türme flankieren das Tor - daran erkennt man von weitem, wo der
    // Sturm hin muss.
    for (const seite of [-1, 1]) {
      const turm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.85, hoehe * 1.35, 8), material
      );
      turm.position.set(0, hoehe * 0.675, seite * (TOR_BREITE / 2 + 0.55));
      group.add(turm);
    }
  } else {
    // Die Palisade: gespitzte Stämme, dicht an dicht. Sie stehen nicht in
    // Reih und Glied - eine Palisade wird gerammt, nicht gemauert.
    const stamm = new THREE.CylinderGeometry(0.17, 0.19, hoehe, 6);
    const spitze = new THREE.ConeGeometry(0.19, 0.34, 6);
    for (let z = -halb; z <= halb; z += 0.34) {
      if (Math.abs(z) < TOR_BREITE / 2) continue;
      const wank = (Math.random() - 0.5) * 0.06;
      const pfahl = new THREE.Mesh(stamm, material);
      pfahl.position.set((Math.random() - 0.5) * 0.08, hoehe / 2, z);
      pfahl.rotation.x = wank;
      group.add(pfahl);
      const kopf = new THREE.Mesh(spitze, material);
      kopf.position.set(pfahl.position.x, hoehe + 0.17, z);
      kopf.rotation.x = wank;
      group.add(kopf);
    }
  }

  // Das Tor: zwei Flügel aus Bohlen, darüber der Sturz.
  const holz = new THREE.MeshLambertMaterial({ color: 0x5b4223 });
  for (const seite of [-1, 1]) {
    const fluegel = new THREE.Mesh(
      new THREE.BoxGeometry(stein ? 1.05 : 0.34, hoehe * 0.72, TOR_BREITE / 2 - 0.04), holz
    );
    fluegel.position.set(0, hoehe * 0.36, seite * TOR_BREITE / 4);
    group.add(fluegel);
  }
  const sturz = new THREE.Mesh(
    new THREE.BoxGeometry(stein ? 1.1 : 0.4, hoehe * 0.28, TOR_BREITE), material
  );
  sturz.position.set(0, hoehe * 0.72 + hoehe * 0.14, 0);
  group.add(sturz);

  // Der Wehrgang: der Erdwall hinter der Brüstung, auf dem die Verteidiger
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
const ARROWS = 34;

function makeArrows(color) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const geometry = new THREE.CylinderGeometry(0.06, 0.06, 1.1, 4);
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
function fighterGeometry(rolle) {
  const rumpf = new THREE.CylinderGeometry(0.15, 0.19, FIGURE * 0.42, 6);
  const kopf = new THREE.SphereGeometry(0.115, 7, 5);
  const teile = [];

  if (rolle === 'cavalry') {
    // Das Pferd: Leib, vier Beine, Hals und Kopf - und der Reiter darauf.
    const leib = new THREE.BoxGeometry(0.78, 0.26, 0.24);
    const bein = new THREE.CylinderGeometry(0.045, 0.04, 0.42, 4);
    const hals = new THREE.BoxGeometry(0.16, 0.3, 0.16);
    teile.push(teil(leib, 0, 0.62, 0));
    for (const [bx, bz] of [[0.3, 0.1], [0.3, -0.1], [-0.28, 0.1], [-0.28, -0.1]]) {
      teile.push(teil(bein, bx, 0.21, bz));
    }
    teile.push(teil(hals, 0.42, 0.78, 0, 0, 0, -0.4));
    teile.push(teil(new THREE.BoxGeometry(0.24, 0.14, 0.14), 0.56, 0.92, 0));
    // Der Reiter sitzt, also kürzer als ein Fußsoldat.
    teile.push(teil(new THREE.CylinderGeometry(0.14, 0.17, 0.34, 6), -0.02, 0.9, 0));
    teile.push(teil(kopf, -0.02, 1.14, 0));
    teile.push(teil(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 4), 0.12, 1.0, 0.16, 0, 0, 0.35));
    return mergeParts(teile);
  }

  // Fußvolk: zwei Beine, Rumpf, Schultern, Kopf. Erst die Beine machen aus
  // dem Kegel, der hier stand, einen Mann - auf dieser Entfernung sieht man
  // keine Gesichter, aber man sieht, ob etwas geht oder steht.
  for (const seite of [-0.09, 0.09]) {
    teile.push(teil(new THREE.CylinderGeometry(0.05, 0.045, FIGURE * 0.34, 4),
      0, FIGURE * 0.17, seite));
  }
  teile.push(teil(rumpf, 0, FIGURE * 0.55, 0));
  teile.push(teil(new THREE.BoxGeometry(0.19, 0.12, 0.36), 0, FIGURE * 0.75, 0));
  teile.push(teil(kopf, 0, FIGURE * 0.9, 0));

  if (rolle === 'ranged') {
    // Der Bogen: ein halber Ring vor der Brust.
    teile.push(teil(new THREE.TorusGeometry(0.2, 0.022, 4, 9, Math.PI),
      0.14, FIGURE * 0.6, 0, Math.PI / 2, 0, 0));
  } else if (rolle === 'watch') {
    // Die Stadtwache steht hinter einem großen Schild.
    teile.push(teil(new THREE.BoxGeometry(0.06, 0.58, 0.42), 0.19, FIGURE * 0.52, 0));
  } else {
    // Fußvolk: Schild am Arm, Speer in der Faust.
    teile.push(teil(new THREE.BoxGeometry(0.05, 0.4, 0.32), 0.18, FIGURE * 0.56, 0.06));
    teile.push(teil(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 4),
      -0.02, FIGURE * 0.72, -0.18, 0, 0, 0.12));
  }
  return mergeParts(teile);
}

// Wie hoch eine Gestalt jeder Gattung steht - daran hängt, wie sie umfällt.
const FIGUR_HOEHE = { cavalry: 1.35, infantry: 1, ranged: 1, watch: 1 };

// Ein Behelfskörper, um eine Matrix auszurechnen: Instanzen haben keine
// eigene Lage, sie haben nur eine Matrix, und die will berechnet werden.
let behelf = null;
function setzeInstanz(stueck) {
  if (stueck.schiff) {
    stueck.gruppe.position.set(stueck.x, stueck.y, stueck.z);
    stueck.gruppe.rotation.set(0, stueck.ry, stueck.rz);
    stueck.gruppe.visible = stueck.sichtbar;
    return;
  }
  if (!behelf) behelf = new THREE.Object3D();
  behelf.position.set(stueck.x, stueck.y, stueck.z);
  behelf.rotation.set(0, stueck.ry, stueck.rz);
  // Ein Gefallener, der ganz verschwinden soll, wird auf null geschrumpft:
  // eine einzelne Instanz lässt sich nicht ausblenden.
  behelf.scale.setScalar(stueck.sichtbar ? stueck.skala : 0);
  behelf.updateMatrix();
  stueck.wolke.setMatrixAt(stueck.instanz, behelf.matrix);
  stueck.wolke.instanceMatrix.needsUpdate = true;
}

// Eine Aufstellung: so viele Gestalten, wie die Truppe Blöcke hat, in Reihen
// und Gliedern. Zurückgegeben wird die Liste in der Reihenfolge, in der sie
// fallen sollen - von vorn nach hinten, damit die Front ausdünnt und nicht
// die Mitte Löcher bekommt.
//
// Gezeichnet wird je Gattung EINE Instanzenwolke: hundert Fußsoldaten kosten
// dann einen Zeichenaufruf. Ein Block ist deshalb kein Mesh mehr, sondern ein
// Merkzettel - Platz, Drehung, Zeitpunkt des Falls -, aus dem jede Bildfolge
// die Matrix seiner Instanz neu schreibt.
function makeFormation(units, factionId, color, facing, naval = false) {
  const group = new THREE.Group();
  const bloecke = [];
  const defs = unitDefs(factionId);
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
  // fahren die Schiffe in loserer Ordnung und brauchen mehr Platz.
  const reihen = Math.max(1, Math.min(naval ? 4 : 8,
    Math.round(Math.sqrt(gesamt / (naval ? 4 : 2.2)))));
  const jeReihe = Math.ceil(gesamt / reihen);
  // Eine Gestalt ist schmaler als der Quader, der hier früher stand: die
  // Reihen rücken enger zusammen, sonst steht dort eine Menschenkette.
  const tiefe = naval ? 3.6 : 1.15;
  const breite = naval ? 2.7 : 0.95;
  // Die Gestalten schauen zum Feind: der Angreifer steht links und blickt
  // nach +X, der Verteidiger rechts und blickt zurück.
  const blick = facing < 0 ? 0 : Math.PI;

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

  for (const { key, anzahl, von } of plan) {
    const schiff = naval || key === 'ships';
    const wolke = schiff ? null : new THREE.InstancedMesh(
      fighterGeometry(key),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }),
      anzahl
    );
    if (wolke) {
      // Beim Fliehen und Fallen wandern die Instanzen weit aus der Hülle, mit
      // der three.js sie sonst wegsortiert - deshalb hier keine Prüfung.
      wolke.frustumCulled = false;
      group.add(wolke);
    }
    for (let i = 0; i < anzahl; i++) {
      const platz = von + i;
      const reihe = Math.floor(platz / jeReihe);
      const glied = platz % jeReihe;
      const stueck = {
        reihe, rolle: key, schiff,
        wolke, instanz: i, gruppe: null,
        // Keine Zinnsoldaten: jeder steht ein wenig anders in der Reihe.
        x: facing * reihe * tiefe + (schiff ? 0 : (Math.random() - 0.5) * 0.18),
        // Auf welcher Höhe dieser Mann steht: null auf dem Feld, der Wehrgang
        // für die, die auf der Mauer stehen.
        grund: 0,
        y: 0,
        z: (glied - (jeReihe - 1) / 2) * breite
          + (schiff ? 0 : (Math.random() - 0.5) * 0.16),
        ry: blick + (schiff ? 0 : (Math.random() - 0.5) * 0.28),
        rz: 0,
        skala: schiff ? 1 : 1.08 + Math.random() * 0.14,
        hoehe: schiff ? 0.5 : (FIGUR_HOEHE[key] || FIGUR_HOEHE.infantry),
        // Zu welcher Seite dieser Mann fällt.
        seite: Math.random() < 0.5 ? -1 : 1,
        gefallen: 0, phase: Math.random() * 6.3, sichtbar: true,
      };
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
  bloecke.sort((a, b) => a.reihe - b.reihe);
  return { group, bloecke, defs };
}

// Was mit einer Gestalt geschieht, die gefallen ist: sie kippt zur Seite und
// sinkt ein. Vorher verschwanden die Verluste einfach - jetzt liegt am Ende
// dort, was die Schlacht gekostet hat. Wer noch steht, bewegt sich: die
// vorderste Reihe stößt zu, der Rest tritt auf der Stelle.
const FALLZEIT = 0.45;

function updateFallen(bloecke, t, gefecht = 0, gruppeX = 0) {
  for (const stueck of bloecke) {
    if (!stueck.gefallen) {
      if (stueck.schiff) {
        // Auf See schaukeln die Schiffe.
        stueck.y = Math.sin(t * 1.6 + stueck.phase) * 0.12;
        stueck.rz = Math.sin(t * 1.3 + stueck.phase) * 0.07;
      } else {
        // Ein leichtes Auf und Ab, damit die Linie nicht aus Zinn ist, und
        // ein Stoß nach vorn für die, die gerade fechten.
        stueck.y = stueck.grund + Math.abs(Math.sin(t * 3.1 + stueck.phase)) * 0.035;
        const stoss = stueck.reihe === 0 ? gefecht : gefecht * 0.35;
        stueck.rz = Math.sin(t * 5.5 + stueck.phase) * 0.14 * stoss;
      }
      setzeInstanz(stueck);
      continue;
    }
    // Ein Gefallener bleibt liegen, wo er gefallen ist. Er hängt an derselben
    // Aufstellung wie die Lebenden, und die weicht am Ende vom Feld - ohne
    // diesen Anker zog sich mit dem geschlagenen Heer auch sein Leichenfeld
    // zurück, und am Ende lag auf dem Schlachtfeld niemand mehr.
    if (stueck.weltX === undefined) stueck.weltX = stueck.x + gruppeX;
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
      // von ihr herunter.
      stueck.y = stueck.grund * (1 - weich) - weich * 0.06;
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

  schauRenderer = makeRenderer(canvas);
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
  schauScene.add(makeGround(report.terrainType, report.naval));
  // Wald, Hügel, Dünen: die Landschaft, in der gefochten wird - immer am
  // Rand, nie zwischen den Linien.
  schauScene.add(makeField(report.terrainType, report.naval));
  const wetter = makeSchauWetter(wetterBild);
  if (wetter) schauScene.add(wetter);

  const angreiferFarbe = hooks.attackerColor || '#c0392b';
  const verteidigerFarbe = hooks.defenderColor || '#3f6fa8';

  const zurSee = !!report.naval;
  const treffen = zurSee ? CLASH_GAP_SEE : CLASH_GAP;
  const angreifer = makeFormation(report.attackerEngaged || {},
    report.attackerFactionId, angreiferFarbe, -1, zurSee);
  const verteidiger = makeFormation(report.defenderEngaged || {},
    report.defenderFactionId, verteidigerFarbe, 1, zurSee);
  angreifer.group.position.x = -START_GAP;
  verteidiger.group.position.x = START_GAP;
  schauScene.add(angreifer.group);
  schauScene.add(verteidiger.group);

  // Über jeder Aufstellung die Fahne ihres Reichs: so weiß man auch nach dem
  // dritten Zusammenprall noch, wer wer ist.
  const fahneA = makeBanner(report.attackerFactionId, angreiferFarbe);
  const fahneD = makeBanner(report.defenderFactionId, verteidigerFarbe);
  fahneA.position.set(-2.6, 0, -(zurSee ? 5.5 : 4.2));
  fahneD.position.set(2.6, 0, -(zurSee ? 5.5 : 4.2));
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
      report.wallMultiplier >= 2 ? '#9c968a' : '#6f5433');
    // Die Mauer steht dicht vor der Verteidigerlinie - der Angreifer
    // rennt gegen sie an, nicht gegen die Männer dahinter.
    wall.position.x = treffen - 0.7;
    schauScene.add(wall);
    // Und die Leitern, mit denen der Angreifer hinaufwill.
    leitern = makeLadders(wall.userData.hoehe);
    leitern.position.x = wall.position.x;
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
      if (!wall) verteidiger.group.position.x = abstand - stoss;
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
    // ficht, stößt zu.
    updateFallen(angreifer.bloecke, t, gefecht, angreifer.group.position.x);
    updateFallen(verteidiger.bloecke, t, gefecht, verteidiger.group.position.x);
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
  if (schauRenderer) {
    schauRenderer.dispose();
    schauRenderer = null;
  }
  schauCamera = null;
  stage = null;
  onFinished = null;
}

// Läuft gerade eine Schlacht?
export function battleRunning() {
  return stage !== null;
}
