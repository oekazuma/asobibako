import type { Actor } from './behavior';
import type { Spot } from './layout';
import { LOOKS } from './looks';
import { closest, crosses, type Seg } from '$lib/segments';
import type { BreedId } from './types';

/**
 * ペット同士のかかわり（あいさつ・じゃれ合い・毛づくろい・くっつき寝・ボールの取り合い）の相手と種類の選び方と、
 * 押しのけ合うための体の形。動き（mode 'social'）は behavior.ts が持つ。仲のよさは保存せず、種類とその場の気分で決める
 */

export type PalKind = 'greet' | 'play' | 'groom' | 'snuggle' | 'rival';

export interface Pal {
  kind: PalKind;
  with: string;
  /** 自分から誘った側 */
  lead: boolean;
  phase:
    | 'meet'
    | 'wait'
    | 'invite'
    | 'answer'
    | 'flee'
    | 'chase'
    | 'jump'
    | 'sniff'
    | 'lick'
    | 'licked'
    | 'nestle'
    | 'follow';
  /** じゃれ合いの追いかけっこの残りの回数 */
  rounds: number;
  /** この追いかけっこで、もう相手にとびついた */
  bumped: boolean;
}

/** 体の大きさ（m）。4 本の足の真ん中から鼻先まで・お尻まで、胴の半分の幅、肩の高さ */
export interface Body {
  fore: number;
  aft: number;
  w: number;
  s: number;
  cat: boolean;
  breed: BreedId;
}

/** 胴の幅を測る形。耳（チワワは大きい）と足は幅に入れない */
const TORSO = new Set(['chest', 'rib', 'loin', 'hips', 'ham', 'rump', 'flank', 'brisket', 'head', 'skull']);
const bodies = new Map<BreedId, Body>();

export function bodyOf(breed: BreedId): Body {
  const hit = bodies.get(breed);
  if (hit) return hit;
  const l = LOOKS[breed];
  let [z0, z1, w] = [0, 0, 0];
  for (const s of l.shapes) {
    if (s.cut || s.tag.includes('tail') || s.bone.startsWith('tail') || s.tag.includes('ear')) continue;
    // 楕円体は中心と半径、円すいは両端の丸
    const balls: [number, number, number][] = s.ell
      ? [[s.a[0], s.a[2], s.ell[0]]]
      : s.cone
        ? [
            [s.a[0], s.a[2], s.cone.ra],
            [s.cone.b[0], s.cone.b[2], s.cone.rb]
          ]
        : [];
    for (const [x, z, r] of balls) {
      const rz = s.ell ? s.ell[2] : r;
      z0 = Math.min(z0, z - rz);
      z1 = Math.max(z1, z + rz);
      if (TORSO.has(s.tag)) w = Math.max(w, Math.abs(x) + r);
    }
  }
  const b = { fore: z1 * l.S, aft: -z0 * l.S, w: w * l.S, s: l.S, cat: l.kind === 'cat', breed };
  bodies.set(breed, b);
  return b;
}

/** 床に落とした体の形。胴にそった線分と、その太さ */
export interface Cap {
  seg: Seg;
  r: number;
}

/**
 * pos に heading で立った（寝た）ときの体の形。寝ている猫は丸くなり、寝ている犬は横になって足を折りたたむぶん太い
 */
export function capsule(b: Body, pos: Spot, heading: number, asleep: boolean): Cap {
  const [fx, fz] = [Math.sin(heading), Math.cos(heading)];
  if (asleep && b.cat) return { seg: [pos.x, pos.z, pos.x, pos.z], r: 0.55 * b.s };
  const r = asleep ? b.w + 0.1 * b.s : b.w;
  const f = Math.max(0, b.fore - r);
  const a = Math.max(0, b.aft - r);
  return { seg: [pos.x - fx * a, pos.z - fz * a, pos.x + fx * f, pos.z + fz * f], r };
}

export const capOf = (a: Actor) => capsule(a.body, a, a.heading, a.asleep);

/** 2 つの形のすき間（負ならめり込み）と、b から a へ押し出す向き */
export function gap(a: Cap, b: Cap): { d: number; nx: number; nz: number } {
  const [ax, az, bx, bz] = a.seg;
  let best = { d: Infinity, nx: 0, nz: 0 };
  const pairs: [Seg, number, number, boolean][] = [
    [b.seg, ax, az, true],
    [b.seg, bx, bz, true],
    [a.seg, b.seg[0], b.seg[1], false],
    [a.seg, b.seg[2], b.seg[3], false]
  ];
  for (const [s, px, pz, fromB] of pairs) {
    const [cx, cz] = closest(s, px, pz);
    const d = Math.hypot(px - cx, pz - cz);
    if (d >= best.d) continue;
    const k = d > 1e-6 ? (fromB ? 1 : -1) / d : 0;
    best = { d, nx: (px - cx) * k, nz: (pz - cz) * k };
  }
  if (crosses(a.seg, b.seg)) best.d = 0;
  if (best.d === 0 || (!best.nx && !best.nz)) {
    // 線が交わっているときは真ん中どうしを結ぶ向きへ押し出す
    const mx = (ax + bx - b.seg[0] - b.seg[2]) / 2;
    const mz = (az + bz - b.seg[1] - b.seg[3]) / 2;
    const m = Math.hypot(mx, mz);
    [best.nx, best.nz] = m > 1e-6 ? [mx / m, mz / m] : [1, 0];
  }
  return { d: best.d - a.r - b.r, nx: best.nx, nz: best.nz };
}

/** ほかの子と遊ぶのが好きな度合い 0..1。柴は犬同士でもそっけなく、ロシアンブルーは人見知り */
const FRIENDLY: Record<BreedId, number> = {
  shiba: 0.5,
  kuroshiba: 0.5,
  beagle: 0.9,
  poodle: 0.8,
  corgi: 0.85,
  dachshund: 0.7,
  labrador: 1,
  chihuahua: 0.45,
  mike: 0.6,
  kuro: 0.55,
  saba: 0.6,
  chatora: 0.8,
  russian: 0.4,
  fold: 0.8,
  munchkin: 0.7
};
export const friendly = (b: Body) => FRIENDLY[b.breed];

/** 言いつけ（なでる・芸・呼ぶ）のあと、ほかの子に誘われない秒 */
const TOLD = 8;

/** ほかの子にかかわれる（誘える・誘われる）ひまな子 */
export const free = (a: Actor) =>
  !a.asleep &&
  !a.stay &&
  !a.hop &&
  !a.pal &&
  !a.carrying &&
  !a.rub &&
  a.shy <= 0 &&
  a.clock - a.toldAt > TOLD &&
  (a.mode === 'idle' || (a.mode === 'go' && a.goal === 'wander'));

/**
 * 誘う相手とすること。つかれているときはじゃれ合わない。面の上はせまいのでじゃれ合わず、
 * 床とソファに分かれていれば、じゃれ合うときだけ面の上の子が降りてくる
 */
export function pickPal(
  a: Actor,
  actors: Actor[],
  tired: boolean,
  rng: () => number
): { o: Actor; kind: PalKind } | null {
  const near = actors.filter((o) => o !== a && free(o) && Math.hypot(o.x - a.x, o.z - a.z) < 3.5);
  if (!near.length) return null;
  const o = near[Math.floor(rng() * near.length)];
  const [me, you] = [a.body, o.body];
  const like = (friendly(me) + friendly(you)) / 2;
  if (rng() > 0.35 + 0.65 * like) return null;
  const apart = o.perch !== a.perch;
  const play = tired || (a.perch && !apart) ? 0 : me.cat ? (you.cat ? 0.2 : 0.3) : you.cat ? 0.35 : 0.55;
  if (apart) return play ? { o, kind: 'play' } : null;
  const groom = me.cat ? (you.cat ? 0.5 : 0.4) : you.cat ? 0.15 : 0;
  const options: [number, PalKind][] = [
    [play, 'play'],
    [groom, 'groom'],
    [0.35, 'greet']
  ];
  let r = rng() * options.reduce((s, [w]) => s + w, 0);
  for (const [w, kind] of options) if ((r -= w) <= 0) return { o, kind };
  return { o, kind: 'greet' };
}

/** 犬に誘われた猫が、いやがって逃げるか */
export const refuses = (cat: Body, rng: () => number) => rng() < 0.45 * (1 - friendly(cat)) + 0.08;

/**
 * 眠っている f のとなりで、a が体を寄せて寝る位置の候補（よいほうから）。向きは f にそろえる。
 * 犬のそばの猫は、犬の足の側（おなか）へもたれることもある
 */
export function snuggleSpots(a: Actor, f: Actor, rng: () => number): Spot[] {
  const me = capsule(a.body, { x: 0, z: 0 }, 0, true).r;
  const you = capsule(f.body, { x: 0, z: 0 }, 0, true).r;
  // 横になった犬は体の左（ペットの +x）が背中、右がおなか
  const [lx, lz] = [Math.cos(f.heading), -Math.sin(f.heading)];
  const d = me + you - SNUG;
  const sides = a.body.cat && !f.body.cat && rng() < 0.6 ? [-1, 1] : rng() < 0.5 ? [1, -1] : [-1, 1];
  return sides.map((s) => ({ x: f.x + lx * d * s, z: f.z + lz * d * s }));
}

/** くっついて寝る 2 匹が重なってよい深さ。体が触れて見える */
export const SNUG = 0.03;
