import { describe, expect, it } from 'vitest';
import { TRICKS } from './engine';
import { done, LESSONS, stroke, track, type Lesson } from './teach';

const drag = (l: Lesson, pts: [number, number][], secs = 0.5) => {
  const s = stroke(pts[0][0], pts[0][1], 0);
  for (const [x, y] of pts.slice(1)) track(s, x, y);
  return done(l, s, secs, 120);
};
const line = (dx: number, dy: number): [number, number][] =>
  Array.from({ length: 11 }, (_, i) => [100 + (dx * i) / 10, 100 + (dy * i) / 10]);

describe('体で教える', () => {
  it('どの芸にも教え方がある', () => {
    for (const t of TRICKS) expect(LESSONS[t.id].parts.length).toBeGreaterThan(0);
  });

  it('指を案内の向きへ動かしたときだけ、できたことになる', () => {
    expect(drag(LESSONS.sit, line(0, 80))).toBe(true);
    expect(drag(LESSONS.sit, line(0, -80))).toBe(false);
    expect(drag(LESSONS.sit, line(0, 15))).toBe(false);
    expect(drag(LESSONS.beg, line(10, -80))).toBe(true);
    expect(drag(LESSONS.roll, line(-80, 10))).toBe(true);
    expect(drag(LESSONS.roll, line(10, 80))).toBe(false);
    expect(drag(LESSONS.paw, [[0, 0]])).toBe(true);
  });

  it('ながおしは動かさずに押さえ続けたときだけ', () => {
    expect(drag(LESSONS.dead, [[0, 0]], 1.2)).toBe(true);
    expect(drag(LESSONS.dead, [[0, 0]], 0.3)).toBe(false);
    expect(drag(LESSONS.dead, line(0, 120), 1.2)).toBe(false);
  });

  it('ぐるっとは 1 周近く回したときだけ', () => {
    const circle = (turns: number): [number, number][] =>
      Array.from({ length: 40 }, (_, i) => {
        const a = (i / 39) * turns * Math.PI * 2;
        return [100 + Math.cos(a) * 50, 100 + Math.sin(a) * 50];
      });
    expect(drag(LESSONS.spin, circle(0.95))).toBe(true);
    expect(drag(LESSONS.spin, circle(0.4))).toBe(false);
    expect(drag(LESSONS.spin, line(200, 0))).toBe(false);
  });
});
