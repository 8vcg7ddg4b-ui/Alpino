export const TILE_W = 64;
export const TILE_H = 32;
export const ELEV_H = 16;

export function tileToScreen(col, row, elevation, cam) {
  const x = (col - row) * (TILE_W / 2) - cam.x;
  const y = (col + row) * (TILE_H / 2) - elevation * ELEV_H - cam.y;
  return { x, y };
}

export function screenToTile(sx, sy, cam) {
  const x = sx + cam.x;
  const y = sy + cam.y;
  const col = (x / (TILE_W / 2) + y / (TILE_H / 2)) / 2;
  const row = (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2;
  return { col: Math.round(col), row: Math.round(row) };
}
