import { describe, expect, it } from 'vitest';
import { layout } from './album';

type Cell = { x: number; y: number; size: number };
const overlap = (a: Cell, b: Cell) =>
  a.x < b.x + b.size && b.x < a.x + a.size && a.y < b.y + b.size && b.y < a.y + a.size;

describe('layout', () => {
  it('3 枚以下は 1 列、4 枚からは 2 列で、重ならずに画像の中に並べる', () => {
    expect(new Set(layout(3).cells.map((c) => c.x)).size).toBe(1);
    expect(new Set(layout(4).cells.map((c) => c.x)).size).toBe(2);
    for (const n of [1, 2, 3, 4, 6, 9]) {
      const { width, height, cells } = layout(n);
      expect(cells).toHaveLength(n);
      for (const c of cells) {
        expect(c.x + c.size).toBeLessThanOrEqual(width);
        expect(c.y + c.size).toBeLessThanOrEqual(height);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(cells[i], cells[j])).toBe(false);
    }
  });
});
