import { describe, expect, it } from 'vitest';
import { createState, expire, GAIN, ORB_LIFE_MS, pop, spawnOrb, zone } from './engine';

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('border-rush engine', () => {
  it('プレイヤー1が取ると境界は上へ、プレイヤー2が取ると下へ動く', () => {
    const s = createState();
    const a = spawnOrb(s, 'tap', 1, 0, seq(0.5));
    expect(pop(s, a.id, 1)).toBe(true);
    expect(s.border).toBeCloseTo(0.5 - GAIN.tap);

    const b = spawnOrb(s, 'tap', 2, 0, seq(0.5));
    expect(pop(s, b.id, 2)).toBe(true);
    expect(s.border).toBeCloseTo(0.5);
  });

  it('相手の玉は取れない', () => {
    const s = createState();
    const orb = spawnOrb(s, 'tap', 1, 0, seq(0.5));
    expect(pop(s, orb.id, 2)).toBe(false);
    expect(s.border).toBe(0.5);
    expect(s.orbs).toHaveLength(1);
  });

  it('境界線上の玉はどちらでも取れる', () => {
    const s = createState();
    const orb = spawnOrb(s, 'contest', null, 0, seq(0.5));
    expect(pop(s, orb.id, 2)).toBe(true);
    expect(s.border).toBeCloseTo(0.5 + GAIN.contest);
  });

  it('押し切ると勝者が決まり、それ以降は取れない', () => {
    const s = createState();
    for (let i = 0; i < 40 && s.winner === null; i++) {
      const orb = spawnOrb(s, 'tap', 1, 0, seq(0.5));
      pop(s, orb.id, 1);
    }
    expect(s.winner).toBe(1);
    const orb = spawnOrb(s, 'tap', 1, 0, seq(0.5));
    expect(pop(s, orb.id, 1)).toBe(false);
  });

  it('境界が動いて相手側に取り残された玉は消える', () => {
    const s = createState();
    const deep = spawnOrb(s, 'tap', 2, 0, seq(0)); // 陣地のいちばん上端寄り
    const edge = spawnOrb(s, 'tap', 2, 0, seq(1)); // 境界のすぐ上
    const mine = spawnOrb(s, 'hold', 1, 0, seq(1));
    expect(pop(s, mine.id, 1)).toBe(true);
    expect(s.orbs.map((o) => o.id)).toEqual([deep.id]);
    expect(edge.y).toBeGreaterThan(s.border);
  });

  it('陣地は境界で分かれ、玉は自陣の内側に出る', () => {
    const s = createState();
    const [topLo, topHi] = zone(s, 2);
    const [botLo, botHi] = zone(s, 1);
    expect(topHi).toBeLessThan(s.border);
    expect(botLo).toBeGreaterThan(s.border);
    expect(topLo).toBeGreaterThan(0);
    expect(botHi).toBeLessThan(1);
  });

  it('寿命を過ぎた玉は落ちる', () => {
    const s = createState();
    const old = spawnOrb(s, 'tap', 1, 0, seq(0.5));
    const fresh = spawnOrb(s, 'tap', 1, ORB_LIFE_MS, seq(0.5));
    expire(s, ORB_LIFE_MS + 1);
    expect(s.orbs.map((o) => o.id)).toEqual([fresh.id]);
    expect(pop(s, old.id, 1)).toBe(false);
  });
});
