import { createInitialState, playerFaction } from './state.js';
import { tileToScreen } from './iso.js';
import { render } from './render.js';
import { renderUI } from './ui.js';
import { setupInput } from './input.js';
import { computeReachable } from './pathfind.js';
import { aiTakeAllTurns } from './ai.js';
import {
  recruitUnit, raiseArmyFromGarrison, collectIncome, regenerateGarrisons,
  resetMovement, checkVictory,
} from './actions.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const state = createInitialState();

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function centerCameraOnCapital() {
  const player = playerFaction(state);
  const capital = state.cities.find((c) => c.factionId === player.id && c.capital);
  if (!capital) return;
  const { x, y } = tileToScreen(capital.col, capital.row, 0, { x: 0, y: 0 });
  state.cam.x = x - canvas.width / 2;
  state.cam.y = y - canvas.height / 2 + 80;
}

function syncSelection() {
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
  syncSelection();
  render(ctx, canvas, state);
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
  if (state.gameOver) return;
  aiTakeAllTurns(state);
  collectIncome(state);
  regenerateGarrisons(state);
  checkVictory(state);
  state.turn += 1;
  resetMovement(state);
  refresh();
}

window.addEventListener('resize', () => {
  resizeCanvas();
  refresh();
});

document.getElementById('endTurnBtn').addEventListener('click', endTurn);

resizeCanvas();
centerCameraOnCapital();
setupInput(canvas, state, refresh);
refresh();
