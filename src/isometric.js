import { TILE_W, TILE_H, GRID_COLS, GRID_ROWS } from './config.js';

export function gridToScreen(col, row, ox, oy) {
  return {
    x: (col - row) * (TILE_W / 2) + ox,
    y: (col + row) * (TILE_H / 2) + oy
  };
}

// Returns the top-left grid cell under a screen point, or null if out of bounds
export function screenToGrid(sx, sy, ox, oy) {
  const rx = sx - ox;
  const ry = sy - oy;
  // Inverse of iso transform
  const col = Math.floor((rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2);
  const row = Math.floor((ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

export function getOrigin(canvasWidth) {
  return { ox: canvasWidth / 2, oy: 36 };
}

// Lighten/darken a hex color
export function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
