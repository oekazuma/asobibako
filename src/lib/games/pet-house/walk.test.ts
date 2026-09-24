import { describe, expect, it } from 'vitest';
import { seeded } from './textures';
import { CROSSING, GAP, LENGTH, plan, tether } from './walk';

describe('plan', () => {
  const plans = Array.from({ length: 200 }, (_, i) => plan(seeded(i + 1)));

  it('奥へ向かう順に、間をあけて、道の中に並べる', () => {
    for (const stops of plans) {
      for (let i = 1; i < stops.length; i++) expect(stops[i - 1].z - stops[i].z).toBeGreaterThanOrEqual(GAP);
      for (const s of stops) {
        expect(s.z).toBeLessThan(-5);
        expect(s.z).toBeGreaterThan(-LENGTH + 5);
        expect(Math.abs(s.z - CROSSING.z)).toBeGreaterThan(CROSSING.half);
      }
    }
  });

  it('毎回、ほかの犬 2 匹・プレゼント・うんち・おしっこがある', () => {
    for (const stops of plans) {
      const count = (k: string) => stops.filter((s) => s.kind === k).length;
      expect(count('dog')).toBe(2);
      expect(count('present')).toBeGreaterThanOrEqual(2);
      expect(count('poop')).toBe(1);
      expect(stops.some((s) => s.pee)).toBe(true);
      expect(stops.filter((s) => s.pee).every((s) => s.kind === 'pole' || s.kind === 'hydrant')).toBe(true);
    }
  });
});

describe('tether', () => {
  it('リードより遠いときだけ、手元の方へ引き寄せる', () => {
    expect(tether({ x: 0, z: -1 }, { x: 0, z: 0 }, 2)).toEqual({ x: 0, z: -1 });
    const p = tether({ x: 3, z: -4 }, { x: 0, z: 0 }, 2);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(2);
    expect(p.x / p.z).toBeCloseTo(-0.75);
  });
});
