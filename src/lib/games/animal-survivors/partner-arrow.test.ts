import { describe, expect, it } from 'vitest';
import { edgeAt, partners } from './draw-events';
import { addHero, createWorld } from './world';

const VW = 260;
const VH = 380;

describe('相棒の矢印', () => {
  it('画面の外の相棒は、その向きの画面の端に矢印を置き、画面の中なら出さない', () => {
    const w = createWorld('dog', 1, { w: VW, h: VH });
    addHero(w, 'cat');
    w.heroes[1].player.x = 60;
    expect(edgeAt(w, w.heroes[1].player, VW, VH, 24)).toBeNull();
    w.heroes[1].player.x = 900;
    const at = edgeAt(w, w.heroes[1].player, VW, VH, 24)!;
    expect(at.x).toBe(VW - 14);
    expect(at.y).toBe(VH / 2);
    expect(at.angle).toBeCloseTo(0);
  });

  it('矢印を出す相棒は自分でない動物で、子の端末では親の動物', () => {
    const w = createWorld('dog', 1, { w: VW, h: VH });
    expect(partners(w)).toEqual([]);
    addHero(w, 'cat');
    expect(partners(w)).toEqual([1]);
    w.cur = 1;
    expect(partners(w)).toEqual([0]);
  });
});
