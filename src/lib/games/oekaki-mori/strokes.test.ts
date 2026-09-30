import { describe, expect, it } from 'vitest';
import { apply, type Stroke } from './strokes';

const start = (x: number, y: number) => ({ k: 'start' as const, color: '#000', size: 0.01, x, y });

describe('apply', () => {
  it('start で線を始め、add で最後の線に点を足す', () => {
    let s: Stroke[] = [];
    s = apply(s, start(0.1, 0.2));
    s = apply(s, { k: 'add', pts: [0.3, 0.4, 0.5, 0.6] });
    expect(s).toEqual([{ color: '#000', size: 0.01, pts: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] }]);
  });

  it('元の配列と線を書き換えない', () => {
    const before = apply([], start(0, 0));
    const after = apply(before, { k: 'add', pts: [1, 1] });
    expect(before[0].pts).toEqual([0, 0]);
    expect(after).not.toBe(before);
  });

  it('線が無いときの add は何もしない', () => {
    expect(apply([], { k: 'add', pts: [1, 1] })).toEqual([]);
  });

  it('undo は最後の線だけを消し、clear は全部消す', () => {
    let s = apply(apply([], start(0, 0)), start(1, 1));
    s = apply(s, { k: 'undo' });
    expect(s.map((x) => x.pts)).toEqual([[0, 0]]);
    expect(apply(s, { k: 'clear' })).toEqual([]);
    expect(apply([], { k: 'undo' })).toEqual([]);
  });
});
