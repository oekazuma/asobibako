import { describe, expect, it } from 'vitest';
import { Prompts } from './prompts.svelte';
import { createWorld } from './world';
import { loadRecords } from './records';

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

describe('初めての説明', () => {
  it('遺物・祠・合体・限界突破は、初めてのときだけ説明の帯を出し、記録に覚える', () => {
    localStorage.clear();
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const p = new Prompts(w);
    w.events.push({ type: 'shrine', kind: 'power' });
    p.take();
    expect(p.notice?.text).toContain('30 秒');
    expect(loadRecords().tips).toContain('shrine');
    w.events.length = 0;
    w.events.push({ type: 'shrine', kind: 'wind' });
    p.take();
    expect(p.notice?.text).not.toContain('30 秒');
    w.events.length = 0;
    w.events.push({ type: 'evolve', id: 'howlUn' });
    p.take();
    expect(p.notice?.text).toContain('枠が 1 つ空いた');
    w.events.length = 0;
    w.events.push({ type: 'evolve', id: 'woofEvo' });
    p.take();
    expect(loadRecords().tips).not.toContain('evolve');
  });
});

describe('祠の初めての説明', () => {
  it('時計の無い祠（宝箱・全快）では説明を使い切らず、次の時計のある祠で出す', () => {
    localStorage.clear();
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const p = new Prompts(w);
    w.events.push({ type: 'shrine', kind: 'treasure' });
    p.take();
    expect(p.notice?.text).not.toContain('30 秒');
    expect(loadRecords().tips).not.toContain('shrine');
    w.events.length = 0;
    w.events.push({ type: 'shrine', kind: 'wisdom' });
    p.take();
    expect(p.notice?.text).toContain('30 秒');
  });
});
