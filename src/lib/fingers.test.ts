import { describe, expect, it } from 'vitest';
import { Fingers, velocity } from './fingers';

describe('fingers', () => {
  it('置いた位置の陣地が持ち主になり、境界線をまたいでも変わらない', () => {
    const fingers = new Fingers();
    fingers.down(1, 0.5, 0.8, 0);
    fingers.move(1, 0.5, 0.2, 16);
    expect(fingers.all.get(1)?.side).toBe(1);
  });

  it('離す直前の動きから速さを出し、止まってから離せばほぼ 0 になる', () => {
    const fingers = new Fingers();
    fingers.down(1, 0.5, 0.8, 0);
    fingers.move(1, 0.5, 0.7, 50);
    const flick = fingers.up(1, 0.5, 0.6, 100)!;
    expect(velocity(flick.trail).vy).toBeCloseTo(-2, 0);

    fingers.down(2, 0.5, 0.8, 0);
    fingers.move(2, 0.5, 0.6, 50);
    const still = fingers.up(2, 0.5, 0.6, 600)!;
    expect(Math.abs(velocity(still.trail).vy)).toBeLessThan(0.5);
  });
});
