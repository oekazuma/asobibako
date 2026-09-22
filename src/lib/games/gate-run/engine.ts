import { difficulty, lerp, Rng } from '$lib/levels';

/**
 * 道は横 0..1、前へ進んだ距離は盤面の高さを 1 とした単位。
 * 群れは自動で前へ進み、プレイヤーは左右だけ動かす
 */
export type Op = { kind: '+' | '-' | 'x' | '÷'; n: number };

export type Item =
  | { type: 'gates'; at: number; left: Op; right: Op; done: boolean }
  | { type: 'enemy'; at: number; x: number; n: number; done: boolean };

export interface GameState {
  dist: number;
  x: number;
  count: number;
  items: Item[];
  length: number;
  boss: number;
  /** 敵とぶつかっている間は止まって、双方が同じ数ずつ減っていく */
  fight: { n: number; per: number; tick: number; boss: boolean; item: Item | null } | null;
  result: 'clear' | 'fail' | null;
}

export type RunEvent =
  | { type: 'gate'; good: boolean; op: Op; x: number }
  | { type: 'hit'; n: number }
  | { type: 'clear' }
  | { type: 'fail' };

export const SPEED = 0.5;
export const MIN_X = 0.14;
export const MAX_X = 0.86;
const FIGHT_TICK = 0.03;
/** 敵の群れは、この数の打ち合いで決着がつくように 1 回の減り方を決める */
const FIGHT_STEPS = 30;

export function apply(op: Op, count: number): number {
  if (op.kind === '+') return count + op.n;
  if (op.kind === '-') return Math.max(0, count - op.n);
  if (op.kind === 'x') return count * op.n;
  return Math.floor(count / op.n);
}

export const isGood = (op: Op) => op.kind === '+' || op.kind === 'x';

/** 難しくなるほど ×3 が減り、+ の門も小さくなる */
function goodOp(rng: Rng, d: number): Op {
  if (rng.chance(0.3)) return { kind: 'x', n: rng.chance(lerp(0.3, 0.05, d)) ? 3 : 2 };
  return { kind: '+', n: 5 * rng.int(1, Math.round(lerp(6, 3, d))) };
}

/** 難しくなるほど、減らす門の数も大きくなる */
function badOp(rng: Rng, d: number): Op {
  return rng.chance(0.4)
    ? { kind: '÷', n: rng.chance(d * 0.5) ? 3 : 2 }
    : { kind: '-', n: 5 * rng.int(1, Math.round(lerp(3, 8, d))) };
}

/**
 * 門はどれも「数が多いほど結果も多い」ので、門ごとに多いほうを選ぶのが最善になる。
 * その最善の数から敵とボスの数を決め、どの面も必ずクリアできるようにする
 */
export function createState(level: number): GameState {
  const d = difficulty(level);
  const rng = new Rng(level);
  const items: Item[] = [];
  let best = 10;
  // 難しくなるほど、コースが長く、敵の群れが多く、門どうしの間がつまる
  const rows = Math.round(lerp(6, 22, d));
  const every = d < 0.5 ? 3 : 2;
  const gap = lerp(1.3, 1.0, d);
  let at = 1.6;
  for (let i = 0; i < rows; i++) {
    if (i % every === every - 1) {
      const n = Math.max(3, Math.round(best * lerp(0.12, 0.4, d)));
      items.push({ type: 'enemy', at, x: rng.range(0.3, 0.7), n, done: false });
      best -= n;
    } else {
      const a = goodOp(rng, d);
      // 最初の 2 面は、どちらをくぐっても増える門だけにする
      const b = level <= 2 || rng.chance(lerp(0.5, 0.1, d)) ? goodOp(rng, d) : badOp(rng, d);
      const [left, right] = rng.chance(0.5) ? [a, b] : [b, a];
      items.push({ type: 'gates', at, left, right, done: false });
      best = Math.max(apply(left, best), apply(right, best));
    }
    at += gap;
  }
  return {
    dist: 0,
    x: 0.5,
    count: 10,
    items,
    length: at + 0.4,
    boss: Math.max(5, Math.round(best * lerp(0.3, 0.9, d))),
    fight: null,
    result: null
  };
}

export function steer(state: GameState, x: number): void {
  state.x = Math.min(MAX_X, Math.max(MIN_X, x));
}

function startFight(state: GameState, n: number, item: Item | null) {
  state.fight = { n, per: Math.max(1, Math.ceil(n / FIGHT_STEPS)), tick: 0, boss: item === null, item };
}

export function step(state: GameState, dt: number): RunEvent[] {
  if (state.result) return [];
  const events: RunEvent[] = [];
  const fight = state.fight;
  if (fight) {
    fight.tick += dt;
    while (fight.tick >= FIGHT_TICK && fight.n > 0 && state.count > 0) {
      fight.tick -= FIGHT_TICK;
      const hit = Math.min(fight.per, fight.n, state.count);
      fight.n -= hit;
      state.count -= hit;
      events.push({ type: 'hit', n: hit });
    }
    if (fight.boss) state.boss = fight.n;
    if (state.count <= 0) {
      state.result = 'fail';
      events.push({ type: 'fail' });
    } else if (fight.n <= 0) {
      state.fight = null;
      if (fight.boss) {
        state.result = 'clear';
        events.push({ type: 'clear' });
      }
    }
    return events;
  }

  state.dist += SPEED * dt;
  for (const item of state.items) {
    if (item.done || item.at > state.dist) continue;
    item.done = true;
    if (item.type === 'gates') {
      const op = state.x < 0.5 ? item.left : item.right;
      state.count = apply(op, state.count);
      events.push({ type: 'gate', good: isGood(op), op, x: state.x < 0.5 ? 0.25 : 0.75 });
      if (state.count <= 0) {
        state.result = 'fail';
        events.push({ type: 'fail' });
        return events;
      }
    } else {
      startFight(state, item.n, item);
      return events;
    }
  }
  if (state.dist >= state.length) {
    state.dist = state.length;
    startFight(state, state.boss, null);
  }
  return events;
}
