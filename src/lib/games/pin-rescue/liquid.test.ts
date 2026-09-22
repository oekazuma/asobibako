import { describe, expect, it } from 'vitest';
import type { Particle } from './engine';
import { liquidBox } from './liquid';

const p = (x: number, y: number, kind: Particle['kind']): Particle => ({ x, y, px: x, py: y, kind, cool: 0 });

describe('liquidBox', () => {
  it('その種類の粒がなければ null', () => {
    expect(liquidBox([p(0.5, 0.5, 'gold')], 'water', 100, 8, 100, 140)).toBeNull();
  });

  it('粒をぼかし玉ごと囲み、canvas の中に切り詰める', () => {
    const box = liquidBox(
      [p(0.02, 0.02, 'water'), p(0.5, 0.5, 'water'), p(0.9, 0.9, 'lava')],
      'water',
      100,
      8,
      100,
      140
    );
    expect(box).toEqual({ x0: 0, y0: 0, w: 54, h: 54 });
  });

  it('canvas の外にはみ出した粒だけなら null', () => {
    expect(liquidBox([p(2, 2, 'water')], 'water', 100, 8, 100, 140)).toBeNull();
  });
});
