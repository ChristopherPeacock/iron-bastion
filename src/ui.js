import { BUILDINGS, RESEARCH_NODES, SOLDIER_HIRE_COST, SOLDIER_FIRE_REFUND } from './config.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.activeTab = 'structures';
    this._notifEl = null;
  }

  init() {
    this._notifEl = document.getElementById('notifications');

    // Build tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab;
        this.renderBuildList();
      });
    });

    // Hire / Fire
    document.getElementById('hire-btn').addEventListener('click', () => {
      const result = this.game.economy.hireSoldier(this.game.grid);
      if (!result.ok) this.notify(result.reason, 'bad');
      else this.notify('+1 Soldier hired');
    });

    document.getElementById('fire-btn').addEventListener('click', () => {
      const result = this.game.economy.fireSoldier();
      if (!result.ok) this.notify(result.reason, 'bad');
      else this.notify(`Soldier dismissed (+$${SOLDIER_FIRE_REFUND})`);
    });

    // Contract slider
    document.getElementById('contract-slider').addEventListener('input', (e) => {
      const maxSlots = this.game.grid.getContractSlots();
      const val = Math.min(parseInt(e.target.value), maxSlots);
      e.target.value = val;
      this.game.economy.setContracted(val);
    });

    // Demolish
    document.getElementById('demolish-btn').addEventListener('click', () => {
      const { selectedCell } = this.game;
      if (!selectedCell) return;
      const ok = this.game.grid.demolish(selectedCell.col, selectedCell.row);
      if (ok) {
        this.game.selectedCell = null;
        this.game.selectedBuilding = null;
        this.notify('Building demolished');
      }
    });

    // Save / Load / New Game buttons
    document.getElementById('save-btn').addEventListener('click', async () => {
      const ok = await this.game.save.save();
      this.notify(ok ? 'Game saved.' : 'Save failed.', ok ? '' : 'bad');
    });

    document.getElementById('newgame-btn').addEventListener('click', () => {
      if (confirm('Start a new game? Unsaved progress will be lost.')) {
        this.game.save.deleteSave();
        location.reload();
      }
    });

    // Overlay restart
    document.getElementById('restart-btn').addEventListener('click', () => {
      this.game.save.deleteSave();
      location.reload();
    });

    this.renderBuildList();
    this.renderResearchTree();
  }

  renderBuildList() {
    const list = document.getElementById('build-list');
    list.innerHTML = '';
    const cat = this.activeTab;
    const entries = Object.values(BUILDINGS).filter(b => {
      if (b.category === 'special') return false;
      if (cat === 'structures') return b.category === 'structures';
      if (cat === 'military') return b.category === 'military';
      if (cat === 'economy') return b.category === 'economy';
      return false;
    });

    for (const def of entries) {
      const locked = def.unlockRequired && !this.game.research.isUnlocked(def.unlockRequired);
      const costMult = this.game.research.hasEffect('buildCostMult')
        ? this.game.research.getEffect('buildCostMult') : 1;
      const cost = Math.floor(def.cost * costMult);

      const el = document.createElement('div');
      el.className = 'build-item' + (locked ? ' locked' : '');
      if (this.game.selectedBuilding === def.id) el.classList.add('selected');
      el.innerHTML = `
        <div class="name">${def.name} <span style="font-size:10px;color:#5a7a5a">${def.size}×${def.size}</span></div>
        <div class="cost">$${cost.toLocaleString()}</div>
        <div class="desc">${def.description}</div>
      `;
      if (!locked) {
        el.addEventListener('click', () => {
          if (this.game.selectedBuilding === def.id) {
            this.game.selectedBuilding = null;
            el.classList.remove('selected');
          } else {
            document.querySelectorAll('.build-item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
            this.game.selectedBuilding = def.id;
            this.game.selectedCell = null;
          }
        });
      }
      list.appendChild(el);
    }
  }

  renderResearchTree() {
    const tree = document.getElementById('research-tree');
    tree.innerHTML = '';

    const branches = ['economy', 'combat'];
    const labels = { economy: 'Economy', combat: 'Combat' };

    for (const branch of branches) {
      const col = document.createElement('div');
      col.className = 'research-branch';
      col.innerHTML = `<div class="branch-label">${labels[branch]}</div>`;

      const nodes = RESEARCH_NODES.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);
      for (const node of nodes) {
        const status = this.game.research.getNodeStatus(node.id);
        const el = document.createElement('div');
        el.className = 'research-node ' + status;
        el.dataset.id = node.id;
        el.innerHTML = `
          <div class="rn-name">${node.name}</div>
          <div class="rn-cost">${node.rpCost} RP</div>
          <div class="rn-desc">${node.description}</div>
        `;
        if (status === 'available') {
          el.addEventListener('click', () => this._onResearch(node.id));
        }
        col.appendChild(el);
      }
      tree.appendChild(col);
    }
  }

  _onResearch(nodeId) {
    const node = RESEARCH_NODES.find(n => n.id === nodeId);
    if (!node) return;
    if (this.game.research.rp < node.rpCost) {
      this.notify(`Need ${node.rpCost} RP (have ${Math.floor(this.game.research.rp)})`, 'bad');
      return;
    }
    const ok = this.game.research.research(nodeId);
    if (ok) {
      this.notify(`Researched: ${node.name}`);
      this.renderResearchTree();
      this.renderBuildList(); // update locked states
    }
  }

  update(economy, waveManager, research) {
    const { income, wages, net } = economy.getNetPerSec(this.game.grid, research);

    _set('money-val', '$' + Math.floor(economy.money).toLocaleString());
    _set('rp-val', Math.floor(research.rp));
    _set('soldier-val', `${economy.soldiers}/${this.game.grid.getSoldierCapacity()}`);

    _set('income-val', `+$${Math.floor(income)}/s`);
    _set('wages-val', `-$${Math.floor(wages)}/s`);
    _set('net-val', (net >= 0 ? '+' : '') + `$${Math.floor(net)}/s`);
    document.getElementById('net-val').style.color = net >= 0 ? '#60c060' : '#e06060';

    // Soldier slider max
    const slider = document.getElementById('contract-slider');
    const maxSlots = this.game.grid.getContractSlots();
    slider.max = Math.min(economy.soldiers, maxSlots);
    slider.value = economy.contractedSoldiers;
    _set('contract-val', `${economy.contractedSoldiers} on contract`);
    _set('defend-val', `${economy.defendingSoldiers} defending`);

    // Wave status
    const waveEl = document.getElementById('wave-status');
    if (waveManager.phase === 'prep') {
      waveEl.textContent = `Wave ${waveManager.waveNumber} — Next in ${Math.ceil(waveManager.timer)}s`;
      waveEl.className = '';
    } else if (waveManager.phase === 'warning') {
      waveEl.textContent = `⚠ WAVE ${waveManager.waveNumber + 1} INCOMING — ${Math.ceil(waveManager.timer)}s`;
      waveEl.className = 'warning';
    } else {
      const alive = waveManager.enemies.filter(e => e.state !== 'dead').length;
      const queued = waveManager.spawnQueue.length;
      waveEl.textContent = `⚔ WAVE ${waveManager.waveNumber} ACTIVE — ${alive + queued} enemies`;
      waveEl.className = 'active';
    }

    // Research RP display
    _set('rp-count', Math.floor(research.rp) + ' RP');

    // Selection panel
    if (this.game.selectedCell) {
      this.updateSelectionPanel();
    }
  }

  updateSelectionPanel() {
    const cell = this.game.selectedCell;
    if (!cell) return;
    const gridCell = this.game.grid.getCell(cell.col, cell.row);
    const b = gridCell?.building;
    const info = document.getElementById('selection-info');
    if (!b) {
      info.innerHTML = `<div class="info-row"><span class="label">Tile</span><span>${cell.col}, ${cell.row}</span></div><div class="info-row"><span class="label">Status</span><span>Empty</span></div>`;
      document.getElementById('demolish-btn').style.display = 'none';
      return;
    }
    const hpPct = (b.hp / b.maxHp * 100).toFixed(0);
    info.innerHTML = `
      <div class="info-row"><span class="label">Building</span><span>${b.def.name}</span></div>
      <div class="info-row"><span class="label">Position</span><span>${b.col}, ${b.row}</span></div>
      <div id="hp-bar-wrap"><div id="hp-bar" style="width:${hpPct}%"></div></div>
      <div class="info-row"><span class="label">HP</span><span>${Math.ceil(b.hp)} / ${b.maxHp}</span></div>
      ${b.def.damage ? `<div class="info-row"><span class="label">Damage</span><span>${b.def.damage}</span></div>` : ''}
      ${b.def.range ? `<div class="info-row"><span class="label">Range</span><span>${b.def.range} tiles</span></div>` : ''}
      ${b.def.soldierCap ? `<div class="info-row"><span class="label">Capacity</span><span>${b.def.soldierCap} soldiers</span></div>` : ''}
    `;
    const btn = document.getElementById('demolish-btn');
    btn.style.display = b.isHQ ? 'none' : 'block';
  }

  notify(msg, type = '') {
    if (!this._notifEl) return;
    const el = document.createElement('div');
    el.className = 'notif' + (type ? ` ${type}` : '');
    el.textContent = msg;
    this._notifEl.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  showGameOver(won = false) {
    const overlay = document.getElementById('overlay');
    document.getElementById('overlay-title').textContent = won ? 'VICTORY' : 'BASE OVERRUN';
    document.getElementById('overlay-sub').textContent = won
      ? 'Your military dominance is complete.'
      : 'Your HQ has been destroyed. Rebuild and try again.';
    overlay.classList.add('show');
  }
}

function _set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
