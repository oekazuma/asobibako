import type { V3 } from '$lib/sculpt';
import type { RGB } from '../color';
import { moodAt, relight, type Mood } from '../mansion/moods';
import type { Me } from '../net';
import { PaintLog, type Dab } from '../paint';
import type { Skill } from './levels';
import type { Ctx, Paint, SurfacePoint } from './senses';
import { viewOf, type Spot } from './spots';

/** 置いてから塗り始めるまで（秒）。親の端末の 3D の体が、届いた体の場所とポーズに落ち着くのを待つ */
export const SETTLE = 1;
/** 塗り終えるまでの上限（秒）。隠れタイムの最短 30 秒から、置いて落ち着くまでと余裕を引いた長さ */
export const PAINT_SECS = 20;
/** 面の色を聞くのは 1 コマにこれだけ（1 回ごとに屋敷の面を全部の三角形で調べるので重い） */
export const RAYS_PER_STEP = 6;
/** 1 秒に吹く点の数。点が多ければ PAINT_SECS で終わる速さに上げる */
const RATE = 150;
/** 見られる位置からの向きをまとめる升目（rad）。戸口から数 m 先で 10cm ほど */
const CELL = (0.75 * Math.PI) / 180;

/** 骨で曲げる前の座標で gap の升目に 1 点ずつ残す */
export function thin(points: readonly SurfacePoint[], gap: number): SurfacePoint[] {
  const seen = new Set<string>();
  const out: SurfacePoint[] = [];
  for (const p of points) {
    const k = p.rest.map((v) => Math.floor(v / gap)).join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * 隠れる CPU。隠れタイムの始めに選んだ場所へ歩かずに置かれ、見られる位置から見て体の向こうにある面の色で自分を塗る。
 * 光が当たる前の色を、向こうの面と体の面の向きによる日と半球の光の当たり方の比で直して吹くので、その位置から見るとまわりに溶け込む
 */
export class HiderBrain {
  readonly spot: Spot;
  readonly log = new PaintLog();
  painting = false;
  readonly #skill: Skill;
  readonly #rand: () => number;
  #wait = SETTLE;
  #plan: SurfacePoint[] | null = null;
  #next = 0;
  #budget = 0;
  #rate = RATE;
  readonly #colors = new Map<string, (Paint & { up: number }) | null>();
  /** 体のいる部屋の明るさ。探す人もこの部屋で見るので、その光で塗りを合わせる */
  readonly #mood: Mood;

  constructor(spot: Spot, skill: Skill, rand: () => number) {
    this.spot = spot;
    this.#skill = skill;
    this.#rand = rand;
    this.#mood = moodAt(spot.pos);
  }

  get done(): boolean {
    return this.#plan !== null && this.#next >= this.#plan.length;
  }

  me(now: number): Me {
    const s = this.spot;
    return {
      ms: now,
      pos: [...s.pos],
      yaw: s.yaw,
      cling: s.cling,
      pose: s.pose,
      crouch: false,
      paint: this.painting,
      look: [s.yaw, 0],
      eye: null
    };
  }

  step(ctx: Ctx, dt: number): void {
    this.painting = false;
    const senses = ctx.senses;
    if (ctx.view.phase !== 'hide' || this.done || !senses) return;
    if ((this.#wait -= dt) > 0) return;
    if (!this.#plan) {
      // 3D の体がまだこの場所に無い（縦持ちで描くのを止めている・体が届いたばかり）なら、次のコマに聞き直す
      const points = senses.surface(ctx.me, this.me(ctx.now));
      if (!points) return;
      this.#plan = thin(points, this.#skill.brush * 0.8).filter(() => this.#rand() >= this.#skill.skip);
      this.#rate = Math.max(RATE, this.#plan.length / PAINT_SECS);
    }
    this.painting = true;
    this.#budget += this.#rate * dt;
    const eye = viewOf(this.spot);
    const plan = this.#plan;
    const out: Dab[] = [];
    let rays = RAYS_PER_STEP;
    while (this.#budget >= 1 && this.#next < plan.length) {
      const p = plan[this.#next];
      const d = norm(sub(p.world, eye));
      const key = `${Math.round(Math.atan2(d[0], d[2]) / CELL)}:${Math.round(Math.asin(d[1]) / CELL)}`;
      if (!this.#colors.has(key)) {
        if (rays === 0) break;
        rays--;
        this.#colors.set(key, senses.colorAt(eye, d));
      }
      const c = this.#colors.get(key);
      this.#next++;
      this.#budget--;
      if (c)
        out.push({
          p: p.rest,
          n: p.normal,
          r: this.#skill.brush,
          c: this.#shift(relight(c.color, this.#mood, c.up, p.up)),
          a: this.#skill.alpha,
          m: c.metal,
          ro: c.rough
        });
    }
    if (out.length) this.log.add(out);
  }

  #shift(c: RGB): RGB {
    const j = this.#skill.jitter;
    const one = (v: number) => Math.min(1, Math.max(0, v + (this.#rand() * 2 - 1) * j));
    return [one(c[0]), one(c[1]), one(c[2])];
  }
}
