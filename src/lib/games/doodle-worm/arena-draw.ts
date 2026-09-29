import { Floaters, icon, Particles, Shake } from '$lib/fx';
import { ACT, CHARGE, WINDUP, type Side } from './battle';
import { hatch, type Creature, type Kind, type Stroke } from './engine';
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
  /** ずかんの絵なら、その id。勝ったしるしを付ける */
  id?: string;
}

/** 名札に出す、1 体ぶんの様子 */
export interface Info {
  name: string;
  trait: string;
  /** 残りの体力の割合 */
  hp: number;
  gauge: number;
  /** 次にガードできるまでの残りの割合（0 ならすぐ構えられる） */
  cool: number;
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

/** 攻撃の最中の動き。along は相手へ向かう割合、lift は自分の上へ浮く高さ、spin は回る角度、shake はためる震え */
interface Motion {
  along: number;
  lift: number;
  spin: number;
  shake: number;
}

const REACH = 0.6;

/**
 * 動き方ごとの技。跳ねる子は高く跳んでのしかかり、飛ぶ子は舞い上がってから急降下し、
 * 這う子は近づいて回りながらしっぽで打ち、歩く子は少し引いてから蹴りこむ。
 * ひっさつわざは同じ技を大きくし、その前にためる（CHARGE のうち WINDUP を除いた時間）
 */
function motion(act: Side['act'], kind: Kind): Motion {
  const m: Motion = { along: 0, lift: 0, spin: 0, shake: 0 };
  if (!act) return m;
  const t = act.special ? act.t - (CHARGE - WINDUP) : act.t;
  if (t < 0) return { ...m, along: -0.06, shake: 1 };
  const big = act.special ? 1.8 : 1;
  if (t >= WINDUP) {
    const r = Math.max(0, 1 - (t - WINDUP) / (ACT - WINDUP));
    return { ...m, along: REACH * r };
  }
  const p = t / WINDUP;
  switch (kind) {
    case 'hop':
      return { ...m, along: REACH * p, lift: Math.sin(Math.PI * p) * 0.16 * big };
    case 'fly':
      return p < 0.5
        ? { ...m, along: -0.1 * p * 2, lift: 0.18 * big * p * 2 }
        : { ...m, along: REACH * (p - 0.5) * 2, lift: 0.18 * big * (1 - (p - 0.5) * 2) };
    case 'crawl':
      return { ...m, along: REACH * p, spin: p > 0.4 ? ((p - 0.4) / 0.6) * Math.PI * 2 * big : 0 };
    default: {
      const back = 0.12;
      return {
        ...m,
        along: p < 0.5 ? -back * p * 2 : -back + (p - 0.5) * 2 * (REACH + back) * (act.special ? 1.1 : 1)
      };
    }
  }
}

/**
 * 1 体を描く。lost は負けてからの秒（負けていなければ -1）。
 * ゲージが満タンの子と、ひっさつわざの最中の子のうしろには金色の光を、ガードしている子のまわりには青い膜を置く
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
  const m = motion(s.act, s.stats.kind);
  let x = me.x + (foe.x - me.x) * m.along;
  let y = me.y + (foe.y - me.y) * m.along;
  const quake =
    (s.hurt >= 0 ? Math.sin(s.hurt * 70) * 0.012 * (1 - s.hurt / 0.4) : 0) +
    m.shake * Math.sin(performance.now() / 20) * 0.006;
  x += quake;
  y += quake * 0.3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(me.rot);
  // 足もとの影。浮いているあいだは小さくする
  const k = 1 - Math.min(0.5, m.lift * 2);
  ctx.fillStyle = 'rgb(0 0 0 / 0.12)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.55, size * 0.45 * k, size * 0.08 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -m.lift);
  if (s.gauge >= 1 || s.act?.special) {
    const pulse = 0.8 + Math.sin(performance.now() / 90) * 0.2;
    ctx.fillStyle = `rgb(255 200 40 / ${s.act?.special ? 0.55 : 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.75 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.guard > 0) {
    ctx.strokeStyle = 'rgb(99 168 247 / 0.9)';
    ctx.fillStyle = 'rgb(99 168 247 / 0.2)';
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (lost >= 0) {
    const d = Math.min(1, lost / 0.4);
    ctx.translate(0, size * 0.3 * d);
    ctx.rotate((Math.PI / 2) * d);
    ctx.globalAlpha = 1 - 0.4 * d;
  }
  ctx.rotate(m.spin);
  if (s.hurt >= 0 && Math.floor(s.hurt * 20) % 2) ctx.globalAlpha *= 0.5;
  ctx.scale(size / f.extent, size / f.extent);
  creature(ctx, look, f.c);
  ctx.restore();
}

/** 跳ねさせる。応援されたときと、勝ったあと */
export function hop(f: Fighter) {
  if (f.c.jump < 0) f.c.jump = 0;
}

/** 応援のボタンから子へ飛んでいくハート */
export class Hearts {
  readonly list: { x: number; y: number; tx: number; ty: number; age: number }[] = [];

  add(x: number, y: number, tx: number, ty: number) {
    this.list.push({ x: x + (Math.random() - 0.5) * 0.08, y, tx: tx + (Math.random() - 0.5) * 0.05, ty, age: 0 });
  }

  step(dt: number) {
    for (const h of this.list) h.age += dt;
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].age > HEART) this.list.splice(i, 1);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const h of this.list) {
      const p = h.age / HEART;
      const e = 1 - (1 - p) ** 2;
      icon(
        ctx,
        'heart',
        h.x + (h.tx - h.x) * e,
        h.y + (h.ty - h.y) * e - Math.sin(Math.PI * p) * 0.04,
        0.035 * (1 - p * 0.4)
      );
    }
  }
}

const HEART = 0.45;

/** ひっさつわざが当たったところに広がる輪 */
export class Rings {
  readonly list: { x: number; y: number; age: number; color: string }[] = [];

  add(x: number, y: number, color: string) {
    this.list.push({ x, y, age: 0, color }, { x, y, age: -0.12, color });
  }

  step(dt: number) {
    for (const r of this.list) r.age += dt;
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].age > 0.5) this.list.splice(i, 1);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const r of this.list) {
      if (r.age < 0) continue;
      const p = r.age / 0.5;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 0.012 * (1 - p) + 0.002;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 0.03 + p * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** 画面の演出（粒・浮かぶ文字・ハート・輪・揺れ）をまとめて進めて描く */
export class Effects {
  readonly fx = new Particles();
  readonly hearts = new Hearts();
  readonly rings = new Rings();
  readonly shake = new Shake();
  readonly #floaters = new Floaters();
  /** 向かいの人に向けた文字。盤面を半回転して描く */
  readonly #flipped = new Floaters();

  /** (x, y) の上に文字を浮かべる。flip なら向かいの人から読める向きにする */
  float(aspect: number, x: number, y: number, flip: boolean, text: string, size: number, color: string) {
    if (flip) this.#flipped.add(text, aspect - x, 1 - y, size, color);
    else this.#floaters.add(text, x, y, size, color);
  }

  step(dt: number) {
    for (const e of [this.fx, this.hearts, this.rings, this.#floaters, this.#flipped]) e.step(dt);
  }

  /** 描き終えると ctx は半回転したままになるので、続けて向かいの人に向けたものを描ける */
  draw(ctx: CanvasRenderingContext2D, aspect: number) {
    for (const e of [this.rings, this.fx, this.hearts, this.#floaters]) e.draw(ctx);
    ctx.translate(aspect, 1);
    ctx.rotate(Math.PI);
    this.#flipped.draw(ctx);
  }
}
