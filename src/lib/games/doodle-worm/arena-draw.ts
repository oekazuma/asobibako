import { ACT, WINDUP, type Side } from './battle';
import { hatch, type Creature, type Stroke } from './engine';
import type { Look } from './looks';
import { creature } from './paint';

/** 戦う子の立ち位置（盤面の高さを 1 とした単位）と向き。rot が π の子は向かいの人から見て立っている */
export interface Spot {
  x: number;
  y: number;
  rot: number;
}

/**
 * ふたりで遊ぶときは、それぞれの子が自分の側から見て立つよう上下に向かい合わせる。
 * ひとりのときは左右に並べる
 */
export function spots(aspect: number, duo: boolean): [Spot, Spot] {
  if (duo)
    return [
      { x: aspect / 2, y: 0.67, rot: 0 },
      { x: aspect / 2, y: 0.33, rot: Math.PI }
    ];
  return [
    { x: aspect * 0.27, y: 0.5, rot: 0 },
    { x: aspect * 0.73, y: 0.5, rot: 0 }
  ];
}

/** 戦いに出る子 */
export interface Entry {
  name: string;
  strokes: Stroke[];
}

/** 名札に出す、1 体ぶんの様子 */
export interface Info {
  name: string;
  trait: string;
  /** 残りの体力の割合 */
  hp: number;
  gauge: number;
}

/** 戦う子の大きさ（外枠の長いほう）。ふたりのときは上下の名札のあいだに収める */
export const fighterSize = (aspect: number, duo: boolean) => Math.min(aspect * 0.34, duo ? 0.17 : 0.22);

export interface Fighter {
  c: Creature;
  /** 外枠の長いほう。描く大きさへ直す倍率を出す */
  extent: number;
}

/** 絵の外枠のまんなかが原点に来るよう置き直す */
export function fighter(strokes: Stroke[]): Fighter {
  const c = hatch(strokes)!;
  const [l, t, r, b] = c.box;
  c.x = -(l + r) / 2;
  c.y = -(t + b) / 2;
  c.age = 1;
  return { c, extent: Math.max(r - l, b - t, 0.01) };
}

/** 攻撃の最中の、相手へ向かう割合。少し引いてから飛びこみ、戻る */
function lunge(act: Side['act']): number {
  if (!act) return 0;
  const { t } = act;
  const back = 0.12;
  if (t < 0.2) return (-back * t) / 0.2;
  if (t < WINDUP) return -back + ((t - 0.2) / (WINDUP - 0.2)) * (0.6 + back);
  return 0.6 * Math.max(0, 1 - (t - WINDUP) / (ACT - WINDUP));
}

/**
 * 1 体を描く。lost は負けてからの秒（負けていなければ -1）。
 * ゲージが満タンの子と、ひっさつわざの最中の子のうしろには金色の光を置く
 */
export function drawFighter(
  ctx: CanvasRenderingContext2D,
  look: Look,
  f: Fighter,
  me: Spot,
  foe: Spot,
  s: Side,
  size: number,
  lost: number
) {
  const f0 = lunge(s.act);
  let x = me.x + (foe.x - me.x) * f0;
  let y = me.y + (foe.y - me.y) * f0;
  if (s.hurt >= 0) {
    const shake = Math.sin(s.hurt * 70) * 0.012 * (1 - s.hurt / 0.4);
    x += shake;
    y += shake * 0.3;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(me.rot);
  // 足もとの影
  ctx.fillStyle = 'rgb(0 0 0 / 0.12)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.55, size * 0.45, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  if (s.gauge >= 1 || s.act?.special) {
    const pulse = 0.8 + Math.sin(performance.now() / 90) * 0.2;
    ctx.fillStyle = `rgb(255 200 40 / ${s.act?.special ? 0.55 : 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.75 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lost >= 0) {
    const k = Math.min(1, lost / 0.4);
    ctx.translate(0, size * 0.3 * k);
    ctx.rotate((Math.PI / 2) * k);
    ctx.globalAlpha = 1 - 0.4 * k;
  }
  if (s.hurt >= 0 && Math.floor(s.hurt * 20) % 2) ctx.globalAlpha *= 0.5;
  ctx.scale(size / f.extent, size / f.extent);
  creature(ctx, look, f.c);
  ctx.restore();
}

/** 跳ねさせる。応援されたときと、勝ったあと */
export function hop(f: Fighter) {
  if (f.c.jump < 0) f.c.jump = 0;
}
