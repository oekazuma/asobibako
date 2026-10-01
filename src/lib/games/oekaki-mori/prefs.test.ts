import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHARS_KEY,
  LENGTH_KEY,
  LOOK_KEY,
  readChars,
  readLength,
  readLook,
  saveChars,
  saveLength,
  saveLook
} from './prefs';

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

describe('chars prefs', () => {
  beforeEach(() => store.clear());

  it('選んだ字数を覚え、知らない値や無いときは ぜんぶ', () => {
    expect(readChars()).toBeNull();
    saveChars(3);
    expect(store.get(CHARS_KEY)).toBe('3');
    expect(readChars()).toBe(3);
    saveChars(null);
    expect(readChars()).toBeNull();
    store.set(CHARS_KEY, '9');
    expect(readChars()).toBeNull();
  });
});
