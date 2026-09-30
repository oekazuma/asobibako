import { Rng } from '$lib/levels';
import { course, halfAt, rule, zoneAt, type LevelRule, type Zone } from './course';

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
export const NEAR_W = 0.45;
export const FAR_W = 1.1;
/** 最後に当ててからこの秒数たつとコンボが切れる */
export const COMBO_TIME = 2.2;
/** 大声のゲージの満タン */
export const GAUGE = 60;
/** 大声が届く奥行き（m）と、そのあと障害物をすり抜ける秒数 */
export const SHOUT_REACH = 32;
export const SHOUT_GUARD = 1.5;
export const STUMBLE_TIME = 0.7;
export const STUMBLE_SLOW = 0.35;
/** 障害物の前後の厚みと、走る子の体の半分の幅（m） */
export const DEPTH = 0.5;
export const BODY = 0.3;
/** ボスは走る子のこの距離（m）先に浮かび、一緒に進む */
export const BOSS_AHEAD = 14;
/** ボスの正面とみなす横のずれ（m）。この中にいればメガホンが当たる */
export const BOSS_HIT_W = 0.9;
/** 大声がボスに与える体力の減り */
export const SHOUT_DAMAGE = 15;
/** ふまん玉が落ちる何秒前から印を出すか、落ちたときの走る子からの距離（m） */
export const WARN_TIME = 1.2;
export const DROP_AHEAD = 11;
/** ボスを倒したあと、教室の入り口までの距離（m） */
export const GATE_AFTER = 30;

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

/** ボスの投げたふまん玉が落ちて、道に残ったもの */
export interface Obstacle {
  x: number;
  z: number;
  /** 横の幅（m） */
  w: number;
  hit: boolean;
}

export interface Drop {
  x: number;
  z: number;
  /** 落ちるまでの秒 */
  t: number;
}

export interface Boss {
  hp: number;
  max: number;
  x: number;
  /** 向かっている横の位置 */
  to: number;
  moveIn: number;
  throwIn: number;
  drops: Drop[];
  phase: 'wait' | 'fight' | 'gone';
}

export interface RunState {
  level: number;
  rule: LevelRule;
  /** ボスの動き（動く先・投げる場所）に使う、面ごとに決まった乱数 */
  rng: Rng;
  boss: Boss | null;
  /** ゴールの距離。ボスの面は倒すまで Infinity */
  goal: number;
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
  | { type: 'boss-in' }
  | { type: 'boss-hit'; damage: number; big: boolean }
  | { type: 'boss-down' }
  | { type: 'throw'; drop: Drop }
  | { type: 'land'; obstacle: Obstacle }
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
    rng: new Rng(Math.round(level) * 7919 + 1),
    boss: r.boss
      ? {
          hp: r.boss.hp,
          max: r.boss.hp,
          x: 0,
          to: 0,
          moveIn: r.boss.moveEvery,
          throwIn: r.boss.throwEvery,
          drops: [],
          phase: 'wait'
        }
      : null,
    goal: r.boss ? Infinity : r.length,
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
    blocks: [],
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

function hurt(s: RunState, b: Boss, damage: number, big: boolean, events: RunEvent[]) {
  b.hp = Math.max(0, b.hp - damage);
  events.push({ type: 'boss-hit', damage, big });
  if (b.hp > 0) return;
  b.phase = 'gone';
  b.drops = [];
  s.goal = s.z + GATE_AFTER;
  events.push({ type: 'boss-down' });
}

function blast(s: RunState, events: RunEvent[]) {
  events.push({ type: 'pulse', x: s.x });
  const b = s.boss;
  if (b?.phase === 'fight' && Math.abs(b.x - s.x) <= BOSS_HIT_W) {
    // ボスに当てるとコンボとゲージも伸びる。速く走っているほど強く当たる
    s.combo += 1;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.since = 0;
    s.followers += 5;
    const before = s.gauge;
    s.gauge = Math.min(GAUGE, s.gauge + 1);
    if (before < GAUGE && s.gauge >= GAUGE) events.push({ type: 'gauge' });
    hurt(s, b, 1 + boost(s.combo), false, events);
  }
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
  const b = s.boss;
  if (b?.phase === 'fight') {
    b.drops = [];
    hurt(s, b, SHOUT_DAMAGE, true, events);
  }
}

function boss(s: RunState, dt: number, events: RunEvent[]) {
  const b = s.boss;
  const r = s.rule.boss;
  if (!b || !r || b.phase === 'gone') return;
  if (b.phase === 'wait') {
    if (s.z < s.rule.bossAt) return;
    b.phase = 'fight';
    b.x = b.to = s.x;
    events.push({ type: 'boss-in' });
    return;
  }
  const half = halfAt(s.z) - 0.4;
  b.moveIn -= dt;
  if (b.moveIn <= 0) {
    b.moveIn += r.moveEvery;
    b.to = -half + s.rng.next() * half * 2;
  }
  b.x += Math.sign(b.to - b.x) * Math.min(Math.abs(b.to - b.x), 2.6 * dt);
  b.throwIn -= dt;
  if (b.throwIn <= 0) {
    b.throwIn += r.throwEvery;
    // ボスの真下か走る子のいる側へ、落ちるころに DROP_AHEAD 先になる場所へ投げる
    const x = s.rng.next() < 0.5 ? b.x : s.x;
    const drop: Drop = { x, z: s.z + DROP_AHEAD + speed(s) * WARN_TIME, t: WARN_TIME };
    b.drops.push(drop);
    events.push({ type: 'throw', drop });
  }
  for (const d of b.drops) {
    d.t -= dt;
    if (d.t > 0) continue;
    const obstacle: Obstacle = { x: d.x, z: d.z, w: 0.9, hit: false };
    s.blocks.push(obstacle);
    events.push({ type: 'land', obstacle });
  }
  b.drops = b.drops.filter((d) => d.t > 0);
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
  // 目標に近づくほどゆっくり寄せる。一定の速さで寄ると、止まる瞬間に指より行きすぎたように見える
  const vx = Math.min(SIDE_SPEED, Math.abs(dx) * 12);
  s.x += Math.sign(dx) * Math.min(Math.abs(dx), vx * dt);
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
  boss(s, dt, events);
  const zone = zoneAt(s.z);
  if (zone !== s.zone) {
    s.zone = zone;
    events.push({ type: 'zone', zone });
  }
  if (s.z >= s.goal) {
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

/**
 * ランクは、その面の通行人の何割をファンにできたかで決める。
 * 点はコンボの長さで大きく揺れるので、ランクには使わない。ボットで、群れを追えば 9 割を超え、まっすぐ走るだけだと 3 割ほど
 */
export function rank(s: RunState): Rank {
  const r = s.fans / Math.max(1, s.walkers.length);
  return r >= 0.97 ? 'S' : r >= 0.88 ? 'A' : r >= 0.65 ? 'B' : 'C';
}
