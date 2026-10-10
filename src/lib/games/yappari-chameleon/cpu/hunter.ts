import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';
import { CROUCH, EYE_HEIGHT } from '../move';
import type { Me } from '../net';
import { bodyPoints, sight, still } from '../oversight';
import { AIM } from '../poses';
import { COOLDOWN, type View } from '../referee';
import type { Skill } from './levels';
import { nearest, ROOMS, route } from './paths';
import type { Ctx } from './senses';
import { Walker } from './walker';

/** 1 つの部屋で見回す秒 */
export const LOOK_SECS = 4;
/** 見回しで左右へ振る幅（rad）。視野の半角 52 度と合わせて、部屋のほぼ全部を見る */
const SWAY = 1.5;
/** 大広間の端から端まで見える届き（m）。見落としポイントの点の足し算の 15m とは別 */
export const SEARCH_REACH = 30;
/** 気づくかを見る間隔（秒）。目立ちを聞くのは 1 体につきこの間隔に 1 回まで */
export const CHECK = 0.25;
/** 怪しさの増え方（1 秒あたり。目立ち 1 のときと、動いている体に足す量）と、いつも減る量 */
const GAIN = 4;
const MOVE_GAIN = 2;
const LEAK = 0.15;
/** ここを超えたら撃ちに行く。PROBE_AT より下は試し撃ちもしない */
export const SHOOT_AT = 1;
export const PROBE_AT = 0.4;
/** 半端に怪しい体へ、見るたびに試し撃ちする確率 */
const PROBE_CHANCE = 0.1;
/** これより遠ければ近づいてから撃つ（m） */
const APPROACH = 10;

export const hidingSeats = (v: View): Seat[] =>
  (Object.keys(v.roles).map(Number) as Seat[]).filter((s) => v.roles[s] === 'hider' && !v.found.includes(s));

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const yawTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/** 向き d（長さ 1）の [yaw, pitch]。pitch は下向きが正 */
export const toLook = (d: V3): [number, number] => [
  Math.atan2(d[0], d[2]),
  -Math.asin(Math.max(-1, Math.min(1, d[1])))
];

/** d（長さ 1）を、乱数で選んだ向きへちょうど deg 度ずらす */
export function deviate(d: V3, deg: number, rand: () => number): V3 {
  const side = cross(d, [0, 1, 0]);
  const r: V3 = Math.hypot(...side) < 1e-6 ? [1, 0, 0] : norm(side);
  const u = cross(r, d);
  const phi = rand() * Math.PI * 2;
  const w: V3 = [
    r[0] * Math.cos(phi) + u[0] * Math.sin(phi),
    r[1] * Math.cos(phi) + u[1] * Math.sin(phi),
    r[2] * Math.cos(phi) + u[2] * Math.sin(phi)
  ];
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return norm([d[0] * c + w[0] * s, d[1] * c + w[1] * s, d[2] * c + w[2] * s]);
}

/**
 * 探す CPU。入口から網の上で部屋を順に回り、部屋に着くと左右と上下に首を振る。0.25 秒ごとに隠れている体が視野・届き・遮りを
 * 通るかを見て、通った体だけ Senses に目立ちを聞いて怪しさをためる。体の位置は見えたときのものだけを使う（ctx.bodies は
 * 親が中継した全員の本当の位置なので、見えないあいだに読むと透視になる）。口笛を聞くとずらした先へ、埋まりの矢印が出た人の場所へ向かう
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
  /** 隠れる人ごとの怪しさ（SHOOT_AT で撃ちに行く） */
  readonly suspicion = new Map<Seat, number>();
  readonly #skill: Skill;
  readonly #rand: () => number;
  #room: number;
  readonly #seen = new Set<number>();
  #scan = 0;
  /** 今の見回しでしゃがむか */
  #low = false;
  #t = 0;
  #base = 0;
  #check = 0;
  #cool = 0;
  /** 撃つと決めた体。lost は見失って、最後に見えた所へ向かっている */
  #aim: { seat: Seat; wait: number; lost: boolean } | null = null;
  /** 前に見たときの体の位置（動いたかを見る） */
  readonly #before = new Map<Seat, V3>();
  /** 最後に視野・届き・遮りを通ったときの体の位置と胴の真ん中。追うのも撃つのもここへ向ける */
  readonly #last = new Map<Seat, { pos: V3; mid: V3 }>();
  /** いちばん新しい見るときに見えていた体 */
  #sees = new Set<Seat>();
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
    this.#cool = Math.max(0, this.#cool - dt);
    const v = ctx.view;
    if (v.phase === 'reveal') {
      // 撃たずにその場で見回すだけ
      this.#aim = null;
      this.#low = false;
      this.walker.path = [];
      this.walker.step(ctx.level, dt);
      this.#sweep();
      return;
    }
    if (v.phase !== 'search' || v.roles[ctx.me] !== 'hunter') return this.#patrol(ctx, dt);
    this.#arrows(ctx);
    if ((this.#check += dt) >= CHECK - 1e-9) {
      this.#check = 0;
      this.#notice(ctx);
    }
    if (this.#aim) this.#chase(ctx, dt);
    else this.#patrol(ctx, dt);
  }

  #sus(seat: Seat): number {
    return this.suspicion.get(seat) ?? 0;
  }

  #notice(ctx: Ctx) {
    const eye = this.eye();
    const viewer = { eye, look: this.look };
    const seen: Seat[] = [];
    for (const seat of hidingSeats(ctx.view)) {
      const body = ctx.bodies.get(seat);
      if (!body) continue;
      const before = this.#before.get(seat);
      let s = this.#sus(seat) - LEAK * CHECK;
      const points = bodyPoints(body);
      const d = sight(ctx.level, viewer, points, SEARCH_REACH);
      // 動いたかは、続けて見えた 2 回の位置でだけ比べる
      if (d === null) this.#before.delete(seat);
      else {
        this.#before.set(seat, body.pos);
        seen.push(seat);
        this.#last.set(seat, { pos: [...body.pos], mid: points[0] });
        // 3D が描けていないあいだ（null）は目立ちを 0 とみなし、動いた体にだけ気づく
        const loud = ctx.senses?.visible(seat, ctx.me, eye, points[0], this.#skill.diff) ?? 0;
        const moving = !!before && !still(body.pos, before);
        s += (loud * GAIN + (moving ? MOVE_GAIN : 0)) * (1 - d / SEARCH_REACH) * CHECK;
      }
      this.suspicion.set(seat, Math.max(0, s));
    }
    this.#sees = new Set(seen);
    if (this.#aim) return;
    const top = seen.reduce<Seat | null>((a, s) => (a === null || this.#sus(s) > this.#sus(a) ? s : a), null);
    if (top === null) return;
    if (this.#sus(top) >= SHOOT_AT) this.#aim = { seat: top, wait: this.#skill.wait, lost: false };
    else if (this.#sus(top) >= PROBE_AT && this.#cool === 0 && this.#rand() < PROBE_CHANCE)
      this.#fire(ctx, top, this.#skill.aim * 2);
  }

  /**
   * 撃つと決めた体へ向いて近づき、強さの段のぶん迷ってから撃つ。外しても怪しさは残して続けて狙う。
   * 追う先と狙う先は最後に見えたときの位置で、見えないあいだの本当の位置は使わない（使うと壁の向こうが透けて見える）。
   * 見失ったら最後に見えた所まで行き、着いても見えなければ、そちらを向いて見回してから見回りに戻る
   */
  #chase(ctx: Ctx, dt: number) {
    const aim = this.#aim!;
    const last = this.#last.get(aim.seat);
    if (!last || !hidingSeats(ctx.view).includes(aim.seat) || this.#sus(aim.seat) < PROBE_AT) return this.#drop(null);
    if (!this.#sees.has(aim.seat)) {
      if (!aim.lost) {
        aim.lost = true;
        this.walker.go(nearest(last.pos));
      }
      const heading = this.walker.step(ctx.level, dt);
      if (heading === null) return this.#drop(last.mid);
      this.crouch = false;
      this.look = [heading, 0];
      return;
    }
    aim.lost = false;
    if (Math.hypot(...sub(last.mid, this.eye())) > APPROACH) {
      const to = nearest(last.mid);
      if (this.walker.path.at(-1) !== to) this.walker.go(to);
    } else this.walker.path = [];
    this.walker.step(ctx.level, dt);
    this.crouch = false;
    this.look = toLook(norm(sub(last.mid, this.eye())));
    if ((aim.wait -= dt) > 0 || this.#cool > 0) return;
    this.#fire(ctx, aim.seat, this.#skill.aim);
    aim.wait = this.#skill.wait;
  }

  /** 狙うのをやめる。at を渡せば、そちらを向いて見回してから見回りに戻る */
  #drop(at: V3 | null) {
    this.#aim = null;
    this.scanning = null;
    if (at) this.#head(at);
    else this.walker.go(ROOMS[this.#room].look);
  }

  #fire(ctx: Ctx, seat: Seat, deg: number) {
    const last = this.#last.get(seat);
    if (!last) return;
    const o = this.eye();
    const d = deviate(norm(sub(last.mid, o)), deg, this.#rand);
    this.look = toLook(d);
    const yaw = this.look[0];
    // 筋は目の右下の前（銃口）から引く。当たりは目から見る
    const from: V3 = [
      o[0] - Math.cos(yaw) * 0.18 + Math.sin(yaw) * 0.3,
      o[1] - 0.15,
      o[2] + Math.sin(yaw) * 0.18 + Math.cos(yaw) * 0.3
    ];
    ctx.act({ t: 'shot', o, d, from, ms: ctx.now });
    this.#cool = COOLDOWN;
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
