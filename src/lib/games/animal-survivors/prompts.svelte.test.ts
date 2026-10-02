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
    w.events = [{ type: 'warning', boss: 'bear' }];
    p.take();
    expect(p.boss).toBe(true);
    w.events = [{ type: 'bossdown', x: 0, y: 0 }];
    p.take();
    expect(p.boss).toBe(false);
  });
});
