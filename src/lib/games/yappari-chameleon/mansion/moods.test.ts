import { describe, expect, it } from 'vitest';
import { DAY, moodAt, MOODS } from './moods';
import { PLACES, SPAWNS } from './layout';

describe('部屋ごとの明るさ', () => {
  it('キッチン・ランドリー・書斎は大広間より暗く、日を消さない（影を落とすのは日だけ）', () => {
    for (const name of ['キッチン', 'ランドリー', '書斎']) {
      const m = MOODS[name];
      expect(PLACES.some((p) => p.name === name)).toBe(true);
      expect(m.sun, name).toBeGreaterThan(0);
      expect(m.sun, name).toBeLessThan(DAY.sun);
      expect(m.fill, name).toBeLessThan(DAY.fill);
    }
  });

  it('カメラのいる部屋の値を返し、大広間・廊下・控室は今のまま、ロビーは日を消す', () => {
    expect(moodAt([-16, 1.5, 11])).toBe(MOODS['キッチン']);
    expect(moodAt([-15, 1.5, -1])).toBe(MOODS['ランドリー']);
    expect(moodAt([12, 1.5, 6])).toBe(MOODS['書斎']);
    expect(moodAt([0, 1.5, 5])).toBe(DAY);
    expect(moodAt([-15, 1.5, 5])).toBe(DAY);
    expect(moodAt(SPAWNS.room[1])).toBe(DAY);
    expect(moodAt([0, 1.5, -66])).toEqual({ ...DAY, sun: 0 });
  });
});
