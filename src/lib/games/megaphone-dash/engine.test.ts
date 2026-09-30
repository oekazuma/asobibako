import { describe, expect, it } from 'vitest';
import { ZONE_LEN } from './course';
import {
  BASE_SPEED,
  BOSS_HIT_W,
  COMBO_TIME,
  createState,
  FULL_COMBO,
  GAUGE,
  PULSE,
  rank,
  REACH,
  score,
  SHOUT_DAMAGE,
  speed,
  step,
  STUMBLE_TIME,
  type Obstacle,
  type RunState,
  type Walker
} from './engine';

function empty(level = 1): RunState {
  const s = createState(level);
  s.walkers = [];
  s.blocks = [];
  return s;
}
const walker = (x: number, z: number): Walker => ({ x, z, look: 0, fan: false, order: 0, phase: 0 });
const block = (x: number, z: number, w = 1.2): Obstacle => ({ x, z, w, kind: 'cone', hit: false });

describe('メガホン', () => {
  it('前の扇形の中の人をまとめてファンにし、横や遠くの人は残す', () => {
    const s = empty();
    const near = walker(0.2, 3);
    // 扇は奥ほど広い。手前では届かない横の位置でも、奥なら届く
    const wide = walker(0.9, 8);
    const side = walker(0.9, 2);
    const far = walker(0, REACH + 2);
    s.walkers = [near, wide, side, far];
    const events = step(s, 0.01);
    expect(near.fan).toBe(true);
    expect(wide.fan).toBe(true);
    expect(side.fan).toBe(false);
    expect(far.fan).toBe(false);
    const hit = events.find((e) => e.type === 'hit');
    expect(hit && hit.type === 'hit' && hit.walkers).toHaveLength(2);
    expect(s.combo).toBe(2);
    expect(s.followers).toBe(11 + 12);
  });

  it('決まった間隔で鳴る', () => {
    const s = empty();
    let pulses = 0;
    for (let i = 0; i < 100; i++) pulses += step(s, 0.01).filter((e) => e.type === 'pulse').length;
    expect(pulses).toBe(Math.ceil(1 / PULSE));
  });

  it('しばらく当てないとコンボが切れる', () => {
    const s = empty();
    s.walkers = [walker(0, 2)];
    step(s, 0.01);
    expect(s.combo).toBe(1);
    let dropped = false;
    for (let t = 0; t < COMBO_TIME + 0.2; t += 0.05) dropped ||= step(s, 0.05).some((e) => e.type === 'drop');
    expect(dropped).toBe(true);
    expect(s.combo).toBe(0);
  });

  it('コンボで速くなり、上限は 2 倍', () => {
    const s = empty();
    expect(speed(s)).toBe(BASE_SPEED);
    s.combo = FULL_COMBO / 2;
    expect(speed(s)).toBeCloseTo(BASE_SPEED * 1.5);
    s.combo = FULL_COMBO * 3;
    expect(speed(s)).toBeCloseTo(BASE_SPEED * 2);
  });
});

describe('走る', () => {
  it('指の位置へ横に寄っていき、道の端で止まる', () => {
    const s = empty();
    step(s, 0.05, { target: 1 });
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(1);
    for (let i = 0; i < 20; i++) step(s, 0.05, { target: 99 });
    expect(s.x).toBeLessThan(2.6);
    expect(s.x).toBeGreaterThan(2);
  });

  it('指を離すとその場をまっすぐ走る', () => {
    const s = empty();
    for (let i = 0; i < 20; i++) step(s, 0.05, { target: 1 });
    const x = s.x;
    step(s, 0.05, { target: null });
    expect(s.x).toBeCloseTo(x);
  });
});

describe('障害物', () => {
  it('体が重なるとぶつかり、よろけてコンボが切れる', () => {
    const s = empty();
    s.combo = 9;
    s.since = 0;
    const o = block(0.6, 0.3);
    s.blocks = [o];
    const events = step(s, 0.01);
    expect(o.hit).toBe(true);
    expect(s.stumble).toBe(STUMBLE_TIME);
    expect(s.combo).toBe(0);
    expect(events.some((e) => e.type === 'bump')).toBe(true);
  });

  it('横に外れていればぶつからない', () => {
    const s = empty();
    s.blocks = [block(1.5, 0.3)];
    step(s, 0.05);
    expect(s.blocks[0].hit).toBe(false);
  });
});

describe('大声', () => {
  it('ゲージが満タンになると知らせ、叫ぶと前の人をまとめてファンにして障害物を吹き飛ばす', () => {
    const s = empty();
    s.gauge = GAUGE - 1;
    s.walkers = [walker(0, 2)];
    const filled = step(s, 0.01);
    expect(filled.some((e) => e.type === 'gauge')).toBe(true);
    s.walkers.push(walker(-2, 20), walker(2, 28));
    s.blocks = [block(0, 15)];
    const events = step(s, 0.01, { shout: true });
    expect(events.some((e) => e.type === 'shout')).toBe(true);
    expect(s.walkers.every((w) => w.fan)).toBe(true);
    expect(s.blocks[0].hit).toBe(true);
    expect(s.gauge).toBe(0);
  });

  it('ゲージが足りなければ叫べない', () => {
    const s = empty();
    s.walkers = [walker(0, 20)];
    step(s, 0.01, { shout: true });
    expect(s.walkers[0].fan).toBe(false);
  });

  it('叫んだあとしばらくは障害物をすり抜ける', () => {
    const s = empty();
    s.gauge = GAUGE;
    step(s, 0.01, { shout: true });
    s.blocks = [block(0, s.z + 0.3)];
    step(s, 0.05);
    expect(s.stumble).toBe(0);
  });
});

describe('場所とゴール', () => {
  it('道のりが進むと場所が変わる', () => {
    const s = empty();
    s.z = ZONE_LEN - 0.01;
    const events = step(s, 0.05);
    expect(events).toContainEqual({ type: 'zone', zone: 'arcade' });
  });

  it('道のりの終わりでクリア、時間切れでしっぱい', () => {
    const s = empty();
    s.z = s.rule.length - 0.01;
    expect(step(s, 0.05)).toContainEqual({ type: 'goal' });
    expect(s.result).toBe('clear');
    const t = empty();
    t.time = 0.01;
    expect(step(t, 0.05)).toContainEqual({ type: 'timeout' });
    expect(t.result).toBe('fail');
  });

  it('コンボなしでも時間内に着ける', () => {
    for (const level of [1, 8, 15]) {
      const s = empty(level);
      expect(s.rule.length / BASE_SPEED).toBeLessThanOrEqual(s.rule.time);
    }
  });
});

describe('点とランク', () => {
  it('ファンにできた人の割合でランクが決まる', () => {
    const s = createState(1);
    const n = s.walkers.length;
    s.fans = n;
    expect(rank(s)).toBe('S');
    s.fans = Math.floor(n * 0.9);
    expect(rank(s)).toBe('A');
    s.fans = Math.floor(n * 0.7);
    expect(rank(s)).toBe('B');
    s.fans = Math.floor(n * 0.3);
    expect(rank(s)).toBe('C');
  });

  it('点はフォロワー・残り秒・最大コンボから出す', () => {
    const s = createState(1);
    s.followers = 500;
    s.time = 12.7;
    s.maxCombo = 8;
    expect(score(s)).toBe(500 + 12 * 30 + 80);
  });
});

describe('ボス', () => {
  /** 5 面を、ボスが現れる直前まで進めた状態 */
  function atBoss(): RunState {
    const s = empty(5);
    s.z = s.rule.bossAt - 0.01;
    return s;
  }

  /** 現れたボスを、動かず投げない状態で走る子の正面（dx だけずらして）に置く */
  function facing(s: RunState, dx = 0) {
    step(s, 0.01);
    const b = s.boss!;
    b.x = b.to = s.x + dx;
    b.moveIn = b.throwIn = 99;
    s.pulse = 0;
    return b;
  }

  it('決まった距離で現れ、それまでゴールはない', () => {
    const s = atBoss();
    expect(s.goal).toBe(Infinity);
    const events = step(s, 0.05);
    expect(events).toContainEqual({ type: 'boss-in' });
    expect(s.boss!.phase).toBe('fight');
  });

  it('正面にいればメガホンが当たり、コンボも伸びる', () => {
    const s = atBoss();
    const b = facing(s);
    const events = step(s, 0.01);
    expect(events.some((e) => e.type === 'boss-hit')).toBe(true);
    expect(b.hp).toBeLessThan(b.max);
    expect(s.combo).toBe(1);
  });

  it('横にずれていれば当たらない', () => {
    const s = atBoss();
    const b = facing(s, BOSS_HIT_W + 0.5);
    step(s, 0.01);
    expect(b.hp).toBe(b.max);
  });

  it('大声で大きく削れる', () => {
    const s = atBoss();
    const b = facing(s, 2);
    s.gauge = GAUGE;
    const events = step(s, 0.01, { shout: true });
    expect(events).toContainEqual({ type: 'boss-hit', damage: SHOUT_DAMAGE, big: true });
    expect(b.hp).toBe(b.max - SHOUT_DAMAGE);
  });

  it('ふまん玉を投げ、印のあとで道に落とす', () => {
    const s = atBoss();
    const b = facing(s, 1);
    b.throwIn = 0.005;
    s.pulse = 99;
    const thrown = step(s, 0.01);
    expect(thrown.some((e) => e.type === 'throw')).toBe(true);
    let landed: Obstacle | null = null;
    for (let i = 0; i < 20 && !landed; i++) for (const e of step(s, 0.1)) if (e.type === 'land') landed = e.obstacle;
    expect(landed?.kind).toBe('bubble');
    expect(s.blocks).toContain(landed);
    expect(landed!.z - s.z).toBeGreaterThan(8);
  });

  it('倒すと 30 m 先にゴールが出る', () => {
    const s = atBoss();
    const b = facing(s);
    b.hp = 0.5;
    const events = step(s, 0.01);
    expect(events).toContainEqual({ type: 'boss-down' });
    expect(b.phase).toBe('gone');
    expect(s.goal - s.z).toBeGreaterThan(29);
    expect(s.goal - s.z).toBeLessThan(31);
  });

  it('ボスのいない面では現れない', () => {
    const s = empty(4);
    s.z = s.rule.length - 5;
    expect(step(s, 0.05).some((e) => e.type === 'boss-in')).toBe(false);
    expect(s.boss).toBeNull();
  });
});
