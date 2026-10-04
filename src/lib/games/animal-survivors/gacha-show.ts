import { parseKey, type GearKey, type Rarity } from './gear';

export type Phase = 'ready' | 'spin' | 'storm' | 'drop' | 'wait' | 'crack' | 'open' | 'show' | 'list' | 'done';
export type GachaEvent = 'click' | 'roll' | 'glow' | 'storm' | 'crack' | 'pop0' | 'pop1' | 'pop2';

export interface Show {
  phase: Phase;
  t: number;
  angle: number;
  gears: GearKey[];
  rarity: Rarity[];
  upgrade: number;
  opened: number;
  guard: number;
  events: GachaEvent[];
}

export const TURN = Math.PI * 1.5;
export const SPIN = 0.8;
export const DROP = 0.9;
export const STORM = 1.1;
export const ROLL_GAP = 0.12;
export const CRACK = 0.9;
/** 割れるのにかける秒。レア度が高いほど間を取って豪華に見せる */
export const OPEN_TIME = [0.5, 0.9, 1.6];
export const UPGRADE = 0.25;
export const GUARD = 0.35;
/** ハンドルがこの角度回るごとにカチッと鳴らす */
const CLICK = 0.5;

export function makeShow(gears: GearKey[], rand: () => number = Math.random): Show {
  const rarity = gears.map((k) => parseKey(k)?.rarity ?? 0);
  const first = rarity.indexOf(2);
  return {
    phase: 'ready',
    t: 0,
    angle: 0,
    gears,
    rarity,
    upgrade: first >= 0 && rand() < UPGRADE ? first : -1,
    opened: 0,
    guard: 0,
    events: []
  };
}

/** 昇格するカプセルはレアに見せる（稲妻や揺れで見破られないように） */
export const cue = (s: Show): Rarity => Math.max(0, ...s.rarity.map((r, i) => (i === s.upgrade ? 1 : r))) as Rarity;

/** 昇格するカプセルは、ひびが入り終えるまで青く光る */
export function glowOf(s: Show, i: number): Rarity {
  if (i !== s.upgrade) return s.rarity[i];
  return s.opened > i || (s.opened === i && s.phase === 'open') ? 2 : 1;
}

export const dropTime = (n: number) => DROP + ROLL_GAP * (n - 1);

const go = (s: Show, phase: Phase) => {
  s.phase = phase;
  s.t = 0;
};

/** 今のカプセルを割り始める。昇格するカプセルは先にひびを入れる */
function openNext(s: Show) {
  if (s.opened === s.upgrade) {
    go(s, 'crack');
    s.events.push('crack');
    return;
  }
  go(s, 'open');
  s.events.push(`pop${s.rarity[s.opened]}` as GachaEvent);
}

function finish(s: Show) {
  go(s, s.gears.length === 1 ? 'show' : 'list');
  s.guard = GUARD;
}

export function turn(s: Show, d: number): void {
  if (s.phase !== 'ready') return;
  const before = Math.floor(s.angle / CLICK);
  s.angle = Math.max(0, s.angle + d);
  if (Math.floor(s.angle / CLICK) > before) s.events.push('click');
  if (s.angle >= TURN) go(s, 'spin');
}

export function tick(s: Show, dt: number): void {
  s.t += dt;
  s.guard = Math.max(0, s.guard - dt);
  if (s.phase === 'spin') s.angle = TURN + (Math.PI * 2 - TURN) * Math.min(1, s.t / SPIN);
  if (s.phase === 'spin' && s.t >= SPIN) {
    if (cue(s) === 2) {
      go(s, 'storm');
      s.events.push('storm');
    } else {
      go(s, 'drop');
      s.events.push('roll');
    }
  } else if (s.phase === 'storm' && s.t >= STORM) {
    go(s, 'drop');
    s.events.push('roll');
  } else if (s.phase === 'drop' && s.t >= dropTime(s.gears.length)) {
    go(s, 'wait');
    if (cue(s) >= 1) s.events.push('glow');
  } else if (s.phase === 'crack' && s.t >= CRACK) {
    go(s, 'open');
    s.events.push('pop2');
  } else if (s.phase === 'open' && s.t >= OPEN_TIME[s.rarity[s.opened]]) {
    s.opened += 1;
    if (s.opened >= s.gears.length) finish(s);
    else openNext(s);
  }
}

export function tap(s: Show): void {
  if (s.guard > 0) return;
  if (s.phase === 'spin' || s.phase === 'storm' || s.phase === 'drop') {
    go(s, 'wait');
    if (cue(s) >= 1) s.events.push('glow');
  } else if (s.phase === 'wait') openNext(s);
  else if (s.phase === 'crack') s.t = CRACK;
  else if (s.phase === 'open') s.t = OPEN_TIME[s.rarity[s.opened]];
  else if (s.phase === 'show' || s.phase === 'list') go(s, 'done');
  else return;
  s.guard = GUARD;
}

export function skip(s: Show): void {
  s.opened = s.gears.length;
  finish(s);
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
