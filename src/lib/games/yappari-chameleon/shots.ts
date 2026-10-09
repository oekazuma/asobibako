import type { V3 } from '$lib/sculpt';
import { BONES, dollShapes, JOINTS, PARENT, type Bone } from './doll';
import { RADIUS, type Cling, type Level, type Ramp } from './move';
import { poseById, STAND, type Pose } from './poses';

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
  /** ポーズの ID。張り付いた体を、そのポーズの当たりが張り付いた面の奥へ出ない所まで面から離す */
  pose?: string;
}

function basePlacement(b: Placeable): Placement {
  const [x, y, z] = b.pos;
  if (b.cling?.kind === 'wall') {
    const k = RADIUS - HALF_DEPTH;
    return { at: [x - b.cling.nx * k, y, z - b.cling.nz * k], yaw: b.yaw, tilt: 0 };
  }
  // 背中を天井に付け、前を下へ向ける
  if (b.cling?.kind === 'ceiling') return { at: [x, y - HALF_DEPTH, z], yaw: b.yaw, tilt: Math.PI / 2 };
  return { at: [x, y, z], yaw: b.yaw, tilt: 0 };
}

/**
 * 張り付いた体は、ポーズで面の中へ入らないよう、立つときより深く出るぶんだけ部屋の側へ離す。人形の 3D・親の当たり・
 * ほかの人の体・見落としと埋まりの判定がみなここを通るので、見た目と当たりはそろう。Body.pos は変えない
 */
export function placement(b: Placeable): Placement {
  const p = basePlacement(b);
  if (!b.cling || !b.pose) return p;
  // カプセルは見た目より太く、立って張り付いた体でも面の奥へ出るので、立つときの深さを引いて立つ体は面に付けたままにする
  const d = Math.max(0, sink(poseById(b.pose), b.cling.kind) - sink(STAND, b.cling.kind));
  const n: V3 = b.cling.kind === 'wall' ? [b.cling.nx, 0, b.cling.nz] : [0, -1, 0];
  return { ...p, at: add(p.at, scale(n, d)) };
}

const SINK = new Map<string, number>();

/**
 * 張り付いたとき、ポーズの当たりのカプセルの面が張り付いた面の奥へ出るいちばん深い所（0 以上）。
 * 壁の体はいつも面を向き（張り付くときに yaw を面へ向け、壁ではその場で回れない）、天井は yaw で深さが変わらないので、
 * 決まった置き方で 1 度だけ測って控える
 */
export function sink(pose: Pose, kind: Cling['kind']): number {
  const key = `${pose.id}:${kind}`;
  const known = SINK.get(key);
  if (known !== undefined) return known;
  const isWall = kind === 'wall';
  const base = basePlacement({
    pos: [0, 0, 0],
    yaw: 0,
    cling: isWall ? { kind: 'wall', nx: 0, nz: -1 } : { kind: 'ceiling' }
  });
  // 部屋の側の向きと、張り付いた面の上の点（壁は体の中心から RADIUS 先、天井は体の高さ）
  const n: V3 = isWall ? [0, 0, -1] : [0, -1, 0];
  const s: V3 = isWall ? [0, 0, RADIUS] : [0, 0, 0];
  let d = 0;
  for (const c of capsules(pose, base)) for (const q of [c.a, c.b]) d = Math.max(d, c.r - dot(sub(q, s), n));
  SINK.set(key, d);
  return d;
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

/** f(p) = c + g·p ≥ 0 の側だけを残す平面（坂の表面の下） */
interface Plane {
  c: number;
  g: V3;
}

/** 線が箱（と平面の下側）に入る距離と、入った面の向き。始点を含む箱は null */
function enter(min: V3, max: V3, o: V3, d: V3, limit: number, plane?: Plane): { t: number; n: V3 } | null {
  let t0 = 0;
  let t1 = limit;
  let n: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
      continue;
    }
    let a = (min[i] - o[i]) / d[i];
    let c = (max[i] - o[i]) / d[i];
    const face: [number, number, number] = [0, 0, 0];
    face[i] = d[i] > 0 ? -1 : 1;
    if (a > c) [a, c] = [c, a];
    if (a > t0) {
      t0 = a;
      n = face;
    }
    t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  if (plane) {
    const f0 = plane.c + dot(plane.g, o);
    const s = dot(plane.g, d);
    if (Math.abs(s) < 1e-12) {
      if (f0 < 0) return null;
    } else {
      const tp = -f0 / s;
      if (s > 0) {
        if (tp > t0) {
          t0 = tp;
          n = norm(scale(plane.g, -1));
        }
      } else t1 = Math.min(t1, tp);
      if (t0 > t1) return null;
    }
  }
  return t0 > 0 ? { t: t0, n } : null;
}

/** 表面 y = h0 + k·u（u は rise の軸）より下の坂の中身 */
function rampPlane(r: Ramp): Plane {
  const axis = r.rise[0] === 'x' ? 0 : 2;
  const up = r.rise[1] === '+';
  const run = r.max[axis] - r.min[axis];
  const k = ((r.max[1] - r.min[1]) / run) * (up ? 1 : -1);
  const h0 = r.min[1] - k * (up ? r.min[axis] : r.max[axis]);
  const g: [number, number, number] = [0, -1, 0];
  g[axis] = k;
  return { c: h0, g };
}

/**
 * カメラの殻（shell）ではなく家具まで含めた boxes と、表面より下を中身とみなした坂（ramps）で見る。
 * 階段は 1 段ずつの塊として描かれているので、弾も段の下へ抜けさせない
 */
export function rayLevel(lv: Level, o: V3, d: V3, max: number): { t: number; n: V3 } | null {
  let best = null as { t: number; n: V3 } | null;
  const hits = [
    ...lv.boxes.map((box) => (limit: number) => enter(box.min, box.max, o, d, limit)),
    ...lv.ramps.map((r) => (limit: number) => enter(r.min, r.max, o, d, limit, rampPlane(r)))
  ];
  for (const hit of hits) best = hit(best?.t ?? max) ?? best;
  return best;
}

/** 向き d（長さ 1）を中心に、上下左右へ SPREAD 開いた 4 本と中心の 5 本 */
export function rays(d: V3): V3[] {
  // 真上や真下を向くまで水平を基準にする。途中で基準を替えると、一人称の急な見上げで十字が回って見える
  let side = cross(d, [0, 1, 0]);
  if (Math.hypot(...side) < 1e-6) side = cross(d, [1, 0, 0]);
  const r = norm(side);
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
