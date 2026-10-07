import { describe, expect, it } from 'vitest';
import { barsTop } from './draw-boss';
import { addHero, createWorld } from './world';

describe('ボスの体力バーの位置', () => {
  it('1 匹のときは今の位置、2 匹のときは連携のゲージの下へずらす', () => {
    const solo = createWorld('dog', 1, { w: 260, h: 380 });
    expect(barsTop(solo, 24)).toBe(24 + 22);
    const two = createWorld('dog', 1, { w: 260, h: 380 });
    addHero(two, 'cat');
    // ゲージの枠は top + 18..21、BOSS の字はバーの 1 つ上の行から 5 行
    expect(barsTop(two, 24) - 1).toBeGreaterThan(24 + 21);
  });
});
