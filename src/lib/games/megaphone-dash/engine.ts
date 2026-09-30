import { course, halfAt, rule, zoneAt, type Block, type LevelRule, type Zone } from './course';

/** コンボなしの速さ（m/s）。コンボで最大 2 倍まで上がる */
export const BASE_SPEED = 6;
export const MAX_BOOST = 1;
/** このコンボで速さが上限に届く */
export const FULL_COMBO = 40;
/** 走る子が横へ動く速さの上限（m/s） */
export const SIDE_SPEED = 11;
/** メガホンが鳴る間隔（秒）。鳴るたびに前の扇形の中の人をまとめてファンにする */
export const PULSE = 0.16;
/** 扇形の奥行きと、手前・奥での半分の幅（m） */
export const REACH = 9;
export const NEAR_W = 0.7;
export const FAR_W = 2.4;
/** 最後に当ててからこの秒数たつとコンボが切れる */
export const COMBO_TIME = 2.2;
/** 大声のゲージの満タン */
export const GAUGE = 40;
/** 大声が届く奥行き（m）と、そのあと障害物をすり抜ける秒数 */
export const SHOUT_REACH = 32;
export const SHOUT_GUARD = 1.5;
export const STUMBLE_TIME = 0.7;
export const STUMBLE_SLOW = 0.35;
/** 障害物の前後の厚みと、走る子の体の半分の幅（m） */
export const DEPTH = 0.5;
export const BODY = 0.3;

export interface Walker {
  x: number;
  z: number;
  look: number;
  fan: boolean;
  /** ファンになった順。後ろを走る列の並びに使う */
  order: number;
  /** ふらふら歩く向きの位相 */
  phase: number;
}

export interface Obstacle extends Block {
  hit: boolean;
}

export interface RunState {
  level: number;
  rule: LevelRule;
  z: number;
  x: number;
  /** 指が示している横の位置 */
  target: number;
  combo: number;
  maxCombo: number;
  /** 最後に当ててからの秒 */
  since: number;
  followers: number;
  fans: number;
  gauge: number;
  /** 大声のあとの、障害物をすり抜ける残りの秒 */
  guard: number;
  stumble: number;
  pulse: number;
  time: number;
  zone: Zone;
  walkers: Walker[];
  blocks: Obstacle[];
  result: 'clear' | 'fail' | null;
}

export interface RunInput {
  /** 指の横の位置（m）。指が離れていれば null で、その場をまっすぐ走る */
  target?: number | null;
  shout?: boolean;
}

export type RunEvent =
  | { type: 'pulse'; x: number }
  | { type: 'hit'; walkers: Walker[]; gain: number; combo: number }
  | { type: 'bump'; obstacle: Obstacle }
  | { type: 'shout'; walkers: Walker[]; blocks: Obstacle[]; gain: number }
  | { type: 'gauge' }
  | { type: 'drop'; combo: number }
  | { type: 'zone'; zone: Zone }
  | { type: 'goal' }
  | { type: 'timeout' };

export const boost = (combo: number): number => Math.min(1, combo / FULL_COMBO) * MAX_BOOST;

export const speed = (s: RunState): number => BASE_SPEED * (1 + boost(s.combo)) * (s.stumble > 0 ? STUMBLE_SLOW : 1);

export function createState(level: number): RunState {
  const r = rule(level);
  const c = course(level);
  return {
    level,
    rule: r,
    z: 0,
    x: 0,
    target: 0,
    combo: 0,
    maxCombo: 0,
    since: 0,
    followers: 0,
    fans: 0,
    gauge: 0,
    guard: 0,
    stumble: 0,
    pulse: 0,
    time: r.time,
    zone: zoneAt(0),
    walkers: c.people.map((p, i) => ({ ...p, fan: false, order: 0, phase: i * 1.7 })),
    blocks: c.blocks.map((b) => ({ ...b, hit: false })),
    result: null
  };
}

/** 扇形の中にいるか。奥ほど広い */
export function inCone(s: RunState, w: Walker): boolean {
  const d = w.z - s.z;
  if (d < -0.3 || d > REACH) return false;
  const half = NEAR_W + (FAR_W - NEAR_W) * Math.max(0, d / REACH);
  return Math.abs(w.x - s.x) <= half;
}

function convert(s: RunState, list: Walker[]): number {
  let gain = 0;
  for (const w of list) {
    w.fan = true;
    w.order = s.fans++;
    s.combo += 1;
    // コンボが伸びるほど 1 人の値打ちが上がり、まとめて巻きこむほど大きな数字になる
    gain += 10 + s.combo;
  }
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.followers += gain;
  s.since = 0;
  return gain;
}

function blast(s: RunState, events: RunEvent[]) {
  events.push({ type: 'pulse', x: s.x });
  const caught = s.walkers.filter((w) => !w.fan && inCone(s, w));
  if (!caught.length) return;
  const before = s.gauge;
  const gain = convert(s, caught);
  s.gauge = Math.min(GAUGE, s.gauge + caught.length);
  events.push({ type: 'hit', walkers: caught, gain, combo: s.combo });
  if (before < GAUGE && s.gauge >= GAUGE) events.push({ type: 'gauge' });
}

function shout(s: RunState, events: RunEvent[]) {
  s.gauge = 0;
  s.guard = SHOUT_GUARD;
  const walkers = s.walkers.filter((w) => !w.fan && w.z >= s.z - 0.5 && w.z - s.z <= SHOUT_REACH);
  const blocks = s.blocks.filter((o) => !o.hit && o.z >= s.z - 0.5 && o.z - s.z <= SHOUT_REACH);
  for (const o of blocks) o.hit = true;
  const gain = convert(s, walkers);
  events.push({ type: 'shout', walkers, blocks, gain });
}

function bump(s: RunState, from: number, events: RunEvent[]) {
  if (s.guard > 0) return;
  for (const o of s.blocks) {
    if (o.hit || o.z < from - DEPTH || o.z > s.z + DEPTH) continue;
    if (Math.abs(o.x - s.x) > o.w / 2 + BODY) continue;
    o.hit = true;
    s.stumble = STUMBLE_TIME;
    if (s.combo > 0) events.push({ type: 'drop', combo: s.combo });
    s.combo = 0;
    events.push({ type: 'bump', obstacle: o });
  }
}

export function step(s: RunState, dt: number, input: RunInput = {}): RunEvent[] {
  const events: RunEvent[] = [];
  if (s.result) return events;
  if (input.target != null) s.target = input.target;
  const half = halfAt(s.z);
  const goal = Math.max(-half + BODY, Math.min(half - BODY, s.target));
  const dx = goal - s.x;
  s.x += Math.sign(dx) * Math.min(Math.abs(dx), SIDE_SPEED * dt);
  if (input.shout && s.gauge >= GAUGE) shout(s, events);
  s.time = Math.max(0, s.time - dt);
  s.stumble = Math.max(0, s.stumble - dt);
  s.guard = Math.max(0, s.guard - dt);
  s.since += dt;
  if (s.combo > 0 && s.since > COMBO_TIME) {
    events.push({ type: 'drop', combo: s.combo });
    s.combo = 0;
  }
  const from = s.z;
  s.z += speed(s) * dt;
  for (const w of s.walkers) {
    if (w.fan) continue;
    // 群れはその場でゆらゆらしながら、少しずつこちらへ歩いてくる
    w.phase += dt;
    w.z -= 0.6 * dt;
    w.x += Math.sin(w.phase * 1.3) * 0.25 * dt;
  }
  s.pulse -= dt;
  if (s.pulse <= 0) {
    s.pulse += PULSE;
    blast(s, events);
  }
  bump(s, from, events);
  const zone = zoneAt(s.z);
  if (zone !== s.zone) {
    s.zone = zone;
    events.push({ type: 'zone', zone });
  }
  if (s.z >= s.rule.length) {
    s.result = 'clear';
    events.push({ type: 'goal' });
  } else if (s.time <= 0) {
    s.result = 'fail';
    events.push({ type: 'timeout' });
  }
  return events;
}

export type Rank = 'S' | 'A' | 'B' | 'C';

/** 点はフォロワーと残り秒。ファンを集めながら速く着くほど高い */
export const score = (s: RunState): number => s.followers + Math.floor(s.time) * 30 + s.maxCombo * 10;

/** ランクは、その面の人数を全員ファンにしたときの点に対する割合で決める */
export function rank(s: RunState): Rank {
  const n = s.walkers.length;
  const ideal = n * 10 + (n * (n + 1)) / 2 + n * 10;
  const r = score(s) / ideal;
  return r >= 0.85 ? 'S' : r >= 0.6 ? 'A' : r >= 0.35 ? 'B' : 'C';
}
