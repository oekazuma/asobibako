import { describe, expect, it } from 'vitest';
import { melt, reopen, target } from './pose';

const o = { speed: 0, wag: 0.5 };

describe('pet-house かっこう', () => {
  it('うっとりは、なでている秒につれて目を閉じていく', () => {
    for (const kind of ['dog', 'cat'] as const) {
      const eye = (s: number) => target(kind, 'bliss', s, o).eye;
      expect(eye(0)).toBeCloseTo(0.55);
      expect(eye(1.5)).toBeLessThan(eye(0.5));
      expect(eye(3)).toBeLessThan(0.1);
    }
    expect(melt(10)).toBeCloseTo(0.05);
  });

  it('閉じていた目は、やめてから 1 秒あまりかけて開く', () => {
    let eye = 0.05;
    const at: number[] = [];
    for (let f = 1; f <= 90; f++) {
      // ふつうの寄せ方ならすぐ開いてしまう値
      const damped = eye + (1 - eye) * 0.14;
      eye = reopen(eye, 1, damped, 1 / 60);
      if (f % 30 === 0) at.push(eye);
    }
    expect(at[0]).toBeLessThan(0.5);
    expect(at[1]).toBeGreaterThan(at[0]);
    expect(at[1]).toBeLessThan(0.9);
    expect(at[2]).toBeGreaterThan(0.9);
    // 開いている目の瞬き・細める動きはふつうの速さのまま
    expect(reopen(1, 1.05, 1.02, 1 / 60)).toBe(1.02);
  });

  it('猫がおなかをさわられるとはたき、しっぽをさわられるとしっぽを速く振る', () => {
    const swat = [0.1, 0.3, 0.45].map((s) => target('cat', 'swat', s, o).frz);
    expect(Math.max(...swat) - Math.min(...swat)).toBeGreaterThan(0.3);
    expect(target('cat', 'flick', 0, o).wag).toBeGreaterThan(1);
  });
});
