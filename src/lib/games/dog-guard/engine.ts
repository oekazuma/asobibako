import { pushOut, type Seg } from '$lib/segments';

/** 座標は幅 1・高さ WORLD_H の固定の箱で、y は下向き。画面にはこの箱ごと拡大して収める */
export const WORLD_H = 1.4;
export const DOG_R = 0.06;
export const BEE_R = 0.018;
export const LINE = 0.012;
/** 犬のまわりのこの距離には線を引けない（犬ごと線で押しつぶさないため） */
const KEEP_OUT = DOG_R + 0.03;
const MIN_STEP = 0.012;
const ACCEL = 1.6;
const JITTER = 1.2;

export type Point = { x: number; y: number };
/** 線を引けない場所（雲） */
export interface Zone {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export type BeeKind = 'normal' | 'fast' | 'big';

export interface Level {
  dogs: Point[];
  hives: Point[];
  walls: Seg[];
  noDraw: Zone[];
  /** 引ける線の長さ */
  ink: number;
  bees: number;
  speed: number;
  /** 守りきる秒数と、ハチが出そろうまでの秒数 */
  duration: number;
  spawn: number;
  /** 速いハチと大きいハチの割合 */
  fast: number;
  big: number;
  /** 線を引く前に出す、その面のひとこと */
  tip: string;
}

/** ハチの種類ごとの大きさ・速さ・曲がりやすさの倍率 */
export const BEE_LOOK: Record<BeeKind, { r: number; speed: number; accel: number }> = {
  normal: { r: 1, speed: 1, accel: 1 },
  fast: { r: 0.9, speed: 1.45, accel: 1.6 },
  big: { r: 1.7, speed: 0.75, accel: 0.8 }
};

export interface Bee {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: BeeKind;
}

export interface GameState {
  level: Level;
  phase: 'draw' | 'defend' | 'done';
  stroke: Point[];
  /** 固まった線の線分。線は defend の間は変わらないので finishStroke で 1 回だけ作る */
  segs: Seg[];
  ink: number;
  bees: Bee[];
  spawned: number;
  time: number;
  result: 'clear' | 'stung' | null;
}

export type GuardEvent =
  { type: 'spawn' } | { type: 'bump'; x: number; y: number } | { type: 'stung' } | { type: 'clear' };

export function createState(level: Level): GameState {
  return { level, phase: 'draw', stroke: [], segs: [], ink: level.ink, bees: [], spawned: 0, time: 0, result: null };
}

/** そこに線を引いてよいか。犬のすぐまわりと雲の中はだめ */
export function drawable(level: Level, x: number, y: number): boolean {
  if (level.dogs.some((d) => Math.hypot(x - d.x, y - d.y) < KEEP_OUT)) return false;
  return !level.noDraw.some((z) => x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1);
}

/** 線に 1 点足す。引けない場所を通る線や、インクが切れた先は足さない */
export function addPoint(state: GameState, x: number, y: number): boolean {
  if (state.phase !== 'draw' || !drawable(state.level, x, y)) return false;
  const last = state.stroke[state.stroke.length - 1];
  if (!last) {
    state.stroke.push({ x, y });
    return true;
  }
  const d = Math.hypot(x - last.x, y - last.y);
  if (d < MIN_STEP || state.ink <= 0) return false;
  // 指を速く動かすと点が飛ぶので、あいだも引けない場所を通っていないか確かめる
  for (let t = 0.1; t < 1; t += 0.1)
    if (!drawable(state.level, last.x + (x - last.x) * t, last.y + (y - last.y) * t)) return false;
  const t = Math.min(1, state.ink / d);
  state.stroke.push({ x: last.x + (x - last.x) * t, y: last.y + (y - last.y) * t });
  state.ink = Math.max(0, state.ink - d);
  return true;
}

/** 指を離したら線が固まり、ハチが出てくる。短すぎる線は引き直させる */
export function finishStroke(state: GameState): boolean {
  if (state.phase !== 'draw') return false;
  if (state.stroke.length < 2) {
    state.stroke = [];
    return false;
  }
  state.segs = strokeSegs(state);
  state.phase = 'defend';
  return true;
}

function strokeSegs(state: GameState): Seg[] {
  const segs: Seg[] = [];
  for (let i = 1; i < state.stroke.length; i++) {
    const a = state.stroke[i - 1];
    const b = state.stroke[i];
    segs.push([a.x, a.y, b.x, b.y]);
  }
  return segs;
}

function collide(bee: Bee, segs: Seg[], r: number): boolean {
  let bumped = false;
  for (const seg of segs) {
    const out = pushOut(seg, LINE, bee.x, bee.y, r);
    if (!out) continue;
    const nx = out[0] - bee.x;
    const ny = out[1] - bee.y;
    const n = Math.hypot(nx, ny) || 1;
    const dot = (bee.vx * nx + bee.vy * ny) / n;
    if (dot < 0) {
      bee.vx -= (1.6 * dot * nx) / n;
      bee.vy -= (1.6 * dot * ny) / n;
    }
    [bee.x, bee.y] = out;
    bumped = true;
  }
  return bumped;
}

/** 何匹目のハチがどの種類か。割合どおりに、面ごとに毎回同じ並びで混ぜる */
function kindOf(level: Level, i: number): BeeKind {
  const u = (i * 0.6180339 + 0.31) % 1;
  if (u < level.fast) return 'fast';
  if (u < level.fast + level.big) return 'big';
  return 'normal';
}

const nearest = (dogs: Point[], b: Point) =>
  dogs.reduce((best, d) => (Math.hypot(d.x - b.x, d.y - b.y) < Math.hypot(best.x - b.x, best.y - b.y) ? d : best));

export function step(state: GameState, dt: number, rand: () => number = Math.random): GuardEvent[] {
  if (state.phase !== 'defend') return [];
  const events: GuardEvent[] = [];
  const { level } = state;
  state.time += dt;

  const due = Math.min(level.bees, Math.ceil((state.time / level.spawn) * level.bees));
  while (state.spawned < due) {
    const hive = level.hives[state.spawned % level.hives.length];
    const kind = kindOf(level, state.spawned);
    state.bees.push({ x: hive.x, y: hive.y, vx: (rand() - 0.5) * 0.4, vy: (rand() - 0.5) * 0.4, kind });
    state.spawned += 1;
    events.push({ type: 'spawn' });
  }

  for (const bee of state.bees) {
    const look = BEE_LOOK[bee.kind];
    const r = BEE_R * look.r;
    const max = level.speed * look.speed;
    const dog = nearest(level.dogs, bee);
    const dx = dog.x - bee.x;
    const dy = dog.y - bee.y;
    const d = Math.hypot(dx, dy) || 1;
    bee.vx += ((dx / d) * ACCEL * look.accel + (rand() - 0.5) * JITTER) * dt;
    bee.vy += ((dy / d) * ACCEL * look.accel + (rand() - 0.5) * JITTER) * dt;
    const v = Math.hypot(bee.vx, bee.vy);
    if (v > max) {
      bee.vx *= max / v;
      bee.vy *= max / v;
    }
    // 速いハチが細い線をすり抜けないよう、3 回に分けて動かして当てる
    for (let k = 0; k < 3; k++) {
      bee.x += (bee.vx * dt) / 3;
      bee.y += (bee.vy * dt) / 3;
      const hit = collide(bee, state.segs, r);
      collide(bee, level.walls, r);
      if (hit && rand() < 0.04) events.push({ type: 'bump', x: bee.x, y: bee.y });
    }
    bee.x = Math.min(1 - r, Math.max(r, bee.x));
    bee.y = Math.min(WORLD_H - r, Math.max(r, bee.y));
    if (level.dogs.some((g) => Math.hypot(g.x - bee.x, g.y - bee.y) < DOG_R + r)) {
      state.phase = 'done';
      state.result = 'stung';
      return [...events, { type: 'stung' }];
    }
  }

  if (state.time >= level.duration) {
    state.phase = 'done';
    state.result = 'clear';
    events.push({ type: 'clear' });
  }
  return events;
}
