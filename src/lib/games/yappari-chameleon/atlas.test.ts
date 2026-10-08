import { describe, expect, it } from 'vitest';
import { GAP, GROW, layAtlas } from './atlas';

function fake(tris: number) {
  const pos = new Float32Array(tris * 9);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 0.1;
  for (let i = 0; i < pos.length; i++) pos[i] = rnd();
  const idx = Uint32Array.from({ length: tris * 3 }, (_, i) => i);
  return { pos, idx };
}

const SIZE = 512;

describe('layAtlas', () => {
  const { pos, idx } = fake(301);
  const a = layAtlas(pos, idx, SIZE);
  const tris = idx.length / 3;

  it('どの角もテクスチャの中にある', () => {
    for (const v of a.uv) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
    for (const v of a.paintUv) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  // 升の中の座標（画素）と、升の 4 辺・対角線からの距離のいちばん小さいもの
  const margin = (uv: Float32Array, t: number) => {
    const c = t >> 1;
    const per = Math.round(SIZE / a.cell);
    const ox = (c % per) * a.cell;
    const oy = Math.floor(c / per) * a.cell;
    let m = Infinity;
    for (let k = 0; k < 3; k++) {
      const x = uv[(t * 3 + k) * 2] * SIZE - ox;
      const y = uv[(t * 3 + k) * 2 + 1] * SIZE - oy;
      const diag = (t & 1 ? x + y - a.cell : a.cell - x - y) / Math.SQRT2;
      m = Math.min(m, x, y, a.cell - x, a.cell - y, diag);
    }
    return m;
  };

  it('見せる三角形は升のふちと対角線から GAP 画素離れる', () => {
    for (let t = 0; t < tris; t++) expect(margin(a.uv, t)).toBeGreaterThan(GAP - 1e-3);
  });

  it('吹き付けの三角形は隣とは重ならない（GAP − GROW 画素残る）', () => {
    for (let t = 0; t < tris; t++) expect(margin(a.paintUv, t)).toBeGreaterThan(GAP - GROW - 1e-3);
  });

  it('吹き付けの角の 3D の位置は、見せる三角形の上の同じ点を元の三角形へ写したもの', () => {
    for (let t = 0; t < tris; t += 17) {
      const u = (k: number) => [a.uv[(t * 3 + k) * 2], a.uv[(t * 3 + k) * 2 + 1]];
      const [p0, p1, p2] = [u(0), u(1), u(2)];
      const det = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
      for (let k = 0; k < 3; k++) {
        const q = [a.paintUv[(t * 3 + k) * 2], a.paintUv[(t * 3 + k) * 2 + 1]];
        const b1 = ((q[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (q[1] - p0[1])) / det;
        const b2 = ((p1[0] - p0[0]) * (q[1] - p0[1]) - (q[0] - p0[0]) * (p1[1] - p0[1])) / det;
        const b0 = 1 - b1 - b2;
        for (let j = 0; j < 3; j++) {
          const want =
            b0 * pos[a.corner[t * 3] * 3 + j] +
            b1 * pos[a.corner[t * 3 + 1] * 3 + j] +
            b2 * pos[a.corner[t * 3 + 2] * 3 + j];
          expect(a.paintPos[(t * 3 + k) * 3 + j]).toBeCloseTo(want, 5);
        }
      }
    }
  });

  it('角の頂点の番号は元の並びのまま', () => {
    expect(Array.from(a.corner)).toEqual(Array.from(idx));
  });

  it('升が小さすぎるときは投げる', () => {
    const big = fake(8000);
    expect(() => layAtlas(big.pos, big.idx, 256)).toThrow();
  });
});
