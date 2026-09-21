import { describe, expect, it } from 'vitest';
import { Gestures, viewDir, type Gesture } from './gestures';
import type { Player } from './player';

function setup() {
  const out: [Player, Gesture][] = [];
  return { g: new Gestures((p, gesture) => out.push([p, gesture])), out };
}

describe('Gestures', () => {
  it('短く触って離すとタップ', () => {
    const { g, out } = setup();
    g.down(1, 0.5, 0.8, 0);
    g.up(1, 0.5, 0.8, 120);
    expect(out).toEqual([[1, { kind: 'tap' }]]);
  });

  it('動かさずに置き続けると、離す前に長押しになり、離しても何も出ない', () => {
    const { g, out } = setup();
    g.down(1, 0.5, 0.2, 0);
    g.tick(600, new Map([[1, { x: 0.5, y: 0.2 }]]));
    g.up(1, 0.5, 0.2, 900);
    expect(out).toEqual([[2, { kind: 'hold' }]]);
  });

  it('同じ陣地にほぼ同時に 2 本置くと 2 本指タップが 1 回だけ出る', () => {
    const { g, out } = setup();
    g.down(1, 0.4, 0.8, 0);
    g.down(2, 0.6, 0.8, 80);
    g.up(1, 0.4, 0.8, 150);
    g.up(2, 0.6, 0.8, 160);
    expect(out).toEqual([[1, { kind: 'two' }]]);
  });

  it('相手の陣地の指とは 2 本指にならない', () => {
    const { g, out } = setup();
    g.down(1, 0.5, 0.8, 0);
    g.down(2, 0.5, 0.2, 50);
    g.up(1, 0.5, 0.8, 100);
    g.up(2, 0.5, 0.2, 100);
    expect(out).toEqual([
      [1, { kind: 'tap' }],
      [2, { kind: 'tap' }]
    ]);
  });

  it('スワイプの向きは持ち主から見た向きになる', () => {
    const { g, out } = setup();
    g.down(1, 0.5, 0.8, 0);
    g.tick(50, new Map([[1, { x: 0.5, y: 0.7 }]]));
    g.down(2, 0.5, 0.2, 0);
    g.up(2, 0.5, 0.3, 80);
    expect(out).toEqual([
      [1, { kind: 'swipe', dir: 'up' }],
      [2, { kind: 'swipe', dir: 'up' }]
    ]);
  });

  it('settle した指は、その後なにも出さない', () => {
    const { g, out } = setup();
    g.down(1, 0.5, 0.8, 0);
    g.settle();
    g.up(1, 0.5, 0.8, 100);
    expect(out).toEqual([]);
  });

  it('横向きのスワイプも向かい側は左右が逆になる', () => {
    expect(viewDir(1, 0.1, 0)).toBe('right');
    expect(viewDir(2, 0.1, 0)).toBe('left');
  });
});
