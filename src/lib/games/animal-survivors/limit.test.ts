import { describe, expect, it } from 'vitest';
import { limitStats, limitTotal, statsFor } from './limit';
import { WEAPONS, weaponStats } from './weapons';

describe('限界突破の能力', () => {
  it('ダメージ・待ち時間・大きさ・数はどの武器にも、速さは動く攻撃、時間は残る攻撃だけ', () => {
    expect(statsFor(WEAPONS.woof)).toEqual(['damage', 'cooldown', 'area', 'speed', 'amount']);
    expect(statsFor(WEAPONS.flame)).toEqual(['damage', 'cooldown', 'area', 'duration', 'amount']);
    expect(statsFor(WEAPONS.feather)).toEqual(['damage', 'cooldown', 'area', 'speed', 'duration', 'amount']);
    expect(statsFor(WEAPONS.howl)).toEqual(['damage', 'cooldown', 'area', 'amount']);
  });

  it('合体武器は 2 つの部品の種類から選ぶ', () => {
    // 炎の疾走はダッシュ（動く）と炎（残る）
    expect(statsFor(WEAPONS.flameUn)).toEqual(['damage', 'cooldown', 'area', 'speed', 'duration', 'amount']);
  });

  it('上げた回数を一定の幅で掛け、待ち時間は掛け算で縮む', () => {
    const s = weaponStats(WEAPONS.woof, 5);
    const t = limitStats(s, { damage: 3, cooldown: 2, area: 1, speed: 1, duration: 1, amount: 2 });
    expect(t.damage).toBeCloseTo(s.damage * 1.3);
    expect(t.cooldown).toBeCloseTo(s.cooldown * 0.95 ** 2);
    expect(t.area).toBeCloseTo(s.area * 1.08);
    expect(t.speed).toBeCloseTo(s.speed * 1.1);
    expect(t.duration).toBeCloseTo(s.duration * 1.1);
    expect(t.amount).toBe(s.amount + 2);
    expect(limitStats(s, undefined)).toEqual(s);
  });

  it('合計の回数', () => {
    expect(limitTotal({ damage: 3, amount: 2 })).toBe(5);
    expect(limitTotal(undefined)).toBe(0);
  });
});
