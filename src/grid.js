import { GRID_COLS, GRID_ROWS, BUILDINGS, HQ_COL, HQ_ROW } from './config.js';
import { findPath } from './pathfinding.js';

export class Grid {
  constructor() {
    this.cols = GRID_COLS;
    this.rows = GRID_ROWS;
    // cells[row][col] = { building: inst|null, blocksPath: bool, originCol, originRow }
    this.cells = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({ building: null, blocksPath: false }))
    );
    this.hqCol = HQ_COL;
    this.hqRow = HQ_ROW;
    this._placeBuilding('HQ', HQ_COL, HQ_ROW, true);
  }

  _placeBuilding(id, col, row, isHQ = false) {
    const def = BUILDINGS[id];
    const inst = {
      id, def, col, row,
      hp: def.hp, maxHp: def.maxHp,
      lastFired: 0,
      isHQ
    };
    for (let dc = 0; dc < def.size; dc++) {
      for (let dr = 0; dr < def.size; dr++) {
        this.cells[row + dr][col + dc] = {
          building: inst,
          blocksPath: def.blockMove !== false,
          originCol: col,
          originRow: row
        };
      }
    }
    return inst;
  }

  canPlace(id, col, row, researchUnlocks) {
    const def = BUILDINGS[id];
    if (!def) return false;
    if (def.unlockRequired && !researchUnlocks.has(def.unlockRequired)) return false;
    for (let dc = 0; dc < def.size; dc++) {
      for (let dr = 0; dr < def.size; dr++) {
        const c = col + dc, r = row + dr;
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
        if (this.cells[r][c].building) return false;
      }
    }
    return true;
  }

  place(id, col, row, researchUnlocks) {
    if (!this.canPlace(id, col, row, researchUnlocks)) return null;
    return this._placeBuilding(id, col, row);
  }

  demolish(col, row) {
    const cell = this.cells[row]?.[col];
    if (!cell?.building || cell.building.isHQ) return false;
    const inst = cell.building;
    const oc = cell.originCol ?? col;
    const or = cell.originRow ?? row;
    for (let dc = 0; dc < inst.def.size; dc++) {
      for (let dr = 0; dr < inst.def.size; dr++) {
        this.cells[or + dr][oc + dc] = { building: null, blocksPath: false };
      }
    }
    return true;
  }

  // Returns all unique building instances (one per building, not per cell)
  getBuildings() {
    const seen = new Set();
    const out = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const b = this.cells[r][c].building;
        if (b && !seen.has(b)) { seen.add(b); out.push(b); }
      }
    }
    return out;
  }

  getTowers() {
    return this.getBuildings().filter(b => b.def.damage);
  }

  getHQ() {
    return this.cells[this.hqRow][this.hqCol].building;
  }

  getCell(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return this.cells[row][col];
  }

  pathToHQ(fromCol, fromRow) {
    return findPath(this.cells, fromCol, fromRow, this.hqCol, this.hqRow, this.cols, this.rows);
  }

  // Soldier capacity from all Barracks/Bunker buildings
  getSoldierCapacity() {
    return this.getBuildings().reduce((sum, b) => sum + (b.def.soldierCap || 0), 0);
  }

  // Finance income per second
  getFinanceIncome() {
    return this.getBuildings().reduce((sum, b) => sum + (b.def.incomePerSec || 0), 0);
  }

  getRPPerSec() {
    return this.getBuildings().reduce((sum, b) => sum + (b.def.rpPerSec || 0), 0);
  }

  getContractSlots() {
    return this.getBuildings().reduce((sum, b) => sum + (b.def.contractSlots || 0), 0);
  }
}
