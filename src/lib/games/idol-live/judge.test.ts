import { describe, expect, it } from 'vitest';
import { RADIUS, type Note } from './chart';
import { along, Judge, WINDOW, type Judged } from './judge';
import { trackOf } from './songs';

const NOTES = trackOf('kirameki').charts.normal;

/** そのノーツを指 i で off 秒ずらしてする。スライドは光の玉を dx だけずれて追う */
function perform(j: Judge, i: number, off = 0, dx = 0, early = 0): Judged[] {
  const n = j.notes[i];
  const out = j.press(i, n.t + off, n.x + dx, n.y);
  if (n.kind === 'hold' || n.kind === 'slide') {
    const end = n.end - early;
    for (let t = n.t; t < end; t += 1 / 60) {
      if (n.kind === 'slide') {
        const [x, y] = along(n, t);
        j.move(i, x + dx, y);
      }
      out.push(...j.advance(t));
    }
    out.push(...j.release(i, end));
  }
  return out;
}

const gradeOf = (events: Judged[], i: number) => events.find((e) => e.note === i)?.grade;
const first = (kind: Note['kind']) => NOTES.findIndex((n) => n.kind === kind);

describe('判定', () => {
  it('全部ぴったりにすると満点で S、フルコンボ', () => {
    const j = new Judge(NOTES);
    NOTES.forEach((_, i) => perform(j, i));
    const r = j.result();
    expect(j.done).toBe(true);
    expect(j.score).toBeCloseTo(j.max);
    expect(r.rank).toBe('S');
    expect(r.fullCombo).toBe(true);
    expect(r.maxCombo).toBe(NOTES.length);
    expect(r.specials).toBe(r.specialTotal);
  });

  it('何もしないと全部 MISS で C。最後まで止まらない', () => {
    const j = new Judge(NOTES);
    j.advance(NOTES.at(-1)!.end + 1);
    const r = j.result();
    expect(r.miss).toBe(NOTES.length);
    expect(r.rank).toBe('C');
    expect(j.hype).toBe(0);
  });

  it('ずれた時刻で PERFECT・GREAT・GOOD が分かれ、幅の外は当たらない', () => {
    const i = first('tap');
    const at = (off: number) => gradeOf(perform(new Judge(NOTES), i, off), i);
    expect(at(0.05)).toBe('perfect');
    expect(at(-0.1)).toBe('great');
    expect(at(0.2)).toBe('good');
    expect(at(-WINDOW.good - 0.05)).toBeUndefined();
    expect(at(WINDOW.good + 0.05)).toBe('miss');
  });

  it('タップはノーツの上を押さないと当たらない。スペシャルはどこを押してもよい', () => {
    const i = first('tap');
    expect(gradeOf(perform(new Judge(NOTES), i, 0, RADIUS * 1.5), i)).toBe('perfect');
    expect(gradeOf(perform(new Judge(NOTES), i, 0, RADIUS * 3), i)).toBeUndefined();
    const s = first('special');
    expect(gradeOf(perform(new Judge(NOTES), s, 0, 0.5), s)).toBe('perfect');
  });

  it('ホールドは終わりまで押さえきる。途中で半分より前に離すと MISS', () => {
    const i = first('hold');
    const len = NOTES[i].end - NOTES[i].t;
    expect(gradeOf(perform(new Judge(NOTES), i), i)).toBe('perfect');
    expect(gradeOf(perform(new Judge(NOTES), i, 0, 0, 0.15), i)).toBe('perfect');
    expect(gradeOf(perform(new Judge(NOTES), i, 0, 0, len * 0.4), i)).toBe('great');
    expect(gradeOf(perform(new Judge(NOTES), i, 0, 0, len * 0.8), i)).toBe('miss');
  });

  it('スライドは光の玉を追えば押した時の判定のまま。動かさないと下がり、道から外れると MISS', () => {
    const i = first('slide');
    const n = NOTES[i];
    expect(gradeOf(perform(new Judge(NOTES), i), i)).toBe('perfect');
    expect(gradeOf(perform(new Judge(NOTES), i, 0, RADIUS * 1.2), i)).toBe('perfect');
    const still = (dx: number) => {
      const j = new Judge(NOTES);
      const out = j.press(i, n.t, n.x, n.y);
      j.move(i, n.x + dx, n.y);
      for (let t = n.t; t <= n.end + 0.1; t += 1 / 60) out.push(...j.advance(t));
      return gradeOf(out, i);
    };
    expect(still(0)).not.toBe('perfect');
    expect(still(0.6)).toBe('miss');
  });

  it('MISS でコンボが切れ、もりあがりが下がる。PERFECT で上がる', () => {
    const j = new Judge(NOTES);
    const i = first('tap');
    perform(j, i);
    const up = j.hype;
    expect(j.combo).toBe(1);
    j.advance(NOTES[i + 1].t + 1);
    expect(j.combo).toBe(0);
    expect(j.hype).toBeLessThan(up);
  });

  it('衣装のボーナスでスコアとランクが上がる', () => {
    const j = new Judge(NOTES);
    NOTES.forEach((_, i) => i % 5 && perform(j, i));
    const plain = j.result();
    const dressed = j.result(0.2);
    expect(dressed.score).toBeGreaterThan(plain.score);
    expect('SABC'.indexOf(dressed.rank)).toBeLessThanOrEqual('SABC'.indexOf(plain.rank));
  });
});
