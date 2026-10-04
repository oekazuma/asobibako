import { describe, expect, it } from 'vitest';
import { betOf } from './cauldron';
import { Prompts } from './prompts.svelte';
import { emptyRecords, payHeat } from './records';
import { createWorld } from './world';

describe('釜の強さを下げたとき', () => {
  it('払えずに下げても、最後に選んだ強さには自分で選んだ強さを覚える', () => {
    const r = { ...emptyRecords(), coins: 100 };
    const heat = payHeat(r, 9);
    expect(heat.level).toBeLessThan(9);
    expect(r.heatLast).toBe(9);
    expect(r.coins).toBe(100 - betOf(heat.level));
  });

  it('始めの一言を渡すと、遊び始めに帯で出す', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 }, {}, 'forest', {
      note: 'コインが足りないので 釜 3.2 で始めます'
    });
    const p = new Prompts(w);
    expect(p.notice?.text).toBe('コインが足りないので 釜 3.2 で始めます');
    p.stop();
    expect(new Prompts(createWorld('dog', 1, { w: 274, h: 394 })).notice).toBeNull();
  });
});
