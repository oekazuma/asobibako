import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prompts } from './prompts.svelte';
import { createWorld } from './world';

describe('Prompts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('WARNING はゲームの時間で 3 秒出し、3 択で止まっているあいだは消えない', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w);
    w.time = 297;
    w.events = [{ type: 'warning', boss: 'bear' }];
    p.take();
    expect(p.warning?.name).toBe('巨大ベア');
    // 3 択のあいだは step が進まないので、ゲームの時間は止まっている
    w.events = [];
    vi.advanceTimersByTime(5000);
    expect(p.warning).not.toBeNull();
    w.time = 299.9;
    p.take();
    expect(p.warning).not.toBeNull();
    w.time = 300.01;
    p.take();
    expect(p.warning).toBeNull();
    p.stop();
  });

  it('宝箱と 3 択が両方あれば、宝箱を先に開ける', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w);
    w.chests = 1;
    w.pending = 1;
    p.next(null);
    expect(p.rewards).not.toBeNull();
    expect(p.options).toBeNull();
    p.close(null);
    expect(p.options).not.toBeNull();
    p.stop();
  });

  it('リロールは残りがあるときだけ 3 択を引き直し、残りを減らす', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, { reroll: 1 });
    w.pending = 1;
    const p = new Prompts(w);
    p.next(null);
    const first = p.options;
    p.reroll(null);
    expect(w.rerolls).toBe(0);
    expect(p.options).not.toBe(first);
    const second = p.options;
    p.reroll(null);
    expect(p.options).toBe(second);
    p.stop();
  });

  it('WARNING でボスの曲、ボスを倒すと森の曲に戻す', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w);
    expect(p.boss).toBe(false);
    w.warned = 1;
    w.events = [{ type: 'warning', boss: 'bear' }];
    p.take();
    expect(p.boss).toBe(true);
    w.bossKills = ['bear'];
    w.events = [{ type: 'bossdown', x: 0, y: 0 }];
    p.take();
    expect(p.boss).toBe(false);
  });

  it('群れの帯をゲームの時間で 2 秒出す', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w);
    w.time = 90;
    w.events = [{ type: 'swarm', text: 'コウモリの大群！' }];
    p.take();
    expect(p.notice?.text).toBe('コウモリの大群！');
    w.events = [];
    w.time = 92.1;
    p.take();
    expect(p.notice).toBeNull();
  });

  it('育ったら「子犬 → わんぱく犬」の演出を始め、次は「わんぱく犬 → 勇者の犬」', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w, false);
    w.events = [{ type: 'grow', form: 1 }];
    p.take();
    expect(p.evolve).toMatchObject({ from: '子犬', to: 'わんぱく犬' });
    p.next(null, 3);
    w.events = [{ type: 'grow', form: 2 }];
    p.take();
    expect(p.evolve).toMatchObject({ from: 'わんぱく犬', to: '勇者の犬' });
    p.stop();
  });

  it('専用進化で「勇者の犬の 専用進化！」の帯を出す', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w);
    w.events = [{ type: 'special', id: 'woofSp' }];
    p.take();
    expect(p.notice?.text).toBe('勇者の犬の 専用進化！');
  });

  it('金の磁石で「コインラッシュ！」の帯を出す', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w);
    w.events = [{ type: 'rush' }];
    p.take();
    expect(p.notice?.text).toBe('コインラッシュ！');
  });

  it('面の主の WARNING はボスの名前ではなく行の title', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w);
    w.events = [{ type: 'warning', boss: 'bear', title: '森の主' }];
    p.take();
    expect(p.warning?.name).toBe('森の主');
  });

  it('巨大ベアが残ったまま女王グモが出たら、片方を倒してもボスの曲のまま', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    const p = new Prompts(w);
    w.warned = 2;
    w.events = [{ type: 'warning', boss: 'spiderQueen' }];
    p.take();
    w.bossKills = ['bear'];
    w.events = [{ type: 'bossdown', x: 0, y: 0 }];
    p.take();
    expect(p.boss).toBe(true);
    w.bossKills = ['bear', 'spiderQueen'];
    p.take();
    expect(p.boss).toBe(false);
  });
});
