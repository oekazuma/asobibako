import { describe, expect, it } from 'vitest';
import { cardInfo } from './choice-view';
import { betOf, MAX_BET } from './cauldron';
import { OVERTIME_MAX, overtimeRate } from './drops';
import { LIMIT_SOFT, limitCount, limitStats, STEP } from './limit';
import { OT_GROW, otScale } from './overtime';
import { STAGES } from './stages';
import { createWorld } from './world';

describe('限界突破の頭打ち', () => {
  it('少ない回数ではほぼそのまま、上げるほど伸びが小さくなり、上限を超えない', () => {
    expect(limitCount(0)).toBe(0);
    expect(limitCount(1)).toBeGreaterThan(0.85);
    for (let n = 1; n < 200; n++)
      expect(limitCount(n + 1) - limitCount(n)).toBeLessThan(limitCount(n) - limitCount(n - 1) + 1e-9);
    expect(limitCount(10_000)).toBeLessThan(LIMIT_SOFT);
  });

  it('ダメージの倍率は頭打ちの回数で掛ける', () => {
    const s = { damage: 10, cooldown: 1, amount: 1, area: 1, speed: 1, pierce: 1, duration: 1, knockback: 0 };
    expect(limitStats(s, { damage: 20 }).damage).toBeCloseTo(10 * (1 + STEP.damage * limitCount(20)));
  });

  it('札の文は、次の 1 回で実際に上がるぶんを出す', () => {
    const c = { kind: 'limit' as const, id: 'woof', stat: 'damage' as const, now: 30 };
    const gain = Math.round(STEP.damage * (limitCount(31) - limitCount(30)) * 100);
    expect(cardInfo(c).text).toContain(`+${gain}%`);
  });
});

describe('延長戦', () => {
  it('長くなると 1 分ごとの掛け算で強まる', () => {
    expect(otScale(600, 600)).toBe(1);
    expect(otScale(600 + 50 * 60, 600) / otScale(600 + 49 * 60, 600)).toBeCloseTo(OT_GROW);
  });

  it('コインの倍率は 4 倍で止まる', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    w.overtime = { from: 600, base: {} as never, coins: 0, retreat: false };
    w.time = 600 + 60 * 60;
    expect(overtimeRate(w)).toBe(OVERTIME_MAX);
  });
});

describe('釜と夜の墓地', () => {
  it('9.0 の賭けは MAX_BET', () => {
    expect(betOf(9)).toBe(MAX_BET);
  });

  it('夜の墓地の硬さは森より低い倍率で掛ける（顔ぶれの敵がもともと硬いため）', () => {
    const at = (id: string) => STAGES.find((s) => s.id === id)!.toughness(300);
    expect(at('graveyard')).toBeLessThan(at('forest'));
  });
});
