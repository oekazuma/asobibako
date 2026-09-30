import { describe, expect, it } from 'vitest';
import {
  createState,
  DEPTH,
  JUMP_TIME,
  rank,
  score,
  SHOT_GAP,
  speed,
  step,
  STUMBLE_TIME,
  tier,
  WARN_TIME,
  type Obstacle,
  type RunState,
  type Walker
} from './engine';

/** 障害物も通行人もない 1 面。テストごとに置きたいものだけ置く */
function empty(level = 1): RunState {
  const s = createState(level);
  s.walkers = [];
  s.blocks = [];
  return s;
}
const walker = (lane: number, z: number): Walker => ({ lane, z, fan: false, passed: false });
const block = (lane: number, z: number, kind: 'low' | 'high'): Obstacle => ({ lane, z, kind, look: 0, hit: false });

describe('レーン', () => {
  it('真ん中から始まり、端より外へは出ない', () => {
    const s = empty();
    expect(s.lane).toBe(1);
    step(s, 0.01, { move: -5 });
    expect(s.lane).toBe(0);
    step(s, 0.01, { move: 9 });
    expect(s.lane).toBe(2);
  });
});

describe('撃つ', () => {
  it('同じレーンの 15 m 以内でいちばん近い通行人に当たる', () => {
    const s = empty();
    const far = walker(1, 14);
    const near = walker(1, 6);
    const side = walker(0, 3);
    s.walkers = [far, near, side];
    const events = step(s, 0.01, { shoot: true });
    expect(near.fan).toBe(true);
    expect(far.fan).toBe(false);
    expect(side.fan).toBe(false);
    expect(events).toContainEqual({ type: 'hit', walker: near, gain: 12, combo: 1 });
  });

  it('15 m より遠いと外れで、損はない', () => {
    const s = empty();
    s.walkers = [walker(1, 16)];
    const events = step(s, 0.01, { shoot: true });
    expect(s.walkers[0].fan).toBe(false);
    expect(events).toEqual([{ type: 'shot', lane: 1 }]);
    expect(s.combo).toBe(0);
  });

  it('撃つ間隔は 0.25 秒以上', () => {
    const s = empty();
    s.walkers = [walker(1, 5), walker(1, 8)];
    step(s, 0.01, { shoot: true });
    step(s, 0.1, { shoot: true });
    expect(s.walkers[1].fan).toBe(false);
    step(s, SHOT_GAP);
    step(s, 0.01, { shoot: true });
    expect(s.walkers[1].fan).toBe(true);
  });

  it('当てるとコンボとフォロワーが式どおりに増える', () => {
    const s = empty();
    s.combo = 17;
    s.walkers = [walker(1, 5)];
    step(s, 0.01, { shoot: true });
    expect(s.combo).toBe(18);
    expect(s.maxCombo).toBe(18);
    expect(s.followers).toBe(46);
  });
});

describe('速さ', () => {
  it('コンボの段階で速さの倍率が変わる', () => {
    expect([0, 4, 5, 9, 10, 19, 20, 50].map(tier)).toEqual([1, 1, 1.2, 1.2, 1.5, 1.5, 2, 2]);
  });

  it('基本は 5 m/s で、倍率ぶん速く進む', () => {
    const s = empty();
    step(s, 1);
    expect(s.z).toBeCloseTo(5);
    s.combo = 20;
    step(s, 1);
    expect(s.z).toBeCloseTo(15);
  });
});

describe('通行人とのすれ違い', () => {
  it('通行人は 1 m/s でこちらへ歩く', () => {
    const s = empty();
    s.walkers = [walker(0, 30)];
    step(s, 1);
    expect(s.walkers[0].z).toBeCloseTo(29);
  });

  it('同じレーンのまますれ違うとコンボが切れる', () => {
    const s = empty();
    s.combo = 7;
    const w = walker(1, 1);
    s.walkers = [w];
    const events = step(s, 0.5);
    expect(s.combo).toBe(0);
    expect(events).toContainEqual({ type: 'miss', walker: w });
  });

  it('ほかのレーンの通行人とのすれ違いでは切れない', () => {
    const s = empty();
    s.combo = 7;
    s.walkers = [walker(2, 1)];
    const events = step(s, 0.5);
    expect(s.combo).toBe(7);
    expect(events.some((e) => e.type === 'miss')).toBe(false);
    expect(s.walkers[0].passed).toBe(true);
  });
});

describe('障害物', () => {
  it('ぶつかるとコンボが切れ、1 秒 ×0.3 になる', () => {
    const s = empty();
    s.combo = 12;
    const o = block(1, 0.5, 'low');
    s.blocks = [o];
    const events = step(s, 0.01);
    expect(events).toContainEqual({ type: 'bump', obstacle: o });
    expect(s.combo).toBe(0);
    expect(s.stumble).toBe(STUMBLE_TIME);
    expect(speed(s)).toBeCloseTo(5 * 0.3);
  });

  it('同じ障害物には 1 回しかぶつからない', () => {
    const s = empty();
    s.blocks = [block(1, DEPTH, 'high')];
    const first = step(s, 0.01);
    const second = step(s, 0.01);
    expect(first.filter((e) => e.type === 'bump')).toHaveLength(1);
    expect(second.filter((e) => e.type === 'bump')).toHaveLength(0);
  });

  it('よろけているあいだに別の障害物にぶつかると 1 秒を数え直す', () => {
    const s = empty();
    s.blocks = [block(1, 0.3, 'low'), block(1, 0.9, 'low')];
    step(s, 0.01);
    step(s, 0.5);
    expect(s.stumble).toBe(STUMBLE_TIME);
  });

  it('よろけているあいだも撃てて移れる', () => {
    const s = empty();
    s.stumble = 0.8;
    s.walkers = [walker(0, 5)];
    step(s, 0.01, { move: -1, shoot: true });
    expect(s.lane).toBe(0);
    expect(s.walkers[0].fan).toBe(true);
  });

  it('低いバリケードは跳べばよけられる', () => {
    const s = empty();
    s.blocks = [block(1, 1.2, 'low')];
    step(s, 0.01, { jump: true });
    for (let i = 0; i < 20; i++) step(s, 0.02);
    expect(s.blocks[0].hit).toBe(false);
  });

  it('高い柵は跳んでもぶつかる', () => {
    const s = empty();
    s.blocks = [block(1, 1.2, 'high')];
    step(s, 0.01, { jump: true });
    for (let i = 0; i < 20; i++) step(s, 0.02);
    expect(s.blocks[0].hit).toBe(true);
  });

  it('ほかのレーンの障害物にはぶつからない', () => {
    const s = empty();
    s.blocks = [block(0, 0.5, 'high')];
    step(s, 0.2);
    expect(s.blocks[0].hit).toBe(false);
  });

  it('大きな dt でも障害物をすり抜けない', () => {
    const s = empty();
    s.combo = 20;
    s.blocks = [block(1, 1, 'high')];
    step(s, 0.2);
    expect(s.blocks[0].hit).toBe(true);
  });
});

describe('跳ぶ', () => {
  it('0.6 秒空中にいて、空中の跳ぶは無視する', () => {
    const s = empty();
    const first = step(s, 0.01, { jump: true });
    expect(first).toContainEqual({ type: 'jump' });
    step(s, 0.3);
    const again = step(s, 0.01, { jump: true });
    expect(again.some((e) => e.type === 'jump')).toBe(false);
    expect(s.air).toBeCloseTo(JUMP_TIME - 0.32);
    step(s, 0.3);
    expect(s.air).toBe(0);
  });

  it('空中でもレーンを移れて撃てる', () => {
    const s = empty();
    s.walkers = [walker(2, 5)];
    step(s, 0.01, { jump: true });
    step(s, 0.01, { move: 1, shoot: true });
    expect(s.lane).toBe(2);
    expect(s.walkers[0].fan).toBe(true);
  });
});

describe('時間とゴール', () => {
  it('時間切れでしっぱい', () => {
    const s = empty();
    s.time = 0.05;
    const events = step(s, 0.1);
    expect(s.result).toBe('fail');
    expect(s.time).toBe(0);
    expect(events).toContainEqual({ type: 'timeout' });
    expect(step(s, 0.1)).toEqual([]);
  });

  it('ボスのない面は道のりの終わりでクリア', () => {
    const s = empty(1);
    s.z = s.goal - 0.01;
    const events = step(s, 0.1);
    expect(s.result).toBe('clear');
    expect(events).toContainEqual({ type: 'goal' });
  });
});

describe('ランク', () => {
  it('点はフォロワー ＋ 残り秒（切り捨て）× 20 ＋ 最大コンボ × 10', () => {
    const s = empty();
    s.followers = 300;
    s.time = 12.9;
    s.maxCombo = 8;
    expect(score(s)).toBe(300 + 12 * 20 + 80);
  });

  it('うまいボットの点に対して S 90%・A 70%・B 50%', () => {
    expect(rank(900, 1000)).toBe('S');
    expect(rank(899, 1000)).toBe('A');
    expect(rank(700, 1000)).toBe('A');
    expect(rank(500, 1000)).toBe('B');
    expect(rank(499, 1000)).toBe('C');
  });
});

describe('ボス', () => {
  /** 5 面を、ボスが現れる直前まで進めた状態 */
  function atBoss(): RunState {
    const s = empty(5);
    s.z = s.bossAt - 0.01;
    return s;
  }

  it('道のりの終わりで現れ、それまで校門はない', () => {
    const s = atBoss();
    expect(s.goal).toBe(Infinity);
    const events = step(s, 0.01);
    expect(events).toContainEqual({ type: 'boss-in' });
    expect(s.boss!.phase).toBe('fight');
  });

  it('同じレーンのときだけ倍率ぶん減り、当てるとコンボが伸びる', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.lane = 0;
    step(s, 0.01, { shoot: true });
    expect(s.boss!.hp).toBe(s.boss!.max);
    s.lane = 0;
    s.combo = 9;
    s.cooldown = 0;
    const events = step(s, 0.01, { shoot: true });
    expect(events).toContainEqual({ type: 'boss-hit', damage: 1.5, combo: 10 });
    expect(s.boss!.hp).toBe(s.boss!.max - 1.5);
  });

  it('ボスのあいだの撃つは通行人に当たらない', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.lane = 2;
    s.walkers = [walker(1, s.z + 5)];
    step(s, 0.01, { shoot: true });
    expect(s.walkers[0].fan).toBe(false);
  });

  it('0 にすると去り、30 m 先に校門が出る', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.hp = 1;
    s.boss!.lane = s.lane;
    const events = step(s, 0.01, { shoot: true });
    expect(events).toContainEqual({ type: 'boss-down' });
    expect(s.boss!.phase).toBe('gone');
    expect(s.goal).toBeCloseTo(s.z + 30, 0);
  });

  it('いまのレーンへ投げ、1.5 秒前から印を出して、およそ 12 m 先に落とす', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.lane = 2;
    s.boss!.moveIn = 99;
    s.boss!.throwIn = 0.005;
    const thrown = step(s, 0.01);
    const t = thrown.find((e) => e.type === 'throw');
    expect(t && t.type === 'throw' && t.drop.t).toBeCloseTo(WARN_TIME, 1);
    expect(t && t.type === 'throw' && t.drop.lane).toBe(2);
    expect(s.boss!.drops).toHaveLength(1);
    let landed: Obstacle | null = null;
    // Step 14 × 0.1 s (1.4 s total, less than WARN_TIME of 1.5 s) — no land event yet
    for (let i = 0; i < 14; i++) {
      const events = step(s, 0.1);
      expect(events.some((e) => e.type === 'land')).toBe(false);
    }
    // Continue stepping and assert it lands by step 16
    for (let i = 14; i < 16 && !landed; i++) for (const e of step(s, 0.1)) if (e.type === 'land') landed = e.obstacle;
    expect(landed).not.toBeNull();
    expect(landed!.kind).toBe('low');
    expect(landed!.z - s.z).toBeGreaterThan(10);
    expect(landed!.z - s.z).toBeLessThan(14);
    expect(s.blocks).toContain(landed);
    expect(s.boss!.drops).toHaveLength(0);
  });

  it('決まった間隔でほかのレーンへ移る', () => {
    const s = atBoss();
    step(s, 0.01);
    s.boss!.throwIn = 99;
    const lane = s.boss!.lane;
    step(s, s.rule.boss!.moveEvery);
    expect(s.boss!.lane).not.toBe(lane);
  });

  it('ボスのない面ではボスは出ない', () => {
    const s = empty(4);
    s.z = s.bossAt + 1;
    expect(step(s, 0.01).some((e) => e.type === 'boss-in')).toBe(false);
  });
});
