import { TILE_W, TILE_H, GRID_COLS, GRID_ROWS, BUILDINGS } from './config.js';
import { gridToScreen, adjustColor, getOrigin, LOGICAL_W, LOGICAL_H } from './isometric.js';

// Seeded random for stable per-tile terrain variation
function tileRng(col, row) {
  const s = ((col * 374761393 + row * 668265263) ^ (col << 13)) & 0xffff;
  return (s / 0xffff);
}

const TERRAIN_PALETTES = [
  ['#1c2a1a', '#1f2d1c', '#1a291a', '#202e1e'],  // deep military green
  ['#1e2c1c', '#21301e', '#1d2b1b', '#222f20'],  // olive
  ['#1b281b', '#1e2c1e', '#1c2a1c', '#1f2d1d'],  // forest
];

export class Renderer {
  constructor(canvas, grid, waveManager, combat) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = grid;
    this.waveManager = waveManager;
    this.combat = combat;
  }

  resize() {
    // Always render at fixed logical size; CSS transform scales to fit.
    this.canvas.width = LOGICAL_W;
    this.canvas.height = LOGICAL_H;

    const parentW = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const parentH = this.canvas.parentElement?.clientHeight || window.innerHeight;
    const scale = Math.min(parentW / LOGICAL_W, parentH / LOGICAL_H, 1.0);
    this.canvas.style.width = Math.floor(LOGICAL_W * scale) + 'px';
    this.canvas.style.height = Math.floor(LOGICAL_H * scale) + 'px';
    this.cssScale = scale;
  }

  get origin() { return getOrigin(); }

  render(selectedBuilding, hoverCell, researchUnlocks) {
    const { ctx } = this;
    const { ox, oy } = this.origin;

    // Background
    ctx.fillStyle = '#0d1a10';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // --- Draw map border glow ---
    this._drawMapBorder(ctx, ox, oy);

    // --- Floor tiles ---
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const isHovered = hoverCell?.col === c && hoverCell?.row === r;
        this._drawTile(ctx, c, r, ox, oy, isHovered);
      }
    }

    // --- Grid coordinate labels (edge tiles only) ---
    this._drawGridLabels(ctx, ox, oy);

    // --- Placement preview ---
    if (selectedBuilding && hoverCell) {
      const def = BUILDINGS[selectedBuilding];
      if (def) {
        const canPlace = this.grid.canPlace(
          selectedBuilding, hoverCell.col, hoverCell.row,
          researchUnlocks || new Set()
        );
        this._drawPreview(ctx, hoverCell.col, hoverCell.row, def, canPlace, ox, oy);
      }
    }

    // --- Buildings sorted back-to-front ---
    const buildings = this.grid.getBuildings().sort((a, b) =>
      (a.col + a.row + a.def.size * 2) - (b.col + b.row + b.def.size * 2)
    );
    for (const b of buildings) this._drawBuilding(ctx, b, ox, oy);

    // --- Enemies ---
    for (const e of this.waveManager.enemies) {
      if (e.state === 'dead') continue;
      this._drawEnemy(ctx, e, ox, oy);
    }

    // --- Projectiles ---
    for (const p of this.combat.projectiles) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.armorPiercing ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }

    // --- Tower range on hover ---
    if (hoverCell) {
      const cell = this.grid.getCell(hoverCell.col, hoverCell.row);
      if (cell?.building?.def?.range) this._drawRange(ctx, cell.building, ox, oy);
    }

    // --- HQ health indicator ---
    this._drawHQStatus(ctx, ox, oy);
  }

  _drawTile(ctx, col, row, ox, oy, hovered) {
    const { x: tx, y: ty } = gridToScreen(col, row, ox, oy);
    const hw = TILE_W / 2, hh = TILE_H / 2;
    const cx = tx, cy = ty + hh;

    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();

    let fill;
    if (hovered) {
      fill = '#3a6a3a';
    } else {
      const rng = tileRng(col, row);
      const palette = TERRAIN_PALETTES[Math.floor(rng * 3)];
      const idx = Math.floor((rng * 100 % 1) * palette.length);
      fill = palette[idx];
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Terrain detail dots (sparse)
    const rng2 = tileRng(col + 100, row + 100);
    if (rng2 > 0.85) {
      ctx.beginPath();
      ctx.arc(cx + (rng2 - 0.9) * 20, cy + (rng2 - 0.87) * 10, 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();
    }
  }

  _drawGridLabels(ctx, ox, oy) {
    ctx.font = '7px Courier New';
    ctx.fillStyle = 'rgba(80,120,70,0.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Top row column numbers
    for (let c = 0; c < GRID_COLS; c += 4) {
      const { x, y } = gridToScreen(c, 0, ox, oy);
      ctx.fillText(c, x, y - 8);
    }
    // Left column row numbers
    for (let r = 0; r < GRID_ROWS; r += 4) {
      const { x, y } = gridToScreen(0, r, ox, oy);
      ctx.fillText(r, x - 28, y + TILE_H / 2);
    }
  }

  _drawBuilding(ctx, b, ox, oy) {
    const { col, row, def, hp, maxHp } = b;
    const S = def.size;
    const { x: tx, y: ty } = gridToScreen(col, row, ox, oy);
    const hw = S * TILE_W / 2;
    const hh = S * TILE_H / 2;
    const wallH = S === 1 ? 20 : 28;
    const cx = tx, cy = ty + hh;
    const color = def.color;

    // Shadow under building
    ctx.beginPath();
    ctx.moveTo(cx, cy + hh + wallH);
    ctx.lineTo(cx + hw, cy + wallH);
    ctx.lineTo(cx + hw + 3, cy + wallH + 3);
    ctx.lineTo(cx + 3, cy + hh + wallH + 3);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Left face (darkest)
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + wallH);
    ctx.lineTo(cx - hw, cy + wallH);
    ctx.closePath();
    ctx.fillStyle = adjustColor(color, -50);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Right face (medium)
    ctx.beginPath();
    ctx.moveTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + wallH);
    ctx.lineTo(cx + hw, cy + wallH);
    ctx.closePath();
    ctx.fillStyle = adjustColor(color, -20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();

    // Top face (lightest)
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.fillStyle = adjustColor(color, 50);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();

    // Details per building type
    this._drawBuildingDetails(ctx, b, cx, cy, hw, hh, wallH);

    // HP bar if damaged
    if (hp < maxHp) {
      const barW = Math.max(hw * 1.4, 24);
      const barY = cy - hh - 12;
      ctx.fillStyle = '#111';
      ctx.fillRect(cx - barW / 2, barY, barW, 5);
      const frac = hp / maxHp;
      ctx.fillStyle = frac > 0.6 ? '#3aaa3a' : frac > 0.3 ? '#aaaa20' : '#cc3020';
      ctx.fillRect(cx - barW / 2, barY, barW * frac, 5);
    }
  }

  _drawBuildingDetails(ctx, b, cx, cy, hw, hh, wallH) {
    const { def } = b;
    ctx.save();
    ctx.font = `bold ${def.size === 2 ? 9 : 7}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';

    // Building abbreviation on top face
    const abbrev = def.name.split(' ').map(w => w[0]).join('');
    ctx.fillText(abbrev, cx, cy - 2);

    // Tower: draw barrel
    if (def.damage && def.range >= 5) {
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh + 2);
      ctx.lineTo(cx + hw * 0.6, cy - hh * 0.4);
      ctx.stroke();
    }

    // Wall: add horizontal stripe texture on right face
    if (def.id === 'WALL') {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.8;
      for (let i = 1; i < 4; i++) {
        const lineY = (cy + hh) + (wallH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(cx, lineY);
        ctx.lineTo(cx + hw, lineY - hh / 2);
        ctx.stroke();
      }
    }

    // HQ: flag pole
    if (def.id === 'HQ') {
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + hw * 0.3, cy - hh);
      ctx.lineTo(cx + hw * 0.3, cy - hh - 14);
      ctx.stroke();
      ctx.fillStyle = '#e03030';
      ctx.fillRect(cx + hw * 0.3, cy - hh - 14, 8, 5);
    }

    ctx.restore();
  }

  _drawPreview(ctx, col, row, def, canPlace, ox, oy) {
    const S = def.size;
    const { x: tx, y: ty } = gridToScreen(col, row, ox, oy);
    const hw = S * TILE_W / 2, hh = S * TILE_H / 2;
    const wallH = S === 1 ? 20 : 28;
    const cx = tx, cy = ty + hh;
    const color = canPlace ? def.color : '#cc2020';

    ctx.globalAlpha = 0.55;
    // Left face
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy); ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + wallH); ctx.lineTo(cx - hw, cy + wallH);
    ctx.closePath();
    ctx.fillStyle = adjustColor(color, -40); ctx.fill();

    // Right face
    ctx.beginPath();
    ctx.moveTo(cx + hw, cy); ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + wallH); ctx.lineTo(cx + hw, cy + wallH);
    ctx.closePath();
    ctx.fillStyle = adjustColor(color, -10); ctx.fill();

    // Top face
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.fillStyle = adjustColor(color, 50); ctx.fill();

    ctx.globalAlpha = 1;

    // Placement border
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.strokeStyle = canPlace ? 'rgba(100,255,100,0.8)' : 'rgba(255,60,60,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawEnemy(ctx, enemy, ox, oy) {
    const { x, y } = gridToScreen(enemy.col, enemy.row, ox, oy);
    const r = enemy.def.radius;

    ctx.save();
    // Ground shadow
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 0.85, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    const ey = y - r * 0.55;
    // Vehicle: draw as boxy shape; Infantry/Heavy: rounded
    if (enemy.type === 'VEHICLE') {
      ctx.fillStyle = enemy.def.color;
      ctx.strokeStyle = adjustColor(enemy.def.color, 40);
      ctx.lineWidth = 1;
      ctx.fillRect(x - r * 0.9, ey - r * 0.6, r * 1.8, r * 1.2);
      ctx.strokeRect(x - r * 0.9, ey - r * 0.6, r * 1.8, r * 1.2);
      // Turret
      ctx.fillStyle = adjustColor(enemy.def.color, -30);
      ctx.fillRect(x - r * 0.3, ey - r * 0.9, r * 0.6, r * 0.6);
      // Barrel
      ctx.beginPath();
      ctx.moveTo(x + r * 0.1, ey - r * 0.6);
      ctx.lineTo(x + r * 1.1, ey - r * 0.3);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (enemy.type === 'HEAVY') {
      // Heavy: large square tank shape
      ctx.fillStyle = enemy.def.color;
      ctx.fillRect(x - r, ey - r * 0.8, r * 2, r * 1.6);
      ctx.strokeStyle = adjustColor(enemy.def.color, 50);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - r, ey - r * 0.8, r * 2, r * 1.6);
      // Crosshair on top
      ctx.strokeStyle = 'rgba(255,200,0,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, ey); ctx.lineTo(x + r * 0.4, ey);
      ctx.moveTo(x, ey - r * 0.4); ctx.lineTo(x, ey + r * 0.4);
      ctx.stroke();
    } else {
      // Infantry: circular squad marker
      ctx.beginPath();
      ctx.arc(x, ey, r, 0, Math.PI * 2);
      ctx.fillStyle = enemy.def.color;
      ctx.fill();
      ctx.strokeStyle = adjustColor(enemy.def.color, 60);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // X marker
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, ey - r * 0.4); ctx.lineTo(x + r * 0.4, ey + r * 0.4);
      ctx.moveTo(x + r * 0.4, ey - r * 0.4); ctx.lineTo(x - r * 0.4, ey + r * 0.4);
      ctx.stroke();
    }

    // HP bar
    const bw = r * 2.6;
    const bx = x - bw / 2, by = ey - r - 10;
    ctx.fillStyle = '#111';
    ctx.fillRect(bx, by, bw, 4);
    const frac = enemy.hp / enemy.maxHp;
    ctx.fillStyle = frac > 0.6 ? '#3aaa3a' : frac > 0.3 ? '#e09020' : '#e03020';
    ctx.fillRect(bx, by, bw * frac, 4);

    ctx.restore();
  }

  _drawRange(ctx, building, ox, oy) {
    if (!building.def.range) return;
    const { x, y } = gridToScreen(
      building.col + building.def.size / 2,
      building.row + building.def.size / 2,
      ox, oy
    );
    const range = building.def.range * TILE_W;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,220,60,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Fill with very faint tint
    ctx.fillStyle = 'rgba(200,220,60,0.04)';
    ctx.fill();
    ctx.restore();
  }

  _drawHQStatus(ctx, ox, oy) {
    const hq = this.grid.getHQ();
    if (!hq || hq.hp >= hq.maxHp) return;
    const { x, y } = gridToScreen(hq.col + 1, hq.row + 1, ox, oy);
    const frac = hq.hp / hq.maxHp;

    ctx.save();
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillStyle = frac < 0.3 ? '#ff4040' : '#ffaa20';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillText('⚠ HQ UNDER ATTACK', x, y + 48);
    ctx.restore();
  }

  _drawMapBorder(ctx, ox, oy) {
    // Subtle tactical border around the grid perimeter
    ctx.save();
    ctx.strokeStyle = 'rgba(60,100,50,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);

    const corners = [
      gridToScreen(0, 0, ox, oy),
      gridToScreen(GRID_COLS, 0, ox, oy),
      gridToScreen(GRID_COLS, GRID_ROWS, ox, oy),
      gridToScreen(0, GRID_ROWS, ox, oy),
    ];
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
