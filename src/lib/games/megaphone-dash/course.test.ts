import { describe, expect, it } from 'vitest';
import { course, halfAt, LEVELS, RUNUP, zoneAt, ZONE_LEN } from './course';

const levels = Array.from({ length: LEVELS }, (_, i) => i + 1);

describe('course', () => {
  it('人と障害物は道の中に置く', () => {
    for (const level of levels) {
      const c = course(level);
      for (const p of [...c.people, ...c.blocks]) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(halfAt(p.z));
        expect(p.z).toBeGreaterThanOrEqual(RUNUP - 3);
        expect(p.z).toBeLessThanOrEqual(c.length);
      }
    }
  });

  it('障害物の横には必ず抜け道がある', () => {
    for (const level of levels)
      for (const b of course(level).blocks) {
        const half = halfAt(b.z);
        const room = Math.max(half - (b.x + b.w / 2), b.x - b.w / 2 + half);
        expect(room).toBeGreaterThan(1);
      }
  });

  it('あとの面ほど人も障害物も多い', () => {
    const a = course(1);
    const b = course(LEVELS);
    expect(b.people.length).toBeGreaterThan(a.people.length);
    expect(b.blocks.length).toBeGreaterThan(a.blocks.length);
  });

  it('同じ面は毎回同じ道', () => {
    expect(course(4)).toEqual(course(4));
  });

  it('通学路・商店街・廊下の順に変わる', () => {
    expect([0, ZONE_LEN + 1, ZONE_LEN * 2 + 1].map(zoneAt)).toEqual(['street', 'arcade', 'hall']);
  });
});
