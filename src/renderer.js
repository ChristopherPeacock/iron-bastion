import { TILE_W, TILE_H, GRID_COLS, GRID_ROWS, BUILDINGS } from './config.js';
import { gridToScreen, adjustColor, getOrigin } from './isometric.js';

export class Renderer {
  constructor(canvas, grid, waveManager, combat) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = grid;
    this.waveManager = waveManager;
    this.combat = combat;
  }

  resize() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }

  get origin() { return getOrigin(this.canvas.width); }

  render(selectedBuilding, hoverCell, researchUnlocks) {
    const { ctx } = this;
    const { ox, oy } = this.origin;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    ctx.fillStyle = '#0d1a10';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // --- Draw floor tiles (row, col order = back to front) ---
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const isHovered = hoverCell && hoverCell.col === c && hoverCell.row === r;
        const cell = this.grid.cells[r][c];
        this._drawTile(ctx, c, r, ox, oy, isHovered, !!cell.building);
      }
    }

    // --- Draw placement preview ---
    if (selectedBuilding && hoverCell) {
      const def = BUILDINGS[selectedBuilding];
      if (def) {
        const canPlace = this.grid.canPlace(selectedBuilding, hoverCell.col, hoverCell.row, researchUnlocks || new Set());
        this._drawPreview(ctx, hoverCell.col, hoverCell.row, def, canPlace, ox, oy);
      }
    }

    // --- Draw buildings (sorted by depth: row+col of bottom-right corner) ---
    const buildings = this.grid.getBuildings().sort((a, b) => {
      const aDepth = a.col + a.row + a.def.size;
      const bDepth = b.col + b.row + b.def.size;
      return aDepth - bDepth;
    });
    for (const b of buildings) {
      this._drawBuilding(ctx, b, ox, oy);
    }

    // --- Draw enemies ---
    for (const e of this.waveManager.enemies) {
      if (e.state === 'dead') continue;
      this._drawEnemy(ctx, e, ox, oy);
    }

    // --- Draw projectiles ---
    for (const p of this.combat.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    // --- Draw tower range indicator on hover ---
    if (hoverCell) {
      const cell = this.grid.getCell(hoverCell.col, hoverCell.row);
      if (cell?.building?.def?.range) {
        this._drawRange(ctx, cell.building, ox, oy);
      }
    }
  }

  _drawTile(ctx, col, row, ox, oy, hovered, occupied) {
    const { x: tx, y: ty } = gridToScreen(col, row, ox, oy);
    const hw = TILE_W / 2, hh = TILE_H / 2;
    const cx = tx, cy = ty + hh;

    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();

    const isAlt = (col + row) % 2 === 0;
    let fill;
    if (hovered) fill = '#3a5a3a';
    else if (occupied) fill = isAlt ? '#1e2e1e' : '#1a2a1a';
    else fill = isAlt ? '#233020' : '#1e2a1e';

    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  _drawBuilding(ctx, b, ox, oy) {
    const { col, row, def, hp, maxHp } = b;
    const S = def.size;
    const { x: tx, y: ty } = gridToScreen(col, row, ox, oy);
    const hw = S * TILE_W / 2;
    const hh = S * TILE_H / 2;
    const wallH = S * 16 + 6;
    const cx = tx, cy = ty + hh;

    const color = def.color;
    const colorTop = adjustColor(color, 60);
    const colorRight = adjustColor(color, 10);
    const colorLeft = adjustColor(color, -35);

    // Left face
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + wallH);
    ctx.lineTo(cx - hw, cy + wallH);
    ctx.closePath();
    ctx.fillStyle = colorLeft;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Right face
    ctx.beginPath();
    ctx.moveTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + wallH);
    ctx.lineTo(cx + hw, cy + wallH);
    ctx.closePath();
    ctx.fillStyle = colorRight;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top face
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.fillStyle = colorTop;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();

    // Building label
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${S === 2 ? 10 : 8}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.name.split(' ').map(w => w[0]).join(''), cx, cy - 4);

    // HP bar if damaged
    if (hp < maxHp) {
      const barW = hw * 1.6;
      const barY = cy - hh - 10;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(cx - barW / 2, barY, barW, 5);
      const hpFrac = hp / maxHp;
      ctx.fillStyle = hpFrac > 0.6 ? '#4aaa4a' : hpFrac > 0.3 ? '#aaaa20' : '#cc3020';
      ctx.fillRect(cx - barW / 2, barY, barW * hpFrac, 5);
    }
  }

  _drawPreview(ctx, col, row, def, canPlace, ox, oy) {
    const S = def.size;
    const { x: tx, y: ty } = gridToScreen(col, row, ox, oy);
    const hw = S * TILE_W / 2, hh = S * TILE_H / 2;
    const wallH = S * 16 + 6;
    const cx = tx, cy = ty + hh;
    const alpha = canPlace ? 0.55 : 0.35;
    const color = canPlace ? def.color : '#cc3030';

    ctx.globalAlpha = alpha;
    // Top face only for preview
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx - hw, cy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // Left face
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy); ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + wallH); ctx.lineTo(cx - hw, cy + wallH);
    ctx.closePath();
    ctx.fillStyle = adjustColor(color, -30);
    ctx.fill();
    // Right face
    ctx.beginPath();
    ctx.moveTo(cx + hw, cy); ctx.lineTo(cx, cy + hh);
    ctx.lineTo(cx, cy + hh + wallH); ctx.lineTo(cx + hw, cy + wallH);
    ctx.closePath();
    ctx.fillStyle = adjustColor(color, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawEnemy(ctx, enemy, ox, oy) {
    const { x, y } = gridToScreen(enemy.col, enemy.row, ox, oy);
    const r = enemy.def.radius;

    // Shadow ellipse
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(x, y - r * 0.5, r, 0, Math.PI * 2);
    ctx.fillStyle = enemy.def.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // HP bar
    const bw = r * 2.4;
    const bx = x - bw / 2, by = y - r * 0.5 - r - 8;
    ctx.fillStyle = '#111';
    ctx.fillRect(bx, by, bw, 4);
    const frac = enemy.hp / enemy.maxHp;
    ctx.fillStyle = frac > 0.6 ? '#4caf50' : frac > 0.3 ? '#ff9800' : '#f44336';
    ctx.fillRect(bx, by, bw * frac, 4);
  }

  _drawRange(ctx, building, ox, oy) {
    if (!building.def.range) return;
    const cx = gridToScreen(building.col + building.def.size / 2,
      building.row + building.def.size / 2, ox, oy);
    const range = building.def.range * TILE_W;
    ctx.beginPath();
    ctx.arc(cx.x, cx.y, range, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,200,60,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
