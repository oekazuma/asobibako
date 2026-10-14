import { describe, expect, it } from 'vitest';
import { Grid } from './grid';

describe('当たり判定の格子', () => {
  it('たくさんのセルを通ったあとも、そのフレームに足した番号だけを返す', () => {
    const g = new Grid();
    const out: number[] = [];
    for (let f = 0; f < 200; f++) {
      g.clear();
      for (let i = 0; i < 50; i++) g.add(i, f * 32 * 50 + i * 32, 0);
    }
    g.clear();
    g.add(7, 10, 10);
    g.add(8, 20, 20);
    expect(g.near(15, 15, 10, out)).toEqual([7, 8]);
    expect(g.near(199 * 32 * 50, 0, 10, out)).toEqual([]);
  });
});
