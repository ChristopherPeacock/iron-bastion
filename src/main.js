import { Grid } from './grid.js';
import { Economy } from './economy.js';
import { Research } from './research.js';
import { WaveManager } from './waves.js';
import { CombatManager } from './combat.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { SaveManager } from './save.js';
import { screenToGrid, getOrigin } from './isometric.js';
import { BUILDINGS } from './config.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.grid = new Grid();
    this.economy = new Economy();
    this.research = new Research();
    this.waveManager = new WaveManager(this.grid);
    this.combat = new CombatManager(this.grid, this.waveManager);
    this.renderer = new Renderer(this.canvas, this.grid, this.waveManager, this.combat);
    this.ui = new UI(this);
    this.save = new SaveManager(this);

    this.selectedBuilding = null; // building ID string to place
    this.selectedCell = null;     // { col, row } of selected tile
    this.hoverCell = null;

    this.gameOver = false;
    this.lastSave = 0;
    this.lastTime = 0;

    this.combat.onEarn(amount => {
      this.economy.earn(amount);
      this.economy.earn(0); // trigger update
    });
  }

  async init() {
    this.renderer.resize();
    window.addEventListener('resize', () => this.renderer.resize());

    this._setupInput();
    this.ui.init();
    await this.save.load();
    this.ui.renderResearchTree();
    this.ui.renderBuildList();

    requestAnimationFrame(t => this._loop(t));
  }

  _loop(time) {
    const dt = Math.min((time - (this.lastTime || time)) / 1000, 0.1);
    this.lastTime = time;

    if (!this.gameOver) {
      this._update(dt);
    }
    this._render();

    // Auto-save every 30s
    if (time - this.lastSave > 30000) {
      this.lastSave = time;
      this.save.save();
    }

    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    this.economy.update(dt, this.grid, this.research);
    this.research.update(dt, this.grid);

    const result = this.waveManager.update(dt, this.research);
    if (result === 'wave_complete') {
      const bonus = 1000 * this.waveManager.waveNumber;
      const rpBonus = 10 * this.waveManager.waveNumber;
      this.economy.earn(bonus);
      this.research.addRP(rpBonus);
      this.ui.notify(`Wave ${this.waveManager.waveNumber} cleared! +$${bonus.toLocaleString()} +${rpBonus}RP`);
    }

    const { ox, oy } = getOrigin(this.canvas.width);
    this.combat.update(dt, this.economy, this.research, ox, oy);

    // Check game over
    const hq = this.grid.getHQ();
    if (!hq || hq.hp <= 0) {
      this.gameOver = true;
      this.ui.showGameOver(false);
    }
  }

  _render() {
    this.renderer.render(this.selectedBuilding, this.hoverCell, this.research.unlocks);
    this.ui.update(this.economy, this.waveManager, this.research);
  }

  _setupInput() {
    this.canvas.addEventListener('mousemove', e => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { ox, oy } = getOrigin(this.canvas.width);
      this.hoverCell = screenToGrid(sx, sy, ox, oy);
    });

    this.canvas.addEventListener('mouseleave', () => { this.hoverCell = null; });

    this.canvas.addEventListener('click', e => {
      if (this.gameOver) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { ox, oy } = getOrigin(this.canvas.width);
      const cell = screenToGrid(sx, sy, ox, oy);
      if (!cell) return;

      if (this.selectedBuilding) {
        this._tryPlace(cell.col, cell.row);
      } else {
        this.selectedCell = cell;
        this.ui.updateSelectionPanel();
      }
    });

    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.selectedBuilding = null;
      this.selectedCell = null;
      document.querySelectorAll('.build-item').forEach(i => i.classList.remove('selected'));
    });
  }

  _tryPlace(col, row) {
    const id = this.selectedBuilding;
    const def = BUILDINGS[id];
    if (!def) return;

    if (!this.grid.canPlace(id, col, row, this.research.unlocks)) {
      this.ui.notify('Cannot place here.', 'bad');
      return;
    }

    const costMult = this.research.hasEffect('buildCostMult')
      ? this.research.getEffect('buildCostMult') : 1;
    const cost = Math.floor(def.cost * costMult);

    if (!this.economy.canAfford(cost)) {
      this.ui.notify(`Need $${cost.toLocaleString()} (have $${Math.floor(this.economy.money).toLocaleString()})`, 'bad');
      return;
    }

    this.economy.spend(cost);
    this.grid.place(id, col, row, this.research.unlocks);
    this.ui.notify(`${def.name} placed`);

    // After placing walls, enemy paths may need refreshing (handled automatically on next move)
  }
}

const game = new Game();
game.init();
