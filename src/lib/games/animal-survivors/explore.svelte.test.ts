import { describe, expect, it } from 'vitest';
import { Prompts } from './prompts.svelte';
import { loadRecords } from './records';
import { createWorld } from './world';

describe('遺物と祠の帯', () => {
  it('遺物を拾った出来事で帯を出し、記録へすぐ書く', () => {
    localStorage.clear();
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'forest');
    const p = new Prompts(w);
    w.events.push({ type: 'relic', id: 'map' });
    p.take();
    expect(p.notice?.text).toContain('古い地図');
    expect(loadRecords().relics).toEqual(['map']);
  });

  it('祠に触れた出来事で、祠の名前の帯を出す', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'forest');
    const p = new Prompts(w);
    w.events.push({ type: 'shrine', kind: 'power' });
    p.take();
    expect(p.notice?.text).toContain('力の祠');
  });

  it('雪の結晶を拾うと、3 択に見せる引き直しの数もふえる', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'snow');
    const p = new Prompts(w);
    const before = p.tools.rerolls;
    w.rerolls += 1;
    w.events.push({ type: 'relic', id: 'flake' });
    p.take();
    expect(p.tools.rerolls).toBe(before + 1);
  });
});
