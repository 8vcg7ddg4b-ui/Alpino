import { TILE_W, TILE_H, ELEV_H, tileToScreen } from './iso.js';
import { TILE_TYPES, UNIT_ORDER, UNIT_TYPES } from './data.js';
import { armyAt, cityAt, unitTotalCount, factionById } from './state.js';

function diamondPath(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y - TILE_H / 2);
  ctx.lineTo(x + TILE_W / 2, y);
  ctx.lineTo(x, y + TILE_H / 2);
  ctx.lineTo(x - TILE_W / 2, y);
  ctx.closePath();
}

function shade(hex, amount) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0xff) + amount;
  let b = (num & 0xff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

function drawTile(ctx, state, col, row, x, y) {
  const tile = state.map.tiles[row][col];
  const def = TILE_TYPES[tile.type];
  const elevPx = tile.elevation * ELEV_H;

  if (elevPx > 0) {
    ctx.fillStyle = shade(def.color, -50);
    ctx.beginPath();
    ctx.moveTo(x - TILE_W / 2, y);
    ctx.lineTo(x, y + TILE_H / 2);
    ctx.lineTo(x, y + TILE_H / 2 + elevPx);
    ctx.lineTo(x - TILE_W / 2, y + elevPx);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(def.color, -25);
    ctx.beginPath();
    ctx.moveTo(x + TILE_W / 2, y);
    ctx.lineTo(x, y + TILE_H / 2);
    ctx.lineTo(x, y + TILE_H / 2 + elevPx);
    ctx.lineTo(x + TILE_W / 2, y + elevPx);
    ctx.closePath();
    ctx.fill();
  }

  diamondPath(ctx, x, y);
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const city = cityAt(state, col, row);
  const faction = city && factionById(state, city.factionId);
  if (faction) {
    diamondPath(ctx, x, y);
    ctx.fillStyle = faction.color;
    ctx.globalAlpha = 0.28;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (def.deco) {
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.deco, x, y - 4);
  }
}

function drawHighlight(ctx, x, y, color, alpha) {
  diamondPath(ctx, x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCity(ctx, state, city, x, y) {
  const faction = factionById(state, city.factionId);
  const elevPx = state.map.tiles[city.row][city.col].elevation * ELEV_H;
  const cy = y - elevPx;

  ctx.beginPath();
  ctx.ellipse(x, cy + 4, 16, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  ctx.font = '26px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(city.capital ? '🏛️' : '🏰', x, cy - 14);

  ctx.beginPath();
  ctx.arc(x + 14, cy - 26, 6, 0, Math.PI * 2);
  ctx.fillStyle = faction ? faction.color : '#999';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = 'bold 11px "Trajan Pro", Georgia, serif';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeText(city.name, x, cy - 42);
  ctx.fillText(city.name, x, cy - 42);
}

function drawArmy(ctx, state, army, x, y, selected) {
  const faction = factionById(state, army.factionId);
  const elevPx = state.map.tiles[army.row][army.col].elevation * ELEV_H;
  const ay = y - elevPx;
  const count = unitTotalCount(army.units);

  ctx.beginPath();
  ctx.ellipse(x, ay + 6, 14, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  if (selected) {
    ctx.beginPath();
    ctx.arc(x, ay - 6, 20, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(x, ay - 6, 15, 0, Math.PI * 2);
  ctx.fillStyle = faction ? faction.color : '#999';
  ctx.fill();
  ctx.strokeStyle = '#2a1c10';
  ctx.lineWidth = 2;
  ctx.stroke();

  const dominant = UNIT_ORDER.reduce((best, key) => (army.units[key] > (army.units[best] || 0) ? key : best), UNIT_ORDER[0]);
  ctx.font = '16px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(UNIT_TYPES[dominant].icon, x, ay - 6);

  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + 12, ay + 4, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(String(count), x + 12, ay + 4);
}

export function render(ctx, canvas, state) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cam = state.cam;

  for (let row = 0; row < state.map.rows; row++) {
    for (let col = 0; col < state.map.cols; col++) {
      const { x, y } = tileToScreen(col, row, state.map.tiles[row][col].elevation, cam);
      if (x < -60 || x > canvas.width + 60 || y < -120 || y > canvas.height + 60) continue;
      drawTile(ctx, state, col, row, x, y);
    }
  }

  if (state.reachable) {
    for (const [k, entry] of state.reachable) {
      const [col, row] = k.split(',').map(Number);
      const { x, y } = tileToScreen(col, row, state.map.tiles[row][col].elevation, cam);
      drawHighlight(ctx, x, y, entry.combat ? '#ff4d3d' : '#4dffa0', 0.4);
    }
  }
  if (state.selectedArmyId) {
    const army = state.armies.find((a) => a.id === state.selectedArmyId);
    if (army) {
      const { x, y } = tileToScreen(army.col, army.row, state.map.tiles[army.row][army.col].elevation, cam);
      drawHighlight(ctx, x, y, '#ffe066', 0.35);
    }
  }

  const drawables = [];
  for (const city of state.cities) drawables.push({ type: 'city', obj: city, row: city.row, col: city.col });
  for (const army of state.armies) drawables.push({ type: 'army', obj: army, row: army.row, col: army.col });
  drawables.sort((a, b) => (a.row + a.col) - (b.row + b.col));

  for (const d of drawables) {
    const { x, y } = tileToScreen(d.col, d.row, state.map.tiles[d.row][d.col].elevation, cam);
    if (d.type === 'city') drawCity(ctx, state, d.obj, x, y);
    else drawArmy(ctx, state, d.obj, x, y, d.obj.id === state.selectedArmyId);
  }
}
