import { createInitialState, playerFaction } from './state.js';
import { renderUI, battleReportHTML } from './ui.js';
import { setupInput } from './input.js';
import { computeReachable } from './pathfind.js';
import { aiTakeAllTurns } from './ai.js';
import {
  recruitUnit, raiseArmyFromGarrison, collectIncome, regenerateGarrisons,
  resetMovement, checkVictory, disbandArmyIntoCity, buyCityWalls,
  advanceWallConstruction, recoverArmies,
} from './actions.js';
import {
  initScene, buildMap, syncEntities, render, resize, centerOn, panCamera, zoomCamera,
  isAnimating,
} from './scene3d.js';
import { sfx, unlockAudio, toggleMuted, isMuted, stopMarch } from './audio.js';

const canvas = document.getElementById('gameCanvas');
const appEl = document.getElementById('app');
let state = null;

function resizeScene() {
  const rect = canvas.parentElement.getBoundingClientRect();
  resize(rect.width, rect.height);
}

// The window resize event misses changes that come from the page itself -
// collapsing the sidebar, or a host resizing the embed - so watch the map
// container directly.
function observeMapSize() {
  if (typeof ResizeObserver !== 'function') return;
  const observer = new ResizeObserver(() => {
    resizeScene();
    render();
  });
  observer.observe(canvas.parentElement);
}

function setupSidebarToggle() {
  const button = document.getElementById('sidebarBtn');
  if (!button) return;
  button.addEventListener('click', () => {
    const collapsed = appEl.classList.toggle('sidebar-collapsed');
    button.classList.toggle('active', collapsed);
    button.textContent = collapsed ? '⇤' : '⇥';
    // ResizeObserver picks the new size up, but resize now so the very next
    // frame is already correct.
    resizeScene();
    render();
  });
}

function setupMuteButton() {
  const button = document.getElementById('muteBtn');
  if (!button) return;
  const paint = () => {
    button.textContent = isMuted() ? '🔇' : '🔊';
    button.classList.toggle('active', !isMuted());
  };
  paint();
  button.addEventListener('click', () => {
    unlockAudio();
    toggleMuted();
    paint();
    if (!isMuted()) sfx.select();
  });
}

function syncSelection() {
  if (!state) return;
  if (state.selectedArmyId) {
    const army = state.armies.find((a) => a.id === state.selectedArmyId);
    if (army) {
      state.reachable = computeReachable(state, army);
    } else {
      state.selectedArmyId = null;
      state.reachable = null;
    }
  }
  if (state.selectedCityId && !state.cities.find((c) => c.id === state.selectedCityId)) {
    state.selectedCityId = null;
  }
}

const reportOverlay = document.getElementById('battleReport');
const undoBtn = document.getElementById('undoBtn');

const UNDO_LIMIT = 25;
const undoStack = [];

// The generated map never changes after startup, so snapshots share it by
// reference instead of copying 1200 tiles per action.
function snapshotState() {
  const { map, reachable, ...rest } = state;
  const copy = typeof structuredClone === 'function'
    ? structuredClone(rest)
    : JSON.parse(JSON.stringify(rest));
  return copy;
}

function pushUndo() {
  if (!state) return;
  undoStack.push(snapshotState());
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function undoLastAction() {
  if (!state || !undoStack.length || isAnimating()) return;
  const previous = undoStack.pop();
  state = { ...previous, map: state.map, reachable: null };
  stopMarch();
  sfx.undo();
  hideBattleReport();
  refresh();
}

function showBattleReport(reportOrId) {
  if (!state) return;
  const report = typeof reportOrId === 'string'
    ? state.battleReports.find((r) => r.id === reportOrId)
    : reportOrId;
  if (!report) return;
  document.getElementById('reportBody').innerHTML = battleReportHTML(state, report);
  reportOverlay.classList.remove('hidden');
}

function hideBattleReport() {
  reportOverlay.classList.add('hidden');
}

function refresh() {
  if (!state) return;
  syncSelection();
  syncEntities(state);
  render();
  renderUI(state, {
    onRecruit: (cityId, unitKey) => {
      pushUndo();
      const ok = recruitUnit(state, cityId, unitKey).ok;
      (ok ? sfx.recruit : sfx.denied)();
      refresh();
    },
    onRaise: (cityId) => {
      pushUndo();
      const ok = raiseArmyFromGarrison(state, cityId).ok;
      (ok ? sfx.raise : sfx.denied)();
      refresh();
    },
    onDisband: (armyId) => {
      pushUndo();
      const result = disbandArmyIntoCity(state, armyId);
      if (result.ok) state.selectedCityId = result.cityId;
      (result.ok ? sfx.disband : sfx.denied)();
      refresh();
    },
    onBuyWalls: (cityId) => {
      pushUndo();
      const ok = buyCityWalls(state, cityId).ok;
      (ok ? sfx.wallBuy : sfx.denied)();
      refresh();
    },
    onShowReport: showBattleReport,
  });

  undoBtn.disabled = undoStack.length === 0;
}

function endTurn() {
  // Ending the turn mid-march would let the AI move while the player's army is
  // still visibly walking, and the resulting sync would teleport it.
  if (!state || state.gameOver || isAnimating()) return;
  pushUndo();
  sfx.endTurn();
  const wallsBuilding = state.cities.filter((c) => c.walls === 'building').length;
  // Identify new reports by the previous head, not by length: the list is
  // capped, so once it is full its length stops growing.
  const previousHead = state.battleReports.length ? state.battleReports[0].id : null;

  aiTakeAllTurns(state);
  collectIncome(state);
  regenerateGarrisons(state);
  advanceWallConstruction(state);
  checkVictory(state);
  state.turn += 1;
  // Recovery is judged on the turn that just ended - an army that never spent
  // a movement point rested - so it runs before movement is replenished.
  recoverArmies(state);
  resetMovement(state);
  refresh();

  // AI turns can produce a whole string of battles. Surface only the most
  // recent one Rome was part of, so the player sees what happened to them
  // without a stack of modals for wars between other factions.
  let mine = null;
  for (const report of state.battleReports) {
    if (report.id === previousHead) break;
    if (report.involvesPlayer) { mine = report; break; }
  }
  if (mine && !state.gameOver) showBattleReport(mine);

  if (state.cities.some((c) => c.walls === 'complete') && wallsBuilding
    && state.cities.filter((c) => c.walls === 'building').length < wallsBuilding) {
    sfx.wallDone();
  }
  if (state.gameOver) (state.gameOver.result === 'victory' ? sfx.victory : sfx.defeat)();
}

let toastTimer = null;
function showToast(message, ms = 6000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
}

// When the page is embedded cross-origin without an explicit fullscreen
// permission, the browser refuses outright: document.fullscreenEnabled is
// false and the request throws a permissions-policy error. Detect that up
// front rather than swallowing the rejection and leaving a dead button.
function fullscreenAllowed() {
  const root = document.documentElement;
  return !!document.fullscreenEnabled && !!(root.requestFullscreen || root.webkitRequestFullscreen);
}

function requestAppFullscreen({ explain = false } = {}) {
  if (!fullscreenAllowed()) {
    if (explain) {
      showToast('Vollbild ist in dieser eingebetteten Ansicht gesperrt. '
        + 'Öffne das Spiel in einem eigenen Browser-Tab oder als Desktop-App – dort geht es. '
        + 'Mit ⇥ blendest du die Seitenleiste aus und gewinnst hier Platz.', 9000);
    }
    return false;
  }
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  Promise.resolve(request.call(root)).catch(() => {
    if (explain) showToast('Der Browser hat den Vollbildmodus abgelehnt.', 5000);
  });
  return true;
}

function setupFullscreenButton(button) {
  button.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      requestAppFullscreen({ explain: true });
    }
  });
  document.addEventListener('fullscreenchange', () => {
    button.classList.toggle('active', !!document.fullscreenElement);
    setTimeout(resizeScene, 60);
  });
}

function reflectFullscreenAvailability() {
  const allowed = fullscreenAllowed();
  for (const id of ['fullscreenBtn', 'menuFullscreenBtn']) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.classList.toggle('unavailable', !allowed);
    button.title = allowed
      ? 'Vollbildmodus'
      : 'Vollbild ist in dieser eingebetteten Ansicht gesperrt – in eigenem Tab öffnen';
  }
}

function setupDpad() {
  const STEP = 1.6;
  document.querySelectorAll('[data-pan]').forEach((btn) => {
    const [dc, dr] = btn.dataset.pan.split(',').map(Number);
    btn.addEventListener('click', () => {
      panCamera(dc * STEP, dr * STEP);
      render();
    });
  });
  document.querySelectorAll('[data-zoom]').forEach((btn) => {
    const factor = Number(btn.dataset.zoom);
    btn.addEventListener('click', () => {
      zoomCamera(factor);
      render();
    });
  });
}

// Without a WebGL context three.js throws while constructing the renderer.
// Say so plainly instead of leaving the player on a blank map - on desktop
// this is usually an outdated graphics driver or a VM without acceleration.
function showGraphicsError() {
  document.getElementById('startScreen').classList.remove('hidden');
  appEl.classList.add('hidden');
  const box = document.querySelector('.start-help');
  if (!box || box.querySelector('.start-error')) return;
  const note = document.createElement('p');
  note.className = 'start-error';
  note.textContent = 'Die 3D-Darstellung konnte nicht gestartet werden: Dieser Rechner '
    + 'stellt kein WebGL bereit. Bitte den Grafiktreiber aktualisieren oder die '
    + 'Hardwarebeschleunigung im Browser aktivieren.';
  box.prepend(note);
}

function startNewGame() {
  unlockAudio();
  requestAppFullscreen({ explain: true });
  document.getElementById('startScreen').classList.add('hidden');
  appEl.classList.remove('hidden');

  state = createInitialState();
  try {
    initScene(canvas);
    resizeScene();
    buildMap(state);
  } catch (err) {
    console.error('3D-Initialisierung fehlgeschlagen:', err);
    state = null;
    showGraphicsError();
    return;
  }

  const player = playerFaction(state);
  const capital = state.cities.find((c) => c.factionId === player.id && c.capital);
  if (capital) centerOn(capital.col, capital.row);

  // Input holds no reference to `state` itself, so it reads through a getter -
  // undo swaps the object wholesale.
  setupInput(canvas, () => state, refresh, showBattleReport, pushUndo);
  document.getElementById('endTurnBtn').addEventListener('click', endTurn);
  undoBtn.addEventListener('click', undoLastAction);
  observeMapSize();
  refresh();
}

window.addEventListener('resize', () => {
  resizeScene();
  render();
});

setupFullscreenButton(document.getElementById('fullscreenBtn'));
setupFullscreenButton(document.getElementById('menuFullscreenBtn'));
reflectFullscreenAvailability();
setupSidebarToggle();
setupMuteButton();
setupDpad();

document.getElementById('reportClose').addEventListener('click', hideBattleReport);
reportOverlay.addEventListener('click', (e) => {
  if (e.target === reportOverlay) hideBattleReport();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideBattleReport();
});

document.getElementById('startGameBtn').addEventListener('click', startNewGame);
