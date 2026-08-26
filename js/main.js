import { createInitialState, playerFaction } from './state.js';
import { renderUI, battleReportHTML } from './ui.js';
import { setupInput } from './input.js';
import { computeReachable } from './pathfind.js';
import { aiTakeAllTurns } from './ai.js';
import {
  recruitUnit, raiseArmyFromGarrison, collectIncome, regenerateGarrisons,
  resetMovement, checkVictory,
} from './actions.js';
import {
  initScene, buildMap, syncEntities, render, resize, centerOn, panCamera, zoomCamera,
  isAnimating,
} from './scene3d.js';

const canvas = document.getElementById('gameCanvas');
const appEl = document.getElementById('app');
let state = null;

function resizeScene() {
  const rect = canvas.parentElement.getBoundingClientRect();
  resize(rect.width, rect.height);
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
      recruitUnit(state, cityId, unitKey);
      refresh();
    },
    onRaise: (cityId) => {
      raiseArmyFromGarrison(state, cityId);
      refresh();
    },
    onShowReport: showBattleReport,
  });
}

function endTurn() {
  // Ending the turn mid-march would let the AI move while the player's army is
  // still visibly walking, and the resulting sync would teleport it.
  if (!state || state.gameOver || isAnimating()) return;
  // Identify new reports by the previous head, not by length: the list is
  // capped, so once it is full its length stops growing.
  const previousHead = state.battleReports.length ? state.battleReports[0].id : null;

  aiTakeAllTurns(state);
  collectIncome(state);
  regenerateGarrisons(state);
  checkVictory(state);
  state.turn += 1;
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
}

function requestAppFullscreen() {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) return;
  // Some sandboxed embeds (e.g. an iframe'd artifact preview) reject
  // fullscreen entirely - fail silently rather than break game start.
  Promise.resolve(request.call(root)).catch(() => {});
}

function setupFullscreenButton(button) {
  button.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      requestAppFullscreen();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    button.classList.toggle('active', !!document.fullscreenElement);
    setTimeout(resizeScene, 60);
  });
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
  requestAppFullscreen();
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

  setupInput(canvas, state, refresh, showBattleReport);
  document.getElementById('endTurnBtn').addEventListener('click', endTurn);
  refresh();
}

window.addEventListener('resize', () => {
  resizeScene();
  render();
});

setupFullscreenButton(document.getElementById('fullscreenBtn'));
setupFullscreenButton(document.getElementById('menuFullscreenBtn'));
setupDpad();

document.getElementById('reportClose').addEventListener('click', hideBattleReport);
reportOverlay.addEventListener('click', (e) => {
  if (e.target === reportOverlay) hideBattleReport();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideBattleReport();
});

document.getElementById('startGameBtn').addEventListener('click', startNewGame);
