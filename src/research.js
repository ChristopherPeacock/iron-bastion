import { RESEARCH_NODES } from './config.js';

export class Research {
  constructor() {
    this.rp = 0;
    this.researched = new Set(); // node IDs that are completed
    this.unlocks = new Set();    // string unlock keys (BUNKER_TECH, AT_SYSTEMS, etc.)
    this._effectCache = {};
    this._buildEffectCache();
  }

  _buildEffectCache() {
    this._effectCache = {};
    for (const id of this.researched) {
      const node = RESEARCH_NODES.find(n => n.id === id);
      if (!node) continue;
      if (node.effect) {
        for (const [k, v] of Object.entries(node.effect)) {
          if (typeof v === 'number') {
            this._effectCache[k] = (this._effectCache[k] || 0) + v;
          }
        }
      }
    }
  }

  hasEffect(key) { return key in this._effectCache; }
  getEffect(key) { return this._effectCache[key] || 0; }

  canResearch(nodeId) {
    const node = RESEARCH_NODES.find(n => n.id === nodeId);
    if (!node) return false;
    if (this.researched.has(nodeId)) return false;
    if (this.rp < node.rpCost) return false;
    return node.requires.every(r => this.researched.has(r));
  }

  research(nodeId) {
    if (!this.canResearch(nodeId)) return false;
    const node = RESEARCH_NODES.find(n => n.id === nodeId);
    this.rp -= node.rpCost;
    this.researched.add(nodeId);
    if (node.unlocks) this.unlocks.add(node.unlocks);
    this._buildEffectCache();
    return true;
  }

  isUnlocked(key) { return this.unlocks.has(key); }

  addRP(amount) { this.rp += amount; }

  update(dt, grid) {
    this.rp += grid.getRPPerSec() * dt;
  }

  getNodeStatus(nodeId) {
    if (this.researched.has(nodeId)) return 'researched';
    const node = RESEARCH_NODES.find(n => n.id === nodeId);
    if (!node) return 'locked';
    const prereqsMet = node.requires.every(r => this.researched.has(r));
    return prereqsMet ? 'available' : 'locked';
  }

  serialize() {
    return { rp: this.rp, researched: [...this.researched] };
  }

  deserialize(data) {
    this.rp = data.rp ?? 0;
    this.researched = new Set(data.researched ?? []);
    this.unlocks = new Set();
    for (const id of this.researched) {
      const node = RESEARCH_NODES.find(n => n.id === id);
      if (node?.unlocks) this.unlocks.add(node.unlocks);
    }
    this._buildEffectCache();
  }
}
