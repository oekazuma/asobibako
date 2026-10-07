import { describe, expect, it } from 'vitest';
import { ITEM_ART } from './art/items';
import { startCarry } from './carry';
import { chestAt } from './draw-carry';
import { carryTimer } from './draw-events';
import { devicePx } from './draw';
import { addHero, createWorld } from './world';

const VIEW = { w: 260, h: 380 };

function duo() {
  const w = createWorld('dog', 3, VIEW);
  addHero(w, 'cat');
  startCarry(w);
  return w;
}

describe('重い宝箱の絵の位置', () => {
  it('宝箱はドットではなく端末の画素に丸めて置く（ドットに丸めると 3pt 刻みでカクつく）', () => {
    const q = (v: number) => devicePx(v, 3) / 3;
    const at = chestAt({ x: 10.2, y: 20.5 }, ITEM_ART.chest, q);
    expect(at.x).toBe(q(10.2 - ITEM_ART.chest.w));
    expect(at.x % 1).not.toBe(0);
  });

  it('残り秒は、画面の外の宝箱の矢印、画面の外の祭壇の矢印、どちらも画面の中なら宝箱の上に出す', () => {
    const w = duo();
    const c = w.carry!;
    const p = w.player;
    c.x = p.x + 500;
    expect(carryTimer(w, VIEW.w, VIEW.h, 24)).toBe('chest');
    c.x = p.x + 20;
    c.y = p.y;
    c.ax = p.x + 600;
    expect(carryTimer(w, VIEW.w, VIEW.h, 24)).toBe('altar');
    c.ax = p.x - 40;
    c.ay = p.y;
    const at = carryTimer(w, VIEW.w, VIEW.h, 24);
    expect(at).toEqual({ x: VIEW.w / 2 + 20, y: expect.any(Number) });
    expect((at as { y: number }).y).toBeLessThan(VIEW.h / 2 - ITEM_ART.chest.h);
  });
});
