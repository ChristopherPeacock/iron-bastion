import { Grid } from './grid.js';
import { Economy } from './economy.js';
import { Research } from './research.js';
import { WaveManager } from './waves.js';
import { CombatManager } from './combat.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { SaveManager } from './save.js';
import { screenToGrid, getOrigin, LOGICAL_W, LOGICAL_H } from './isometric.js';
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

    this.selectedBuilding = null;
    this.selectedCell = null;
    this.hoverCell = null;
    this.gameOver = false;
    this.lastSave = 0;
    this.lastTime = 0;

    this.combat.onEarn(amount => this.economy.earn(amount));
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

    if (!this.gameOver) this._update(dt);
    this._render();

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

    const { ox, oy } = getOrigin();
    this.combat.update(dt, this.economy, this.research, ox, oy);

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

  // Convert a DOM event's clientX/Y into logical canvas coordinates
  _toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (LOGICAL_W / rect.width),
      y: (clientY - rect.top) * (LOGICAL_H / rect.height)
    };
  }

  _setupInput() {
    // Mouse move
    this.canvas.addEventListener('mousemove', e => {
      const { x, y } = this._toLogical(e.clientX, e.clientY);
      const { ox, oy } = getOrigin();
      this.hoverCell = screenToGrid(x, y, ox, oy);
    });

    this.canvas.addEventListener('mouseleave', () => { this.hoverCell = null; });

    // Click (place building or select tile)
    this.canvas.addEventListener('click', e => {
      if (this.gameOver) return;
      const { x, y } = this._toLogical(e.clientX, e.clientY);
      const { ox, oy } = getOrigin();
      const cell = screenToGrid(x, y, ox, oy);
      if (!cell) return;

      if (this.selectedBuilding) {
        this._tryPlace(cell.col, cell.row);
      } else {
        this.selectedCell = cell;
        this.ui.updateSelectionPanel();
      }
    });

    // Right-click: cancel placement
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.selectedBuilding = null;
      this.selectedCell = null;
      document.querySelectorAll('.build-item').forEach(i => i.classList.remove('selected'));
    });

    // Touch support (treat as click/hover)
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = this._toLogical(touch.clientX, touch.clientY);
      const { ox, oy } = getOrigin();
      const cell = screenToGrid(x, y, ox, oy);
      if (!cell || this.gameOver) return;

      if (this.selectedBuilding) {
        this._tryPlace(cell.col, cell.row);
      } else {
        this.selectedCell = cell;
        this.ui.updateSelectionPanel();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = this._toLogical(touch.clientX, touch.clientY);
      const { ox, oy } = getOrigin();
      this.hoverCell = screenToGrid(x, y, ox, oy);
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => { this.hoverCell = null; });

    // Mobile panel toggle
    const panelToggle = document.getElementById('panel-toggle');
    const sidePanel = document.getElementById('side-panel');
    if (panelToggle) {
      panelToggle.addEventListener('click', () => {
        sidePanel.classList.toggle('open');
      });
    }

    // Research toggle
    const researchToggle = document.getElementById('research-toggle');
    const researchPanel = document.getElementById('research-panel');
    if (researchToggle && researchPanel) {
      researchToggle.addEventListener('click', () => {
        researchPanel.classList.toggle('collapsed');
        researchToggle.textContent = researchPanel.classList.contains('collapsed')
          ? '▲ Research' : '▼ Research';
      });
    }
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
      this.ui.notify(
        `Need $${cost.toLocaleString()} — have $${Math.floor(this.economy.money).toLocaleString()}`,
        'bad'
      );
      return;
    }

    this.economy.spend(cost);
    this.grid.place(id, col, row, this.research.unlocks);
    this.ui.notify(`${def.name} placed`);
  }
}

const game = new Game();
game.init();
