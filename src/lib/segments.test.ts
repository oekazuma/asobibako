import { describe, expect, it } from 'vitest';
import { closest, pushOut } from './segments';

describe('segments', () => {
  it('線分の端より外の点は、端がいちばん近い', () => {
    expect(closest([0, 0, 1, 0], 2, 1)).toEqual([1, 0]);
  });

  it('めり込んだ円は、線の法線方向へ太さと半径の分だけ押し出す', () => {
    const [x, y] = pushOut([0, 1, 2, 1], 0.1, 1, 0.95, 0.1)!;
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0.8);
    expect(pushOut([0, 1, 2, 1], 0.1, 1, 0.5, 0.1)).toBeNull();
  });
});
