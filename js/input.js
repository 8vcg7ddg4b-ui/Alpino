import { computeReachable, tileKey } from './pathfind.js';
import { armyAt, cityAt, playerFaction } from './state.js';
import { moveArmy, previewTileCombat, moveWarning, besiegeCity } from './actions.js';
import {
  pickTile, groundPointAt, panCameraByWorld, panCameraRelative, panCameraByScreen,
  zoomCamera, rotateCamera,
  animateArmyPath, playBattleClash, isAnimating,
} from './scene3d.js';
import { sfx, startMarch, stopMarch } from './audio.js';

const PAN_KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};

function selectArmy(state, army) {
  state.selectedArmyId = army.id;
  state.selectedCityId = null;
  state.reachable = computeReachable(state, army);
}

function clearSelection(state) {
  state.selectedArmyId = null;
  state.selectedCityId = null;
  state.reachable = null;
}

// Turns the pathfinder's route into what the army visibly does. A clean move
// walks the whole path; an attack that fails stops short, lunges at the
// defender, and (if anyone survived) retreats back to where it started.
function buildMarchRoute(path, origin, survivor, dest) {
  if (survivor && survivor.col === dest.col && survivor.row === dest.row) return path;

  const approach = path.slice(0, -1);
  const from = approach.length ? approach[approach.length - 1] : origin;
  const route = [...approach, {
    col: from.col + (dest.col - from.col) * 0.45,
    row: from.row + (dest.row - from.row) * 0.45,
  }];

  if (survivor) {
    for (let i = approach.length - 1; i >= 0; i--) route.push(approach[i]);
    route.push(origin);
  }
  return route;
}

function toNdc(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

export function setupInput(canvas, getState, onChange, onShowReport, onBeforeAction, onPreviewAttack, onInspect, onConfirmBorder, onWatchBattle) {
  // Pointer events cover mouse, pen and touch in one path. Two simultaneous
  // pointers mean a pinch: the distance between them zooms, the angle between
  // them turns the map.
  const pointers = new Map();
  let dragMoved = false;
  let dragAnchor = null;
  let pinch = null;
  // Mit gedrücktem Mausrad wird die Kamera geschwenkt: seitlich dreht sie um
  // die Bildmitte, nach oben und unten neigt sie sich. Mit Umschalt dazu wird
  // stattdessen verschoben - das braucht man, wo unter dem Zeiger kein Boden
  // liegt und das Ziehen mit der linken Taste deshalb nicht greift.
  let freeLook = null;

  const pointerNdc = (e) => toNdc(canvas, e.clientX, e.clientY);

  function pinchMetrics() {
    const [a, b] = [...pointers.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  }

  // Pointer capture throws for an id the browser no longer tracks; losing the
  // capture is harmless, but letting it throw would kill the whole handler.
  function capturePointer(id) {
    try { canvas.setPointerCapture(id); } catch (err) { /* keep going uncaptured */ }
  }
  function releasePointer(id) {
    try { canvas.releasePointerCapture(id); } catch (err) { /* already gone */ }
  }

  canvas.addEventListener('pointerdown', (e) => {
    // Die rechte Taste schlägt nur nach (siehe contextmenu): sie darf nichts
    // auswählen und nichts bewegen.
    if (e.button === 2) return;
    // Mausrad gedrückt: Kameraschwenk, ohne Auswahl und ohne die
    // Bildlauf-Automatik des Browsers.
    if (e.button === 1) {
      e.preventDefault();
      capturePointer(e.pointerId);
      freeLook = { id: e.pointerId, x: e.clientX, y: e.clientY, turn: !e.shiftKey };
      canvas.classList.add('free-look');
      return;
    }
    capturePointer(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      dragMoved = false;
      const ndc = pointerNdc(e);
      dragAnchor = groundPointAt(ndc.x, ndc.y);
    } else if (pointers.size === 2) {
      // A second finger cancels the drag and starts a pinch.
      dragAnchor = null;
      pinch = pinchMetrics();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (freeLook && e.pointerId === freeLook.id) {
      e.preventDefault();
      const dx = e.clientX - freeLook.x;
      const dy = e.clientY - freeLook.y;
      freeLook.x = e.clientX;
      freeLook.y = e.clientY;
      if (freeLook.turn) rotateCamera(dx * 0.006, -dy * 0.004);
      else panCameraByScreen(dx, dy, canvas.clientHeight);
      onChange();
      return;
    }
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2 && pinch) {
      e.preventDefault();
      const now = pinchMetrics();
      if (pinch.distance > 0 && now.distance > 0) {
        zoomCamera(now.distance / pinch.distance);
      }
      let turn = now.angle - pinch.angle;
      // Keep the shortest way round so crossing ±π does not spin the map.
      if (turn > Math.PI) turn -= Math.PI * 2;
      if (turn < -Math.PI) turn += Math.PI * 2;
      rotateCamera(turn);
      pinch = now;
      dragMoved = true;
      onChange();
      return;
    }

    if (pointers.size !== 1 || !dragAnchor) return;
    e.preventDefault();
    const ndc = pointerNdc(e);
    const q = groundPointAt(ndc.x, ndc.y);
    if (!q) return;
    const dx = dragAnchor.x - q.x;
    const dz = dragAnchor.z - q.z;
    if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) dragMoved = true;
    if (dragMoved) {
      panCameraByWorld(dx, dz);
      onChange();
    }
  }, { passive: false });

  function endPointer(e) {
    if (freeLook && e.pointerId === freeLook.id) {
      freeLook = null;
      releasePointer(e.pointerId);
      canvas.classList.remove('free-look');
      return;
    }
    if (!pointers.has(e.pointerId)) return;
    const wasSingleTap = pointers.size === 1 && !dragMoved;
    pointers.delete(e.pointerId);
    releasePointer(e.pointerId);

    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      dragAnchor = null;
      if (wasSingleTap) handleClick(e);
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  // Ohne das öffnet der Mittelklick in manchen Browsern die Bildlauf-Automatik
  // oder einen Link im neuen Tab.
  canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

  // Rechte Maustaste: das Feld nachschlagen, ohne etwas auszuwählen oder zu
  // bewegen. Wer eine Armee im Zug hat, verliert sie dabei nicht.
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!onInspect) return;
    const ndc = toNdc(canvas, e.clientX, e.clientY);
    const tile = pickTile(ndc.x, ndc.y);
    onInspect(tile, e.clientX, e.clientY);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Shift + wheel turns the map, matching the two-finger twist.
    if (e.shiftKey) rotateCamera(e.deltaY * 0.004);
    else zoomCamera(e.deltaY < 0 ? 1.12 : 0.89);
    onChange();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'q' || e.key === 'e') {
      rotateCamera(e.key === 'q' ? -0.18 : 0.18);
      onChange();
      return;
    }
    const delta = PAN_KEYS[e.key];
    if (!delta) return;
    panCameraRelative(delta[0] * 1.4, delta[1] * 1.4);
    onChange();
  });

  // Commits a move: the state changes at once, and the army is then shown
  // walking there. The route is re-derived here rather than reused, so a move
  // confirmed from the forecast dialog still uses the current position.
  function executeMove(armyId, col, row) {
    const state = getState();
    if (!state) return;
    const marching = state.armies.find((a) => a.id === armyId);
    if (!marching) return;
    const entry = computeReachable(state, marching).get(tileKey(col, row));
    if (!entry) return;
    const origin = { col: marching.col, row: marching.row };

    if (onBeforeAction) onBeforeAction();
    // Drop the range overlay before the march so the army isn't walking
    // across its own highlighted tiles.
    state.reachable = null;
    const outcome = moveArmy(state, armyId, col, row);
    const survivor = state.armies.find((a) => a.id === armyId);
    const route = buildMarchRoute(entry.path, origin, survivor, { col, row });
    const reports = outcome.reports || [];

    const settle = () => {
      if (survivor && survivor.movement > 0) {
        selectArmy(state, survivor);
      } else {
        clearSelection(state);
      }
      onChange();
      // The report is the last beat: the player watches the clash, then
      // reads what it cost.
      if (reports.length && onShowReport) onShowReport(reports[reports.length - 1]);
    };

    startMarch();
    animateArmyPath(armyId, route, () => {
      stopMarch();
      if (!reports.length) {
        settle();
        return;
      }
      // Wer der Schlacht zusehen will, bekommt sie im eigenen Fenster gezeigt -
      // dann bleibt der kurze Zusammenprall auf der Karte aus, sonst sähe man
      // dasselbe zweimal. Das Fenster meldet sich selbst zurück, wenn es fertig
      // ist; sagt es ab, geht es wie bisher weiter.
      const schlacht = reports[reports.length - 1];
      if (onWatchBattle && onWatchBattle(schlacht, settle)) return;
      sfx.clash();
      // Ob auf See gefochten wurde, sagt der Bericht selbst.
      const zurSee = reports.some((r) => r.naval);
      playBattleClash(col, row, settle, { naval: zurSee });
    });
    onChange();
  }

  // Eine Belagerung: das Heer marschiert bis vor den Ort und gräbt sich dort
  // ein, statt über die Mauer zu gehen. Der Weg dorthin ist derselbe wie beim
  // Angriff, nur endet er ein Feld früher.
  function executeSiege(armyId, siege) {
    const state = getState();
    if (!state || !siege) return;
    const marching = state.armies.find((a) => a.id === armyId);
    if (!marching) return;

    if (onBeforeAction) onBeforeAction();
    state.reachable = null;
    const schonDa = marching.col === siege.col && marching.row === siege.row;
    const origin = { col: marching.col, row: marching.row };
    let route = null;
    if (!schonDa) {
      const entry = computeReachable(state, marching).get(tileKey(siege.col, siege.row));
      if (!entry) { onChange(); return; }
      const outcome = moveArmy(state, armyId, siege.col, siege.row);
      if (!outcome.ok) { onChange(); return; }
      const survivor = state.armies.find((a) => a.id === armyId);
      route = buildMarchRoute(entry.path, origin, survivor, siege);
    }

    const einschliessen = () => {
      const jetzt = getState();
      const ergebnis = besiegeCity(jetzt, armyId, siege.cityId);
      if (ergebnis.ok) sfx.raise();
      else sfx.denied();
      clearSelection(jetzt);
      onChange();
    };

    if (!route) { einschliessen(); return; }
    startMarch();
    animateArmyPath(armyId, route, () => {
      stopMarch();
      einschliessen();
    });
    onChange();
  }

  function handleClick(e) {
    const state = getState();
    if (!state || state.gameOver || isAnimating()) return;
    const ndc = toNdc(canvas, e.clientX, e.clientY);
    const tile = pickTile(ndc.x, ndc.y);
    if (!tile) {
      clearSelection(state);
      state.inspectedTile = null;
      onChange();
      return;
    }
    const { col, row } = tile;
    if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) {
      clearSelection(state);
      state.inspectedTile = null;
      onChange();
      return;
    }
    // Every click reports the ground it landed on, whatever else it does.
    state.inspectedTile = { col, row };

    const player = playerFaction(state);
    const clickedArmy = armyAt(state, col, row);
    const clickedCity = cityAt(state, col, row);

    if (state.selectedArmyId) {
      const entry = state.reachable && state.reachable.get(tileKey(col, row));
      if (entry) {
        const armyId = state.selectedArmyId;
        // Eine Grenze überschreitet man nicht aus Versehen: führt der Weg über
        // fremdes Land, wird vorher gefragt - der Schritt ist eine
        // Kriegserklärung.
        const marching = state.armies.find((a) => a.id === armyId);
        const grenze = marching && moveWarning(state, marching, col, row, state.reachable);
        if (grenze && onConfirmBorder) {
          onConfirmBorder(grenze, () => executeMove(armyId, col, row));
          return;
        }
        // An attack is put to the player first: the forecast says what the
        // fight is likely to cost, and only then is it committed to.
        if (entry.combat && onPreviewAttack) {
          const preview = previewTileCombat(state, armyId, col, row);
          if (preview) {
            onPreviewAttack(preview, () => executeMove(armyId, col, row),
              preview.siege && preview.siege.can
                ? () => executeSiege(armyId, preview.siege) : null);
            return;
          }
        }
        executeMove(armyId, col, row);
        return;
      }
    }

    const ownArmyHere = clickedArmy && clickedArmy.factionId === player.id ? clickedArmy : null;

    if (ownArmyHere || clickedCity) sfx.select();

    if (ownArmyHere && clickedCity) {
      // A tile can hold both a friendly army and a city (e.g. a garrisoned
      // capital) - repeated clicks alternate between the two selections.
      if (state.selectedArmyId === ownArmyHere.id) {
        state.selectedCityId = clickedCity.id;
        state.selectedArmyId = null;
        state.reachable = null;
      } else {
        selectArmy(state, ownArmyHere);
      }
    } else if (ownArmyHere) {
      selectArmy(state, ownArmyHere);
    } else if (clickedCity) {
      state.selectedCityId = clickedCity.id;
      state.selectedArmyId = null;
      state.reachable = null;
    } else {
      clearSelection(state);
    }
    onChange();
  }
}
