import { describe, expect, it } from 'vitest';
import { atkMul, betOf, chestOdds, coinMul, heatLabel, heatStage, hpMul, maxHeat, PLAIN, snap } from './cauldron';
import { chestSize } from './chest';
import { FOREST } from './stages/forest';
import { coinsOf, createWorld, hurtPlayer, summary } from './world';

const VIEW = { w: 274, h: 394 };

describe('釜の強さ', () => {
  it('2.0 は今と同じで、賭けない', () => {
    for (const f of [hpMul, atkMul, coinMul]) expect(f(2)).toBeCloseTo(1, 9);
    expect(betOf(2)).toBe(0);
    expect(betOf(2.1)).toBe(10);
    expect(heatStage(FOREST, 2)).toBe(FOREST);
    expect(chestOdds(2)).toEqual({ one: 0.85, three: 0.98 });
  });

  it('0.0 はやさしくコインが半分、9.0 は強くコイン 4 倍で 1500 枚賭ける', () => {
    expect([hpMul(0), atkMul(0), coinMul(0), betOf(0)]).toEqual([0.6, 0.7, 0.5, 0]);
    expect(hpMul(9)).toBeCloseTo(2.75);
    expect(atkMul(9)).toBeCloseTo(1.8);
    expect(coinMul(9)).toBeCloseTo(4);
    expect(betOf(9)).toBe(1500);
    expect(chestOdds(9).one).toBeCloseTo(0.5);
    expect(chestOdds(9).three).toBeCloseTo(0.85);
  });

  it('上げるほど賭けは増え、10 枚刻み', () => {
    let prev = 0;
    for (let k = 21; k <= 90; k++) {
      const b = betOf(k / 10);
      expect(b).toBeGreaterThanOrEqual(prev);
      expect(b % 10).toBe(0);
      prev = b;
    }
  });

  it('強さは 0.1 刻みに丸め、表示は 1 桁', () => {
    expect(snap(4.4999999)).toBe(4.5);
    expect(snap(-1)).toBe(0);
    expect(snap(12)).toBe(9);
    expect(heatLabel(0.1 + 0.2)).toBe('0.3');
    expect(heatLabel(2)).toBe('2.0');
  });

  it('払える最大の強さは、賭けが持っているコイン以下になるところ', () => {
    expect(maxHeat(0)).toBe(2);
    expect(maxHeat(99999)).toBe(9);
    const h = maxHeat(300);
    expect(betOf(h)).toBeLessThanOrEqual(300);
    expect(betOf(snap(h + 0.1))).toBeGreaterThan(300);
  });

  it('写した表は体力・ヌシ・コインに掛かり、元の表は変わらない', () => {
    const s = heatStage(FOREST, 9);
    expect(s.toughness(300)).toBeCloseTo(FOREST.toughness(300) * hpMul(9));
    // 攻撃は自分が受けるところで掛けるので、表の fury には掛けない（二重にしない）
    expect(s.fury(300)).toBe(FOREST.fury(300));
    expect(s.chiefs[0].hp).toBeCloseTo(FOREST.chiefs[0].hp * hpMul(9));
    expect(s.coin).toBeCloseTo(FOREST.coin * coinMul(9));
    expect(FOREST.toughness(300)).toBeCloseTo(1 + (300 / 600) * 4.2);
  });

  it('createWorld は強さを持ち、コインに倍率が掛かり、まとめに入る', () => {
    const heat = { level: 4.5, bet: betOf(4.5) };
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { heat });
    expect(w.heat).toEqual(heat);
    w.coins = 100;
    expect(coinsOf(w)).toBe(Math.floor(100 * 1.5 * coinMul(4.5) + 1e-9));
    expect(summary(w).heat).toEqual(heat);
    expect(createWorld('dog', 1, VIEW).heat).toEqual(PLAIN);
  });

  it('宝箱の中身の数は渡した割合で決まる', () => {
    const odds = chestOdds(9);
    expect(chestSize(0.49, odds)).toBe(1);
    expect(chestSize(0.51, odds)).toBe(3);
    expect(chestSize(0.9, odds)).toBe(5);
    expect(chestSize(0.9)).toBe(3);
  });
});

describe('釜の攻撃の倍率', () => {
  const hit = (level: number, raw: number) => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { heat: { level, bet: 0 } });
    w.stats.armor = 0;
    const hp = w.player.hp;
    hurtPlayer(w, raw);
    return hp - w.player.hp;
  };

  it('ボスの攻撃も含めて、受けるダメージ全部に掛かる', () => {
    expect(hit(2, 20)).toBe(20);
    expect(hit(9, 20)).toBe(Math.round(20 * atkMul(9)));
    expect(hit(0, 20)).toBe(Math.round(20 * atkMul(0)));
  });

  it('2.0 では倍率がちょうど 1', () => {
    expect(atkMul(2)).toBe(1);
    expect(hpMul(2)).toBe(1);
    expect(coinMul(2)).toBe(1);
  });
});
