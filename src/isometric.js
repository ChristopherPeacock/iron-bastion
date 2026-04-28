import { TILE_W, TILE_H, GRID_COLS, GRID_ROWS } from './config.js';

// Fixed logical canvas dimensions — rendering is always done in this space,
// CSS transform scales it to fit any screen.
export const LOGICAL_W = 800;
export const LOGICAL_H = 530;

// The isometric grid diamond width = (GRID_COLS-1 + GRID_ROWS-1) * TILE_W/2 = 15*2*24 = 720px
// Centered in LOGICAL_W=800: ox = 400, left edge = 40, right edge = 760. ✓
export function getOrigin() {
  const gridH = (GRID_COLS + GRID_ROWS) * (TILE_H / 2); // 384px for 16×16, TH=24
  const ox = LOGICAL_W / 2;
  const oy = Math.floor((LOGICAL_H - gridH - 30) / 2); // 30px for building wall depth
  return { ox, oy: Math.max(20, oy) };
}

export function gridToScreen(col, row, ox, oy) {
  return {
    x: (col - row) * (TILE_W / 2) + ox,
    y: (col + row) * (TILE_H / 2) + oy
  };
}

// Returns {col, row} in grid space, or null if out of bounds.
// sx, sy must be in LOGICAL canvas coordinates.
export function screenToGrid(sx, sy, ox, oy) {
  const rx = sx - ox;
  const ry = sy - oy;
  const col = Math.floor((rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2);
  const row = Math.floor((ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

// Adjust a hex color by `amount` (positive = lighter, negative = darker)
export function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
