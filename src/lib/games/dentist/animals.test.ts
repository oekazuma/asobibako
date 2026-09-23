import { describe, expect, it } from 'vitest';
import { ANIMALS, teethFor } from './animals';

describe('dentist animals', () => {
  const all = Object.values(ANIMALS);

  it('歯の本数は うさぎの 6 本から カエルの 12 本まで', () => {
    expect(teethFor(ANIMALS.rabbit)).toHaveLength(6);
    expect(teethFor(ANIMALS.frog)).toHaveLength(12);
    for (const a of all) expect(teethFor(a)).toHaveLength(a.per * 2);
  });

  it.each(all.map((a) => [a.id, a] as const))('%s の歯は口の中にあり、上の列と下の列は重ならない', (_, a) => {
    const teeth = teethFor(a);
    const { cx, cy, rx, ry } = a.mouth;
    for (const t of teeth) expect(((t.x - cx) / rx) ** 2 + ((t.y - cy) / ry) ** 2).toBeLessThan(1);
    const upper = teeth.filter((t) => t.row === 'upper');
    const lower = teeth.filter((t) => t.row === 'lower');
    for (const [i, u] of upper.entries()) expect(u.y + u.h / 2).toBeLessThan(lower[i].y - lower[i].h / 2);
  });

  it('同じ列のとなりの歯は横に重ならない', () => {
    for (const a of all) {
      const teeth = teethFor(a);
      for (let i = 1; i < a.per; i++) expect(teeth[i].x - teeth[i - 1].x).toBeGreaterThanOrEqual(teeth[i].w);
    }
  });
});
