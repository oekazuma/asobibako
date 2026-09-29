import { describe, expect, it } from 'vitest';
import { score } from '$lib/music/tune';
import { chart, Judge, SPOTS, spotAt, type Chart, type DanceEvent } from './dance';
import { LEVELS } from './dance-songs';

const bars = (i: number) => {
  const s = score(LEVELS[i].song);
  return s.notes.length / s.perBar;
};
const where = (spot: number): [number, number] => spotAt(spot);
const REACH = 0.08;

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
  it.each(LEVELS.map((l, i) => [l.name, i] as const))('%s の楽譜は読めて、ノーツは曲の中に収まる', (_, i) => {
    const c = chart(LEVELS[i], bars(i));
    expect(c.notes.length).toBeGreaterThan(20);
    for (const n of c.notes) {
      expect(n.t + n.len).toBeLessThan(c.length);
      expect(n.spot).toBeGreaterThanOrEqual(0);
      expect(n.spot).toBeLessThan(SPOTS);
    }
    expect(c.notes.some((n) => n.len > 0)).toBe(true);
  });

  it('むずかしい曲ほどノーツが多い', () => {
    const counts = LEVELS.map((l, i) => chart(l, bars(i)).notes.length);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
  });

  it('ぴったり押すと S で、どの区切りもスペシャルアピールになる', () => {
    const c = chart(LEVELS[1], bars(1));
    const { judge } = play(c, () => 0);
    const r = judge.result();
    expect(r.rank).toBe('S');
    expect(r.miss).toBe(0);
    expect(r.maxCombo).toBe(c.notes.length);
    expect(r.appeals).toBe(new Set(c.notes.map((n) => n.section)).size);
  });

  it('押さなければミス。ノーツから離れた所や、早すぎる押しは数えない', () => {
    const c = chart(LEVELS[0], bars(0));
    expect(play(c, () => null).judge.result().miss).toBe(c.notes.length);
    const judge = new Judge(c.notes, where, REACH);
    const n = c.notes[0];
    const [x, y] = where(n.spot);
    expect(judge.press(1, n.t, x + 0.3, y)).toEqual([]);
    expect(judge.press(1, n.t - 0.5, x, y)).toEqual([]);
    expect(judge.press(1, n.t + 0.1, x, y)).toEqual([{ type: 'hit', note: 0, grade: 'good' }]);
  });

  it('長押しを早く離すと「おしい」でコンボが切れ、その区切りはアピールにならない', () => {
    const c = chart(LEVELS[0], bars(0));
    const { judge } = play(c, () => 0, false);
    const holds = c.notes.flatMap((n, i) => (n.len ? [i] : []));
    for (const i of holds) expect(judge.grades[i]).toBe('near');
    expect(judge.result().appeals).toBeLessThan(new Set(c.notes.map((n) => n.section)).size);
  });
});
