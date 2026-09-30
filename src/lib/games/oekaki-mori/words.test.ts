import { describe, expect, it } from 'vitest';
import { WORDS } from './words';

describe('WORDS', () => {
  it('150 語以上ある', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(150);
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
