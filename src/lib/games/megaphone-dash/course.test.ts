import { describe, expect, it } from 'vitest';
import { course, halfAt, LEVELS, rule, RUNUP, zoneAt, ZONE_LEN } from './course';

const levels = Array.from({ length: LEVELS }, (_, i) => i + 1);

describe('course', () => {
  it('人は道の中に置く', () => {
    for (const level of levels) {
      const c = course(level);
      for (const p of c.people) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(halfAt(p.z));
        expect(p.z).toBeGreaterThanOrEqual(RUNUP - 3);
        expect(p.z).toBeLessThanOrEqual(c.length);
      }
    }
  });

  it('あとの面ほど人が多い', () => {
    expect(course(LEVELS).people.length).toBeGreaterThan(course(1).people.length);
  });

  it('ボスの面では、ボスより先に人を置かない', () => {
    const c = course(5);
    expect(c.people.every((p) => p.z < rule(5).bossAt)).toBe(true);
  });

  it('同じ面は毎回同じ道', () => {
    expect(course(4)).toEqual(course(4));
  });

  it('通学路・商店街・廊下の順に変わる', () => {
    expect([0, ZONE_LEN + 1, ZONE_LEN * 2 + 1].map(zoneAt)).toEqual(['street', 'arcade', 'hall']);
  });
});
