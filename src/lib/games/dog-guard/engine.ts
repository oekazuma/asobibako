import { pushOut, type Seg } from '$lib/segments';

/** 座標は幅 1・高さ WORLD_H の固定の箱で、y は下向き。画面にはこの箱ごと拡大して収める */
export const WORLD_H = 1.4;
export const DOG_R = 0.06;
export const BEE_R = 0.018;
export const LINE = 0.012;
export const DEFEND_S = 8;
/** 犬のまわりのこの距離には線を引けない（犬ごと線で押しつぶさないため） */
const KEEP_OUT = DOG_R + 0.03;
const MIN_STEP = 0.012;
const SPAWN_S = 2;
const ACCEL = 1.6;
const JITTER = 1.2;

export interface Level {
  dog: { x: number; y: number };
  hives: { x: number; y: number }[];
  walls: Seg[];
  /** 引ける線の長さ */
  ink: number;
  bees: number;
  speed: number;
}

export interface Bee {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GameState {
  level: Level;
  phase: 'draw' | 'defend' | 'done';
  stroke: { x: number; y: number }[];
  ink: number;
  bees: Bee[];
  spawned: number;
  time: number;
  result: 'clear' | 'stung' | null;
}

export type GuardEvent =
  { type: 'spawn' } | { type: 'bump'; x: number; y: number } | { type: 'stung' } | { type: 'clear' };

export function createState(level: Level): GameState {
  return { level, phase: 'draw', stroke: [], ink: level.ink, bees: [], spawned: 0, time: 0, result: null };
}

/** 線に 1 点足す。犬に近すぎる点や、インクが切れた先は足さない */
export function addPoint(state: GameState, x: number, y: number): boolean {
  if (state.phase !== 'draw') return false;
  const { dog } = state.level;
  if (Math.hypot(x - dog.x, y - dog.y) < KEEP_OUT) return false;
  const last = state.stroke[state.stroke.length - 1];
  if (!last) {
    state.stroke.push({ x, y });
    return true;
  }
  const d = Math.hypot(x - last.x, y - last.y);
  if (d < MIN_STEP || state.ink <= 0) return false;
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
  state.phase = 'defend';
  return true;
}

export function strokeSegs(state: GameState): Seg[] {
  const segs: Seg[] = [];
  for (let i = 1; i < state.stroke.length; i++) {
    const a = state.stroke[i - 1];
    const b = state.stroke[i];
    segs.push([a.x, a.y, b.x, b.y]);
  }
  return segs;
}

function collide(bee: Bee, segs: Seg[], thick: number): boolean {
  let bumped = false;
  for (const seg of segs) {
    const out = pushOut(seg, thick, bee.x, bee.y, BEE_R);
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

export function step(state: GameState, dt: number, rand: () => number = Math.random): GuardEvent[] {
  if (state.phase !== 'defend') return [];
  const events: GuardEvent[] = [];
  const { level } = state;
  state.time += dt;

  const due = Math.min(level.bees, Math.ceil((state.time / SPAWN_S) * level.bees));
  while (state.spawned < due) {
    const hive = level.hives[state.spawned % level.hives.length];
    state.bees.push({ x: hive.x, y: hive.y, vx: (rand() - 0.5) * 0.4, vy: (rand() - 0.5) * 0.4 });
    state.spawned += 1;
    events.push({ type: 'spawn' });
  }

  const segs = strokeSegs(state);
  const { dog } = level;
  for (const bee of state.bees) {
    const dx = dog.x - bee.x;
    const dy = dog.y - bee.y;
    const d = Math.hypot(dx, dy) || 1;
    bee.vx += ((dx / d) * ACCEL + (rand() - 0.5) * JITTER) * dt;
    bee.vy += ((dy / d) * ACCEL + (rand() - 0.5) * JITTER) * dt;
    const v = Math.hypot(bee.vx, bee.vy);
    if (v > level.speed) {
      bee.vx *= level.speed / v;
      bee.vy *= level.speed / v;
    }
    // 速いハチが細い線をすり抜けないよう、半分ずつ動かして当てる
    for (let k = 0; k < 2; k++) {
      bee.x += (bee.vx * dt) / 2;
      bee.y += (bee.vy * dt) / 2;
      const hit = collide(bee, segs, LINE);
      collide(bee, level.walls, LINE);
      if (hit && rand() < 0.05) events.push({ type: 'bump', x: bee.x, y: bee.y });
    }
    bee.x = Math.min(1 - BEE_R, Math.max(BEE_R, bee.x));
    bee.y = Math.min(WORLD_H - BEE_R, Math.max(BEE_R, bee.y));
    if (Math.hypot(dog.x - bee.x, dog.y - bee.y) < DOG_R + BEE_R) {
      state.phase = 'done';
      state.result = 'stung';
      return [...events, { type: 'stung' }];
    }
  }

  if (state.time >= DEFEND_S) {
    state.phase = 'done';
    state.result = 'clear';
    events.push({ type: 'clear' });
  }
  return events;
}
