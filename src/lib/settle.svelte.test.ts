import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Settle } from './settle.svelte';

const fire = (type: string) => window.dispatchEvent(new Event(type, { bubbles: true }));

describe('Settle', () => {
  let stop: () => void;
  let settle: Settle;

  beforeEach(() => {
    vi.useFakeTimers();
    settle = new Settle();
    stop = settle.listen();
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('指が触れていなければ 350ms で戻る', () => {
    settle.begin();
    expect(settle.active).toBe(true);
    vi.advanceTimersByTime(349);
    expect(settle.active).toBe(true);
    vi.advanceTimersByTime(1);
    expect(settle.active).toBe(false);
  });

  it('指が残っていれば 350ms では戻らず、離れてから 350ms、遅くとも 3 秒で戻る', () => {
    fire('pointerdown');
    settle.begin();
    vi.advanceTimersByTime(1000);
    expect(settle.active).toBe(true);
    fire('pointerup');
    vi.advanceTimersByTime(349);
    expect(settle.active).toBe(true);
    vi.advanceTimersByTime(1);
    expect(settle.active).toBe(false);

    fire('pointerdown');
    settle.begin();
    vi.advanceTimersByTime(3000);
    expect(settle.active).toBe(false);
  });

  it('対になっていない pointerup で指の数が負にならない', () => {
    fire('pointerup');
    fire('pointerup');
    fire('pointerdown');
    settle.begin();
    vi.advanceTimersByTime(350);
    expect(settle.active).toBe(true);
  });

  it('listen の戻り値で見張りをやめる', () => {
    stop();
    fire('pointerdown');
    settle.begin();
    vi.advanceTimersByTime(350);
    expect(settle.active).toBe(false);
    stop = () => {};
  });
});
