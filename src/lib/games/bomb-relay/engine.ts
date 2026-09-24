import { sideOf, type Player } from '$lib/player';

/**
 * 座標は x が盤面の幅、y が高さに対する 0..1。
 * 距離と速さは高さを 1 とした単位で揃え、横長・縦長どちらの画面でも同じ手触りにする
 */
export interface Bomb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  fuse: number;
  heldBy: Player | null;
}

export interface GameState {
  /** 盤面の幅 / 高さ。当たり判定と左右の壁を見た目のピクセルに合わせるために使う */
  aspect: number;
  meters: Record<Player, number>;
  bomb: Bomb | null;
  respawnIn: number;
  /** 次の爆弾が落ちていく側 */
  nextSide: Player;
  winner: Player | null;
}

/** boom の lost は、吹き飛んだメーターの量（0..1） */
export type StepEvent =
  { type: 'boom'; side: Player; x: number; y: number; lost: number } | { type: 'win'; player: Player };

export const BOMB_R = 0.055;
export const CATCH_R = 0.1;
export const FUSE_MIN = 3.5;
export const FUSE_MAX = 9;

/**
 * 熱いほど速くたまる。危ない爆弾ほど持っていたくなるのがこのゲームの誘惑。
 * いちばん長い導火線の爆弾を爆発まで持っても満タンに届かない速さにし、持ち続けるだけで勝てないようにする
 */
const FILL_BASE = 0.045;
const FILL_HOT = 2;
const FRICTION = 3;
const MAX_SPEED = 5;
const SIDE_BOUNCE = 0.6;
/** 奥の壁は強く吸収する。強く投げすぎると跳ね返って自陣に戻るが、戻りすぎはしない */
const END_BOUNCE = 0.25;
const RESPAWN_S = 1.2;
/** 陣地の中ほど（端から 1/4 くらい）で止まる強さ。端に寄るほど、はじく指が OS の画面端ジェスチャーとぶつかりやすい */
const DROP_SPEED = 0.7;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 爆弾の「生きてきた長さ」。2 人が同じように見られる唯一の危険度の手がかり */
export const heat = (bomb: Bomb) => Math.min(1, bomb.age / FUSE_MAX);

export function createState(aspect: number, rand: () => number = Math.random): GameState {
  const state: GameState = {
    aspect,
    meters: { 1: 0, 2: 0 },
    bomb: null,
    respawnIn: 0,
    nextSide: rand() < 0.5 ? 1 : 2,
    winner: null
  };
  spawn(state, rand);
  return state;
}

function spawn(state: GameState, rand: () => number) {
  const down = state.nextSide === 1;
  state.bomb = {
    x: 0.5,
    y: down ? 0.52 : 0.48,
    vx: (rand() - 0.5) * 0.3,
    vy: down ? DROP_SPEED : -DROP_SPEED,
    age: 0,
    fuse: FUSE_MIN + rand() * (FUSE_MAX - FUSE_MIN),
    heldBy: null
  };
}

/** 自分の陣地にある爆弾に指が触れていればつかむ。飛んでくる途中でも受け止められる */
export function tryCatch(state: GameState, player: Player, fx: number, fy: number): boolean {
  const bomb = state.bomb;
  if (!bomb || bomb.heldBy !== null || state.winner !== null) return false;
  if (sideOf(bomb.y) !== player) return false;
  const dx = (fx - bomb.x) * state.aspect;
  const dy = fy - bomb.y;
  if (dx * dx + dy * dy > CATCH_R * CATCH_R) return false;
  bomb.heldBy = player;
  bomb.vx = 0;
  bomb.vy = 0;
  return true;
}

/** 持ったまま相手の陣地へは運べない。渡すには投げるしかない */
export function moveHeld(state: GameState, fx: number, fy: number): void {
  const bomb = state.bomb;
  if (!bomb || bomb.heldBy === null) return;
  const rx = BOMB_R / state.aspect;
  bomb.x = clamp(fx, rx, 1 - rx);
  bomb.y = bomb.heldBy === 1 ? clamp(fy, 0.5 + BOMB_R, 1 - BOMB_R) : clamp(fy, BOMB_R, 0.5 - BOMB_R);
}

/** 離した指の速さで投げる。戻り値は投げた速さ */
export function throwBomb(state: GameState, vx: number, vy: number): number {
  const bomb = state.bomb;
  if (!bomb || bomb.heldBy === null) return 0;
  bomb.heldBy = null;
  const speed = Math.hypot(vx * state.aspect, vy);
  const k = speed > MAX_SPEED ? MAX_SPEED / speed : 1;
  bomb.vx = vx * k;
  bomb.vy = vy * k;
  return Math.min(speed, MAX_SPEED);
}

export function step(state: GameState, dt: number, rand: () => number = Math.random): StepEvent | null {
  if (state.winner !== null) return null;

  const bomb = state.bomb;
  if (!bomb) {
    state.respawnIn -= dt;
    if (state.respawnIn <= 0) spawn(state, rand);
    return null;
  }

  bomb.age += dt;
  if (bomb.age >= bomb.fuse) {
    const side = sideOf(bomb.y);
    const lost = state.meters[side] * 0.5;
    state.meters[side] -= lost;
    state.bomb = null;
    state.respawnIn = RESPAWN_S;
    // 同じ側へ落とすと、爆発まで持ち続けた人が次の爆弾も独り占めできてしまう
    state.nextSide = side === 1 ? 2 : 1;
    return { type: 'boom', side, x: bomb.x, y: bomb.y, lost };
  }

  if (bomb.heldBy !== null) {
    const player = bomb.heldBy;
    state.meters[player] = Math.min(1, state.meters[player] + FILL_BASE * (1 + FILL_HOT * heat(bomb)) * dt);
    if (state.meters[player] < 1) return null;
    state.winner = player;
    return { type: 'win', player };
  }

  bomb.x += bomb.vx * dt;
  bomb.y += bomb.vy * dt;
  const decay = Math.exp(-FRICTION * dt);
  bomb.vx *= decay;
  bomb.vy *= decay;

  const rx = BOMB_R / state.aspect;
  if (bomb.x < rx || bomb.x > 1 - rx) {
    bomb.x = clamp(bomb.x, rx, 1 - rx);
    bomb.vx = -bomb.vx * SIDE_BOUNCE;
  }
  if (bomb.y < BOMB_R || bomb.y > 1 - BOMB_R) {
    bomb.y = clamp(bomb.y, BOMB_R, 1 - BOMB_R);
    bomb.vy = -bomb.vy * END_BOUNCE;
  }
  return null;
}
