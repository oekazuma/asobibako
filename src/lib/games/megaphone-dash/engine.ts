import { Rng } from '$lib/levels';
import { BASE_SPEED, course, LANES, rule, type Block, type Kind, type LevelRule } from './course';

/** 撃ったときに当たる、前方の距離（m） */
export const SHOT_RANGE = 15;
export const SHOT_GAP = 0.25;
export const JUMP_TIME = 0.6;
export const STUMBLE_TIME = 1;
export const STUMBLE_SLOW = 0.3;
export const WALK_SPEED = 1;
/** 障害物の前後の厚み（m）。この範囲に同じレーンでいるとぶつかる */
export const DEPTH = 0.6;
export const BOSS_AHEAD = 20;
export const GATE_AFTER_BOSS = 30;
/** 投げた障害物が落ちるまでの秒。そのあいだ落ちる場所に印を出す */
export const WARN_TIME = 1.5;
/** 投げた障害物が落ちる、そのときの走る子からの距離（m） */
export const DROP_AHEAD = 12;

export interface Walker {
  lane: number;
  z: number;
  fan: boolean;
  passed: boolean;
}

export interface Obstacle extends Block {
  hit: boolean;
}

export interface Drop {
  lane: number;
  z: number;
  kind: Kind;
  /** 落ちるまでの秒 */
  t: number;
}

export interface Boss {
  hp: number;
  max: number;
  lane: number;
  moveIn: number;
  throwIn: number;
  drops: Drop[];
  phase: 'wait' | 'fight' | 'gone';
}

export interface RunState {
  level: number;
  rule: LevelRule;
  /** ボスの動きに使う。面ごとに決まった列 */
  rng: Rng;
  /** 走った距離（m） */
  z: number;
  lane: number;
  /** 空中にいる残りの秒 */
  air: number;
  stumble: number;
  cooldown: number;
  combo: number;
  maxCombo: number;
  followers: number;
  /** 残りの秒 */
  time: number;
  /** ボスが現れる距離 */
  bossAt: number;
  /** 校門の距離。ボスの面は倒すまで Infinity */
  goal: number;
  walkers: Walker[];
  blocks: Obstacle[];
  boss: Boss | null;
  result: 'clear' | 'fail' | null;
}

/** move は右を正にした、このフレームで移るレーンの数 */
export interface RunInput {
  shoot?: boolean;
  move?: number;
  jump?: boolean;
}

export type RunEvent =
  | { type: 'shot'; lane: number }
  | { type: 'hit'; walker: Walker; gain: number; combo: number }
  | { type: 'miss'; walker: Walker }
  | { type: 'jump' }
  | { type: 'bump'; obstacle: Obstacle }
  | { type: 'boss-in' }
  | { type: 'boss-hit'; damage: number; combo: number }
  | { type: 'boss-down' }
  | { type: 'throw'; drop: Drop }
  | { type: 'land'; obstacle: Obstacle }
  | { type: 'goal' }
  | { type: 'timeout' };

export const tier = (combo: number): number => (combo >= 20 ? 2 : combo >= 10 ? 1.5 : combo >= 5 ? 1.2 : 1);

export const speed = (s: RunState): number => BASE_SPEED * tier(s.combo) * (s.stumble > 0 ? STUMBLE_SLOW : 1);

export function createState(level: number): RunState {
  const r = rule(level);
  const c = course(level);
  return {
    level,
    rule: r,
    rng: new Rng(Math.round(level) * 7919 + 1),
    z: 0,
    lane: 1,
    air: 0,
    stumble: 0,
    cooldown: 0,
    combo: 0,
    maxCombo: 0,
    followers: 0,
    time: r.time,
    bossAt: c.length,
    goal: r.boss ? Infinity : c.length,
    walkers: c.walkers.map((w) => ({ lane: w.lane, z: w.z, fan: false, passed: false })),
    blocks: c.blocks.map((b) => ({ ...b, hit: false })),
    boss: r.boss
      ? {
          hp: r.boss.hp,
          max: r.boss.hp,
          lane: 1,
          moveIn: r.boss.moveEvery,
          throwIn: r.boss.throwEvery,
          drops: [],
          phase: 'wait'
        }
      : null,
    result: null
  };
}

function addCombo(s: RunState) {
  s.combo += 1;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
}

function shoot(s: RunState, events: RunEvent[]) {
  s.cooldown = SHOT_GAP;
  events.push({ type: 'shot', lane: s.lane });
  if (s.boss?.phase === 'fight') {
    hitBoss(s, s.boss, events);
    return;
  }
  let target: Walker | null = null;
  for (const w of s.walkers) {
    if (w.fan || w.lane !== s.lane) continue;
    const d = w.z - s.z;
    if (d < 0 || d > SHOT_RANGE) continue;
    if (!target || w.z < target.z) target = w;
  }
  if (!target) return;
  target.fan = true;
  addCombo(s);
  const gain = 10 + 2 * s.combo;
  s.followers += gain;
  events.push({ type: 'hit', walker: target, gain, combo: s.combo });
}

function hitBoss(s: RunState, b: Boss, events: RunEvent[]) {
  if (b.lane !== s.lane) return;
  addCombo(s);
  const damage = tier(s.combo);
  b.hp = Math.max(0, b.hp - damage);
  events.push({ type: 'boss-hit', damage, combo: s.combo });
  if (b.hp > 0) return;
  b.phase = 'gone';
  b.drops = [];
  s.goal = s.z + GATE_AFTER_BOSS;
  events.push({ type: 'boss-down' });
}

function pass(s: RunState, events: RunEvent[]) {
  for (const w of s.walkers) {
    if (w.fan || w.passed || w.z > s.z) continue;
    w.passed = true;
    if (w.lane !== s.lane) continue;
    s.combo = 0;
    events.push({ type: 'miss', walker: w });
  }
}

/** from から今の位置までに通った範囲で見る。速いときの 1 フレームで障害物を飛び越さないため */
function bump(s: RunState, from: number, events: RunEvent[]) {
  for (const o of s.blocks) {
    if (o.hit || o.lane !== s.lane) continue;
    if (o.z < from - DEPTH || o.z > s.z + DEPTH) continue;
    if (o.kind === 'low' && s.air > 0) continue;
    o.hit = true;
    s.combo = 0;
    s.stumble = STUMBLE_TIME;
    events.push({ type: 'bump', obstacle: o });
  }
}

function boss(s: RunState, dt: number, events: RunEvent[]) {
  const b = s.boss;
  const r = s.rule.boss;
  if (!b || !r || b.phase === 'gone') return;
  if (b.phase === 'wait') {
    if (s.z < s.bossAt) return;
    b.phase = 'fight';
    events.push({ type: 'boss-in' });
    return;
  }
  b.moveIn -= dt;
  if (b.moveIn <= 0) {
    b.moveIn += r.moveEvery;
    b.lane = (b.lane + 1 + Math.floor(s.rng.next() * (LANES - 1))) % LANES;
  }
  b.throwIn -= dt;
  if (b.throwIn <= 0) {
    b.throwIn += r.throwEvery;
    const kind = r.kinds[Math.floor(s.rng.next() * r.kinds.length)];
    // 落ちるときにおよそ DROP_AHEAD 先になるよう、いまの速さで WARN_TIME ぶん先へ置く
    const drop: Drop = { lane: b.lane, z: s.z + DROP_AHEAD + speed(s) * WARN_TIME, kind, t: WARN_TIME };
    b.drops.push(drop);
    events.push({ type: 'throw', drop });
  }
  for (const d of b.drops) {
    d.t -= dt;
    if (d.t > 0) continue;
    const obstacle: Obstacle = { lane: d.lane, z: d.z, kind: d.kind, look: 0, hit: false };
    s.blocks.push(obstacle);
    events.push({ type: 'land', obstacle });
  }
  b.drops = b.drops.filter((d) => d.t > 0);
}

export function step(s: RunState, dt: number, input: RunInput = {}): RunEvent[] {
  const events: RunEvent[] = [];
  if (s.result) return events;
  if (input.move) s.lane = Math.max(0, Math.min(LANES - 1, s.lane + input.move));
  if (input.jump && s.air <= 0) {
    s.air = JUMP_TIME;
    events.push({ type: 'jump' });
  }
  if (input.shoot && s.cooldown <= 0) shoot(s, events);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.stumble = Math.max(0, s.stumble - dt);
  s.time = Math.max(0, s.time - dt);
  const from = s.z;
  s.z += speed(s) * dt;
  for (const w of s.walkers) if (!w.fan) w.z -= WALK_SPEED * dt;
  pass(s, events);
  bump(s, from, events);
  s.air = Math.max(0, s.air - dt);
  boss(s, dt, events);
  if (s.z >= s.goal) {
    s.result = 'clear';
    events.push({ type: 'goal' });
  } else if (s.time <= 0) {
    // 時間が尽きるフレームで校門に着いたときはクリアにするため、走らせたあとで決める
    s.result = 'fail';
    events.push({ type: 'timeout' });
  }
  return events;
}

export type Rank = 'S' | 'A' | 'B' | 'C';

export const score = (s: RunState): number => s.followers + Math.floor(s.time) * 20 + s.maxCombo * 10;

export function rank(points: number, best: number): Rank {
  const r = points / best;
  return r >= 0.9 ? 'S' : r >= 0.7 ? 'A' : r >= 0.5 ? 'B' : 'C';
}
