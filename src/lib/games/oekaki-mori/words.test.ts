import { describe, expect, it } from 'vitest';
import { WORDS } from './words';

describe('WORDS', () => {
  it('380 語以上あり、3 もじまでで 200 語以上残る', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(380);
    expect(WORDS.filter((w) => [...w].length <= 3).length).toBeGreaterThanOrEqual(200);
  });

  it('4 もじまでで 300 語以上残る', () => {
    expect(WORDS.filter((w) => [...w].length <= 4).length).toBeGreaterThanOrEqual(300);
  });

  it('ひらがなと「ー」だけで、2 文字以上', () => {
    for (const word of WORDS) {
      expect(word, word).toMatch(/^[ぁ-んー]+$/);
      expect([...word].length, word).toBeGreaterThanOrEqual(2);
    }
  });

  it('重なりがない', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });
});
