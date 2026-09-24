import { difficulty, lerp, Rng } from '$lib/levels';
import meta from './meta';

/**
 * 道は横 0..1、前へ進んだ距離は盤面の高さを 1 とした単位。
 * 群れは自動で前へ進み、プレイヤーは左右だけ動かす
 */
export type Op = { kind: '+' | '-' | 'x' | '÷'; n: number };

/**
 * saw は道を左右に往復する回転ノコギリ。位置は時間ではなく進んだ距離で決め、敵と戦って止まっている間は止まる。
 * wall はすき間のあるトゲの柵、ally は道に立っていて触れると仲間になる人たち
 */
export type Item =
  | { type: 'gates'; at: number; left: Op; right: Op; done: boolean }
  | { type: 'enemy'; at: number; x: number; n: number; done: boolean }
  | { type: 'saw'; at: number; x: number; amp: number; freq: number; done: boolean }
  | { type: 'wall'; at: number; gap: number; width: number; done: boolean }
  | { type: 'ally'; at: number; x: number; n: number; done: boolean };

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
  | { type: 'cut'; n: number; x: number }
  | { type: 'join'; n: number; x: number }
  | { type: 'hit'; n: number }
  | { type: 'clear' }
  | { type: 'fail' };

export const SPEED = 0.5;
export const MIN_X = 0.14;
export const MAX_X = 0.86;
const FIGHT_TICK = 0.03;
/** 敵の群れは、この数の打ち合いで決着がつくように 1 回の減り方を決める */
const FIGHT_STEPS = 30;
export const SAW_R = 0.09;
export const ALLY_R = 0.07;
/** 描く人数の上限。群れの広がりもこの人数で頭打ちにする */
export const MAX_DOTS = 140;

/** 群れの横の半幅。人数の平方根で広がる */
export const crowdHalf = (n: number) => 0.026 * Math.sqrt(Math.min(n, MAX_DOTS));
/** 群れは道からはみ出さないよう、真ん中を内側へ寄せる */
export const crowdCenter = (x: number, n: number) => {
  const h = crowdHalf(n);
  return Math.min(1 - h - 0.02, Math.max(h + 0.02, x));
};
export const sawX = (item: { x: number; amp: number; freq: number }, dist: number) =>
  item.x + item.amp * Math.sin(dist * item.freq);

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** 群れが x にいるとき、ノコギリか柵で減る人数。触れた幅の割合だけ減る */
export function cutBy(item: Item, x: number, count: number): number {
  const h = crowdHalf(count);
  const c = crowdCenter(x, count);
  if (h === 0) return 0;
  let frac = 0;
  if (item.type === 'saw') {
    const sx = sawX(item, item.at);
    frac = overlap(c - h, c + h, sx - SAW_R, sx + SAW_R) / (2 * h);
  } else if (item.type === 'wall') {
    frac = 1 - overlap(c - h, c + h, item.gap - item.width / 2, item.gap + item.width / 2) / (2 * h);
  }
  return Math.min(count, Math.max(0, Math.ceil(count * frac - 1e-9)));
}

/** 群れが x にいるとき、道の仲間に触れて増える人数 */
export function joinBy(item: Item, x: number, count: number): number {
  if (item.type !== 'ally') return 0;
  const h = crowdHalf(count);
  const c = crowdCenter(x, count);
  return overlap(c - h, c + h, item.x - ALLY_R, item.x + ALLY_R) > 0 ? item.n : 0;
}

/** 障害物や仲間のところで、いちばん得をする立ち位置 */
export function bestX(item: Item, count: number): number {
  let best = 0.5;
  let score = -Infinity;
  for (let x = MIN_X; x <= MAX_X + 1e-9; x += 0.01) {
    const v = joinBy(item, x, count) - cutBy(item, x, count) - Math.abs(x - 0.5) * 1e-3;
    if (v > score) [best, score] = [x, v];
  }
  return best;
}

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
  const d = difficulty(level, meta.levels);
  const rng = new Rng(level);
  const items: Item[] = [];
  let best = 10;
  // 難しくなるほど、コースが長く、敵の群れが多く、門どうしの間がつまる
  const rows = Math.round(lerp(6, 22, d));
  const foe = lerp(1 / 3, 1 / 2, d);
  const isEnemy = (i: number) => Math.floor((i + 1) * foe) > Math.floor(i * foe);
  const gateRows = rows - Array.from({ length: rows }, (_, i) => i).filter(isEnemy).length;
  // 片方が赤い列は青を選ぶだけで済むので、×2 と +N を比べる列を面ごとに決まった数だけ混ぜる
  const tough = Math.round(lerp(1, 3, d));
  // 門と敵のあいだに、道の仲間・ノコギリ・柵を面が進むほど多く挟む。種類は面ごとに少しずつ解禁する
  const extras = Math.round(lerp(0, 9, d));
  const kinds: ('ally' | 'saw' | 'wall')[] = ['ally'];
  if (level >= 4) kinds.push('saw');
  if (level >= 9) kinds.push('wall');
  const extraAfter = (i: number) => Math.floor(((i + 1) * extras) / rows) > Math.floor((i * extras) / rows);
  let g = -1;
  const gap = lerp(1.3, 1.0, d);
  let at = 1.6;
  for (let i = 0; i < rows; i++) {
    if (isEnemy(i)) {
      const n = Math.max(3, Math.round(best * lerp(0.12, 0.4, d)));
      items.push({ type: 'enemy', at, x: rng.range(0.3, 0.7), n, done: false });
      best -= n;
    } else {
      g++;
      const hard = level > 2 && Math.floor(((g + 1) * tough) / gateRows) > Math.floor((g * tough) / gateRows);
      const a: Op = hard ? { kind: 'x', n: 2 } : goodOp(rng, d);
      // 最初の 2 面は、どちらをくぐっても増える門だけにする
      const b: Op = hard ? { kind: '+', n: 5 * rng.int(2, 6) } : level <= 2 ? goodOp(rng, d) : badOp(rng, d);
      const [left, right] = rng.chance(0.5) ? [a, b] : [b, a];
      items.push({ type: 'gates', at, left, right, done: false });
      best = Math.max(apply(left, best), apply(right, best));
    }
    at += gap;
    if (level < 2 || !extraAfter(i)) continue;
    const kind = rng.pick(kinds);
    const extra: Item =
      kind === 'ally'
        ? { type: 'ally', at, x: rng.range(0.2, 0.8), n: 5 * rng.int(1, 4), done: false }
        : kind === 'saw'
          ? { type: 'saw', at, x: rng.range(0.35, 0.65), amp: lerp(0.12, 0.28, d), freq: rng.range(3, 6), done: false }
          : { type: 'wall', at, gap: rng.range(0.3, 0.7), width: lerp(0.5, 0.32, d), done: false };
    items.push(extra);
    const x = bestX(extra, best);
    best += joinBy(extra, x, best) - cutBy(extra, x, best);
    at += gap * 0.8;
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
    } else if (item.type === 'enemy') {
      startFight(state, item.n, item);
      return events;
    } else {
      const x = crowdCenter(state.x, state.count);
      const cut = cutBy(item, state.x, state.count);
      const join = joinBy(item, state.x, state.count);
      state.count += join - cut;
      if (cut > 0) events.push({ type: 'cut', n: cut, x });
      if (join > 0) events.push({ type: 'join', n: join, x });
    }
    if (state.count <= 0) {
      state.result = 'fail';
      events.push({ type: 'fail' });
      return events;
    }
  }
  if (state.dist >= state.length) {
    state.dist = state.length;
    startFight(state, state.boss, null);
  }
  return events;
}
