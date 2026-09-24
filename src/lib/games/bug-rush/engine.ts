import { sideOf, type Player } from '$lib/player';

export type BugKind = 'bug' | 'beetle';

/** 座標は盤面の幅・高さに対する 0..1。歩く速さは高さを 1 とした単位 */
export interface Bug {
  id: number;
  kind: BugKind;
  x: number;
  y: number;
  /** 歩く向き（ラジアン） */
  heading: number;
  hp: number;
  /** 相手の陣地へ飛んでいる途中。0..1 の進み具合 */
  flight: { fromX: number; fromY: number; toX: number; toY: number; t: number } | null;
}

export interface GameState {
  aspect: number;
  bugs: Bug[];
  /** 残り秒。0 を過ぎても同数なら延長する */
  timeLeft: number;
  spawnIn: number;
  winner: Player | null;
}

export type BugEvent = { type: 'land'; side: Player; x: number; y: number } | { type: 'end'; winner: Player };
export type TapResult = { type: 'hit' } | { type: 'send'; to: Player } | null;

export const DURATION_S = 30;
export const BUG_R = 0.035;
export const BEETLE_R = 0.055;
export const HP: Record<BugKind, number> = { bug: 1, beetle: 3 };
/** 終わったときの数え方。カブトムシは残ると 3 匹ぶん */
export const WEIGHT: Record<BugKind, number> = { bug: 1, beetle: 3 };

const SPAWN_S = 0.45;
/** 残りがこの秒数を切ると、巣から湧く間隔が縮む（延長中も） */
export const RUSH_S = 10;
const RUSH_SPAWN_S = 0.25;
const MAX_BUGS = 36;
const BEETLE_CHANCE = 0.12;
const WALK_SPEED = 0.07;
const TURN_RATE = 2.5;
const FLIGHT_S = 0.45;
/** 境界線と外周から、虫の半径ぶん内側を歩かせる */
const MARGIN = 0.06;

let nextId = 1;

export function createState(aspect: number): GameState {
  return { aspect, bugs: [], timeLeft: DURATION_S, spawnIn: 0, winner: null };
}

export const radius = (bug: Bug) => (bug.kind === 'beetle' ? BEETLE_R : BUG_R);

/** 陣地の中で虫がいてよい y の範囲 */
function rangeY(side: Player): [number, number] {
  return side === 1 ? [0.5 + MARGIN, 1 - MARGIN] : [MARGIN, 0.5 - MARGIN];
}

function spawn(state: GameState, rand: () => number) {
  const kind: BugKind = rand() < BEETLE_CHANCE ? 'beetle' : 'bug';
  const toward: Player = rand() < 0.5 ? 1 : 2;
  const x = 0.2 + rand() * 0.6;
  const [lo, hi] = rangeY(toward);
  state.bugs.push({
    id: nextId++,
    kind,
    x,
    y: 0.5,
    heading: 0,
    hp: HP[kind],
    // 真ん中の巣から、どちらかの陣地へ跳び出してくる
    flight: { fromX: x, fromY: 0.5, toX: x + (rand() - 0.5) * 0.2, toY: lo + rand() * (hi - lo), t: 0 }
  });
}

export function counts(state: GameState): Record<Player, number> {
  const result: Record<Player, number> = { 1: 0, 2: 0 };
  for (const bug of state.bugs) result[sideOf(bug.flight ? bug.flight.toY : bug.y)] += WEIGHT[bug.kind];
  return result;
}

/**
 * 指を置いた位置にいちばん近い、叩ける虫を探す。
 * 見た目より少し広く当たりを取り、動いている小さな虫でも叩きやすくする
 */
export function bugAt(state: GameState, x: number, y: number): Bug | null {
  let best: Bug | null = null;
  let bestDist = Infinity;
  for (const bug of state.bugs) {
    if (bug.flight) continue;
    const dist = Math.hypot((bug.x - x) * state.aspect, bug.y - y);
    if (dist <= radius(bug) * 1.4 && dist < bestDist) {
      best = bug;
      bestDist = dist;
    }
  }
  return best;
}

/** 叩いた虫を相手の陣地へ飛ばす。カブトムシは何度か叩かないと飛ばない */
export function tap(state: GameState, id: number, rand: () => number = Math.random): TapResult {
  const bug = state.bugs.find((b) => b.id === id);
  if (!bug || bug.flight || state.winner !== null) return null;
  bug.hp -= 1;
  if (bug.hp > 0) return { type: 'hit' };
  const to: Player = sideOf(bug.y) === 1 ? 2 : 1;
  const [lo, hi] = rangeY(to);
  bug.hp = HP[bug.kind];
  bug.flight = { fromX: bug.x, fromY: bug.y, toX: 0.1 + rand() * 0.8, toY: lo + rand() * (hi - lo), t: 0 };
  return { type: 'send', to };
}

export function step(state: GameState, dt: number, rand: () => number = Math.random): BugEvent[] {
  const events: BugEvent[] = [];
  if (state.winner !== null) return events;

  state.spawnIn -= dt;
  if (state.spawnIn <= 0 && state.bugs.length < MAX_BUGS) {
    spawn(state, rand);
    state.spawnIn = state.timeLeft <= RUSH_S ? RUSH_SPAWN_S : SPAWN_S;
  }

  const rx = MARGIN / state.aspect;
  for (const bug of state.bugs) {
    if (bug.flight) {
      const f = bug.flight;
      f.t = Math.min(1, f.t + dt / FLIGHT_S);
      bug.x = f.fromX + (f.toX - f.fromX) * f.t;
      bug.y = f.fromY + (f.toY - f.fromY) * f.t;
      if (f.t >= 1) {
        bug.flight = null;
        events.push({ type: 'land', side: sideOf(bug.y), x: bug.x, y: bug.y });
      }
      continue;
    }
    // ふらふら向きを変えながら歩き、自分のいる陣地の中にとどまる
    bug.heading += (rand() - 0.5) * TURN_RATE * dt * 2;
    const [lo, hi] = rangeY(sideOf(bug.y));
    const speed = WALK_SPEED * (bug.kind === 'beetle' ? 0.6 : 1);
    let x = bug.x + (Math.cos(bug.heading) * speed * dt) / state.aspect;
    let y = bug.y + Math.sin(bug.heading) * speed * dt;
    if (x < rx || x > 1 - rx) {
      bug.heading = Math.PI - bug.heading;
      x = Math.min(1 - rx, Math.max(rx, x));
    }
    if (y < lo || y > hi) {
      bug.heading = -bug.heading;
      y = Math.min(hi, Math.max(lo, y));
    }
    bug.x = x;
    bug.y = y;
  }

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    const c = counts(state);
    // 同じ数なら、差がつくまで続ける
    if (c[1] !== c[2]) {
      state.winner = c[1] < c[2] ? 1 : 2;
      events.push({ type: 'end', winner: state.winner });
    }
  }
  return events;
}
