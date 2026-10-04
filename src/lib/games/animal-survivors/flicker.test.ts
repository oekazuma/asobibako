import { describe, expect, it } from 'vitest';
import { pulse } from './draw-boss';

describe('予告の明滅', () => {
  it('0〜1 のあいだをなめらかに動き、60 フレームのどの 1 コマでも大きく飛ばない', () => {
    let lo = 1;
    let hi = 0;
    for (let now = 0; now < 2; now += 1 / 60) {
      const v = pulse(now);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      expect(Math.abs(pulse(now + 1 / 60) - v)).toBeLessThan(0.15);
    }
    expect(lo).toBeLessThan(0.05);
    expect(hi).toBeGreaterThan(0.95);
  });
});
