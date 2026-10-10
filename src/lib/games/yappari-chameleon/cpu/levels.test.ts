import { describe, expect, it } from 'vitest';
import { CPU_DEFAULT, SKILLS, STRENGTHS } from './levels';

describe('強さの表', () => {
  it('撃つまでの迷いと狙いのずれは、弱い 1.5 秒 3 度・普通 0.8 秒 1.5 度・強い 0.4 秒 0.5 度', () => {
    expect([SKILLS.weak, SKILLS.normal, SKILLS.strong].map((s) => [s.wait, s.aim])).toEqual([
      [1.5, 3],
      [0.8, 1.5],
      [0.4, 0.5]
    ]);
  });

  it('強いほど、わずかな色の違いに気づき、口笛のずれが小さく、筆が細かい', () => {
    const list = [SKILLS.weak, SKILLS.normal, SKILLS.strong];
    for (let i = 1; i < 3; i++) {
      expect(list[i].diff).toBeLessThan(list[i - 1].diff);
      expect(list[i].stray.base).toBeLessThan(list[i - 1].stray.base);
      expect(list[i].stray.far).toBeLessThan(list[i - 1].stray.far);
      expect(list[i].brush).toBeLessThan(list[i - 1].brush);
      expect(list[i].jitter).toBeLessThan(list[i - 1].jitter);
    }
    expect(SKILLS.strong.stray.base).toBeGreaterThanOrEqual(1);
  });

  it('隠れ場所は、弱いが床だけ、普通が壁ぎわと家具の陰、強いは張り付きも使う', () => {
    expect([SKILLS.weak.tiers, SKILLS.normal.tiers, SKILLS.strong.tiers]).toEqual([[0], [1], [1, 2]]);
  });

  it('歩きは、弱いがゆっくり同じ所も見に行き、普通が決まった順、強いが走ってまだ見ていない部屋から', () => {
    expect(SKILLS.weak).toMatchObject({ pace: 0.6, run: false, order: 'random', crouch: false });
    expect(SKILLS.normal).toMatchObject({ pace: 1, run: false, order: 'loop', crouch: false });
    expect(SKILLS.strong).toMatchObject({ pace: 1, run: true, order: 'fresh', crouch: true });
  });

  it('画面の言葉と、選ぶ画面の既定', () => {
    expect(STRENGTHS.map((s) => s.name)).toEqual(['弱い', '普通', '強い']);
    expect(CPU_DEFAULT).toEqual({ side: 'hide', count: 1, mode: 'normal', strength: 'normal' });
  });
});
