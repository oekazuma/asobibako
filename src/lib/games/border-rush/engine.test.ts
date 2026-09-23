import { describe, expect, it } from 'vitest';
import {
  beginHold,
  createState,
  endHold,
  expire,
  GAIN,
  HOLD_MS,
  MAX_PER_PLAYER,
  ORB_LIFE_MS,
  pop,
  RUSH_S,
  spawnOrb,
  step,
  zone
} from './engine';

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('border-rush engine', () => {
  it(`${RUSH_S} 秒を過ぎると押す量が増え、30 秒で 2 倍に止まる`, () => {
    for (const [after, rate] of [
      [0, 1],
      [15, 1.5],
      [30, 2],
      [90, 2]
    ]) {
      const s = createState();
      s.elapsed = RUSH_S + after;
      pop(s, spawnOrb(s, 'tap', 2, 0, seq(0.5)).id, 2);
      expect(s.border).toBeCloseTo(0.5 + GAIN.tap * rate);
    }
  });

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

  it('プレイヤー 2 も押し切れば勝てる', () => {
    const s = createState();
    for (let i = 0; i < 40 && s.winner === null; i++) {
      const orb = spawnOrb(s, 'tap', 2, 0, seq(0.5));
      pop(s, orb.id, 2);
    }
    expect(s.winner).toBe(2);
  });

  it('境界が端に寄っても、自陣の玉はつぶれた範囲の中央に出る', () => {
    const s = createState();
    s.border = 0.95;
    const orb = spawnOrb(s, 'tap', 1, 0, seq(0.5));
    expect(orb.y).toBeGreaterThanOrEqual(0);
    expect(orb.y).toBeLessThanOrEqual(1);
  });

  it('出現の周期ごとに各陣地を上限まで埋め、上限を超えない', () => {
    const s = createState();
    step(s, 1, 0, seq(0.5));
    expect(s.orbs.filter((o) => o.owner === 1)).toHaveLength(1);
    for (let t = 0; t < 3; t += 1 / 60) step(s, 1 / 60, t * 1000, seq(0.5));
    expect(s.orbs.filter((o) => o.owner === 1).length).toBeLessThanOrEqual(MAX_PER_PLAYER);
    expect(s.orbs.filter((o) => o.owner === 2).length).toBeLessThanOrEqual(MAX_PER_PLAYER);
  });

  it('奪い合い玉は 1 つまでしか出ない', () => {
    const s = createState();
    for (let t = 0; t < 5; t += 1 / 60) step(s, 1 / 60, t * 1000, seq(0.1));
    expect(s.orbs.filter((o) => o.owner === null).length).toBeLessThanOrEqual(1);
  });

  it('長押しの玉は HOLD_MS 押し続けると取れ、途中で離すと取れない', () => {
    const s = createState();
    const orb = spawnOrb(s, 'hold', 1, 0, seq(0.5));
    beginHold(s, orb.id);
    expect(step(s, HOLD_MS / 1000 - 0.01, 0, seq(0.99))).toEqual([]);
    expect(step(s, 0.02, 0, seq(0.99))).toContainEqual({ type: 'pop', kind: 'hold' });
    expect(s.border).toBeCloseTo(0.5 - GAIN.hold);

    const t = createState();
    const other = spawnOrb(t, 'hold', 1, 0, seq(0.5));
    beginHold(t, other.id);
    step(t, 0.3, 0, seq(0.99));
    endHold(t, other.id);
    step(t, 1, 0, seq(0.99));
    expect(t.border).toBe(0.5);
  });

  it('id は state ごとに 1 から数える', () => {
    expect(spawnOrb(createState(), 'tap', 1, 0, seq(0.5)).id).toBe(1);
    expect(spawnOrb(createState(), 'tap', 1, 0, seq(0.5)).id).toBe(1);
  });
});
