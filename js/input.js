import { computeReachable, tileKey } from './pathfind.js';
import { armyAt, cityAt, playerFaction } from './state.js';
import { moveArmy } from './actions.js';
import { pickTile, groundPointAt, panCameraByWorld, panCamera, zoomCamera } from './scene3d.js';

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

function toNdc(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

export function setupInput(canvas, state, onChange) {
  let dragging = false;
  let dragMoved = false;
  let dragAnchor = null;

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    dragMoved = false;
    const ndc = toNdc(canvas, e.clientX, e.clientY);
    dragAnchor = groundPointAt(ndc.x, ndc.y);
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const ndc = toNdc(canvas, e.clientX, e.clientY);
    const q = groundPointAt(ndc.x, ndc.y);
    if (dragAnchor && q) {
      const dx = dragAnchor.x - q.x;
      const dz = dragAnchor.z - q.z;
      if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) dragMoved = true;
      if (dragMoved) {
        panCameraByWorld(dx, dz);
        onChange();
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (dragging && !dragMoved) {
      handleClick(e);
    }
    dragging = false;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomCamera(e.deltaY < 0 ? 1.12 : 0.89);
    onChange();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const delta = PAN_KEYS[e.key];
    if (!delta) return;
    panCamera(delta[0] * 1.4, delta[1] * 1.4);
    onChange();
  });

  function handleClick(e) {
    if (state.gameOver) return;
    const ndc = toNdc(canvas, e.clientX, e.clientY);
    const tile = pickTile(ndc.x, ndc.y);
    if (!tile) {
      clearSelection(state);
      onChange();
      return;
    }
    const { col, row } = tile;
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

    const ownArmyHere = clickedArmy && clickedArmy.factionId === player.id ? clickedArmy : null;

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
