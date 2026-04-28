import {
  STARTING_MONEY, SOLDIER_HIRE_COST, SOLDIER_FIRE_REFUND,
  SOLDIER_WAGE_PER_SEC, SOLDIER_CONTRACT_RATE, SOLDIER_DEFENSE_BONUS
} from './config.js';

export class Economy {
  constructor() {
    this.money = STARTING_MONEY;
    this.soldiers = 0;
    this.contractedSoldiers = 0; // subset of soldiers on contract
    this.incomeAccum = 0;
  }

  get defendingSoldiers() {
    return this.soldiers - this.contractedSoldiers;
  }

  // Net income per second (positive = profit)
  getNetPerSec(grid, research) {
    const financeIncome = grid.getFinanceIncome();
    const contractMult = research.hasEffect('contractBonus')
      ? 1 + research.getEffect('contractBonus') : 1;
    const incomeMult = research.hasEffect('incomeMultiplier')
      ? research.getEffect('incomeMultiplier') : 1;
    const contractIncome = this.contractedSoldiers * SOLDIER_CONTRACT_RATE * contractMult;
    const totalIncome = (financeIncome + contractIncome) * incomeMult;
    const wages = this.soldiers * SOLDIER_WAGE_PER_SEC;
    return { income: totalIncome, wages, net: totalIncome - wages };
  }

  update(dt, grid, research) {
    const cap = grid.getSoldierCapacity();
    this.soldiers = Math.min(this.soldiers, cap);
    this.contractedSoldiers = Math.min(this.contractedSoldiers, this.soldiers);

    const { net } = this.getNetPerSec(grid, research);
    this.money += net * dt;
    if (this.money < 0) this.money = 0;
  }

  canAfford(cost) { return this.money >= cost; }

  spend(amount) {
    if (!this.canAfford(amount)) return false;
    this.money -= amount;
    return true;
  }

  earn(amount) { this.money += amount; }

  hireSoldier(grid) {
    const cap = grid.getSoldierCapacity();
    if (this.soldiers >= cap) return { ok: false, reason: 'No soldier capacity. Build a Barracks.' };
    if (!this.canAfford(SOLDIER_HIRE_COST)) return { ok: false, reason: `Need $${SOLDIER_HIRE_COST} to hire.` };
    this.money -= SOLDIER_HIRE_COST;
    this.soldiers++;
    return { ok: true };
  }

  fireSoldier() {
    if (this.soldiers <= 0) return { ok: false, reason: 'No soldiers to fire.' };
    this.soldiers--;
    this.contractedSoldiers = Math.min(this.contractedSoldiers, this.soldiers);
    this.money += SOLDIER_FIRE_REFUND;
    return { ok: true };
  }

  setContracted(count) {
    const max = Math.min(this.soldiers, 999); // will be further clamped by slots
    this.contractedSoldiers = Math.max(0, Math.min(count, max));
  }

  // Defense damage multiplier from soldiers
  getDefenseMultiplier(research) {
    const base = SOLDIER_DEFENSE_BONUS;
    const bonus = research.hasEffect('soldierDefenseBonus')
      ? research.getEffect('soldierDefenseBonus') : base;
    return 1 + this.defendingSoldiers * bonus;
  }

  serialize() {
    return { money: this.money, soldiers: this.soldiers, contractedSoldiers: this.contractedSoldiers };
  }

  deserialize(data) {
    this.money = data.money ?? STARTING_MONEY;
    this.soldiers = data.soldiers ?? 0;
    this.contractedSoldiers = data.contractedSoldiers ?? 0;
  }
}
