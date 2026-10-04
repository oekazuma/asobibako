import type { GearKey } from './gear';

/** ready はハンドルを待つ、spin は 1 回転、drop はカプセルが転がる、wait は押すのを待つ、open は割れる、show は品を見せる */
export type Phase = 'ready' | 'spin' | 'drop' | 'wait' | 'open' | 'show' | 'done';

export interface Show {
  phase: Phase;
  t: number;
  angle: number;
  gear: GearKey;
  guard: number;
}

export const TURN = Math.PI * 1.5;
export const SPIN = 0.8;
export const DROP = 0.9;
export const OPEN = 0.6;
/** 押してから次の押しを受けるまでの秒。押した指を離した合成 click で 2 段進まないように */
export const GUARD = 0.35;

export const makeShow = (gear: GearKey): Show => ({ phase: 'ready', t: 0, angle: 0, gear, guard: 0 });

const go = (s: Show, phase: Phase) => {
  s.phase = phase;
  s.t = 0;
};

/** 逆に回すと戻るだけ（0 より下へは戻らない）。4 分の 3 回ったら残りは機械が回す */
export function turn(s: Show, d: number): void {
  if (s.phase !== 'ready') return;
  s.angle = Math.max(0, s.angle + d);
  if (s.angle >= TURN) go(s, 'spin');
}

export function tick(s: Show, dt: number): void {
  s.t += dt;
  s.guard = Math.max(0, s.guard - dt);
  if (s.phase === 'spin') s.angle = TURN + (Math.PI * 2 - TURN) * Math.min(1, s.t / SPIN);
  if (s.phase === 'spin' && s.t >= SPIN) go(s, 'drop');
  else if (s.phase === 'drop' && s.t >= DROP) go(s, 'wait');
  else if (s.phase === 'open' && s.t >= OPEN) {
    go(s, 'show');
    // 割れ終えた瞬間に、割るときに押した指の合成 click で閉じないように
    s.guard = GUARD;
  }
}

export function tap(s: Show): void {
  if (s.guard > 0) return;
  if (s.phase === 'spin' || s.phase === 'drop') go(s, 'wait');
  else if (s.phase === 'wait') go(s, 'open');
  else if (s.phase === 'open') go(s, 'show');
  else if (s.phase === 'show') go(s, 'done');
  else return;
  s.guard = GUARD;
}

export function skip(s: Show): void {
  go(s, 'show');
  s.guard = GUARD;
}

export function angleDelta(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number): number {
  let d = Math.atan2(y1 - cy, x1 - cx) - Math.atan2(y0 - cy, x0 - cx);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 終わってから閉じるまで GUARD 待つ。閉じた指の合成 click が、裏の引くボタンを押してしまわないように */
export const closing = (s: Show) => s.phase === 'done' && s.t >= GUARD;

/** ハンドルの中心からこの距離（CSS px）より内側の指は回す量に数えない（中心のそばは向きが定まらず、こするだけで回ってしまう） */
const DEAD = 20;
/** 1 回の動きでこれより大きく回ったら数えない。指はそこまで速く回せず、中心を飛び越えた動きは向きがでたらめになる */
const STEP = 0.5;

type Pt = { x: number; y: number };

export function handleDelta(h: Pt, p0: Pt, p1: Pt): number {
  if (Math.hypot(p0.x - h.x, p0.y - h.y) < DEAD || Math.hypot(p1.x - h.x, p1.y - h.y) < DEAD) return 0;
  const d = angleDelta(h.x, h.y, p0.x, p0.y, p1.x, p1.y);
  return Math.abs(d) > STEP ? 0 : d;
}
