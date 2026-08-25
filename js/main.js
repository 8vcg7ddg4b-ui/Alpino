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
  if (!state || state.gameOver) return;
  aiTakeAllTurns(state);
  collectIncome(state);
  regenerateGarrisons(state);
  checkVictory(state);
  state.turn += 1;
  resetMovement(state);
  refresh();
}

function setupFullscreenButton(button) {
  button.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (appEl.requestFullscreen) {
      appEl.requestFullscreen();
    } else if (appEl.webkitRequestFullscreen) {
      appEl.webkitRequestFullscreen();
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

function startNewGame() {
  document.getElementById('startScreen').classList.add('hidden');
  appEl.classList.remove('hidden');

  state = createInitialState();
  initScene(canvas);
  resizeScene();
  buildMap(state);

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
