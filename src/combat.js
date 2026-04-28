import { gridToScreen } from './isometric.js';
import { TILE_W } from './config.js';

let _projId = 1;

export class CombatManager {
  constructor(grid, waveManager) {
    this.grid = grid;
    this.waveManager = waveManager;
    this.projectiles = []; // { id, x, y, tx, ty, targetId, speed, damage, armorPiercing, color }
    this._earnCallbacks = [];
  }

  onEarn(cb) { this._earnCallbacks.push(cb); }

  update(dt, economy, research, ox, oy) {
    const towers = this.grid.getTowers();
    const enemies = this.waveManager.enemies.filter(e => e.state !== 'dead');

    if (enemies.length === 0 && this.projectiles.length === 0) return;

    const defMult = economy.getDefenseMultiplier(research);
    const towerDmgBonus = research.hasEffect('towerDamageBonus')
      ? 1 + research.getEffect('towerDamageBonus') : 1;
    const defenseMult = research.hasEffect('defenseMultiplier')
      ? research.getEffect('defenseMultiplier') : 1;
    const totalMult = defMult * towerDmgBonus * defenseMult;

    // Fire from towers
    const now = performance.now() / 1000;
    for (const tower of towers) {
      if (!tower.def.damage) continue;
      if (now - tower.lastFired < 1 / tower.def.fireRate) continue;

      const tsr = gridToScreen(tower.col + tower.def.size / 2, tower.row + tower.def.size / 2, ox, oy);
      const range = tower.def.range * TILE_W;

      // Target: enemy closest to HQ (furthest along its path)
      let best = null, bestProgress = -1;
      for (const e of enemies) {
        const esr = _enemyScreen(e, ox, oy);
        const dx = esr.x - tsr.x, dy = esr.y - tsr.y;
        if (dx * dx + dy * dy > range * range) continue;
        const progress = e.pathIndex + (e.path.length > 0 ? 1 : 0);
        if (progress > bestProgress) { bestProgress = progress; best = e; }
      }

      if (best) {
        tower.lastFired = now;
        const esr = _enemyScreen(best, ox, oy);
        const dmg = tower.def.damage * totalMult;
        this.projectiles.push({
          id: _projId++,
          x: tsr.x, y: tsr.y,
          targetId: best.id,
          speed: 280,
          damage: dmg,
          armorPiercing: tower.def.armorPiercing || false,
          color: tower.def.armorPiercing ? '#ff8040' : '#ffe060'
        });
      }
    }

    // Move projectiles
    this.projectiles = this.projectiles.filter(p => {
      const target = this.waveManager.enemies.find(e => e.id === p.targetId && e.state !== 'dead');
      if (!target) return false;

      const es = _enemyScreen(target, ox, oy);
      const dx = es.x - p.x, dy = es.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const move = p.speed * dt;

      if (dist <= move + 4) {
        // Hit
        let dmg = p.damage;
        if (!p.armorPiercing) dmg = Math.max(1, dmg - target.def.armor);
        const result = this.waveManager.damageEnemy(p.targetId, dmg);
        if (result) {
          for (const cb of this._earnCallbacks) cb(result.reward);
        }
        return false;
      }

      p.x += (dx / dist) * move;
      p.y += (dy / dist) * move;
      return true;
    });
  }

  serialize() { return {}; }
  deserialize() { this.projectiles = []; }
}

function _enemyScreen(enemy, ox, oy) {
  return gridToScreen(enemy.col, enemy.row, ox, oy);
}
