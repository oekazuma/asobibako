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

export type RunEvent = { type: 'gate'; good: boolean } | { type: 'hit' } | { type: 'clear' } | { type: 'fail' };

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

/** 決まった乱数の列（面ごとに同じコースにする） */
export function seeded(seed: number): () => number {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function goodOp(rand: () => number, level: number): Op {
  if (rand() < 0.3) return { kind: 'x', n: rand() < 0.2 + level * 0.02 ? 3 : 2 };
  return { kind: '+', n: 5 * (1 + Math.floor(rand() * (4 + level))) };
}

function badOp(rand: () => number): Op {
  return rand() < 0.4 ? { kind: '÷', n: 2 } : { kind: '-', n: 5 * (1 + Math.floor(rand() * 4)) };
}

/**
 * 門はどれも「数が多いほど結果も多い」ので、門ごとに多いほうを選ぶのが最善になる。
 * その最善の数から敵とボスの数を決め、どの面も必ずクリアできるようにする
 */
export function createState(level: number): GameState {
  const rand = seeded(level);
  const items: Item[] = [];
  let best = 10;
  const rows = 6 + Math.min(10, level);
  let at = 1.6;
  for (let i = 0; i < rows; i++) {
    if (i % 3 === 2) {
      const n = Math.max(3, Math.round(best * (0.12 + Math.min(0.3, level * 0.03))));
      items.push({ type: 'enemy', at, x: 0.3 + rand() * 0.4, n, done: false });
      best -= n;
    } else {
      const a = goodOp(rand, level);
      // 最初の 2 面は、どちらをくぐっても増える門だけにする
      const b = level <= 2 || rand() < 0.35 ? goodOp(rand, level) : badOp(rand);
      const [left, right] = rand() < 0.5 ? [a, b] : [b, a];
      items.push({ type: 'gates', at, left, right, done: false });
      best = Math.max(apply(left, best), apply(right, best));
    }
    at += 1.3;
  }
  return {
    dist: 0,
    x: 0.5,
    count: 10,
    items,
    length: at + 0.4,
    boss: Math.max(5, Math.round(best * (0.3 + Math.min(0.5, level * 0.05)))),
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
      events.push({ type: 'hit' });
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
      events.push({ type: 'gate', good: isGood(op) });
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
