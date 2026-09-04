// --- Das Gefecht auf der Karte -------------------------------------------
// Es gibt keinen zweiten Bildschirm: gekämpft wird dort, wo die Flotten
// stehen. Der Bericht aus `combat.js` ist die Partitur - jede Runde wird
// geflogen: Anflug, Laserfäden, Torpedos gegen den Schild, Wracks.
import {
  sceneHandles, worldOfTile, TILE_SIZE, flashTile, glideTo, zoomTo, cameraState, setCamera,
} from './scene3d.js';
import { factionProfile, ROLE_SHORT } from './data.js';
import { shipModel, SHIP_LENGTH } from './ships3d.js';
import { sfx } from './audio.js';

let running = false;
let cancelled = false;
let group = null;

function ensureGroup() {
  const { scene } = sceneHandles();
  if (!scene) return null;
  if (!group) {
    group = new THREE.Group();
    group.name = 'gefecht';
    scene.add(group);
  }
  return group;
}

function clearGroup() {
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  }
}

// Wie groß ein Schiff im Gefecht auf der Karte steht. Ein Jäger ist ein
// halbes Feld lang, ein Träger füllt eines - so bleibt zu sehen, wer da
// aufeinander schießt.
const FIGHT_LENGTH = {
  jaeger: 2.8, bomber: 3.2, korvette: 4, kreuzer: 5, traeger: 6.2, marines: 3.2, wache: 3.6,
};

// Ein Schiff im Gefecht. Es trägt dieselbe Silhouette wie auf der Karte -
// nur fliegt es hier seine eigene Bahn.
function makeFighter(kind, role, profile, heading) {
  const scale = FIGHT_LENGTH[role] / SHIP_LENGTH[role];
  const mesh = shipModel(kind, role, profile.color, profile.accent, { scale, detail: 'low' });
  mesh.rotation.y = heading;
  return mesh;
}

// Womit eine Seite ins Gefecht geht: die Verbände, die sie wirklich hat, vom
// schwersten zum leichtesten - Träger einmal, Jäger so oft wie nötig.
function battleRoles(units, slots) {
  const order = ['traeger', 'kreuzer', 'korvette', 'bomber', 'marines', 'jaeger', 'wache'];
  const present = order.filter((r) => units.some((u) => u.role === r && u.count > 0));
  if (!present.length) return new Array(slots).fill('jaeger');
  const out = [];
  for (const role of present) {
    // Große Kiele einmal, kleine nach Zahl - so steht ein Träger zwischen
    // seinen Staffeln und nicht zehnmal nebeneinander.
    const many = role === 'jaeger' || role === 'bomber' || role === 'marines';
    out.push(role);
    if (many) out.push(role, role);
  }
  while (out.length < slots) out.push(present[present.length - 1]);
  return out.slice(0, slots);
}

function makeLaser(from, to, colour) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.95 });
  return new THREE.Line(geo, mat);
}

function makeBurst(position, colour, size = 2.4) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 10, 8),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9 }),
  );
  mesh.position.copy(position);
  return mesh;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wie ein Schiff im Gefecht fliegt: schwere Kiele halten die Linie und
// drehen kaum, Jäger kreisen eng und schnell.
const FLIGHT_STYLE = {
  jaeger: { radius: 4.2, speed: 1.35 },
  bomber: { radius: 3.4, speed: 0.9 },
  korvette: { radius: 2.6, speed: 0.62 },
  kreuzer: { radius: 1.8, speed: 0.42 },
  traeger: { radius: 1.1, speed: 0.26 },
  marines: { radius: 3.0, speed: 0.8 },
  wache: { radius: 2.4, speed: 0.7 },
};

function setupFlight(ship, role, heading) {
  const style = FLIGHT_STYLE[role] || FLIGHT_STYLE.jaeger;
  ship.userData.role = role;
  ship.userData.phase = Math.random() * Math.PI * 2;
  ship.userData.radius = style.radius * (0.8 + Math.random() * 0.4);
  ship.userData.speed = style.speed * (0.85 + Math.random() * 0.3);
  ship.userData.yaw = heading;
  ship.userData.runUntil = 0;
  ship.rotation.y = heading;
}

// Ein Anflug: das Schiff zieht in einer Welle auf den Gegner zu und wieder
// zurück auf seinen Platz.
function attackRun(ship, target, clock, span = 2.6) {
  ship.userData.runFrom = clock.t;
  ship.userData.runUntil = clock.t + span;
  ship.userData.runTarget = target.position.clone();
}

// --- Torpedos -------------------------------------------------------------
// Bomber schießen nicht, sie stoßen zu: ein Torpedo braucht seine Zeit,
// zieht eine Spur und geht am Ende hoch. Das ist der Grund, warum Bomber
// mitfliegen - und warum Jäger sie abfangen sollen.
const torpedoes = [];

function launchTorpedo(group, from, to, colour, onHit) {
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.9, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff0d0 }),
  );
  body.rotation.x = Math.PI / 2;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 8, 6),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.55 }),
  );
  const trail = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 3.2, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.3 }),
  );
  trail.rotation.x = -Math.PI / 2;
  trail.position.z = -1.9;
  const torp = new THREE.Group();
  torp.add(body, glow, trail);
  torp.position.copy(from);
  torp.lookAt(to);
  group.add(torp);

  const start = performance.now();
  const dur = 900 + from.distanceTo(to) * 18;
  const target = to.clone();
  const entry = {
    mesh: torp,
    step() {
      const t = Math.min(1, (performance.now() - start) / dur);
      torp.position.lerpVectors(from, target, t);
      // Ein Torpedo läuft nicht schnurgerade: er zieht leicht nach.
      torp.position.y += Math.sin(t * Math.PI) * 1.2;
      torp.lookAt(target);
      if (t >= 1) {
        entry.done = true;
        group.remove(torp);
        if (onHit) onHit(target);
      }
    },
    done: false,
  };
  torpedoes.push(entry);
  return entry;
}

function stepTorpedoes() {
  for (let i = torpedoes.length - 1; i >= 0; i--) {
    torpedoes[i].step();
    if (torpedoes[i].done) torpedoes.splice(i, 1);
  }
}

// --- Die Vorstellung -----------------------------------------------------
// `report` ist der fertige Bericht; hier wird er nur noch gezeigt. Das Spiel
// wartet darauf, aber es hängt nicht davon ab: wer abbricht, bekommt sofort
// das Ergebnis.
export async function playBattle(report, { speed = 1, onRound = null, render = null } = {}) {
  const g = ensureGroup();
  if (!g || !report) return;
  running = true;
  cancelled = false;
  clearGroup();

  const attackerProfile = factionProfile(report.attacker.factionId);
  const defenderProfile = factionProfile(report.defender.factionId);
  const attackerColour = new THREE.Color(attackerProfile.color);
  const defenderColour = new THREE.Color(defenderProfile.color);
  const centre = worldOfTile(report.col, report.row);
  const origin = new THREE.Vector3(centre.x, 5, centre.z);

  // Der Blick geht auf das Feld, auf dem gekämpft wird - und geht heran:
  // ein Gefecht sieht man sich aus der Nähe an.
  // Die Kamera geht nah heran und flacher: ein Gefecht sieht man von der
  // Seite, nicht von oben auf eine Landkarte.
  const camBefore = cameraState();
  await glideTo(report.col, report.row, 380 / speed);
  setCamera({ polar: 1.02 });
  await zoomTo(4.0, 520 / speed);

  // Die beiden Seiten stellen sich gegenüber auf: Angreifer kommt von
  // Westen, Verteidiger hält die Stellung.
  const attackers = [];
  const defenders = [];
  const attackerCount = Math.min(8, Math.max(3, Math.round(sumUnits(report.attacker.units) / 6)));
  const defenderCount = Math.min(8, Math.max(3, Math.round(sumUnits(report.defender.units) / 6)));
  const attackerRoles = battleRoles(report.attacker.units, attackerCount);
  const defenderRoles = battleRoles(report.defender.units, defenderCount);
  for (let i = 0; i < attackerCount; i++) {
    // Der Angreifer kommt von Westen und fliegt nach Osten.
    const f = makeFighter(attackerProfile.kind, attackerRoles[i], attackerProfile, Math.PI / 2);
    const angle = (i / attackerCount) * Math.PI - Math.PI / 2;
    f.userData.home = new THREE.Vector3(
      origin.x - TILE_SIZE * 2.8 + Math.cos(angle) * 3.4,
      6 + Math.sin(angle) * 4,
      origin.z + Math.sin(angle) * TILE_SIZE * 1.5,
    );
    f.position.copy(f.userData.home);
    setupFlight(f, attackerRoles[i], Math.PI / 2);
    g.add(f);
    attackers.push(f);
  }
  for (let i = 0; i < defenderCount; i++) {
    // Der Verteidiger hält dagegen und blickt nach Westen.
    const f = makeFighter(defenderProfile.kind, defenderRoles[i], defenderProfile, -Math.PI / 2);
    const angle = (i / defenderCount) * Math.PI + Math.PI / 2;
    f.userData.home = new THREE.Vector3(
      origin.x + TILE_SIZE * 2.6 + Math.cos(angle) * 3.4,
      6 + Math.sin(angle) * 4,
      origin.z + Math.sin(angle) * TILE_SIZE * 1.5,
    );
    f.position.copy(f.userData.home);
    setupFlight(f, defenderRoles[i], -Math.PI / 2);
    g.add(f);
    defenders.push(f);
  }

  // Steht ein System dahinter, wird der Schild sichtbar: eine Kuppel, die
  // Runde für Runde dünner wird.
  let shieldMesh = null;
  if (report.shield && report.shield.level > 0) {
    shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(TILE_SIZE * 0.8, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    );
    shieldMesh.position.set(origin.x + TILE_SIZE * 0.6, 6, origin.z);
    g.add(shieldMesh);
  }

  const clock = { t: 0 };
  let live = true;

  // Jedes Schiff fliegt seine eigene Bahn: eine langsame Ellipse um seinen
  // Platz im Verband, dazu ein Anflug, wenn es an der Reihe ist. Die Nase
  // zeigt immer dorthin, wo es hinfliegt - kein Zappeln, kein Rückwärtsflug.
  const _prev = new THREE.Vector3();
  const _next = new THREE.Vector3();
  function station(ship, t) {
    const d = ship.userData;
    const a = t * d.speed + d.phase;
    return _next.set(
      d.home.x + Math.cos(a) * d.radius * 0.8,
      d.home.y + Math.sin(a * 0.7 + d.phase) * 1.6,
      d.home.z + Math.sin(a) * d.radius,
    );
  }
  function flyShip(ship, t) {
    const d = ship.userData;
    _prev.copy(ship.position);
    station(ship, t);
    // Läuft ein Anflug, wird die Bahn zum Gegner hin verschoben und wieder
    // zurück - eine Welle, kein Sprung.
    if (d.runUntil && t < d.runUntil) {
      const span = d.runUntil - d.runFrom;
      const k = Math.sin(((t - d.runFrom) / span) * Math.PI);
      _next.x += (d.runTarget.x - d.home.x) * k * 0.72;
      _next.y += (d.runTarget.y - d.home.y) * k * 0.72;
      _next.z += (d.runTarget.z - d.home.z) * k * 0.72;
    }
    ship.position.copy(_next);
    // Kurs aus der tatsächlichen Bewegung: so fliegt kein Schiff seitwärts.
    const dx = ship.position.x - _prev.x;
    const dz = ship.position.z - _prev.z;
    if (dx * dx + dz * dz > 1e-6) {
      const want = Math.atan2(dx, dz);
      let delta = want - d.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      d.yaw += delta * 0.14;
      ship.rotation.y = d.yaw;
      ship.rotation.z = Math.max(-0.55, Math.min(0.55, -delta * 14));
    }
  }

  const swirl = () => {
    if (!live) return;
    // Deutlich langsamer als vorher: die Verbände fliegen, sie flirren nicht.
    clock.t += 0.016 * speed;
    for (const f of attackers) flyShip(f, clock.t);
    for (const f of defenders) flyShip(f, clock.t);
    stepTorpedoes();
    if (render) render();
    requestAnimationFrame(swirl);
  };
  requestAnimationFrame(swirl);

  // Runde für Runde: Anflüge, Salven, Torpedos, Verluste.
  for (const round of report.rounds) {
    if (cancelled) break;
    if (onRound) onRound(round);

    // Wer greift in dieser Runde an? Zwei bis drei Maschinen je Seite ziehen
    // einen Anflug; der Rest hält die Linie.
    const runners = [];
    for (const [side, foes] of [[attackers, defenders], [defenders, attackers]]) {
      const many = Math.min(3, Math.max(1, Math.round(side.length / 3)));
      for (let i = 0; i < many; i++) {
        const ship = side[Math.floor(Math.random() * side.length)];
        const foe = foes[Math.floor(Math.random() * foes.length)];
        if (!ship || !foe || runners.includes(ship)) continue;
        attackRun(ship, foe, clock, 2.4 + Math.random());
        runners.push(ship);
      }
    }

    // Die Salven: ruhiger getaktet als früher, dafür trifft man mit dem Auge
    // mit, wer auf wen schießt.
    const shots = 5;
    for (let s = 0; s < shots; s++) {
      if (cancelled) break;
      const a = attackers[Math.floor(Math.random() * attackers.length)];
      const d = defenders[Math.floor(Math.random() * defenders.length)];
      if (a && d) {
        const laser = makeLaser(a.position, d.position, attackerColour);
        const back = makeLaser(d.position, a.position, defenderColour);
        g.add(laser, back);
        sfx.laser();
        setTimeout(() => { g.remove(laser); g.remove(back); }, 150 / speed);
      }
      await wait(150 / speed);
    }

    // Die Torpedos: jeder Bomber im Verband stößt einmal zu - gegen den
    // Schild, wenn eine Welt dahintersteht, sonst gegen den schwersten Kiel
    // auf der anderen Seite.
    for (const [side, foes, colour, profile] of [
      [attackers, defenders, attackerColour, attackerProfile],
      [defenders, attackers, defenderColour, defenderProfile],
    ]) {
      const bombers = side.filter((sh) => sh.userData.role === 'bomber');
      for (const bomber of bombers.slice(0, 2)) {
        if (cancelled) break;
        const aim = shieldMesh && side === attackers
          ? shieldMesh
          : foes.slice().sort((x, y) => (FLIGHT_STYLE[y.userData.role].radius < FLIGHT_STYLE[x.userData.role].radius ? 1 : -1))[0];
        if (!aim) continue;
        sfx.torpedo();
        launchTorpedo(g, bomber.position.clone(), aim.position.clone(), colour, (at) => {
          const burst = makeBurst(at, 0xffd08a, 2.4);
          g.add(burst);
          sfx.treffer();
          setTimeout(() => g.remove(burst), 420 / speed);
        });
        await wait(220 / speed);
      }
    }

    // Der Schild unter Beschuss.
    if (shieldMesh) {
      const remaining = Math.max(0, 1 - (round.shieldDown || 0) / 100);
      shieldMesh.material.opacity = 0.06 + remaining * 0.26;
      if ((round.shieldDown || 0) > 0) {
        sfx.schild();
        const hit = makeBurst(shieldMesh.position, 0x9fe4ff, 3.2);
        g.add(hit);
        setTimeout(() => g.remove(hit), 320 / speed);
      }
      if (remaining <= 0.01) {
        shieldMesh.visible = false;
        sfx.explosion();
      }
    }

    // Verluste: für jede Runde fallen so viele Maschinen aus der Formation,
    // wie der Bericht sagt - anteilig, damit die Zahl auf dem Feld stimmt.
    const lossA = sumLosses(round.lossesAttacker);
    const lossD = sumLosses(round.lossesDefender);
    await removeSome(g, attackers, lossA / Math.max(1, sumUnits(report.attacker.units) + lossA), speed);
    await removeSome(g, defenders, lossD / Math.max(1, sumUnits(report.defender.units) + lossD), speed);
    await wait(320 / speed);
  }

  // Der Ausgang: der Verlierer zieht ab, der Sieger bleibt und dreht eine
  // Runde über dem Feld.
  if (!cancelled) {
    const losers = report.winner === 'angreifer' ? defenders : attackers;
    for (const f of losers) {
      const burst = makeBurst(f.position, 0xffb066, 1.6);
      g.add(burst);
      setTimeout(() => g.remove(burst), 400 / speed);
    }
    sfx.explosion();
    flashTile(report.col, report.row, report.winner === 'angreifer' ? 0x7fffb0 : 0xff7a5a);
    await wait(420 / speed);
  }

  live = false;
  clearGroup();
  setCamera({ polar: camBefore.polar });
  await zoomTo(camBefore.zoom, 420 / speed);
  running = false;
  if (render) render();
}

async function removeSome(g, list, share, speed) {
  const kill = Math.min(list.length, Math.round(list.length * Math.max(0, Math.min(0.9, share))));
  for (let i = 0; i < kill; i++) {
    const f = list.pop();
    if (!f) break;
    const burst = makeBurst(f.position, 0xffd08a, 1.2);
    g.add(burst);
    g.remove(f);
    sfx.treffer();
    setTimeout(() => g.remove(burst), 300 / speed);
    await wait(90 / speed);
  }
}

function sumUnits(units) {
  return (units || []).reduce((s, u) => s + Math.max(0, u.count), 0);
}
function sumLosses(losses) {
  return Object.values(losses || {}).reduce((s, n) => s + n, 0);
}

export function stopBattle() {
  cancelled = true;
  clearGroup();
  running = false;
}

export function isBattleRunning() {
  return running;
}

// Der Bericht in Worten - dieselbe Partitur, nur zum Lesen. Er steht im
// Fenster nach dem Gefecht.
export function battleRoundsHTML(report) {
  if (!report) return '';
  return `<table class="battle-rounds">
    <thead><tr><th>Runde</th><th>Angreifer</th><th>Verteidiger</th><th>Schild</th></tr></thead>
    <tbody>${report.rounds.map((r) => `<tr>
      <td>${r.round}</td>
      <td>${r.attackStrength} <small>(${lossText(r.lossesAttacker)})</small></td>
      <td>${r.defenceStrength} <small>(${lossText(r.lossesDefender)})</small></td>
      <td>${r.shieldDown == null ? '—' : `${r.shieldDown}%`}</td>
    </tr>`).join('')}</tbody></table>`;
}

function lossText(losses) {
  const parts = Object.entries(losses || {})
    .filter(([, n]) => n > 0)
    .map(([role, n]) => `−${n} ${ROLE_SHORT[role] || role}`);
  return parts.length ? parts.join(', ') : 'ohne Verlust';
}
