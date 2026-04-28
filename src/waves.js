import { ENEMIES, WAVE_TEMPLATES, SPAWN_CORNERS, WAVE_INTERVAL, WAVE_WARNING } from './config.js';

let _nextId = 1;

function makeEnemy(type, col, row, path) {
  const def = ENEMIES[type];
  return {
    id: _nextId++,
    type, def,
    col: col + 0.5, row: row + 0.5,
    hp: def.hp, maxHp: def.hp,
    speed: def.speed / 48,
    path: path || [], pathIndex: 0,
    state: 'moving',
    attackTimer: 0, target: null
  };
}

export class WaveManager {
  constructor(grid) {
    this.grid = grid;
    this.enemies = [];
    this.waveNumber = 0;
    this.phase = 'prep';
    this.timer = WAVE_INTERVAL;
    this.spawnQueue = [];
    this.spawnTimer = 0;
  }

  get timeToWave() { return this.timer; }

  update(dt, research) {
    const extraWarn = research.hasEffect('extraWarning') ? research.getEffect('extraWarning') : 0;
    const warnThresh = WAVE_WARNING + extraWarn;

    if (this.phase === 'prep') {
      this.timer -= dt;
      if (this.timer <= warnThresh) this.phase = 'warning';
    } else if (this.phase === 'warning') {
      this.timer -= dt;
      if (this.timer <= 0) this._startWave();
    } else if (this.phase === 'active') {
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const next = this.spawnQueue.shift();
          const e = this._spawnEnemy(next.type, next.spawnCol, next.spawnRow);
          if (e) this.enemies.push(e);
          this.spawnTimer = 0.6 + Math.random() * 0.4;
        }
      }

      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        this._updateEnemy(e, dt);
      }

      this.enemies = this.enemies.filter(e => e.state !== 'dead');

      if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
        this.phase = 'prep';
        this.timer = WAVE_INTERVAL;
        return 'wave_complete';
      }
    }
    return null;
  }

  _startWave() {
    this.waveNumber++;
    this.phase = 'active';
    this.spawnTimer = 0;

    const tplIdx = Math.min(this.waveNumber - 1, WAVE_TEMPLATES.length - 1);
    const template = WAVE_TEMPLATES[tplIdx];
    const scale = Math.max(1, 1 + (this.waveNumber - WAVE_TEMPLATES.length) * 0.2);

    const shuffled = [...SPAWN_CORNERS].sort(() => Math.random() - 0.5);
    const usedCorners = shuffled.slice(0, this.waveNumber >= 3 ? 2 : 1);

    this.spawnQueue = [];
    for (const group of template) {
      const count = Math.ceil(group.count * scale);
      for (let i = 0; i < count; i++) {
        const corner = usedCorners[i % usedCorners.length];
        this.spawnQueue.push({ type: group.type, spawnCol: corner.col, spawnRow: corner.row });
      }
    }
    this.spawnQueue.sort(() => Math.random() - 0.5);
  }

  _spawnEnemy(type, col, row) {
    const path = this.grid.pathToHQ(col, row);
    if (!path) {
      // Base is fully enclosed at spawn — immediately attack nearest wall
      const enemy = makeEnemy(type, col, row, []);
      enemy.state = 'moving'; // will find blocker on first update
      return enemy;
    }
    return makeEnemy(type, col, row, path);
  }

  _updateEnemy(enemy, dt) {
    if (enemy.state === 'attacking') {
      this._handleAttack(enemy, dt);
      return;
    }

    const gc = Math.floor(enemy.col);
    const gr = Math.floor(enemy.row);

    // No path or path exhausted — do NOT auto-attack HQ, find walls first
    if (!enemy.path || enemy.path.length === 0 || enemy.pathIndex >= enemy.path.length) {
      const newPath = this.grid.pathToHQ(gc, gr);
      if (newPath && newPath.length > 0) {
        enemy.path = newPath;
        enemy.pathIndex = 0;
      } else {
        // Must attack a wall/blocker — only attack HQ if literally adjacent
        const distToHQ = Math.abs(gc - this.grid.hqCol) + Math.abs(gr - this.grid.hqRow);
        if (distToHQ <= 1) {
          enemy.state = 'attacking';
          enemy.target = this.grid.getHQ();
        } else {
          this._startAttackingBlocker(enemy, gc, gr);
        }
      }
      return;
    }

    // PRE-CHECK: is the next waypoint now blocked by a wall placed since path was calculated?
    const wp = enemy.path[enemy.pathIndex];
    const wpCell = this.grid.getCell(wp.col, wp.row);
    const wpIsHQ = (wp.col === this.grid.hqCol && wp.row === this.grid.hqRow);
    if (wpCell?.blocksPath && wpCell.building && !wpIsHQ) {
      // Wall placed on our route — repath now, before we walk into it
      const newPath = this.grid.pathToHQ(gc, gr);
      if (newPath && newPath.length > 0) {
        enemy.path = newPath;
        enemy.pathIndex = 0;
      } else {
        enemy.state = 'attacking';
        enemy.target = wpCell.building;
      }
      return;
    }

    // Move toward waypoint
    const tx = wp.col + 0.5;
    const ty = wp.row + 0.5;
    const dx = tx - enemy.col;
    const dy = ty - enemy.row;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.12) {
      enemy.pathIndex++;
      return;
    }

    const move = enemy.speed * dt;
    enemy.col += (dx / dist) * move;
    enemy.row += (dy / dist) * move;
  }

  _handleAttack(enemy, dt) {
    if (!enemy.target || enemy.target.hp <= 0) {
      const gc = Math.floor(enemy.col);
      const gr = Math.floor(enemy.row);
      const newPath = this.grid.pathToHQ(gc, gr);
      if (newPath && newPath.length > 0) {
        enemy.path = newPath;
        enemy.pathIndex = 0;
        enemy.state = 'moving';
        enemy.target = null;
      } else {
        // Path still blocked — attack the NEAREST WALL toward HQ, not the HQ itself
        const blocker = this._findNearestBlocker(gc, gr);
        if (blocker) {
          enemy.target = blocker;
        } else {
          // No blocker nearby means we're actually inside or adjacent to HQ
          const distToHQ = Math.abs(gc - this.grid.hqCol) + Math.abs(gr - this.grid.hqRow);
          if (distToHQ <= 2) {
            const hq = this.grid.getHQ();
            if (hq) enemy.target = hq;
            else enemy.state = 'dead';
          } else {
            enemy.state = 'dead';
          }
        }
      }
      return;
    }

    enemy.attackTimer += dt;
    if (enemy.attackTimer >= 1.0) {
      enemy.attackTimer = 0;
      enemy.target.hp -= enemy.def.damage;
      if (enemy.target.hp <= 0) {
        this.grid.demolish(enemy.target.col, enemy.target.row);
      }
    }
  }

  _startAttackingBlocker(enemy, gc, gr) {
    const blocker = this._findNearestBlocker(gc, gr);
    if (blocker) {
      enemy.state = 'attacking';
      enemy.target = blocker;
    } else {
      // Open ground, no walls — just try direct movement toward HQ
      const distToHQ = Math.abs(gc - this.grid.hqCol) + Math.abs(gr - this.grid.hqRow);
      if (distToHQ <= 1) {
        enemy.state = 'attacking';
        enemy.target = this.grid.getHQ();
      } else {
        // Move directly toward HQ (open ground scenario)
        const dx = (this.grid.hqCol + 0.5) - enemy.col;
        const dy = (this.grid.hqRow + 0.5) - enemy.row;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.5) {
          enemy.path = [{ col: this.grid.hqCol, row: this.grid.hqRow }];
          enemy.pathIndex = 0;
        }
      }
    }
  }

  // BFS toward HQ direction to find the nearest blocking building
  _findNearestBlocker(fromCol, fromRow) {
    const hqCol = this.grid.hqCol;
    const hqRow = this.grid.hqRow;
    const visited = new Set();
    const queue = [{ col: fromCol, row: fromRow }];

    for (let iter = 0; iter < 120 && queue.length > 0; iter++) {
      // Sort to prefer cells closer to HQ
      queue.sort((a, b) =>
        (Math.abs(a.col - hqCol) + Math.abs(a.row - hqRow)) -
        (Math.abs(b.col - hqCol) + Math.abs(b.row - hqRow))
      );
      const { col, row } = queue.shift();
      const key = col * 100 + row;
      if (visited.has(key)) continue;
      visited.add(key);
      if (col < 0 || col >= this.grid.cols || row < 0 || row >= this.grid.rows) continue;

      const cell = this.grid.getCell(col, row);
      if (cell?.building && cell.blocksPath && !(col === fromCol && row === fromRow)) {
        return cell.building;
      }

      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nk = (col + dc) * 100 + (row + dr);
        if (!visited.has(nk)) queue.push({ col: col + dc, row: row + dr });
      }
    }
    return null;
  }

  damageEnemy(enemyId, damage) {
    const e = this.enemies.find(e => e.id === enemyId);
    if (!e || e.state === 'dead') return;
    e.hp -= damage;
    if (e.hp <= 0) {
      e.state = 'dead';
      return { reward: e.def.reward };
    }
    return null;
  }

  // Preview of what the NEXT wave will contain (shown during warning phase)
  getWavePreview() {
    const nextWave = this.waveNumber + (this.phase === 'active' ? 0 : 1);
    const tplIdx = Math.min(nextWave - 1, WAVE_TEMPLATES.length - 1);
    if (tplIdx < 0) return [];
    const template = WAVE_TEMPLATES[tplIdx];
    const scale = Math.max(1, 1 + (nextWave - WAVE_TEMPLATES.length) * 0.2);
    return template.map(g => ({ type: g.type, count: Math.ceil(g.count * scale) }));
  }

  serialize() {
    return { waveNumber: this.waveNumber, phase: this.phase, timer: this.timer };
  }

  deserialize(data) {
    this.waveNumber = data.waveNumber ?? 0;
    this.phase = data.phase === 'active' ? 'prep' : (data.phase ?? 'prep');
    this.timer = data.timer ?? WAVE_INTERVAL;
    this.enemies = [];
    this.spawnQueue = [];
  }
}
