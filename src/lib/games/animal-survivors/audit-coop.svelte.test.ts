import { describe, expect, it } from 'vitest';
import { barsTop } from './draw-boss';
import { BUTTON_BAND, edgeAt } from './draw-events';
import { hasMate } from './heroes';
import { fireLink, LINK_INVULN } from './link';
import { Prompts } from './prompts.svelte';
import { addHero, createWorld } from './world';

const VIEW = { w: 260, h: 380 };

describe('協力プレイまわりの小さな点', () => {
  it('相棒が抜けたら、ボスの体力バーは 1 人のときの位置に戻る', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    expect(hasMate(w)).toBe(true);
    w.heroes[1].gone = w.heroes[1].down = true;
    expect(hasMate(w)).toBe(false);
    expect(barsTop(w, 24)).toBe(24 + 22);
  });

  it('連携の技のあとは、当たらないあいだも半透明にしない秒を持つ', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    fireLink(w);
    expect(w.link.calm).toBeGreaterThanOrEqual(LINK_INVULN);
  });

  it('右端の矢印は、いっしょに！のボタンの高さを避ける', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    const at = edgeAt(w, { x: w.player.x + 2000, y: w.player.y }, VIEW.w, VIEW.h, 24)!;
    expect(Math.abs(at.y - VIEW.h / 2)).toBeGreaterThanOrEqual(BUTTON_BAND);
  });

  it('止めている 1 秒のあいだに一時停止しても、帯は消えない（ゲームが進んだぶんだけ時計を進める）', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    const p = new Prompts(w);
    w.link.fuse = 0.8;
    w.events.push({ type: 'link', a: 'dog', b: 'cat', name: 'X' });
    p.take();
    for (let i = 0; i < 300; i++) p.next(null, 1 / 60);
    expect(p.link).not.toBeNull();
  });
});
