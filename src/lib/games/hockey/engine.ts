import type { Player } from '$lib/player';

/**
 * 座標は x が盤面の幅、y が高さに対する 0..1。
 * 距離と速さは高さを 1 とした単位に揃え、縦長・横長どちらでも同じ手触りにする
 */
export interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Mallet {
  /** 動かしている指の pointerId */
  id: number;
  player: Player;
  x: number;
  y: number;
  /** 前のフレームの位置。1 フレームを細かく分けて当たり判定するときに、マレットの軌跡を補間する */
  px: number;
  py: number;
  vx: number;
  vy: number;
}

export interface Finger {
  id: number;
  side: Player;
  x: number;
  y: number;
}

export interface GameState {
  aspect: number;
  puck: Puck;
  mallets: Mallet[];
  scores: Record<Player, number>;
  /** 得点のあと、次のパックが動き出すまでの残り秒 */
  pause: number;
  winner: Player | null;
}

export type HockeyEvent =
  | { type: 'hit'; speed: number }
  | { type: 'wall' }
  | { type: 'goal'; scorer: Player }
  | { type: 'win'; player: Player };

export const GOAL = 5;
export const PUCK_R = 0.035;
export const MALLET_R = 0.055;
/** ゴールの口の幅（盤面の幅に対する割合） */
export const GOAL_W = 0.4;
/** 1 人が使えるマレットの数。先に置いた指だけがマレットになり、ほかの指は無視する */
export const MALLETS_PER_PLAYER = 1;

const MAX_SPEED = 2.8;
const MAX_MALLET_SPEED = 6;
const FRICTION = 0.25;
const WALL_BOUNCE = 0.9;
const HIT_BOUNCE = 0.9;
const PAUSE_S = 0.9;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createState(aspect: number, serveTo: Player = 1): GameState {
  const state: GameState = {
    aspect,
    puck: { x: 0.5, y: 0.5, vx: 0, vy: 0 },
    mallets: [],
    scores: { 1: 0, 2: 0 },
    pause: 0,
    winner: null
  };
  serve(state, serveTo);
  state.pause = 0;
  return state;
}

/** 失点した側の陣地の真ん中にパックを置く。取り返す番はそちらに回す */
function serve(state: GameState, to: Player) {
  state.puck = { x: 0.5, y: to === 1 ? 0.75 : 0.25, vx: 0, vy: 0 };
  state.pause = PAUSE_S;
}

/** マレットは自分の陣地から出られない */
export function clampMallet(state: GameState, player: Player, x: number, y: number): [number, number] {
  const rx = MALLET_R / state.aspect;
  const cx = clamp(x, rx, 1 - rx);
  const cy = player === 1 ? clamp(y, 0.5 + MALLET_R, 1 - MALLET_R) : clamp(y, MALLET_R, 0.5 - MALLET_R);
  return [cx, cy];
}

/**
 * 盤面に置かれている指からマレットを作り直す。各プレイヤーの先に置いた指だけを使い、
 * その指を離せば、同じ陣地に残っている次の指がマレットになる。
 * 速さは前のフレームからの移動で出す
 */
export function updateMallets(state: GameState, fingers: Iterable<Finger>, dt: number): void {
  const previous = new Map(state.mallets.map((m) => [m.id, m]));
  const counts: Record<Player, number> = { 1: 0, 2: 0 };
  const next: Mallet[] = [];
  for (const finger of fingers) {
    if (counts[finger.side] >= MALLETS_PER_PLAYER) continue;
    counts[finger.side] += 1;
    const [x, y] = clampMallet(state, finger.side, finger.x, finger.y);
    const before = previous.get(finger.id);
    const px = before?.x ?? x;
    const py = before?.y ?? y;
    let vx = dt > 0 ? (x - px) / dt : 0;
    let vy = dt > 0 ? (y - py) / dt : 0;
    const speed = Math.hypot(vx * state.aspect, vy);
    if (speed > MAX_MALLET_SPEED) {
      vx *= MAX_MALLET_SPEED / speed;
      vy *= MAX_MALLET_SPEED / speed;
    }
    next.push({ id: finger.id, player: finger.side, x, y, px, py, vx, vy });
  }
  state.mallets = next;
}

function collide(state: GameState, mx: number, my: number, mallet: Mallet): number {
  const puck = state.puck;
  const dx = (puck.x - mx) * state.aspect;
  const dy = puck.y - my;
  const dist = Math.hypot(dx, dy);
  const reach = PUCK_R + MALLET_R;
  if (dist >= reach) return 0;
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : mallet.player === 1 ? -1 : 1;
  // 重なったぶんだけ押し出す
  puck.x = mx + (nx * reach) / state.aspect;
  puck.y = my + ny * reach;
  // マレットは質量無限大として、法線方向の相対速度だけ跳ね返す
  const rvx = (puck.vx - mallet.vx) * state.aspect;
  const rvy = puck.vy - mallet.vy;
  const along = rvx * nx + rvy * ny;
  if (along >= 0) return 0;
  puck.vx -= ((1 + HIT_BOUNCE) * along * nx) / state.aspect;
  puck.vy -= (1 + HIT_BOUNCE) * along * ny;
  return -along;
}

function capSpeed(state: GameState) {
  const puck = state.puck;
  const speed = Math.hypot(puck.vx * state.aspect, puck.vy);
  if (speed <= MAX_SPEED) return;
  puck.vx *= MAX_SPEED / speed;
  puck.vy *= MAX_SPEED / speed;
}

export function step(state: GameState, dt: number): HockeyEvent[] {
  const events: HockeyEvent[] = [];
  if (state.winner !== null) return events;
  if (state.pause > 0) {
    state.pause = Math.max(0, state.pause - dt);
    return events;
  }

  const puck = state.puck;
  const travel = Math.hypot(puck.vx * state.aspect, puck.vy) * dt;
  const swing = Math.max(0, ...state.mallets.map((m) => Math.hypot((m.x - m.px) * state.aspect, m.y - m.py)));
  // 速いパックや速く振ったマレットがすり抜けないよう、動く量に応じて 1 フレームを分ける
  const n = clamp(Math.ceil((travel + swing) / (PUCK_R * 0.5)), 1, 16);
  const h = dt / n;
  const rx = PUCK_R / state.aspect;
  const mouth = GOAL_W / 2;

  for (let i = 1; i <= n; i++) {
    puck.x += puck.vx * h;
    puck.y += puck.vy * h;

    // マレットが押し出した位置を、このあとの壁の処理で盤の中へ戻す
    const t = i / n;
    for (const mallet of state.mallets) {
      const hit = collide(
        state,
        mallet.px + (mallet.x - mallet.px) * t,
        mallet.py + (mallet.y - mallet.py) * t,
        mallet
      );
      if (hit > 0) events.push({ type: 'hit', speed: hit });
    }
    capSpeed(state);

    if (puck.x < rx || puck.x > 1 - rx) {
      puck.x = clamp(puck.x, rx, 1 - rx);
      puck.vx = -puck.vx * WALL_BOUNCE;
      events.push({ type: 'wall' });
    }

    const inMouth = Math.abs(puck.x - 0.5) < mouth;
    if (inMouth && (puck.y < -PUCK_R || puck.y > 1 + PUCK_R)) {
      const scorer: Player = puck.y < 0 ? 1 : 2;
      state.scores[scorer] += 1;
      events.push({ type: 'goal', scorer });
      if (state.scores[scorer] >= GOAL) {
        state.winner = scorer;
        events.push({ type: 'win', player: scorer });
      } else {
        serve(state, scorer === 1 ? 2 : 1);
      }
      return events;
    }
    if (!inMouth && (puck.y < PUCK_R || puck.y > 1 - PUCK_R)) {
      puck.y = clamp(puck.y, PUCK_R, 1 - PUCK_R);
      puck.vy = -puck.vy * WALL_BOUNCE;
      events.push({ type: 'wall' });
    }

  }

  const decay = Math.exp(-FRICTION * dt);
  puck.vx *= decay;
  puck.vy *= decay;
  return events;
}
