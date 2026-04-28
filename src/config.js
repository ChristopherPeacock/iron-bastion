export const TILE_W = 48;
export const TILE_H = 24;
export const GRID_COLS = 16;
export const GRID_ROWS = 16;
export const HQ_COL = 7;
export const HQ_ROW = 7;

export const STARTING_MONEY = 50000;
export const SOLDIER_HIRE_COST = 2000;
export const SOLDIER_FIRE_REFUND = 600;
export const SOLDIER_WAGE_PER_SEC = 8;
export const SOLDIER_CONTRACT_RATE = 70;  // income per contracted soldier per second
export const SOLDIER_DEFENSE_BONUS = 0.03; // 3% damage per defending soldier

export const WAVE_INTERVAL = 90;   // seconds between waves
export const WAVE_WARNING = 25;    // seconds of warning before wave

export const BUILDINGS = {
  HQ: {
    id: 'HQ', name: 'Command HQ', size: 2, cost: 0, hp: 2500, maxHp: 2500,
    category: 'special', color: '#1a4a7a', blockMove: true,
    description: 'Your main base. Protect it at all costs!'
  },
  WALL: {
    id: 'WALL', name: 'Concrete Wall', size: 1, cost: 400, hp: 600, maxHp: 600,
    category: 'structures', color: '#6a7a72', blockMove: true,
    description: 'Blocks enemy movement. Forces enemies to pathfind around.'
  },
  WATCH_TOWER: {
    id: 'WATCH_TOWER', name: 'Watch Tower', size: 1, cost: 3500, hp: 200, maxHp: 200,
    category: 'structures', color: '#2c3e50', blockMove: false,
    range: 5, damage: 22, fireRate: 1.0,
    description: 'Long-range automated tower. Core defense structure.'
  },
  GUARD_POST: {
    id: 'GUARD_POST', name: 'Guard Post', size: 1, cost: 1500, hp: 150, maxHp: 150,
    category: 'structures', color: '#34495e', blockMove: false,
    range: 3, damage: 9, fireRate: 2.5,
    description: 'Short range, fast-firing. Great for base interiors.'
  },
  SNIPER_TOWER: {
    id: 'SNIPER_TOWER', name: 'Sniper Tower', size: 1, cost: 6000, hp: 180, maxHp: 180,
    category: 'structures', color: '#1a2530', blockMove: false,
    range: 9, damage: 80, fireRate: 0.4, unlockRequired: 'HEAVY_WEAPONS',
    description: 'Extreme range, high single-shot damage. Unlocked via research.'
  },
  BARRACKS: {
    id: 'BARRACKS', name: 'Barracks', size: 2, cost: 5000, hp: 300, maxHp: 300,
    category: 'military', color: '#4a5320', blockMove: true,
    soldierCap: 5,
    description: 'Houses up to 5 soldiers. Required to recruit troops.'
  },
  BUNKER: {
    id: 'BUNKER', name: 'Reinforced Bunker', size: 2, cost: 8500, hp: 1000, maxHp: 1000,
    category: 'military', color: '#4a5060', blockMove: true,
    soldierCap: 8, unlockRequired: 'BUNKER_TECH',
    description: 'Heavy fortified housing. Very high HP. Requires research.'
  },
  ANTI_TANK: {
    id: 'ANTI_TANK', name: 'AT Emplacement', size: 1, cost: 7000, hp: 220, maxHp: 220,
    category: 'military', color: '#7a2218', blockMove: false,
    range: 5, damage: 120, fireRate: 0.4, armorPiercing: true, unlockRequired: 'AT_SYSTEMS',
    description: 'Devastating vs armored units. Ignores armor. Requires research.'
  },
  RESEARCH_LAB: {
    id: 'RESEARCH_LAB', name: 'Research Lab', size: 2, cost: 10000, hp: 200, maxHp: 200,
    category: 'economy', color: '#1a5a3a', blockMove: true,
    rpPerSec: 2,
    description: 'Generates 2 Research Points per second.'
  },
  FINANCE_HQ: {
    id: 'FINANCE_HQ', name: 'Finance Office', size: 2, cost: 8000, hp: 200, maxHp: 200,
    category: 'economy', color: '#8a6a10', blockMove: true,
    incomePerSec: 120,
    description: 'Passive income: $120/sec. Stack for exponential growth.'
  },
  CONTRACT_OFFICE: {
    id: 'CONTRACT_OFFICE', name: 'Contract Office', size: 2, cost: 6000, hp: 200, maxHp: 200,
    category: 'economy', color: '#6a3a20', blockMove: true,
    contractSlots: 3,
    description: 'Each office allows 3 additional soldiers on contract.'
  }
};

export const ENEMIES = {
  INFANTRY: {
    id: 'INFANTRY', name: 'Infantry Squad',
    hp: 100, speed: 65, damage: 15, reward: 250, color: '#c0392b', armor: 0, radius: 7
  },
  VEHICLE: {
    id: 'VEHICLE', name: 'Light Vehicle',
    hp: 350, speed: 85, damage: 35, reward: 600, color: '#992b1b', armor: 25, radius: 10
  },
  HEAVY: {
    id: 'HEAVY', name: 'Heavy Assault',
    hp: 1000, speed: 38, damage: 70, reward: 1800, color: '#6b1b0b', armor: 55, radius: 14
  }
};

export const RESEARCH_NODES = [
  // === Economy Branch ===
  {
    id: 'LOGISTICS', name: 'Logistics', branch: 'economy', tier: 0,
    rpCost: 50, requires: [],
    description: '+40% contract income',
    effect: { contractBonus: 0.4 }
  },
  {
    id: 'ELITE_MERCS', name: 'Elite Mercs', branch: 'economy', tier: 1,
    rpCost: 120, requires: ['LOGISTICS'],
    description: 'Soldiers deal +60% damage on defense',
    effect: { soldierDefenseBonus: 0.06 }
  },
  {
    id: 'BLACK_MARKET', name: 'Black Market', branch: 'economy', tier: 2,
    rpCost: 220, requires: ['ELITE_MERCS'],
    description: 'All buildings cost 25% less',
    effect: { buildCostMult: 0.75 }
  },
  {
    id: 'INTEL_NETWORK', name: 'Intel Network', branch: 'economy', tier: 3,
    rpCost: 350, requires: ['BLACK_MARKET'],
    description: 'Enemy waves announced 45s earlier',
    effect: { extraWarning: 45 }
  },
  {
    id: 'GLOBAL_OPS', name: 'Global Operations', branch: 'economy', tier: 4,
    rpCost: 600, requires: ['INTEL_NETWORK'],
    description: 'Double all income sources',
    effect: { incomeMultiplier: 2.0 }
  },
  // === Combat Branch ===
  {
    id: 'REINFORCED_WALLS', name: 'Reinforced Walls', branch: 'combat', tier: 0,
    rpCost: 50, requires: [],
    description: '+100% wall HP permanently',
    effect: { wallHpBonus: 1.0 }
  },
  {
    id: 'HEAVY_WEAPONS', name: 'Heavy Weapons', branch: 'combat', tier: 1,
    rpCost: 120, requires: ['REINFORCED_WALLS'],
    description: '+50% tower damage. Unlocks Sniper Tower.',
    unlocks: 'HEAVY_WEAPONS',
    effect: { towerDamageBonus: 0.5 }
  },
  {
    id: 'BUNKER_TECH', name: 'Bunker Tech', branch: 'combat', tier: 2,
    rpCost: 220, requires: ['HEAVY_WEAPONS'],
    description: 'Unlocks Reinforced Bunker building.',
    unlocks: 'BUNKER_TECH'
  },
  {
    id: 'AT_SYSTEMS', name: 'AT Systems', branch: 'combat', tier: 3,
    rpCost: 350, requires: ['BUNKER_TECH'],
    description: 'Unlocks Anti-Tank emplacement.',
    unlocks: 'AT_SYSTEMS'
  },
  {
    id: 'MILITARY_FORTRESS', name: 'Military Fortress', branch: 'combat', tier: 4,
    rpCost: 600, requires: ['AT_SYSTEMS'],
    description: 'All defense stats doubled. True endgame dominance.',
    effect: { defenseMultiplier: 2.0 }
  }
];

// enemy composition per wave index (repeats/scales after last entry)
export const WAVE_TEMPLATES = [
  [{ type: 'INFANTRY', count: 6 }],
  [{ type: 'INFANTRY', count: 10 }, { type: 'VEHICLE', count: 2 }],
  [{ type: 'INFANTRY', count: 12 }, { type: 'VEHICLE', count: 4 }],
  [{ type: 'INFANTRY', count: 15 }, { type: 'VEHICLE', count: 5 }, { type: 'HEAVY', count: 1 }],
  [{ type: 'INFANTRY', count: 18 }, { type: 'VEHICLE', count: 7 }, { type: 'HEAVY', count: 2 }],
  [{ type: 'INFANTRY', count: 22 }, { type: 'VEHICLE', count: 8 }, { type: 'HEAVY', count: 4 }],
  [{ type: 'INFANTRY', count: 28 }, { type: 'VEHICLE', count: 10 }, { type: 'HEAVY', count: 6 }],
];

export const SPAWN_CORNERS = [
  { col: 0, row: 0 },
  { col: GRID_COLS - 1, row: 0 },
  { col: 0, row: GRID_ROWS - 1 },
  { col: GRID_COLS - 1, row: GRID_ROWS - 1 }
];
