import { sideOf, type Player } from './player';

export type Dir = 'up' | 'down' | 'left' | 'right';
export type Gesture = { kind: 'tap' } | { kind: 'hold' } | { kind: 'two' } | { kind: 'swipe'; dir: Dir };

/** これ以上動いたらスワイプ（盤面の幅・高さに対する割合） */
const SWIPE = 0.06;
/** 長押しと認める、動いてよい幅 */
const SLOP = 0.03;
const TAP_MS = 350;
const HOLD_MS = 550;
/** 同じ陣地の 2 本目がこの時間内に置かれたら 2 本指タップ */
const TWO_MS = 200;

interface Touch {
  side: Player;
  x0: number;
  y0: number;
  t0: number;
  /** もう何かのジェスチャとして数えた。以後この指は何も出さない */
  done: boolean;
}

/**
 * 盤面の向き（上下）は、その指の持ち主から見た向きに直す。
 * 向かい側（2）は 180 度回して見ているので、盤面で下へ動けば本人には上（相手の方向）になる
 */
export function viewDir(player: Player, dx: number, dy: number): Dir {
  const s = player === 1 ? 1 : -1;
  if (Math.abs(dx) > Math.abs(dy)) return dx * s > 0 ? 'right' : 'left';
  return dy * s < 0 ? 'up' : 'down';
}

/** 盤面の 0..1 座標で置かれた指を、各プレイヤーのタップ・長押し・2 本指・スワイプに分ける */
export class Gestures {
  readonly #touches = new Map<number, Touch>();
  readonly #emit: (player: Player, gesture: Gesture) => void;

  constructor(emit: (player: Player, gesture: Gesture) => void) {
    this.#emit = emit;
  }

  down(id: number, x: number, y: number, t: number): void {
    const side = sideOf(y);
    for (const other of this.#touches.values()) {
      if (other.side !== side || other.done || t - other.t0 > TWO_MS) continue;
      other.done = true;
      this.#touches.set(id, { side, x0: x, y0: y, t0: t, done: true });
      this.#emit(side, { kind: 'two' });
      return;
    }
    this.#touches.set(id, { side, x0: x, y0: y, t0: t, done: false });
  }

  up(id: number, x: number, y: number, t: number): void {
    const touch = this.#touches.get(id);
    this.#touches.delete(id);
    if (!touch || touch.done) return;
    if (this.#swiped(touch, x, y)) return;
    if (t - touch.t0 < TAP_MS) this.#emit(touch.side, { kind: 'tap' });
  }

  /** 毎フレーム、置いたままの指の今の位置を渡す。スワイプと長押しは離す前に決まる */
  tick(t: number, positions: Map<number, { x: number; y: number }>): void {
    for (const [id, touch] of this.#touches) {
      const at = positions.get(id);
      if (touch.done || !at || this.#swiped(touch, at.x, at.y)) continue;
      if (t - touch.t0 >= HOLD_MS && Math.hypot(at.x - touch.x0, at.y - touch.y0) < SLOP) {
        touch.done = true;
        this.#emit(touch.side, { kind: 'hold' });
      }
    }
  }

  /** いま置かれている指を、以後ジェスチャとして数えない（合図の前から触っていた指など） */
  settle(): void {
    for (const touch of this.#touches.values()) touch.done = true;
  }

  #swiped(touch: Touch, x: number, y: number): boolean {
    const dx = x - touch.x0;
    const dy = y - touch.y0;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return false;
    touch.done = true;
    this.#emit(touch.side, { kind: 'swipe', dir: viewDir(touch.side, dx, dy) });
    return true;
  }
}
