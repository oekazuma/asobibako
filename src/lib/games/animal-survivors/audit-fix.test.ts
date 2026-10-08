import { describe, expect, it } from 'vitest';
import { atkMul, ATK_AT9, hpMul, HP_AT9 } from './cauldron';
import { AMOUNT_CAP, limitCards, limitGain, limitStats } from './limit';
import { OT_EARLY, otScale } from './overtime';
import { MAX_LEVEL, WEAPONS, weaponStats } from './weapons';
import { createWorld } from './world';

describe('延長戦の伸び方', () => {
  it('序盤は 1 分ごとの足し算、長くなると掛け算の速いほうで強まる', () => {
    expect(otScale(600 + 5 * 60, 600)).toBeCloseTo(1 + OT_EARLY * 5);
    expect(otScale(600 + 60 * 60, 600)).toBeGreaterThan(1 + OT_EARLY * 60);
  });
});

describe('釜の強さの曲線', () => {
  it('9.0 は決めた値で、お題の 2.5〜3.5 は前の直線とほぼ同じ', () => {
    expect(hpMul(9)).toBeCloseTo(HP_AT9);
    expect(atkMul(9)).toBeCloseTo(ATK_AT9);
    for (const h of [2.5, 3, 3.5]) {
      expect(hpMul(h)).toBeLessThan((1 + (1.75 * (h - 2)) / 7) * 1.05);
      expect(atkMul(h)).toBeLessThan((1 + (0.8 * (h - 2)) / 7) * 1.05);
    }
  });
});

describe('限界突破の数', () => {
  it('数は 1 回ごとに 1 ずつ増え、上限で止まり、上限の武器には数の札を出さない', () => {
    const s = weaponStats(WEAPONS.woof, MAX_LEVEL);
    expect(limitStats(s, { amount: 3 }).amount).toBe(s.amount + 3);
    expect(limitStats(s, { amount: AMOUNT_CAP + 4 }).amount).toBe(s.amount + AMOUNT_CAP);
    expect(limitGain('amount', 3)).toBe('数 +1');
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    w.weapons = [{ id: 'woof', level: MAX_LEVEL, cd: 0, limit: { amount: AMOUNT_CAP } }];
    for (let i = 0; i < 50; i++) {
      const cards = limitCards(w, 3);
      expect(cards.some((c) => c.kind === 'limit' && c.stat === 'amount')).toBe(false);
    }
  });
});
