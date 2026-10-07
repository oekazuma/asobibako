import { describe, expect, it } from 'vitest';
import { Prompts } from './prompts.svelte';
import { createWorld } from './world';

describe('選ぶ画面', () => {
  it('育つ演出とボスの登場は picking に入らず、3 択・宝箱・延長戦を聞く画面は入る', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const p = new Prompts(w);
    p.evolve = { from: 'a', to: 'b', fromForm: 0, form: 1, t: 0 };
    expect(p.busy).toBe(true);
    expect(p.picking).toBe(false);
    p.evolve = null;
    p.ask(null);
    expect(p.picking).toBe(true);
  });
});
