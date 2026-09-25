import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animate } from './loop';

describe('animate', () => {
  let callbacks: FrameRequestCallback[];
  let nextId: number;
  let canceled: number[];

  beforeEach(() => {
    callbacks = [];
    nextId = 0;
    canceled = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return ++nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      canceled.push(id);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // 溜めたコールバックを 1 つずつ呼ぶ（rAF を手で進める）
  function tick(now: number) {
    const cb = callbacks.shift();
    cb?.(now);
  }

  it('最初の frame が投げても、次のフレームで frame がもう一度呼ばれる', () => {
    let calls = 0;
    animate(() => {
      calls++;
      if (calls === 1) throw new Error('boom');
    });
    tick(0);
    tick(16);
    expect(calls).toBe(2);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('投げ続けても console.error は 1 回だけで、ループも止まらない', () => {
    let calls = 0;
    animate(() => {
      calls++;
      throw new Error('boom');
    });
    tick(0);
    tick(16);
    tick(32);
    expect(calls).toBe(3);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('戻り値で止めたあとは、予約済みのコールバックが取り消される', () => {
    const stop = animate(() => {});
    tick(0);
    stop();
    expect(canceled).toEqual([nextId]);
  });

  it('dt は 0.05 秒までに抑えられる', () => {
    const dts: number[] = [];
    animate((dt) => dts.push(dt));
    tick(0);
    tick(100);
    expect(dts[1]).toBe(0.05);
  });
});
