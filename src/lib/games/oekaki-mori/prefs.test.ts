import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LENGTH_KEY, LOOK_KEY, readLength, readLook, saveLength, saveLook } from './prefs';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v)
});

describe('length prefs', () => {
  beforeEach(() => store.clear());

  it('選んだ長さを覚え、知らない値や無いときは ふつう', () => {
    expect(readLength()).toBe('normal');
    saveLength('short');
    expect(store.get(LENGTH_KEY)).toBe('short');
    expect(readLength()).toBe('short');
    store.set(LENGTH_KEY, 'forever');
    expect(readLength()).toBe('normal');
  });
});

describe('look prefs', () => {
  beforeEach(() => store.clear());

  it('はじめてはランダムに選んで覚え、知らない名前なら選び直す', () => {
    expect(readLook(() => 0)).toBe('rabbit');
    expect(store.get(LOOK_KEY)).toBe('rabbit');
    saveLook('bear');
    expect(readLook()).toBe('bear');
    store.set(LOOK_KEY, 'dragon');
    expect(readLook(() => 0)).toBe('rabbit');
  });
});
