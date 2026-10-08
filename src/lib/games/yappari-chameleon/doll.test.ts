import { describe, expect, it } from 'vitest';
import { BONES, buildDoll, HEIGHT, JOINTS, PARENT } from './doll';

describe('doll', () => {
  // 細かい面は 1 秒ほどかかるので、形を見るテストは粗い面で足りる
  const d = buildDoll(0.02);
  const n = d.pos.length / 3;
  const ys = Array.from({ length: n }, (_, i) => d.pos[i * 3 + 1]);
  const xs = Array.from({ length: n }, (_, i) => d.pos[i * 3]);

  it('背の高さは 1.15m ほどで、足の裏は y = 0 にある', () => {
    expect(Math.min(...ys)).toBeCloseTo(0, 1);
    expect(Math.max(...ys)).toBeGreaterThan(HEIGHT - 0.03);
    expect(Math.max(...ys)).toBeLessThan(HEIGHT + 0.03);
  });

  it('左右が対称', () => {
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 2);
  });

  it('どの頂点も骨の重さの和が 1 で、骨の番号は BONES の中にある', () => {
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += d.skinWeight[i * 4 + k];
        expect(d.skinIndex[i * 4 + k]).toBeLessThan(BONES.length);
      }
      expect(sum).toBeCloseTo(1, 4);
    }
  });

  const heaviest = (i: number) => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (d.skinWeight[i * 4 + k] > d.skinWeight[i * 4 + best]) best = k;
    return BONES[d.skinIndex[i * 4 + best]];
  };

  it('頭のてっぺんは head、足の裏は shin、手の先は forearm にいちばん重く付く', () => {
    const top = ys.indexOf(Math.max(...ys));
    const sole = ys.indexOf(Math.min(...ys));
    const tip = xs.indexOf(Math.max(...xs));
    expect(heaviest(top)).toBe('head');
    expect(heaviest(sole)).toMatch(/^shin\./);
    expect(heaviest(tip)).toBe('forearm.l');
  });

  it('骨の親は自分より前に並ぶ', () => {
    BONES.forEach((b, i) => {
      const p = PARENT[b];
      if (p) expect(BONES.indexOf(p)).toBeLessThan(i);
      expect(JOINTS[b]).toHaveLength(3);
    });
  });

  it('遊ぶときの細かさでは 6 千〜2 万の三角形になる', () => {
    const fine = buildDoll();
    const tris = fine.idx.length / 3;
    expect(tris).toBeGreaterThan(6000);
    expect(tris).toBeLessThan(20000);
  }, 20_000);
});
