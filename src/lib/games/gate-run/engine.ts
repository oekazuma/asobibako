import { difficulty, lerp, Rng } from '$lib/levels';
import meta from './meta';

/**
 * 道は横 0..1、前へ進んだ距離は盤面の高さを 1 とした単位。
 * 群れは自動で前へ進みながら、立っている列の前へ撃ち続ける。プレイヤーは左右だけ動かす
 */
export type Op = { kind: 'add' | 'mul'; n: number };

export type Reward = { kind: 'power' } | { kind: 'add'; n: number };

/**
 * add の門は撃つたびに数が 1 ずつ増え、-10 も撃ち続ければ + に変わる。mul の門は撃っても変わらず、弾は素通りする。
 * 敵は近づくと歩いてきて群れのほうへ寄る。hp は残りの人数（撃たれて端数になる）。
 * 樽は撃ち壊すとごほうびが出て、壊せずに通り過ぎると何も起きない
 */
export type Item =
  | { type: 'gates'; at: number; left: Op; right: Op; heat: [number, number]; done: boolean }
  | { type: 'enemy'; at: number; x: number; hp: number; boss: boolean; done: boolean }
  | { type: 'barrel'; at: number; x: number; hp: number; max: number; reward: Reward; done: boolean };

export interface GameState {
  dist: number;
  x: number;
  count: number;
  /** 1 人あたりの連射の強さ。樽で上がる */
  power: number;
  items: Item[];
  /** 道の終わり。ここで止まってボスを迎え撃つ */
  length: number;
  /** いま撃っている相手。弾の絵を描くためだけに使う */
  aim: Item | null;
  /** 敵とぶつかっている間は止まって、双方が同じ数ずつ減っていく */
  fight: { item: Extract<Item, { type: 'enemy' }>; per: number; tick: number } | null;
  result: 'clear' | 'fail' | null;
}

export type RunEvent =
  | { type: 'gate'; good: boolean; op: Op; x: number }
  | { type: 'bump'; x: number; at: number }
  | { type: 'kill'; x: number; at: number; boss: boolean }
  | { type: 'loot'; reward: Reward; x: number; at: number }
  | { type: 'hit'; n: number }
  | { type: 'clear' }
  | { type: 'fail' };

export const SPEED = 0.5;
export const MIN_X = 0.14;
export const MAX_X = 0.86;
/** 撃てる距離 */
export const RANGE = 2.4;
/** 敵が歩きはじめる距離。遠くからは歩かせず、面の並びを時間で崩さない */
const WAKE = 3.2;
const WALK = 0.3;
const BOSS_WALK = 0.12;
const CHASE = 0.18;
const BOSS_GAP = 2.2;
/** ぶつかったとみなす距離 */
const CONTACT = 0.12;
const FIGHT_TICK = 0.03;
const FIGHT_STEPS = 30;
/** 1 秒に倒せる敵の数は FIRE × power × √人数 */
const FIRE = 1;
/** 敵 1 人を倒す弾で、門の数がいくつ上がるか */
const GATE_RATE = 0.8;
export const BARREL_R = 0.08;
/** 描く人数の上限。群れの広がりもこの人数で頭打ちにする */
export const MAX_DOTS = 140;

/** 群れの横の半幅。人数の平方根で広がる */
export const crowdHalf = (n: number) => 0.026 * Math.sqrt(Math.min(n, MAX_DOTS));
/** 群れは道からはみ出さないよう、真ん中を内側へ寄せる */
export const crowdCenter = (x: number, n: number) => {
  const h = crowdHalf(n);
  return Math.min(1 - h - 0.02, Math.max(h + 0.02, x));
};

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) > Math.max(a0, b0);

export function apply(op: Op, count: number): number {
  return op.kind === 'mul' ? count * op.n : Math.max(0, count + op.n);
}

export const isGood = (op: Op) => op.kind === 'mul' || op.n >= 0;
export const enemyCount = (hp: number) => Math.ceil(hp - 1e-9);
export const dps = (state: GameState) => FIRE * state.power * Math.sqrt(state.count);
const side = (x: number): 0 | 1 => (x < 0.5 ? 0 : 1);

/** 群れの前の列で、いちばん手前の撃てる相手 */
export function aimAt(state: GameState): Item | null {
  const c = crowdCenter(state.x, state.count);
  const h = Math.max(0.05, crowdHalf(state.count));
  let best: Item | null = null;
  for (const item of state.items) {
    const ahead = item.at - state.dist;
    if (item.done || ahead < -CONTACT || ahead > RANGE || (best && item.at >= best.at)) continue;
    if (item.type === 'gates') {
      if ((side(state.x) ? item.right : item.left).kind === 'mul') continue;
    } else {
      const r = item.type === 'barrel' ? BARREL_R : Math.max(0.05, crowdHalf(item.hp));
      if (!overlap(c - h, c + h, item.x - r, item.x + r)) continue;
    }
    best = item;
  }
  return best;
}

function shoot(state: GameState, dt: number, events: RunEvent[]) {
  const item = (state.aim = aimAt(state));
  if (!item) return;
  const dmg = dps(state) * dt;
  if (item.type === 'gates') {
    const s = side(state.x);
    const op = s ? item.right : item.left;
    item.heat[s] += dmg * GATE_RATE;
    while (item.heat[s] >= 1) {
      item.heat[s] -= 1;
      op.n += 1;
      events.push({ type: 'bump', x: s ? 0.75 : 0.25, at: item.at });
    }
  } else if (item.type === 'enemy') {
    const before = enemyCount(item.hp);
    item.hp = Math.max(0, item.hp - dmg);
    if (enemyCount(item.hp) < before) events.push({ type: 'kill', x: item.x, at: item.at, boss: item.boss });
  } else {
    item.hp -= dmg;
    if (item.hp <= 0) {
      item.done = true;
      if (item.reward.kind === 'power') state.power += 0.5;
      else state.count += item.reward.n;
      events.push({ type: 'loot', reward: item.reward, x: item.x, at: item.at });
    }
  }
}

function fight(state: GameState, dt: number, events: RunEvent[]) {
  const f = state.fight!;
  f.tick += dt;
  while (f.tick >= FIGHT_TICK && f.item.hp > 0 && state.count > 0) {
    f.tick -= FIGHT_TICK;
    const hit = Math.min(f.per, enemyCount(f.item.hp), state.count);
    f.item.hp = Math.max(0, f.item.hp - hit);
    state.count -= hit;
    events.push({ type: 'hit', n: hit });
  }
}

export function steer(state: GameState, x: number): void {
  state.x = Math.min(MAX_X, Math.max(MIN_X, x));
}

export function step(state: GameState, dt: number): RunEvent[] {
  if (state.result) return [];
  const events: RunEvent[] = [];
  shoot(state, dt, events);
  if (state.fight) fight(state, dt, events);
  else state.dist = Math.min(state.length, state.dist + SPEED * dt);

  const c = crowdCenter(state.x, state.count);
  for (const item of state.items) {
    if (item.done) continue;
    if (item.type === 'enemy') {
      if (item.hp <= 0) {
        item.done = true;
        if (state.fight?.item === item) state.fight = null;
        if (item.boss) {
          state.result = 'clear';
          events.push({ type: 'clear' });
          return events;
        }
        continue;
      }
      if (state.fight || item.at - state.dist > WAKE) continue;
      item.at -= (item.boss ? BOSS_WALK : WALK) * dt;
      if (!item.boss) item.x += Math.sign(c - item.x) * Math.min(Math.abs(c - item.x), CHASE * dt);
      if (item.at - state.dist <= CONTACT) {
        state.fight = { item, per: Math.max(1, Math.ceil(item.hp / FIGHT_STEPS)), tick: 0 };
      }
    } else if (item.at <= state.dist) {
      item.done = true;
      if (item.type === 'gates') {
        const op = side(state.x) ? item.right : item.left;
        state.count = apply(op, state.count);
        events.push({ type: 'gate', good: isGood(op), op, x: side(state.x) ? 0.75 : 0.25 });
      }
    }
  }
  if (state.count <= 0) {
    state.result = 'fail';
    events.push({ type: 'fail' });
  }
  return events;
}

/** 次の門は、着くまでに撃って上がる分も見込んで多くなるほうへ、樽は撃ちに寄る。面がクリアできるかを確かめるのに使う */
export function autopilot(state: GameState): number {
  const next = state.items.find((item) => !item.done && item.type !== 'enemy' && item.at > state.dist);
  if (next?.type === 'barrel') return next.x;
  if (next?.type !== 'gates') return 0.5;
  const shots = (dps(state) * GATE_RATE * (next.at - state.dist)) / SPEED;
  const gain = (op: Op) => apply(op.kind === 'add' ? { kind: 'add', n: op.n + shots } : op, state.count);
  return gain(next.left) >= gain(next.right) ? 0.25 : 0.75;
}

export function autoplay(state: GameState): GameState['result'] {
  for (let t = 0; t < 240 && !state.result; t += 1 / 30) {
    steer(state, autopilot(state));
    step(state, 1 / 30);
  }
  return state.result;
}

/** 難しくなるほど ×3 が減り、+ の門も小さくなる */
function goodOp(rng: Rng, d: number): Op {
  if (rng.chance(0.35)) return { kind: 'mul', n: rng.chance(lerp(0.3, 0.05, d)) ? 3 : 2 };
  return { kind: 'add', n: 5 * rng.int(1, Math.round(lerp(4, 2, d))) };
}

/** 赤い門。撃てば上がるので、難しくなるほど深くする */
const badOp = (rng: Rng, d: number): Op => ({ kind: 'add', n: -5 * rng.int(1, Math.round(lerp(3, 10, d))) });

/**
 * 敵と樽の強さは、門ごとに多いほうを選んだときの人数を目安に決め、scale 倍する。
 * createState は autoplay がクリアできるいちばん大きな scale（1 まで）を選び、どの面も必ずクリアできるようにする
 */
function course(level: number, scale: number): GameState {
  const d = difficulty(level, meta.levels);
  const rng = new Rng(level);
  const items: Item[] = [];
  let best = 10;
  const rows = Math.round(lerp(6, 14, d));
  const foe = lerp(1 / 3, 1 / 2, d);
  const isEnemy = (i: number) => Math.floor((i + 1) * foe) > Math.floor(i * foe);
  const barrels = level < 2 ? 0 : Math.round(lerp(1, 5, d));
  const barrelAfter = (i: number) => Math.floor(((i + 1) * barrels) / rows) > Math.floor((i * barrels) / rows);
  const gap = lerp(1.4, 1.1, d);
  let at = 1.6;
  for (let i = 0; i < rows; i++) {
    if (isEnemy(i)) {
      const n = Math.max(3, Math.round(best * lerp(0.3, 0.7, d) * scale));
      items.push({ type: 'enemy', at, x: rng.range(0.25, 0.75), hp: n, boss: false, done: false });
    } else {
      const a = goodOp(rng, d);
      // 最初の 2 面は、どちらをくぐっても増える門だけにする
      const b = level <= 2 ? goodOp(rng, d) : badOp(rng, d);
      const [left, right] = rng.chance(0.5) ? [a, b] : [b, a];
      items.push({ type: 'gates', at, left, right, heat: [0, 0], done: false });
      best = Math.max(apply(left, best), apply(right, best));
    }
    at += gap;
    if (!barrelAfter(i)) continue;
    const reward: Reward = rng.chance(0.5) ? { kind: 'power' } : { kind: 'add', n: 5 * rng.int(2, 6) };
    const hp = Math.round(lerp(10, 40, d));
    items.push({ type: 'barrel', at, x: rng.range(0.2, 0.8), hp, max: hp, reward, done: false });
    at += gap * 0.8;
  }
  const length = at;
  const boss = Math.max(5, Math.round(best * lerp(0.8, 2, d) * scale));
  items.push({ type: 'enemy', at: length + BOSS_GAP, x: 0.5, hp: boss, boss: true, done: false });
  return { dist: 0, x: 0.5, count: 10, power: 1, items, length, aim: null, fight: null, result: null };
}

export function createState(level: number): GameState {
  if (autoplay(course(level, 1)) === 'clear') return course(level, 1);
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (autoplay(course(level, mid)) === 'clear') lo = mid;
    else hi = mid;
  }
  return course(level, lo);
}
