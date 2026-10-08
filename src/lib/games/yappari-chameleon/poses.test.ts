import { describe, expect, it } from 'vitest';
import { BONES } from './doll';
import { poseById, POSES, STAND } from './poses';

describe('poses', () => {
  it('本家の輪から選んだ 12 種がある', () => {
    expect(POSES.map((p) => p.label)).toEqual([
      '丸まる',
      '寝そべる',
      'しゃがむ',
      'あぐら',
      'ブリッジ',
      'Tポーズ',
      '片足立ち',
      '寄りかかる',
      '開脚',
      '前屈',
      'ワシ',
      'のけぞり'
    ]);
  });

  it('id は重ならず、骨の名前はどれも人形の骨', () => {
    const all = [STAND, ...POSES];
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    for (const p of all)
      for (const [b, a] of Object.entries(p.bones)) {
        expect(BONES).toContain(b);
        for (const v of a!) expect(Math.abs(v)).toBeLessThanOrEqual(Math.PI);
      }
  });

  it('腰は下がるだけで、0.45m より下げない', () => {
    for (const p of POSES) {
      expect(p.drop ?? 0).toBeLessThanOrEqual(0);
      expect(p.drop ?? 0).toBeGreaterThanOrEqual(-0.45);
    }
  });

  it('知らない id は立ち姿になる', () => {
    expect(poseById('nope')).toBe(STAND);
    expect(poseById('curl').label).toBe('丸まる');
  });
});
