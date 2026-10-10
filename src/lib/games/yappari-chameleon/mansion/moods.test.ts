import { describe, expect, it } from 'vitest';
import { blendK, DAY, irradiance, moodAt, MOODS, relight } from './moods';
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

  it('ロビーへ入る最初の 1 フレームで日を切り、部屋どうしの移りはなめらかに寄せる', () => {
    expect(blendK(moodAt([0, 1.5, -66]), 16)).toBe(1);
    expect(blendK(MOODS['キッチン'], 16)).toBeLessThan(0.1);
    expect(blendK(MOODS['キッチン'], null)).toBe(1);
  });

  it('白い面が向きごとに受ける光は、大広間で描いて測った明るさに近い（上 1.61・横 0.62・下 0.29、緑）', () => {
    expect(irradiance(DAY, 1)[1]).toBeCloseTo(1.61, 0);
    expect(irradiance(DAY, 0)[1] / irradiance(DAY, 1)[1]).toBeCloseTo(0.62 / 1.61, 1);
    expect(irradiance(DAY, -1)[1] / irradiance(DAY, 1)[1]).toBeCloseTo(0.29 / 1.61, 1);
  });

  it('上を向く床の色を横を向く面に塗ると明るくし、1 を超えるぶんは色合いを保って下げる。同じ向きならそのまま', () => {
    const floor: [number, number, number] = [0.5, 0.45, 0.4];
    const leg = relight(floor, DAY, 1, 0);
    expect(leg[1]).toBeGreaterThan(floor[1] + 0.2);
    expect(leg[0]).toBeGreaterThan(leg[1]);
    expect(leg[1]).toBeGreaterThan(leg[2]);
    const cream = relight([0.95, 0.9, 0.8], DAY, 1, 0);
    expect(Math.max(...cream)).toBeCloseTo(1, 5);
    expect(cream[2]).toBeLessThan(0.95);
    relight(floor, DAY, 0.3, 0.3).forEach((v, i) => expect(v).toBeCloseTo(floor[i], 5));
    expect(relight(floor, DAY, 0, 1)[1]).toBeLessThan(floor[1]);
  });
});
