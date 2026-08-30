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

import { COMBAT_ROLES, TILE_TYPES, unitDefs } from './data.js';

// Wie viele Mann ein Klotz darstellt und wie viele Klötze eine Seite höchstens
// bekommt. Ein Heer von 2.000 Mann als 2.000 Würfel zu zeichnen sähe nicht
// genauer aus, es liefe nur langsamer.
const MEN_PER_BLOCK = 15;
const MAX_BLOCKS = 110;

// Die Bühne in Weltmaßen: die beiden Linien stehen sich über diese Entfernung
// gegenüber und treffen sich in der Mitte.
const FIELD_WIDTH = 46;
const START_GAP = 16;
const CLASH_GAP = 3.6;

// Wie lange die Abschnitte dauern (Sekunden).
const T_MARCH = 1.5;
const T_ROUND = 1.15;
const T_END = 2.2;

// Jede Waffengattung hat ihre Form: Fußvolk breit und niedrig, Reiter hoch,
// Schützen schmal, die Stadtwache ein gedrungener Klotz, Schiffe lang.
const SHAPES = {
  infantry: { w: 1.05, h: 1.0, d: 0.85, icon: '⚔️' },
  cavalry: { w: 1.1, h: 1.65, d: 1.05, icon: '🐎' },
  ranged: { w: 0.8, h: 0.9, d: 0.7, icon: '🏹' },
  watch: { w: 1.0, h: 1.1, d: 0.9, icon: '🛡️' },
  ships: { w: 2.1, h: 0.7, d: 0.9, icon: '⛵' },
};

let schauRenderer = null;
let schauScene = null;
let schauCamera = null;
let schauRaf = null;
let stage = null;      // was gerade läuft
let onFinished = null; // was danach geschieht

// --- Aufbau ---------------------------------------------------------------

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.shadowMap.enabled = false;
  return r;
}

function makeLights(target) {
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.05);
  sun.position.set(18, 30, 14);
  target.add(sun);
  target.add(new THREE.HemisphereLight(0xbfd4ff, 0x4a4030, 0.75));
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

// Die Mauer, wenn hinter einer gefochten wurde: ein Riegel aus Quadern quer
// vor der Verteidigerlinie. Je stärker die Befestigung, desto höher.
function makeWall(multiplier, color) {
  const group = new THREE.Group();
  const hoehe = multiplier >= 2 ? 3.2 : multiplier >= 1.6 ? 2.4 : 1.7;
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const geometry = new THREE.BoxGeometry(1.1, hoehe, 1.3);
  // Nur so lang wie die Front, sonst verdeckt der Riegel die Verteidiger.
  for (let i = -5; i <= 5; i++) {
    const stein = new THREE.Mesh(geometry, material);
    // Ein Zinnenkranz: jeder zweite Stein steht höher.
    const zinne = i % 2 === 0 ? 1 : 0.78;
    stein.scale.y = zinne;
    stein.position.set(0, (hoehe * zinne) / 2, i * 1.45);
    group.add(stein);
  }
  return group;
}

// Eine Aufstellung: so viele Klötze, wie die Truppe Blöcke hat, in Reihen und
// Gliedern. Zurückgegeben wird die Liste der Klötze in der Reihenfolge, in der
// sie fallen sollen - von vorn nach hinten, damit die Front ausdünnt und nicht
// die Mitte Löcher bekommt.
function makeFormation(units, factionId, color, facing) {
  const group = new THREE.Group();
  const bloecke = [];
  const defs = unitDefs(factionId);
  const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  // Wie viele Klötze auf diese Seite entfallen - bei sehr großen Heeren
  // gedeckelt, damit die Zahl der Quader beherrschbar bleibt.
  const mann = COMBAT_ROLES.reduce((sum, key) => sum + (units[key] || 0), 0);
  const gesamt = Math.max(1, Math.min(MAX_BLOCKS, Math.ceil(mann / MEN_PER_BLOCK)));
  const proMann = mann > 0 ? gesamt / mann : 0;

  // Ein Block, kein Gänsemarsch: ungefähr doppelt so breit wie tief.
  const reihen = Math.max(1, Math.min(8, Math.round(Math.sqrt(gesamt / 2.2))));
  const jeReihe = Math.ceil(gesamt / reihen);
  let index = 0;
  for (const key of COMBAT_ROLES) {
    const anzahl = Math.round((units[key] || 0) * proMann);
    const form = SHAPES[key] || SHAPES.infantry;
    for (let i = 0; i < anzahl && index < gesamt; i++, index++) {
      const reihe = Math.floor(index / jeReihe);
      const glied = index % jeReihe;
      const wuerfel = new THREE.Mesh(
        new THREE.BoxGeometry(form.w, form.h, form.d),
        material
      );
      wuerfel.position.set(
        facing * reihe * 1.45,
        form.h / 2,
        (glied - (jeReihe - 1) / 2) * 1.3
      );
      // Die vorderste Reihe fällt zuerst: die Liste wird danach sortiert.
      wuerfel.userData = { reihe, hoehe: form.h, rolle: key };
      group.add(wuerfel);
      bloecke.push(wuerfel);
    }
  }
  bloecke.sort((a, b) => a.userData.reihe - b.userData.reihe);
  return { group, bloecke, defs };
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
  schauScene.background = new THREE.Color(0x1c1712);
  schauScene.fog = new THREE.Fog(0x1c1712, 55, 130);
  makeLights(schauScene);
  schauScene.add(makeGround(report.terrainType, report.naval));

  const angreiferFarbe = hooks.attackerColor || '#c0392b';
  const verteidigerFarbe = hooks.defenderColor || '#3f6fa8';

  const angreifer = makeFormation(report.attackerEngaged || {},
    report.attackerFactionId, angreiferFarbe, -1);
  const verteidiger = makeFormation(report.defenderEngaged || {},
    report.defenderFactionId, verteidigerFarbe, 1);
  angreifer.group.position.x = -START_GAP;
  verteidiger.group.position.x = START_GAP;
  schauScene.add(angreifer.group);
  schauScene.add(verteidiger.group);

  let wall = null;
  if ((report.wallMultiplier || 1) > 1) {
    // Holz für die Palisade, Quaderstein für die Mauer - dieselbe Unter-
    // scheidung wie auf der Karte.
    wall = makeWall(report.wallMultiplier,
      report.wallMultiplier >= 2 ? '#9c968a' : '#6f5433');
    wall.position.x = CLASH_GAP + 0.9;
    schauScene.add(wall);
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

  const zeige = (bloecke, wieViele) => {
    for (let i = 0; i < bloecke.length; i++) {
      const steht = i < wieViele;
      const w = bloecke[i];
      if (steht === w.visible) continue;
      w.visible = steht;
    }
  };

  const schritt = (now) => {
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;
    resize();

    // 1. Aufmarsch: beide Linien gehen aufeinander zu.
    const marsch = Math.min(1, t / T_MARCH);
    const weich = marsch * marsch * (3 - 2 * marsch);
    const abstand = START_GAP + (CLASH_GAP - START_GAP) * weich;
    angreifer.group.position.x = -abstand;
    verteidiger.group.position.x = abstand;

    // 2. Die Runden: je Runde ein Ruck nach vorn und die Verluste danach.
    const nachMarsch = Math.max(0, t - T_MARCH);
    const rundenIndex = Math.min(buch.runden.length - 1,
      Math.floor(nachMarsch / T_ROUND));
    if (buch.runden.length && nachMarsch > 0) {
      const runde = buch.runden[rundenIndex];
      const inRunde = (nachMarsch % T_ROUND) / T_ROUND;
      // Der Zusammenprall: ein kurzer Stoß aufeinander zu und zurück.
      const stoss = Math.sin(Math.min(1, inRunde * 2.2) * Math.PI) * 1.5;
      angreifer.group.position.x = -abstand + stoss;
      verteidiger.group.position.x = abstand - stoss;
      // Die Verluste dieser Runde erscheinen in ihrer zweiten Hälfte.
      const anteil = Math.max(0, Math.min(1, (inRunde - 0.45) / 0.4));
      const vorherA = rundenIndex > 0 ? buch.runden[rundenIndex - 1].angreiferLinks : startA;
      const vorherD = rundenIndex > 0 ? buch.runden[rundenIndex - 1].verteidigerLinks : startD;
      const jetztA = vorherA + (runde.angreiferLinks - vorherA) * anteil;
      const jetztD = vorherD + (runde.verteidigerLinks - vorherD) * anteil;
      zeige(angreifer.bloecke, bloeckeFuer(zahlA, startA, jetztA));
      zeige(verteidiger.bloecke, bloeckeFuer(zahlD, startD, jetztD));
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
      if (sieger === 'attacker') {
        verteidiger.group.position.x = CLASH_GAP + weg;
        angreifer.group.position.x = -CLASH_GAP + weg * 0.35;
      } else {
        angreifer.group.position.x = -CLASH_GAP - weg;
        verteidiger.group.position.x = CLASH_GAP - weg * 0.35;
      }
      if (!fertig && flucht >= 1) {
        fertig = true;
        if (hooks.onEnd) hooks.onEnd();
      }
    }

    // Eine ruhige Kamera: sie steht schräg über dem Feld und schwenkt nur
    // wenig. Eine Fahrt rundherum wäre hübsch und würde den Blick auf das
    // Wesentliche - wer noch steht - jede Sekunde ändern.
    const schwenk = Math.sin(t * 0.16) * 0.22;
    const hoehe = 9.5 + Math.min(t, 8) * 0.3;
    schauCamera.position.set(Math.sin(schwenk) * 22, hoehe, Math.cos(schwenk) * 22);
    schauCamera.lookAt(blick);

    schauRenderer.render(schauScene, schauCamera);
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
