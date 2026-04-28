import { ENEMIES, WAVE_TEMPLATES, SPAWN_CORNERS, WAVE_INTERVAL, WAVE_WARNING } from './config.js';

let _nextId = 1;

function makeEnemy(type, col, row, path) {
  const def = ENEMIES[type];
  return {
    id: _nextId++,
    type,
    def,
    col: col + 0.5,
    row: row + 0.5,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed / 48, // tiles per second (48 = TILE_W)
    path: path || [],
    pathIndex: 0,
    state: 'moving', // moving | attacking | dead
    attackTimer: 0,
    target: null,  // building instance being attacked
    bounced: false
  };
}

export class WaveManager {
  constructor(grid) {
    this.grid = grid;
    this.enemies = [];
    this.waveNumber = 0;
    this.phase = 'prep';   // prep | warning | active
    this.timer = WAVE_INTERVAL;
    this.spawnQueue = [];
    this.spawnTimer = 0;
  }

  get timeToWave() { return this.timer; }

  update(dt, research) {
    const extraWarn = research.hasEffect('extraWarning') ? research.getEffect('extraWarning') : 0;
    const warningThreshold = WAVE_WARNING + extraWarn;

    if (this.phase === 'prep') {
      this.timer -= dt;
      if (this.timer <= warningThreshold) {
        this.phase = 'warning';
      }
    } else if (this.phase === 'warning') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._startWave();
      }
    } else if (this.phase === 'active') {
      // Spawn queued enemies
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const next = this.spawnQueue.shift();
          const enemy = this._spawnEnemy(next.type, next.spawnCol, next.spawnRow);
          if (enemy) this.enemies.push(enemy);
          this.spawnTimer = 0.6 + Math.random() * 0.4; // 0.6–1s between spawns
        }
      }

      // Update enemy movement/attack
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        this._updateEnemy(e, dt);
      }

      // Remove dead enemies
      this.enemies = this.enemies.filter(e => e.state !== 'dead');

      // Wave complete when queue empty and no live enemies
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

    // Scale later waves
    const scale = Math.max(1, 1 + (this.waveNumber - WAVE_TEMPLATES.length) * 0.2);

    // Pick 1-2 random spawn corners
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
    // Shuffle queue for mixed waves
    this.spawnQueue.sort(() => Math.random() - 0.5);
  }

  _spawnEnemy(type, col, row) {
    const path = this.grid.pathToHQ(col, row);
    if (!path) {
      // No path: spawn but use direct approach
      return makeEnemy(type, col, row, [{ col: this.grid.hqCol, row: this.grid.hqRow }]);
    }
    return makeEnemy(type, col, row, path);
  }

  _updateEnemy(enemy, dt) {
    if (enemy.state === 'attacking') {
      this._handleAttack(enemy, dt);
      return;
    }

    // Move toward current waypoint
    if (enemy.pathIndex >= enemy.path.length) {
      // Reached HQ area
      enemy.state = 'attacking';
      enemy.target = this.grid.getHQ();
      return;
    }

    const wp = enemy.path[enemy.pathIndex];
    const tx = wp.col + 0.5;
    const ty = wp.row + 0.5;
    const dx = tx - enemy.col;
    const dy = ty - enemy.row;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.1) {
      enemy.pathIndex++;
      return;
    }

    const move = enemy.speed * dt;
    enemy.col += (dx / dist) * move;
    enemy.row += (dy / dist) * move;

    // Check if stepping into a blocking cell (wall/building destroyed path)
    const gc = Math.floor(enemy.col);
    const gr = Math.floor(enemy.row);
    const cell = this.grid.getCell(gc, gr);
    if (cell?.blocksPath && cell.building) {
      // Repath or attack the blocker
      const newPath = this.grid.pathToHQ(gc, gr);
      if (newPath) {
        enemy.path = newPath;
        enemy.pathIndex = 0;
      } else {
        enemy.state = 'attacking';
        enemy.target = cell.building;
      }
    }
  }

  _handleAttack(enemy, dt) {
    if (!enemy.target || enemy.target.hp <= 0) {
      // Target destroyed — repath
      const gc = Math.floor(enemy.col);
      const gr = Math.floor(enemy.row);
      const newPath = this.grid.pathToHQ(gc, gr);
      if (newPath && newPath.length > 0) {
        enemy.path = newPath;
        enemy.pathIndex = 0;
        enemy.state = 'moving';
        enemy.target = null;
      } else {
        // Found HQ or nowhere to go
        const hq = this.grid.getHQ();
        if (hq) { enemy.target = hq; }
        else { enemy.state = 'dead'; }
      }
      return;
    }

    enemy.attackTimer += dt;
    const atkRate = 1.0; // attacks per second
    if (enemy.attackTimer >= 1 / atkRate) {
      enemy.attackTimer = 0;
      enemy.target.hp -= enemy.def.damage;
      if (enemy.target.hp <= 0) {
        this.grid.demolish(enemy.target.col, enemy.target.row);
      }
    }
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
