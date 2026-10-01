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

  // 似た言葉が両方あると、小さい子の自然な答え（おばけ・はち）が外れになる
  it('答えが割れやすい言葉の組と、60 秒で描きにくい言葉を持たない', () => {
    for (const word of [
      'ゆうれい',
      'みつばち',
      'いわ',
      'しろくま',
      'えだまめ',
      'こい',
      'とり',
      'しお',
      'さとう',
      'みず',
      'こめ',
      'おちゃ',
      'かん',
      'びわ',
      'もっきん'
    ])
      expect(WORDS, word).not.toContain(word);
  });
});
