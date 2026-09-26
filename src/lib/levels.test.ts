// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { nextOpen, saveSolved, savedSolved, solvedKey } from './levels';

describe('savedSolved / saveSolved', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('何も保存されていなければ、到達レベルから 1..best-1 を解いたことにする', () => {
    expect(savedSolved('x', 10, 4)).toEqual(new Set([1, 2, 3]));
  });

  it('saveSolved で書いた集合が savedSolved で戻る。範囲外の数や文字は捨てる', () => {
    saveSolved('x', new Set([3, 1, 5]));
    expect(savedSolved('x', 10, 1)).toEqual(new Set([1, 3, 5]));
    localStorage.setItem(solvedKey('x'), JSON.stringify([1, 2, 99, 'a', 3.5, -1]));
    expect(savedSolved('x', 10, 1)).toEqual(new Set([1, 2]));
  });
});

describe('nextOpen', () => {
  it('次から一周して最初の解いていない面を返す', () => {
    expect(nextOpen(3, new Set([4, 5]), 10)).toBe(6);
    expect(nextOpen(9, new Set([10, 1]), 10)).toBe(2);
    expect(nextOpen(0, new Set(), 10)).toBe(1);
  });

  it('全部解いていれば from をそのまま返す', () => {
    expect(nextOpen(3, new Set(Array.from({ length: 10 }, (_, i) => i + 1)), 10)).toBe(3);
  });
});
