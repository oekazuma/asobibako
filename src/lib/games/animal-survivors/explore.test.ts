import { describe, expect, it } from 'vitest';
import { obstaclesNear, type Ground } from './obstacles';
import { relicSpot, RELICS } from './relics';
import { shrineAt, shrinesNear } from './shrines';
import { STAGES } from './stages';

const GROUNDS: Ground[] = ['forest', 'graveyard', 'snow', 'volcano'];

describe('遺物の置き場所', () => {
  it('ステージごとに 2 つで、全部で 8 つ', () => {
    expect(RELICS).toHaveLength(8);
    for (const s of STAGES) expect(RELICS.filter((r) => r.stage === s.id)).toHaveLength(2);
  });

  it('1 つめは 700 ドット、2 つめは 1500 ドットほど離れ、障害物の中に無い', () => {
    for (const s of STAGES) {
      const [a, b] = RELICS.filter((r) => r.stage === s.id).map((r) => relicSpot(r, s.art));
      expect(Math.hypot(a.x, a.y)).toBeGreaterThan(650);
      expect(Math.hypot(a.x, a.y)).toBeLessThan(760);
      expect(Math.hypot(b.x, b.y)).toBeGreaterThan(1430);
      expect(Math.hypot(b.x, b.y)).toBeLessThan(1570);
      for (const p of [a, b]) expect(obstaclesNear(s.art, p.x, p.y, 8, [])).toEqual([]);
    }
  });

  it('毎回同じ場所', () => {
    for (const r of RELICS) expect(relicSpot(r, 'forest')).toEqual(relicSpot(r, 'forest'));
  });
});

describe('祠の置き方', () => {
  it('およそ 10 区画に 1 つ（40 × 40 区画で 6〜15%）、5 種が出る', () => {
    for (const g of GROUNDS) {
      let n = 0;
      const kinds = new Set<string>();
      for (let cx = -20; cx < 20; cx++)
        for (let cy = -20; cy < 20; cy++) {
          const s = shrineAt(g, cx, cy);
          if (!s) continue;
          n++;
          kinds.add(s.kind);
        }
      expect(n / 1600).toBeGreaterThan(0.06);
      expect(n / 1600).toBeLessThan(0.15);
      expect(kinds.size).toBe(5);
    }
  });

  it('始めの位置から 120 ドットの中と、障害物の上には無い', () => {
    for (const g of GROUNDS) {
      expect(shrinesNear(g, 0, 0, 120, [])).toEqual([]);
      for (let cx = -15; cx < 15; cx++)
        for (let cy = -15; cy < 15; cy++) {
          const s = shrineAt(g, cx, cy);
          if (s) expect(obstaclesNear(g, s.x, s.y, 12, [])).toEqual([]);
        }
    }
  });

  it('区画の番号は祠ごとに違い、毎回同じ', () => {
    const keys = new Set<number>();
    for (let cx = -10; cx < 10; cx++)
      for (let cy = -10; cy < 10; cy++) {
        const s = shrineAt('forest', cx, cy);
        if (!s) continue;
        expect(keys.has(s.key)).toBe(false);
        keys.add(s.key);
        expect(shrineAt('forest', cx, cy)).toEqual(s);
      }
  });
});
