import type { V3 } from '$lib/sculpt';
import { HEIGHT } from './doll';

export interface Box {
  min: V3;
  max: V3;
}

/** 坂（階段の上り）。rise の向きへ min.y から max.y まで上がる。坂の横の壁は箱で別に置く */
export interface Ramp {
  min: V3;
  max: V3;
  rise: 'x+' | 'x-' | 'z+' | 'z-';
}

export interface Level {
  boxes: Box[];
  ramps: Ramp[];
  spawn: V3;
}

export type Cling = { kind: 'wall'; nx: number; nz: number } | { kind: 'ceiling' };

export interface Body {
  pos: [number, number, number];
  vy: number;
  yaw: number;
  ground: boolean;
  cling: Cling | null;
}

export interface Input {
  x: number;
  z: number;
  run: boolean;
  jump: boolean;
  up: boolean;
  down: boolean;
  release: boolean;
  lock: boolean;
  turn: number;
}

export const RADIUS = 0.2;
export const STEP = 0.3;
export const WALK = 2.0;
export const RUN = 3.8;
export const CLIMB = 1.0;
const JUMP = 4.2;
const GRAVITY = 12;
const TURN = 2.5;
const FACE = 10;
/** 壁際とみなす、体のふちから壁までの距離 */
const NEAR = 0.12;

export const newBody = (at: V3): Body => ({ pos: [at[0], at[1], at[2]], vy: 0, yaw: 0, ground: false, cling: null });

export const idle = (): Input => ({
  x: 0,
  z: 0,
  run: false,
  jump: false,
  up: false,
  down: false,
  release: false,
  lock: false,
  turn: 0
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 体の高さの範囲に掛かる箱（足もとの段は STEP まで上れるので除く） */
const blocks = (b: Body, box: Box) => box.max[1] > b.pos[1] + STEP && box.min[1] < b.pos[1] + HEIGHT;

/** 体の円を箱の外へ押し出し、押した向き（壁の法線）を返す */
function pushOut(b: Body, lv: Level): { nx: number; nz: number } | null {
  let normal: { nx: number; nz: number } | null = null;
  for (let pass = 0; pass < 2; pass++)
    for (const box of lv.boxes) {
      if (!blocks(b, box)) continue;
      const [x, , z] = b.pos;
      const cx = clamp(x, box.min[0], box.max[0]);
      const cz = clamp(z, box.min[2], box.max[2]);
      const dx = x - cx;
      const dz = z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= RADIUS) continue;
      if (d > 1e-6) {
        b.pos[0] = cx + (dx / d) * RADIUS;
        b.pos[2] = cz + (dz / d) * RADIUS;
        normal = { nx: dx / d, nz: dz / d };
      } else {
        // 中心が箱の中に入った（速く当たった）ときは、いちばん浅い面から出す
        const out = [
          [x - box.min[0], -1, 0],
          [box.max[0] - x, 1, 0],
          [z - box.min[2], 0, -1],
          [box.max[2] - z, 0, 1]
        ].sort((p, q) => p[0] - q[0])[0];
        b.pos[0] += out[1] * (out[0] + RADIUS);
        b.pos[2] += out[2] * (out[0] + RADIUS);
        normal = { nx: out[1], nz: out[2] };
      }
    }
  return normal;
}

/** 体のふちから NEAR 以内にある壁の法線（張り付けるか、まだ張り付いていられるか） */
export function wallNear(
  b: Body,
  lv: Level,
  want?: { nx: number; nz: number }
): { nx: number; nz: number; top: number } | null {
  let best: { nx: number; nz: number; top: number; d: number } | null = null;
  for (const box of lv.boxes) {
    if (!(box.max[1] > b.pos[1] + 0.05 && box.min[1] < b.pos[1] + HEIGHT * 0.6)) continue;
    const [x, , z] = b.pos;
    const cx = clamp(x, box.min[0], box.max[0]);
    const cz = clamp(z, box.min[2], box.max[2]);
    const d = Math.hypot(x - cx, z - cz);
    if (d > RADIUS + NEAR || d < 1e-6) continue;
    const nx = Math.round((x - cx) / d);
    const nz = Math.round((z - cz) / d);
    if (Math.abs(nx) + Math.abs(nz) !== 1) continue;
    if (want && (nx !== want.nx || nz !== want.nz)) continue;
    if (!best || d < best.d) best = { nx, nz, top: box.max[1], d };
  }
  return best && { nx: best.nx, nz: best.nz, top: best.top };
}

function rampHeight(r: Ramp, x: number, z: number): number | null {
  if (x < r.min[0] || x > r.max[0] || z < r.min[2] || z > r.max[2]) return null;
  const t =
    r.rise === 'x+'
      ? (x - r.min[0]) / (r.max[0] - r.min[0])
      : r.rise === 'x-'
        ? (r.max[0] - x) / (r.max[0] - r.min[0])
        : r.rise === 'z+'
          ? (z - r.min[2]) / (r.max[2] - r.min[2])
          : (r.max[2] - z) / (r.max[2] - r.min[2]);
  return r.min[1] + (r.max[1] - r.min[1]) * t;
}

/** 足もとより STEP までの高さにある、いちばん高い床 */
function groundAt(lv: Level, x: number, z: number, below: number): number {
  let g = -Infinity;
  const e = RADIUS * 0.7;
  for (const box of lv.boxes)
    if (x > box.min[0] - e && x < box.max[0] + e && z > box.min[2] - e && z < box.max[2] + e && box.max[1] <= below)
      g = Math.max(g, box.max[1]);
  for (const r of lv.ramps) {
    const h = rampHeight(r, x, z);
    if (h !== null && h <= below) g = Math.max(g, h);
  }
  return g;
}

/** (x, z) の真下で y 以下にある、いちばん高い床の高さ。無ければ y（空中や天井から出したカメラを床へ下ろすのに使う） */
export function floorBelow(lv: Level, x: number, z: number, y: number): number {
  const g = groundAt(lv, x, z, y);
  return Number.isFinite(g) ? g : y;
}

/** 頭の上の、いちばん低い天井（箱の下の面） */
function ceilingAt(lv: Level, b: Body): number {
  let c = Infinity;
  const e = RADIUS * 0.7;
  for (const box of lv.boxes) {
    const [x, y, z] = b.pos;
    if (x > box.min[0] - e && x < box.max[0] + e && z > box.min[2] - e && z < box.max[2] + e && box.min[1] >= y + STEP)
      c = Math.min(c, box.min[1]);
  }
  return c;
}

function turnToward(b: Body, x: number, z: number, dt: number) {
  const want = Math.atan2(x, z);
  let d = want - b.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  b.yaw += clamp(d, -FACE * dt, FACE * dt);
}

function stepWall(b: Body, c: { nx: number; nz: number }, inp: Input, lv: Level, dt: number) {
  const vy = (inp.up ? CLIMB : 0) - (inp.down ? CLIMB : 0);
  // 床は動く前の高さで探す（下がって床より下へ出ると、床が「足もとより上」になって見つからない）
  const floor = groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + 0.01);
  const tx = -c.nz;
  const tz = c.nx;
  const side = (inp.x * tx + inp.z * tz) * CLIMB * 0.8;
  b.pos[0] += tx * side * dt;
  b.pos[2] += tz * side * dt;
  b.pos[1] += vy * dt;
  if (Math.abs(side) > 1e-6) pushOut(b, lv);
  const ceil = ceilingAt(lv, b);
  if (b.pos[1] + HEIGHT >= ceil) {
    b.cling = { kind: 'ceiling' };
    b.pos[1] = ceil;
    b.ground = false;
    return;
  }
  // 床の高さで張り付いたまま待てるよう、外すのは「さがる」で床まで下りたときだけ
  if (inp.down && b.pos[1] <= floor) {
    b.pos[1] = floor;
    b.cling = null;
    b.ground = true;
    return;
  }
  const wall = wallNear(b, lv, c);
  if (wall) return;
  // 壁の上まで上がり切った（台の上へ乗る）か、横へはみ出した（落ちる）
  b.cling = null;
  b.vy = 0;
  b.ground = false;
  const top = wallNear({ ...b, pos: [b.pos[0], b.pos[1] - 0.3, b.pos[2]] }, lv, c);
  if (top && inp.up) {
    b.pos[1] = top.top;
    b.pos[0] -= c.nx * (RADIUS + NEAR + 0.05);
    b.pos[2] -= c.nz * (RADIUS + NEAR + 0.05);
    b.ground = true;
  }
}

function stepCeiling(b: Body, inp: Input, lv: Level, dt: number) {
  if (inp.release || inp.down) {
    b.cling = null;
    b.vy = 0;
    b.pos[1] -= HEIGHT;
    b.ground = false;
    return;
  }
  const px = b.pos[0];
  const pz = b.pos[2];
  b.pos[0] += inp.x * CLIMB * dt;
  b.pos[2] += inp.z * CLIMB * dt;
  // 天井ボックスが干渉判定のブロッカーに数えられないよう、吊った体を少し下げる
  const hang = { ...b, pos: [b.pos[0], b.pos[1] - HEIGHT - 0.01, b.pos[2]] as [number, number, number] };
  const hx = hang.pos[0];
  const hz = hang.pos[2];
  pushOut(hang, lv);
  if (hang.pos[0] !== hx || hang.pos[2] !== hz) {
    b.pos[0] = px;
    b.pos[2] = pz;
  }
  const checkHang = { ...b, pos: [b.pos[0], b.pos[1] - HEIGHT - 0.01, b.pos[2]] as [number, number, number] };
  if (Math.abs(ceilingAt(lv, checkHang) - b.pos[1]) > 0.01) {
    b.pos[0] = px;
    b.pos[2] = pz;
  }
}

export function step(b: Body, inp: Input, lv: Level, dt: number): void {
  if (b.pos[1] < -10) {
    b.pos = [...lv.spawn] as [number, number, number];
    b.vy = 0;
    b.cling = null;
    return;
  }
  // その場で回転は回転ロックと別の操作で、いつでも（天井にいるときも）効く。壁では体が壁を向いたままにする
  if (b.cling?.kind !== 'wall') b.yaw += inp.turn * TURN * dt;
  if (b.cling?.kind === 'ceiling') return stepCeiling(b, inp, lv, dt);
  if (b.cling?.kind === 'wall') {
    if (inp.release) {
      b.cling = null;
      b.vy = 0;
      b.ground = false;
    } else return stepWall(b, b.cling, inp, lv, dt);
  }

  const len = Math.hypot(inp.x, inp.z);
  if (!inp.lock && len > 0.1) turnToward(b, inp.x, inp.z, dt);
  const speed = inp.run ? RUN : WALK;
  // 速く歩いても箱を抜けないよう、半径の半分ずつに分けて動かす
  const dist = speed * Math.min(1, len) * dt;
  const parts = Math.max(1, Math.ceil(dist / (RADIUS * 0.5)));
  const wasGround = b.ground;
  for (let i = 0; i < parts; i++) {
    b.pos[0] += (inp.x * speed * dt) / parts;
    b.pos[2] += (inp.z * speed * dt) / parts;
    // 段の上へ乗れるよう、横に動いたあとで床の高さへ持ち上げてから押し出す
    const g = groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + STEP);
    if (b.ground && g > b.pos[1]) b.pos[1] = g;
    pushOut(b, lv);
  }

  if (inp.jump) {
    const wall = wallNear(b, lv);
    if (wall) {
      b.cling = { kind: 'wall', nx: wall.nx, nz: wall.nz };
      b.vy = 0;
      b.yaw = Math.atan2(-wall.nx, -wall.nz);
      b.ground = false;
      return;
    }
    if (b.ground) {
      b.vy = JUMP;
      b.ground = false;
    }
  }

  b.vy -= GRAVITY * dt;
  b.pos[1] += b.vy * dt;
  const ceil = ceilingAt(lv, b);
  if (b.pos[1] + HEIGHT > ceil) {
    b.pos[1] = ceil - HEIGHT;
    b.vy = Math.min(0, b.vy);
  }
  const g = groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + STEP);
  if (b.pos[1] <= g || (wasGround && b.vy <= 0 && b.pos[1] - g < STEP)) {
    b.pos[1] = g;
    b.vy = 0;
    b.ground = true;
  } else b.ground = false;
}

/** カメラの線（o から向き d、長さ max）が箱に当たるまでの距離 */
export function rayDistance(lv: Level, o: V3, d: V3, max: number): number {
  let best = max;
  for (const box of lv.boxes) {
    let t0 = 0;
    let t1 = best;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < box.min[i] || o[i] > box.max[i]) t0 = Infinity;
        continue;
      }
      let a = (box.min[i] - o[i]) / d[i];
      let c = (box.max[i] - o[i]) / d[i];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
    }
    if (t0 <= t1 && t0 < best) best = t0;
  }
  return best;
}
