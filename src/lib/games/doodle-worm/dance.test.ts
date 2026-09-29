import { describe, expect, it } from 'vitest';
import { chart, Judge, SPOTS, spotAt, type Chart, type DanceEvent, type Difficulty } from './dance';
import { LEVELS } from './dance-songs';

const where = (spot: number): [number, number] => spotAt(spot);
const REACH = 0.08;
const ALL = LEVELS.flatMap((l) => ([0, 1, 2] as Difficulty[]).map((d) => [`${l.name} ${d}`, l, d] as const));

function play(c: Chart, tap: (i: number) => number | null, hold = true) {
  const judge = new Judge(c.notes, where, REACH);
  const events: DanceEvent[] = [];
  for (let t = -1; t < c.length + 1; t += 1 / 60) {
    c.notes.forEach((n, i) => {
      const at = tap(i);
      if (at === null || t < n.t + at || t - 1 / 60 >= n.t + at) return;
      events.push(...judge.press(i, t, ...where(n.spot)));
    });
    for (const [id, i] of judge.holding) {
      const n = c.notes[i];
      if (!hold && t > n.t + n.len / 3) events.push(...judge.release(id, t));
    }
    events.push(...judge.advance(t));
  }
  return { judge, events };
}

describe('ダンス', () => {
  it.each(ALL)('%s の譜面は曲の中に収まり、ノーツが重ならない', (_, level, d) => {
    const c = chart(level, d);
    expect(c.notes.length).toBeGreaterThan(20);
    c.notes.forEach((n, i) => {
      expect(n.t + n.len).toBeLessThan(c.length);
      expect(n.spot).toBeGreaterThanOrEqual(0);
      expect(n.spot).toBeLessThan(SPOTS);
      if (i) expect(n.t).toBeGreaterThan(c.notes[i - 1].t + c.notes[i - 1].len);
    });
  });

  it.each(LEVELS.map((l) => [l.name, l] as const))('%s は難しくするほどノーツが多い', (_, level) => {
    const counts = ([0, 1, 2] as Difficulty[]).map((d) => chart(level, d).notes.length);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
  });

  it('かんたんは 2 拍に 1 つまで', () => {
    for (const level of LEVELS) {
      const c = chart(level, 0);
      c.notes.forEach((n, i) => i && expect(n.t - c.notes[i - 1].t).toBeGreaterThanOrEqual(c.beat * 2 - 1e-9));
    }
  });

  it('ぴったり押すと S で、どの区切りもスペシャルアピールになる', () => {
    const c = chart(LEVELS[1], 1);
    const { judge } = play(c, () => 0);
    const r = judge.result();
    expect(r.rank).toBe('S');
    expect(r.miss).toBe(0);
    expect(r.maxCombo).toBe(c.notes.length);
    expect(r.appeals).toBe(new Set(c.notes.map((n) => n.section)).size);
  });

  it('押さなければミス。ノーツから離れた所や、早すぎる押しは数えない', () => {
    const c = chart(LEVELS[0], 0);
    expect(play(c, () => null).judge.result().miss).toBe(c.notes.length);
    const judge = new Judge(c.notes, where, REACH);
    const n = c.notes[0];
    const [x, y] = where(n.spot);
    expect(judge.press(1, n.t, x + 0.3, y)).toEqual([]);
    expect(judge.press(1, n.t - 0.5, x, y)).toEqual([]);
    expect(judge.press(1, n.t + 0.1, x, y)).toEqual([{ type: 'hit', note: 0, grade: 'good' }]);
  });

  it('長押しを早く離すと「おしい」でコンボが切れ、その区切りはアピールにならない', () => {
    const c = chart(LEVELS[0], 1);
    const { judge } = play(c, () => 0, false);
    const holds = c.notes.flatMap((n, i) => (n.len ? [i] : []));
    expect(holds.length).toBeGreaterThan(0);
    for (const i of holds) expect(judge.grades[i]).toBe('near');
    expect(judge.result().appeals).toBeLessThan(new Set(c.notes.map((n) => n.section)).size);
  });
});
