import { difficulty, lerp, Rng } from '$lib/levels';
import meta from './meta';

/**
 * 道は横 0..1、前へ進んだ距離は盤面の高さを 1 とした単位。
 * 群れは自動で前へ進み、1 人 1 人が自分の真上へ撃つ。プレイヤーは左右だけ動かす
 */
export type Reward = { kind: 'power' } | { kind: 'add'; n: number };

/**
 * gate は道の半分にかかる門で、撃たれた弾の数だけ n が上がり（-10 も撃ち続ければ + になる）、くぐると n 人増える。
 * enemy は隊列で、近づくと歩いてきて群れのほうへ寄る。hp は残りの人数（撃たれて端数になる）。
 * barrel は撃ち壊すとごほうびが出て、壊せずに通り過ぎると何も起きない
 */
export type Item =
  | { type: 'gate'; at: number; x0: number; x1: number; n: number; heat: number; done: boolean }
  | { type: 'enemy'; at: number; x: number; hp: number; done: boolean }
  | { type: 'barrel'; at: number; x: number; hp: number; max: number; reward: Reward; done: boolean };

export interface Shot {
  x: number;
  /** 弾が届く先。当たる相手がなければ撃てる距離の端 */
  at: number;
}

export interface GameState {
  dist: number;
  x: number;
  count: number;
  /** 1 人が 1 秒に撃つ弾の数。樽で上がる */
  power: number;
  items: Item[];
  /** 道の終わり。ここで止まって最後の隊列を迎え撃つ */
  length: number;
  /** 列ごとの弾の行き先。弾の絵を描くためだけに使う */
  shots: Shot[];
  /** 敵とぶつかっている間は止まって、双方が同じ数ずつ減っていく */
  fight: { item: Extract<Item, { type: 'enemy' }>; per: number; tick: number } | null;
  result: 'clear' | 'fail' | null;
}

export type RunEvent =
  | { type: 'gate'; n: number; x: number }
  | { type: 'bump'; x: number; at: number }
  | { type: 'kill'; x: number; at: number }
  | { type: 'loot'; reward: Reward; x: number; at: number }
  | { type: 'hit'; n: number }
  | { type: 'clear' }
  | { type: 'fail' };

export const SPEED = 0.5;
export const MIN_X = 0.1;
export const MAX_X = 0.9;
/** 撃てる距離 */
export const RANGE = 3;
/** 敵が歩きはじめる距離。遠くからは歩かせず、面の並びを時間で崩さない */
const WAKE = 3.5;
const WALK = 0.3;
const CHASE = 0.15;
/** ぶつかったとみなす距離 */
const CONTACT = 0.12;
const FIGHT_TICK = 0.03;
const FIGHT_STEPS = 30;
/** 群れの幅を、この数の列に分けて撃つ */
export const COLS = 12;
/** 撃つのはこの人数まで。増えすぎた群れで門が際限なく上がらないようにする */
const SHOOTERS = 120;
export const BARREL_R = 0.09;
/** 描く人数の上限。群れの広がりもこの人数で頭打ちにする */
export const MAX_DOTS = 140;

/** 群れの横の半幅。人数の平方根で広がる */
export const crowdHalf = (n: number) => 0.026 * Math.sqrt(Math.min(n, MAX_DOTS));
/** 群れは道からはみ出さないよう、真ん中を内側へ寄せる */
export const crowdCenter = (x: number, n: number) => {
  const h = crowdHalf(n);
  return Math.min(1 - h - 0.02, Math.max(h + 0.02, x));
};
export const enemyCount = (hp: number) => Math.ceil(hp - 1e-9);
export const enemyHalf = (hp: number) => Math.max(0.05, crowdHalf(hp));
/** 群れ全体が 1 秒に撃つ弾の数 */
export const fire = (state: GameState) => state.power * Math.min(state.count, SHOOTERS);
/** 残っている敵の人数。0 になればクリア */
export const foes = (state: GameState) =>
  state.items.reduce((sum, item) => sum + (item.type === 'enemy' && !item.done ? enemyCount(item.hp) : 0), 0);

function span(item: Item): [number, number] {
  if (item.type === 'gate') return [item.x0, item.x1];
  const r = item.type === 'barrel' ? BARREL_R : enemyHalf(item.hp);
  return [item.x - r, item.x + r];
}

/** 群れの列の位置。端の列ほど群れの端に寄る */
export function columns(state: GameState): number[] {
  const c = crowdCenter(state.x, state.count);
  const h = Math.max(0.03, crowdHalf(state.count));
  return Array.from({ length: COLS }, (_, i) => c - h + ((i + 0.5) / COLS) * 2 * h);
}

function hit(state: GameState, item: Item, bullets: number, events: RunEvent[]) {
  if (item.type === 'gate') {
    item.heat += bullets;
    while (item.heat >= 1) {
      item.heat -= 1;
      item.n += 1;
      events.push({ type: 'bump', x: (item.x0 + item.x1) / 2, at: item.at });
    }
  } else if (item.type === 'enemy') {
    const before = enemyCount(item.hp);
    item.hp = Math.max(0, item.hp - bullets);
    if (enemyCount(item.hp) < before) events.push({ type: 'kill', x: item.x, at: item.at });
    if (item.hp <= 0) {
      item.done = true;
      if (state.fight?.item === item) state.fight = null;
    }
  } else {
    item.hp -= bullets;
    if (item.hp > 0) return;
    item.done = true;
    if (item.reward.kind === 'power') state.power += 0.5;
    else state.count += item.reward.n;
    events.push({ type: 'loot', reward: item.reward, x: item.x, at: item.at });
  }
}

function shoot(state: GameState, dt: number, events: RunEvent[]) {
  const near = state.items
    .filter((item) => !item.done && item.at - state.dist >= -CONTACT && item.at - state.dist <= RANGE)
    .sort((a, b) => a.at - b.at);
  const bullets = (fire(state) * dt) / COLS;
  state.shots = columns(state).map((x) => {
    const item = near.find((it) => !it.done && span(it)[0] <= x && x <= span(it)[1]);
    if (!item) return { x, at: state.dist + RANGE };
    hit(state, item, bullets, events);
    return { x, at: item.at };
  });
}

function fight(state: GameState, dt: number, events: RunEvent[]) {
  const f = state.fight!;
  f.tick += dt;
  while (f.tick >= FIGHT_TICK && f.item.hp > 0 && state.count > 0) {
    f.tick -= FIGHT_TICK;
    const n = Math.min(f.per, enemyCount(f.item.hp), state.count);
    f.item.hp = Math.max(0, f.item.hp - n);
    state.count -= n;
    events.push({ type: 'hit', n });
  }
  if (f.item.hp <= 0) {
    f.item.done = true;
    state.fight = null;
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
      if (state.fight || item.at - state.dist > WAKE) continue;
      item.at -= WALK * dt;
      item.x += Math.sign(c - item.x) * Math.min(Math.abs(c - item.x), CHASE * dt);
      if (item.at - state.dist <= CONTACT)
        state.fight = { item, per: Math.max(1, Math.ceil(item.hp / FIGHT_STEPS)), tick: 0 };
    } else if (item.at <= state.dist) {
      item.done = true;
      // 2 つの門のあいだのすき間に立っていても、真ん中より右なら右の門をくぐる
      if (item.type === 'gate' && item.x0 < 0.5 === c < 0.5) {
        state.count = Math.max(0, state.count + item.n);
        events.push({ type: 'gate', n: item.n, x: (item.x0 + item.x1) / 2 });
      }
    }
  }
  if (state.count <= 0) {
    state.result = 'fail';
    events.push({ type: 'fail' });
  } else if (foes(state) === 0) {
    state.result = 'clear';
    events.push({ type: 'clear' });
  }
  return events;
}

/**
 * 次の門の列では数の大きいほうへ（立った側が撃たれて上がるのはどちらでも同じ）、樽の列では最初の樽へ寄る。
 * 面がクリアできるかを確かめるのに使う
 */
export function autopilot(state: GameState): number {
  let next: Item | null = null;
  for (const item of state.items)
    if (!item.done && item.type !== 'enemy' && item.at > state.dist && (!next || item.at < next.at)) next = item;
  if (!next) return 0.5;
  if (next.type === 'barrel') return next.x;
  const at = next.at;
  const row = state.items.filter((item) => item.type === 'gate' && item.at === at) as Extract<Item, { type: 'gate' }>[];
  const pick = row.reduce((a, b) => (a.n >= b.n ? a : b));
  return (pick.x0 + pick.x1) / 2;
}

export function autoplay(state: GameState): GameState['result'] {
  for (let t = 0; t < 240 && !state.result; t += 1 / 30) {
    steer(state, autopilot(state));
    step(state, 1 / 30);
  }
  return state.result;
}

/**
 * 1 面は、門の列・樽の列・敵の隊列を順にくり返し、最後に大きな隊列を置く。
 * 敵の大きさは、門ごとに多いほうを選んだときの人数の見込みを scale 倍して決める
 */
function course(level: number, scale: number): GameState {
  const d = difficulty(level, meta.levels);
  const rng = new Rng(level);
  const items: Item[] = [];
  let best = 1;
  const rows = Math.round(lerp(5, 12, d));
  const gap = lerp(1.3, 1.0, d);
  // 門は届いてからくぐるまで撃たれるので、そのあいだに上がる分を見込む
  const exposure = (RANGE / SPEED) * 0.3;
  let at = 1.2;
  for (let i = 0; i < rows; i++) {
    const kind = i % 3 === 0 || (i % 3 === 1 && level < 2) ? 'gate' : i % 3 === 1 ? 'barrel' : 'enemy';
    if (kind === 'gate') {
      const good = Math.max(2, Math.round(best * lerp(0.6, 0.3, d) * rng.range(0.7, 1.3)));
      // 最初の 2 面は、どちらをくぐっても増える門だけにする
      const bad = level <= 2 ? good : -Math.max(2, Math.round(best * lerp(0.3, 1.5, d) * rng.range(0.7, 1.3)));
      const [l, r] = rng.chance(0.5) ? [good, bad] : [bad, good];
      items.push({ type: 'gate', at, x0: 0.02, x1: 0.49, n: l, heat: 0, done: false });
      items.push({ type: 'gate', at, x0: 0.51, x1: 0.98, n: r, heat: 0, done: false });
      best = best + good + Math.min(best, SHOOTERS) * exposure;
    } else if (kind === 'barrel') {
      const k = rng.int(2, 3);
      for (let j = 0; j < k; j++) {
        const hp = Math.max(3, Math.round(Math.min(best, SHOOTERS) * lerp(1, 3, d) * rng.range(0.6, 1.4)));
        const reward: Reward = rng.chance(0.35)
          ? { kind: 'power' }
          : { kind: 'add', n: Math.max(1, Math.round(hp / 3)) };
        const x = (j + 0.5) / k + rng.range(-0.05, 0.05);
        items.push({ type: 'barrel', at: at + rng.range(-0.15, 0.15), x, hp, max: hp, reward, done: false });
      }
    } else {
      const hp = Math.max(2, Math.round(best * lerp(0.4, 0.8, d) * scale));
      items.push({ type: 'enemy', at, x: rng.range(0.3, 0.7), hp, done: false });
    }
    at += gap;
  }
  const length = at;
  const wave = Math.max(5, Math.round(best * lerp(0.8, 1.6, d) * scale));
  items.push({ type: 'enemy', at: length + 1.5, x: 0.5, hp: wave, done: false });
  return { dist: 0, x: 0.5, count: 1, power: 1, items, length, shots: [], fight: null, result: null };
}

const clears = (level: number, scale: number) => autoplay(course(level, scale)) === 'clear';

/**
 * autoplay がクリアできるいちばん強い scale を探し、面が進むほど余白を削ったものを使う。
 * どの面も必ずクリアでき、序盤はゆとりがあり、終盤はぎりぎりになる
 */
export function createState(level: number): GameState {
  let [lo, hi] = [0, 1];
  while (hi < 64 && clears(level, hi)) [lo, hi] = [hi, hi * 2];
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (clears(level, mid)) lo = mid;
    else hi = mid;
  }
  return course(level, lo * lerp(0.65, 0.97, difficulty(level, meta.levels)));
}
