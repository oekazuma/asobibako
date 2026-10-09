import type { V3 } from '$lib/sculpt';
import { BONES, dollShapes, JOINTS, PARENT, type Bone } from './doll';
import { RADIUS, type Cling, type Level } from './move';
import type { Pose } from './poses';

export const SPREAD = (2 * Math.PI) / 180;
/** 屋敷の端から端より長い */
export const RANGE = 60;
/** 張り付いたときに壁や天井と体の間を空けない（world3d の placeDoll と同じ値） */
export const HALF_DEPTH = 0.12;

/** tilt は天井で寝かせる角度（x 軸まわり） */
export interface Placement {
  at: V3;
  yaw: number;
  tilt: number;
}

/** Body と、ほかの人から届いた体の様子（net.ts の Me）のどちらも渡せる */
export interface Placeable {
  pos: V3;
  yaw: number;
  cling: Cling | null;
}

export function placement(b: Placeable): Placement {
  const [x, y, z] = b.pos;
  if (b.cling?.kind === 'wall') {
    const k = RADIUS - HALF_DEPTH;
    return { at: [x - b.cling.nx * k, y, z - b.cling.nz * k], yaw: b.yaw, tilt: 0 };
  }
  if (b.cling?.kind === 'ceiling') return { at: [x, y - HALF_DEPTH, z], yaw: b.yaw, tilt: Math.PI / 2 };
  return { at: [x, y, z], yaw: b.yaw, tilt: 0 };
}

type M3 = readonly [number, number, number, number, number, number, number, number, number];

const mul = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
  a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
  a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
  a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
  a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
  a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
  a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
];
const apply = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
];
const rx = (a: number): M3 => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const ry = (a: number): M3 => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rz = (a: number): M3 => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: V3): V3 => scale(v, 1 / Math.hypot(...v));

interface Frame {
  p: V3;
  r: M3;
}

/**
 * ポーズの骨ごとの置き方（屋敷の座標）。親の審判は three を持たないので、doll3d の PoseAnimator
 * （骨の角度は x → y → z の Euler、腰は drop だけ下げる）と world3d の placeDoll（根元は y → x の順）と同じ鎖をここでたどる
 */
export function frames(pose: Pose, place: Placement): Record<Bone, Frame> {
  const root: Frame = { p: place.at, r: mul(ry(place.yaw), rx(place.tilt)) };
  const out = {} as Record<Bone, Frame>;
  for (const b of BONES) {
    const parent = PARENT[b];
    const from = parent ? out[parent] : root;
    const local = parent ? sub(JOINTS[b], JOINTS[parent]) : add(JOINTS[b], [0, pose.drop ?? 0, 0]);
    const e = pose.bones[b] ?? [0, 0, 0];
    out[b] = { p: add(from.p, apply(from.r, local)), r: mul(from.r, mul(rx(e[0]), mul(ry(e[1]), rz(e[2])))) };
  }
  return out;
}

export interface Capsule {
  a: V3;
  b: V3;
  r: number;
}

const SHAPES = dollShapes();

/** 円すいは太いほうの半径の筒、楕円体（頭）は最大半径の球にする。当たりは見た目より少し甘くてよい */
export function capsules(pose: Pose, place: Placement): Capsule[] {
  const f = frames(pose, place);
  const at = (bone: Bone, p: V3) => add(f[bone].p, apply(f[bone].r, sub(p, JOINTS[bone])));
  return SHAPES.map((s) => {
    const bone = s.bone as Bone;
    if (s.cone) return { a: at(bone, s.a), b: at(bone, s.cone.b), r: Math.max(s.cone.ra, s.cone.rb) };
    const p = at(bone, s.a);
    return { a: p, b: p, r: Math.max(...(s.ell ?? [0.1, 0.1, 0.1])) };
  });
}

function raySphere(o: V3, d: V3, c: V3, r: number): number | null {
  const oc = sub(o, c);
  const b = dot(d, oc);
  const h = b * b - (dot(oc, oc) - r * r);
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : null;
}

/** 線（o から長さ 1 の向き d）がカプセルに入る距離。当たらなければ null */
export function rayCapsule(o: V3, d: V3, c: Capsule): number | null {
  const ba = sub(c.b, c.a);
  const oa = sub(o, c.a);
  const baba = dot(ba, ba);
  const bard = dot(ba, d);
  const qa = baba - bard * bard;
  if (baba < 1e-12 || qa < 1e-12) {
    const ts = [raySphere(o, d, c.a, c.r), raySphere(o, d, c.b, c.r)].filter((t) => t !== null);
    return ts.length ? Math.min(...ts) : null;
  }
  const baoa = dot(ba, oa);
  const qb = baba * dot(d, oa) - baoa * bard;
  const qc = baba * dot(oa, oa) - baoa * baoa - c.r * c.r * baba;
  const h = qb * qb - qa * qc;
  if (h < 0) return null;
  const t = (-qb - Math.sqrt(h)) / qa;
  const y = baoa + t * bard;
  if (y > 0 && y < baba) return t >= 0 ? t : null;
  return raySphere(o, d, y <= 0 ? c.a : c.b, c.r);
}

/** カメラの殻（shell）ではなく家具まで含めた boxes で見る。始点を含む箱（撃った人の立つ床など）は数えない */
export function rayLevel(lv: Level, o: V3, d: V3, max: number): { t: number; n: V3 } | null {
  let best: { t: number; n: V3 } | null = null;
  for (const box of lv.boxes) {
    let t0 = 0;
    let t1 = best?.t ?? max;
    let n: V3 = [0, 0, 0];
    let miss = false;
    for (let i = 0; i < 3 && !miss; i++) {
      if (Math.abs(d[i]) < 1e-12) {
        miss = o[i] < box.min[i] || o[i] > box.max[i];
        continue;
      }
      let a = (box.min[i] - o[i]) / d[i];
      let c = (box.max[i] - o[i]) / d[i];
      const face: [number, number, number] = [0, 0, 0];
      face[i] = d[i] > 0 ? -1 : 1;
      if (a > c) [a, c] = [c, a];
      if (a > t0) {
        t0 = a;
        n = face;
      }
      t1 = Math.min(t1, c);
      miss = t0 > t1;
    }
    if (!miss && t0 > 0) best = { t: t0, n };
  }
  return best;
}

/** 向き d（長さ 1）を中心に、上下左右へ SPREAD 開いた 4 本と中心の 5 本 */
export function rays(d: V3): V3[] {
  const ref: V3 = Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const r = norm(cross(d, ref));
  const u = cross(r, d);
  const c = Math.cos(SPREAD);
  const s = Math.sin(SPREAD);
  return [d, ...[r, scale(r, -1), u, scale(u, -1)].map((side) => norm(add(scale(d, c), scale(side, s))))];
}

export interface Target {
  seat: number;
  caps: Capsule[];
}

/** seat は当たった人。n は体に当たらず面に当たったときの面の向き（しぶきを置く） */
export interface Ray {
  end: V3;
  seat: number | null;
  n: V3 | null;
}

export function fire(lv: Level, o: V3, d: V3, targets: readonly Target[]): Ray[] {
  return rays(d).map((dir) => {
    const wall = rayLevel(lv, o, dir, RANGE);
    let t = wall?.t ?? RANGE;
    let seat: number | null = null;
    for (const target of targets)
      for (const cap of target.caps) {
        const hit = rayCapsule(o, dir, cap);
        if (hit !== null && hit < t) {
          t = hit;
          seat = target.seat;
        }
      }
    return { end: add(o, scale(dir, t)), seat, n: seat === null && wall ? wall.n : null };
  });
}
