import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';
import { CROUCH, EYE_HEIGHT } from '../move';
import type { Me } from '../net';
import { AIM } from '../poses';
import type { View } from '../referee';
import type { Skill } from './levels';
import { nearest, ROOMS, route } from './paths';
import type { Ctx } from './senses';
import { Walker } from './walker';

/** 1 つの部屋で見回す秒 */
export const LOOK_SECS = 4;
/** 見回しで左右へ振る幅（rad）。視野の半角 52 度と合わせて、部屋のほぼ全部を見る */
const SWAY = 1.5;

export const hidingSeats = (v: View): Seat[] =>
  (Object.keys(v.roles).map(Number) as Seat[]).filter((s) => v.roles[s] === 'hider' && !v.found.includes(s));

const yawTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/**
 * 探す CPU。入口から網の上で部屋を順に回り、部屋に着くと左右と上下に首を振る。口笛を聞くとずらした先へ、
 * 埋まりの矢印が出た人の場所へ向かう
 */
export class HunterBrain {
  readonly walker: Walker;
  /** [yaw, pitch]。pitch は下向きが正（oversight の forward と同じ） */
  look: [number, number];
  crouch = false;
  /** 見回している部屋（歩いているあいだは null） */
  scanning: string | null = null;
  /** 口笛と矢印で向かう先。着いたらそちらを向いて見回す */
  goal: V3 | null = null;
  readonly #skill: Skill;
  readonly #rand: () => number;
  #room: number;
  readonly #seen = new Set<number>();
  #scan = 0;
  /** 今の見回しでしゃがむか */
  #low = false;
  #t = 0;
  #base = 0;
  readonly #exposed = new Set<Seat>();

  constructor(at: V3, yaw: number, skill: Skill, index: number, rand: () => number) {
    this.walker = new Walker(at);
    this.walker.body.yaw = yaw;
    this.walker.pace = skill.pace;
    this.walker.run = skill.run;
    this.look = [yaw, 0];
    this.#skill = skill;
    this.#rand = rand;
    // 2 人なら、部屋の並びの反対側から回り始める
    this.#room = (index * 3) % ROOMS.length;
    this.walker.go(ROOMS[this.#room].look);
  }

  eye(): V3 {
    const [x, y, z] = this.walker.body.pos;
    return [x, y + EYE_HEIGHT - (this.crouch ? CROUCH : 0), z];
  }

  me(now: number): Me {
    return {
      ms: now,
      pos: [...this.walker.body.pos],
      yaw: this.look[0],
      cling: null,
      pose: this.crouch ? 'crouch' : AIM.id,
      crouch: this.crouch,
      paint: false,
      look: [...this.look],
      eye: this.eye()
    };
  }

  /** 口笛。本家の ♪ も近いか遠いかが分かる程度なので、遠いほど・強さが低いほど大きくずらした先へ向かう */
  heard(at: V3): void {
    const eye = this.eye();
    const r = this.#skill.stray.base + this.#skill.stray.far * Math.hypot(at[0] - eye[0], at[2] - eye[2]);
    const a = this.#rand() * Math.PI * 2;
    // 半分より近くへはずらさないので、強いでも隠れる人の上へまっすぐは行かない
    const k = r * (0.5 + 0.5 * this.#rand());
    this.#head([at[0] + Math.cos(a) * k, at[1], at[2] + Math.sin(a) * k]);
  }

  step(ctx: Ctx, dt: number): void {
    this.#t += dt;
    if (ctx.view.phase === 'reveal') {
      this.#low = false;
      this.walker.path = [];
      this.walker.step(ctx.level, dt);
      this.#sweep();
      return;
    }
    if (ctx.view.phase === 'search') this.#arrows(ctx);
    this.#patrol(ctx, dt);
  }

  #head(goal: V3) {
    this.goal = goal;
    this.scanning = null;
    this.walker.go(nearest(goal));
  }

  /** 埋まりすぎて場所を知らされた人へ向かう（人のハンターに見える矢印と同じ情報） */
  #arrows(ctx: Ctx) {
    const exposed = ctx.view.exposed.filter((s) => hidingSeats(ctx.view).includes(s));
    for (const s of [...this.#exposed]) if (!exposed.includes(s)) this.#exposed.delete(s);
    for (const s of exposed) {
      const body = ctx.bodies.get(s);
      if (this.#exposed.has(s) || !body) continue;
      this.#exposed.add(s);
      this.#head(body.pos);
    }
  }

  #patrol(ctx: Ctx, dt: number) {
    const heading = this.walker.step(ctx.level, dt);
    if (heading !== null) {
      this.scanning = null;
      this.crouch = false;
      this.look = [heading, 0];
      return;
    }
    if (this.scanning === null) {
      const pos = this.walker.body.pos;
      this.#base = yawTo(pos, this.goal ?? ROOMS[this.#room].toward);
      this.scanning = this.goal ? placeOf(pos) : ROOMS[this.#room].name;
      this.#scan = LOOK_SECS;
      this.#low = this.#skill.crouch && !!ROOMS.find((r) => r.name === this.scanning)?.low;
    }
    this.#sweep();
    if ((this.#scan -= dt) > 0) return;
    if (this.goal) this.goal = null;
    else {
      this.#seen.add(this.#room);
      this.#room = this.#next();
    }
    this.scanning = null;
    this.crouch = false;
    this.walker.go(ROOMS[this.#room].look);
  }

  /**
   * 左右に加えて上下にも振り、天井・回廊・家具の上を見る（pitch は −0.6 で見上げ、0.4 で見下ろす）。
   * 強いは、机や台の下をのぞける部屋の見回しの後半だけしゃがむ
   */
  #sweep() {
    const t = this.#t;
    this.look = [this.#base + SWAY * Math.sin(t * 1.1), 0.5 * Math.sin(t * 1.7) - 0.1];
    this.crouch = this.#low && this.#scan < LOOK_SECS / 2;
  }

  #next(): number {
    const order = this.#skill.order;
    if (order === 'random') return Math.floor(this.#rand() * ROOMS.length);
    if (order === 'loop') return (this.#room + 1) % ROOMS.length;
    if (this.#seen.size >= ROOMS.length) {
      this.#seen.clear();
      this.#seen.add(this.#room);
    }
    const from = nearest(this.walker.body.pos);
    let best = this.#room;
    let len = Infinity;
    ROOMS.forEach((r, i) => {
      const n = route(from, r.look).length;
      if (!this.#seen.has(i) && n < len) {
        len = n;
        best = i;
      }
    });
    return best;
  }
}
