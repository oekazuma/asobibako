import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Lock } from './lock.svelte';

describe('Lock', () => {
  let lock: Lock;

  beforeEach(() => {
    vi.useFakeTimers();
    lock = new Lock();
  });

  afterEach(() => {
    lock.stop();
    vi.useRealTimers();
  });

  it('移動の指がなければ 350ms で外れる', () => {
    lock.begin(null);
    vi.advanceTimersByTime(349);
    expect(lock.active).toBe(true);
    vi.advanceTimersByTime(1);
    expect(lock.active).toBe(false);
  });

  it('移動の指が残っていても 350ms で外れ、ほかの指で選べる', () => {
    lock.begin(7);
    vi.advanceTimersByTime(350);
    expect(lock.active).toBe(false);
    lock.lift(3);
    expect(lock.active).toBe(false);
  });

  it('出たときに残っていた指が離れたら、そこからもう一度 350ms 止める（その指の合成 click を捨てる）', () => {
    lock.begin(7);
    vi.advanceTimersByTime(1000);
    lock.lift(7);
    expect(lock.active).toBe(true);
    vi.advanceTimersByTime(349);
    expect(lock.active).toBe(true);
    vi.advanceTimersByTime(1);
    expect(lock.active).toBe(false);
    lock.lift(7);
    expect(lock.active).toBe(false);
  });
});
