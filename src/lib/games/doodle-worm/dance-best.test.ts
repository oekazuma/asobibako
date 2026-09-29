// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { Result } from './dance';
import { BEST_KEY, bestKey, loadBest, saveBest } from './dance-best';

const result = (score: number): Result => ({
  great: 0,
  good: 0,
  near: 0,
  miss: 0,
  maxCombo: 0,
  appeals: 0,
  score,
  rank: 'A'
});

afterEach(() => localStorage.clear());

describe('ダンスのハイスコア', () => {
  it('良くなったときだけ覚え、読み直しても残る', () => {
    const key = bestKey('kirakira', 1);
    const first = saveBest(loadBest(), key, result(500));
    expect(first.fresh).toBe(true);
    expect(saveBest(first.best, key, result(400)).fresh).toBe(false);
    expect(loadBest()[key].score).toBe(500);
  });

  it('壊れた保存は空として読む', () => {
    localStorage.setItem(BEST_KEY, '[1,2]');
    expect(loadBest()).toEqual({});
    localStorage.setItem(BEST_KEY, '{');
    expect(loadBest()).toEqual({});
  });
});
