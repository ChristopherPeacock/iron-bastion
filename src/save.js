export class SaveManager {
  constructor(game) {
    this.game = game;
  }

  async save() {
    const data = this._serialize();
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) return true;
    } catch {}
    // Fallback to localStorage
    try { localStorage.setItem('ironBastion', JSON.stringify(data)); return true; } catch {}
    return false;
  }

  async load() {
    try {
      const res = await fetch('/api/save');
      if (res.ok) {
        const data = await res.json();
        if (data) { this._deserialize(data); return true; }
      }
    } catch {}
    // Fallback
    try {
      const raw = localStorage.getItem('ironBastion');
      if (raw) { this._deserialize(JSON.parse(raw)); return true; }
    } catch {}
    return false;
  }

  async deleteSave() {
    try { await fetch('/api/save', { method: 'DELETE' }); } catch {}
    try { localStorage.removeItem('ironBastion'); } catch {}
  }

  _serialize() {
    const { economy, research, waveManager, grid } = this.game;
    const buildings = [];
    const seen = new Set();
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        if (cell.building && !seen.has(cell.building)) {
          seen.add(cell.building);
          buildings.push({
            id: cell.building.id,
            col: cell.building.col,
            row: cell.building.row,
            hp: cell.building.hp
          });
        }
      }
    }
    return {
      version: 1,
      economy: economy.serialize(),
      research: research.serialize(),
      wave: waveManager.serialize(),
      buildings
    };
  }

  _deserialize(data) {
    if (!data || data.version !== 1) return;
    const { economy, research, waveManager, grid } = this.game;

    economy.deserialize(data.economy || {});
    research.deserialize(data.research || {});
    waveManager.deserialize(data.wave || {});

    // Rebuild grid
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        grid.cells[r][c] = { building: null, blocksPath: false };
      }
    }
    for (const b of (data.buildings || [])) {
      const inst = grid._placeBuilding(b.id, b.col, b.row, b.id === 'HQ');
      if (inst) inst.hp = b.hp ?? inst.def.hp;
    }
  }
}
