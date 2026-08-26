import { createInitialState, playerFaction } from './state.js';
import { renderUI } from './ui.js';
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
  });
}

function endTurn() {
  // Ending the turn mid-march would let the AI move while the player's army is
  // still visibly walking, and the resulting sync would teleport it.
  if (!state || state.gameOver || isAnimating()) return;
  aiTakeAllTurns(state);
  collectIncome(state);
  regenerateGarrisons(state);
  checkVictory(state);
  state.turn += 1;
  resetMovement(state);
  refresh();
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

  setupInput(canvas, state, refresh);
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

document.getElementById('startGameBtn').addEventListener('click', startNewGame);
