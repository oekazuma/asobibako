import { describe, expect, it } from 'vitest';
import { fxAmount, fxText, GEAR, gearDef, gearOf, keyOf, parseKey, SLOTS, statAmount, statText } from './gear';

describe('装備の表', () => {
  it('3 か所に 6 種ずつ、id は重ならない', () => {
    expect(GEAR).toHaveLength(18);
    for (const s of SLOTS) expect(GEAR.filter((g) => g.slot === s)).toHaveLength(6);
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(18);
  });

  it('伝説は店の最大の半分、レアは 0.65 倍、ふつうは 0.4 倍', () => {
    const h = gearDef('hachimaki');
    expect(statAmount(h, 2)).toBeCloseTo(0.125);
    expect(statAmount(h, 1)).toBeCloseTo(0.125 * 0.65);
    expect(statAmount(h, 0)).toBeCloseTo(0.05);
  });

  it('効き目はふつうに無く、伝説はレアの 2 倍', () => {
    const h = gearDef('hachimaki');
    expect(fxAmount(h, 0)).toBe(0);
    expect(fxAmount(h, 1)).toBeCloseTo(0.15);
    expect(fxAmount(h, 2)).toBeCloseTo(0.3);
    expect(fxText(h, 0)).toBe(null);
    expect(fxText(h, 2)).toBe('ボスとヌシへの攻撃 +30%');
  });

  it('能力の文は割合と数を分けて書く', () => {
    expect(statText(gearDef('hachimaki'), 0)).toBe('攻撃 +5%');
    expect(statText(gearDef('muffler'), 2)).toBe('最大 HP +25');
    expect(statText(gearDef('knight'), 2)).toBe('防御 +1.5');
  });

  it('鍵は品とレア度で、知らない鍵は読まない', () => {
    expect(keyOf('owl', 1)).toBe('owl:1');
    expect(parseKey('owl:1')?.def.id).toBe('owl');
    expect(parseKey('owl:3')).toBe(null);
    expect(parseKey('dragon:1')).toBe(null);
  });

  it('つけた品の能力・コイン・効き目を足し合わせる', () => {
    const g = gearOf(['hachimaki:2', 'knight:1', 'cat:2']);
    expect(g.boost.might).toBeCloseTo(0.125);
    expect(g.boost.armor).toBeCloseTo(1.5 * 0.65);
    expect(g.greed).toBeCloseTo(0.25);
    expect(g.fx.bossDmg).toBeCloseTo(0.3);
    expect(g.fx.bossGuard).toBeCloseTo(0.15);
    expect(g.fx.gold).toBeCloseTo(2);
    expect(g.fx.feather).toBe(0);
  });
});
