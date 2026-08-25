import { screenToTile } from './iso.js';
import { computeReachable, tileKey } from './pathfind.js';
import { armyAt, cityAt, playerFaction } from './state.js';
import { moveArmy } from './actions.js';

const PAN_KEYS = {
  ArrowUp: [0, -30], ArrowDown: [0, 30], ArrowLeft: [-30, 0], ArrowRight: [30, 0],
  w: [0, -30], s: [0, 30], a: [-30, 0], d: [30, 0],
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

export function setupInput(canvas, state, onChange) {
  let dragging = false;
  let dragMoved = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    dragMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    if (dragMoved) {
      state.cam.x -= dx;
      state.cam.y -= dy;
      lastX = e.clientX;
      lastY = e.clientY;
      onChange();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (dragging && !dragMoved) {
      handleClick(e);
    }
    dragging = false;
  });

  window.addEventListener('keydown', (e) => {
    const delta = PAN_KEYS[e.key];
    if (!delta) return;
    state.cam.x += delta[0];
    state.cam.y += delta[1];
    onChange();
  });

  function handleClick(e) {
    if (state.gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { col, row } = screenToTile(sx, sy, state.cam);
    if (col < 0 || col >= state.map.cols || row < 0 || row >= state.map.rows) {
      clearSelection(state);
      onChange();
      return;
    }

    const player = playerFaction(state);
    const clickedArmy = armyAt(state, col, row);
    const clickedCity = cityAt(state, col, row);

    if (state.selectedArmyId) {
      const key = tileKey(col, row);
      if (state.reachable && state.reachable.has(key)) {
        const armyId = state.selectedArmyId;
        moveArmy(state, armyId, col, row);
        const stillThere = state.armies.find((a) => a.id === armyId);
        if (stillThere && stillThere.movement > 0) {
          selectArmy(state, stillThere);
        } else {
          clearSelection(state);
        }
        onChange();
        return;
      }
    }

    if (clickedArmy && clickedArmy.factionId === player.id) {
      selectArmy(state, clickedArmy);
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
