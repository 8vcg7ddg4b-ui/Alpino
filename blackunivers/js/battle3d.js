// --- Das Gefecht auf der Karte -------------------------------------------
// Es gibt keinen zweiten Bildschirm: gekämpft wird dort, wo die Flotten
// stehen. Der Bericht aus `combat.js` ist die Partitur - jede Runde wird
// geflogen: Anflug, Laserfäden, Torpedos gegen den Schild, Wracks.
import { sceneHandles, worldOfTile, TILE_SIZE, flashTile, glideTo, zoomTo, cameraState } from './scene3d.js';
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
  const zoomBefore = cameraState().zoom;
  await glideTo(report.col, report.row, 380 / speed);
  await zoomTo(Math.max(zoomBefore, 2.8), 420 / speed);

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
    f.userData.phase = Math.random() * Math.PI * 2;
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
    f.userData.phase = Math.random() * Math.PI * 2;
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
  const swirl = () => {
    if (!live) return;
    clock.t += 0.05 * speed;
    for (const f of attackers) {
      f.position.x = f.userData.home.x + Math.sin(clock.t + f.userData.phase) * 2.4;
      f.position.z = f.userData.home.z + Math.cos(clock.t * 0.8 + f.userData.phase) * 2.2;
      f.position.y = f.userData.home.y + Math.sin(clock.t * 1.3 + f.userData.phase) * 0.6;
      // Rollen um die eigene Achse: das Modell blickt nach vorn, also liegt
      // die Rolle auf X.
      f.rotation.x = Math.sin(clock.t + f.userData.phase) * 0.45;
      f.rotation.y = Math.PI / 2 + Math.sin(clock.t * 0.6 + f.userData.phase) * 0.35;
    }
    for (const f of defenders) {
      f.position.x = f.userData.home.x + Math.cos(clock.t * 0.9 + f.userData.phase) * 2.2;
      f.position.z = f.userData.home.z + Math.sin(clock.t + f.userData.phase) * 2.4;
      f.position.y = f.userData.home.y + Math.cos(clock.t * 1.1 + f.userData.phase) * 0.6;
      f.rotation.x = Math.cos(clock.t + f.userData.phase) * 0.45;
      f.rotation.y = -Math.PI / 2 + Math.cos(clock.t * 0.7 + f.userData.phase) * 0.35;
    }
    if (render) render();
    requestAnimationFrame(swirl);
  };
  requestAnimationFrame(swirl);

  // Runde für Runde: Salven, Treffer, Verluste.
  for (const round of report.rounds) {
    if (cancelled) break;
    if (onRound) onRound(round);
    const shots = 6;
    for (let s = 0; s < shots; s++) {
      if (cancelled) break;
      const a = attackers[Math.floor(Math.random() * attackers.length)];
      const d = defenders[Math.floor(Math.random() * defenders.length)];
      if (a && d) {
        const laser = makeLaser(a.position, d.position, attackerColour);
        const back = makeLaser(d.position, a.position, defenderColour);
        g.add(laser, back);
        sfx.laser();
        setTimeout(() => { g.remove(laser); g.remove(back); }, 120 / speed);
      }
      await wait(70 / speed);
    }

    // Torpedos gegen den Schild - sie sind der Grund, warum Bomber mitfliegen.
    if (shieldMesh) {
      const remaining = Math.max(0, 1 - (round.shieldDown || 0) / 100);
      shieldMesh.material.opacity = 0.06 + remaining * 0.26;
      if ((round.shieldDown || 0) > 0) {
        sfx.schild();
        const hit = makeBurst(shieldMesh.position, 0x9fe4ff, 3.2);
        g.add(hit);
        setTimeout(() => g.remove(hit), 260 / speed);
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
    await wait(200 / speed);
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
  await zoomTo(zoomBefore, 380 / speed);
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
    await wait(50 / speed);
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
