import { describe, expect, it } from 'vitest';
import { clampView, FULL, MAX_SCALE, pinch, toContent } from './zoom';

describe('zoom', () => {
  it('2 本指を 2 倍に広げると 2 倍になり、指のあいだの絵は指のあいだに残る', () => {
    const v = pinch(FULL, [0.4, 0.5], [0.6, 0.5], [0.3, 0.5], [0.7, 0.5]);
    expect(v.scale).toBeCloseTo(2);
    const [cx, cy] = toContent(v, 0.5, 0.5);
    expect(cx).toBeCloseTo(0.5);
    expect(cy).toBeCloseTo(0.5);
  });

  it('倍率は 1〜4 倍に収め、絵の外を見せない', () => {
    expect(pinch(FULL, [0.45, 0.5], [0.55, 0.5], [0, 0.5], [1, 0.5]).scale).toBe(MAX_SCALE);
    expect(pinch(FULL, [0.3, 0.5], [0.7, 0.5], [0.45, 0.5], [0.55, 0.5]).scale).toBe(1);
    expect(clampView({ x: 0.9, y: -0.2, scale: 2 })).toEqual({ x: 0.5, y: 0, scale: 2 });
  });

  it('タップした位置を、拡大した絵の中の位置に直す', () => {
    expect(toContent({ x: 0.25, y: 0.5, scale: 2 }, 0.5, 0)).toEqual([0.5, 0.5]);
    expect(toContent(FULL, 0.3, 0.7)).toEqual([0.3, 0.7]);
  });
});
