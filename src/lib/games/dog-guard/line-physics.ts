import { pushOut, type Seg } from '$lib/segments';

type P = { x: number; y: number };
export type Ball = { x: number; y: number; r: number };

/**
 * 重力で落ちる 1 本の線。点ごとに動かして当たり判定し、そのあと線を引いたときの形に
 * 最も近い剛体の位置へ戻す（shape matching）。支えから外れた側が重ければ線は傾いて倒れる
 */
export interface LineBody {
  pts: P[];
  prev: P[];
  /** 線を引いたときの点。形の基準にする */
  rest: P[];
  /** 止まってからのフレーム数。線を押すものはハチも含めてないので、止まりきったら動かさない */
  still: number;
}

const SLEEP_FRAMES = 20;

const GRAVITY = 2.4;
const SUBSTEPS = 4;
const ITERATIONS = 3;
/**
 * 触れている点を形合わせで重く扱う。同じ重さだと、端の 2 点だけで立つドームは
 * 押し戻しが全体の 2/50 しか効かず、床に沈んで薄い足場をすり抜ける
 */
const CONTACT_WEIGHT = 30;
const FRICTION = 0.8;

/**
 * 点の間隔を線の太さ r にそろえ（広いと壁の角が点のあいだを抜ける）、引いた時点のめり込みを
 * 止まったまま直す。めり込みを落ちる途中で直すと、その押し戻しが速さになって線が跳ね上がる
 */
export function makeLineBody(stroke: P[], walls: readonly Seg[], balls: readonly Ball[], r: number): LineBody {
  const gap = r;
  const pts = [{ ...stroke[0] }];
  let since = 0;
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1];
    const b = stroke[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    let t = gap - since;
    for (; t <= d; t += gap) pts.push({ x: a.x + ((b.x - a.x) * t) / d, y: a.y + ((b.y - a.y) * t) / d });
    since = d - (t - gap);
  }
  const end = stroke[stroke.length - 1];
  if (since > gap * 0.3) pts.push({ ...end });
  const body = { pts, prev: pts.map((p) => ({ ...p })), rest: pts.map((p) => ({ ...p })), still: 0 };
  for (let k = 0; k < ITERATIONS * 4; k++) match(body, collide(body, walls, balls, r));
  body.prev = pts.map((p) => ({ ...p }));
  return body;
}

/** 押し出した点の、接線方向の動きを摩擦で削る。押し出しで外向きの速さは生まない */
function contact(p: P, q: P, x: number, y: number) {
  const nx = x - p.x;
  const ny = y - p.y;
  const n = Math.hypot(nx, ny) || 1;
  p.x = x;
  p.y = y;
  const tx = -ny / n;
  const ty = nx / n;
  const slide = ((p.x - q.x) * tx + (p.y - q.y) * ty) * FRICTION;
  p.x -= tx * slide;
  p.y -= ty * slide;
  const out = ((p.x - q.x) * nx + (p.y - q.y) * ny) / n;
  if (out > 0) {
    q.x += (nx / n) * out;
    q.y += (ny / n) * out;
  }
}

function collide(body: LineBody, walls: readonly Seg[], balls: readonly Ball[], r: number): number[] {
  return body.pts.map((p, i) => {
    const q = body.prev[i];
    let hit = false;
    for (const wall of walls) {
      const out = pushOut(wall, r, p.x, p.y, r);
      if (out) {
        contact(p, q, ...out);
        hit = true;
      }
    }
    for (const b of balls) {
      const d = Math.hypot(p.x - b.x, p.y - b.y) || 1e-9;
      const reach = b.r + r;
      if (d < reach) {
        contact(p, q, b.x + ((p.x - b.x) / d) * reach, b.y + ((p.y - b.y) / d) * reach);
        hit = true;
      }
    }
    if (p.x < r || p.x > 1 - r) {
      contact(p, q, Math.min(1 - r, Math.max(r, p.x)), p.y);
      hit = true;
    }
    return hit ? CONTACT_WEIGHT : 1;
  });
}

/** 重みつきで、元の形を回して動かしたときにいまの点へ最も近くなる位置へ、すべての点を置き直す */
function match(body: LineBody, w: number[]) {
  const { pts, rest } = body;
  let sw = 0;
  let cx = 0;
  let cy = 0;
  let rx = 0;
  let ry = 0;
  pts.forEach((p, i) => {
    sw += w[i];
    cx += p.x * w[i];
    cy += p.y * w[i];
    rx += rest[i].x * w[i];
    ry += rest[i].y * w[i];
  });
  [cx, cy, rx, ry] = [cx / sw, cy / sw, rx / sw, ry / sw];
  let sin = 0;
  let cos = 0;
  pts.forEach((p, i) => {
    const [qx, qy] = [rest[i].x - rx, rest[i].y - ry];
    const [px, py] = [p.x - cx, p.y - cy];
    sin += w[i] * (qx * py - qy * px);
    cos += w[i] * (qx * px + qy * py);
  });
  const a = Math.atan2(sin, cos);
  const [c, s] = [Math.cos(a), Math.sin(a)];
  pts.forEach((p, i) => {
    const [qx, qy] = [rest[i].x - rx, rest[i].y - ry];
    p.x = cx + qx * c - qy * s;
    p.y = cy + qx * s + qy * c;
  });
}

/** r は線の太さの半分。壁も同じ太さで扱う。止まりきっていて動かさなかったら false */
export function fall(body: LineBody, dt: number, walls: readonly Seg[], balls: readonly Ball[], r: number): boolean {
  if (body.still >= SLEEP_FRAMES) return false;
  const h = dt / SUBSTEPS;
  const before = body.pts.map((p) => ({ ...p }));
  for (let s = 0; s < SUBSTEPS; s++) {
    body.pts.forEach((p, i) => {
      const q = body.prev[i];
      const [vx, vy] = [p.x - q.x, p.y - q.y];
      q.x = p.x;
      q.y = p.y;
      p.x += vx;
      p.y += vy + GRAVITY * h * h;
    });
    for (let k = 0; k < ITERATIONS; k++) match(body, collide(body, walls, balls, r));
  }
  // 支えの上でも毎回の重力で少し沈んで押し戻されるので、1 フレームでの動きで見る
  const moving = body.pts.some((p, i) => Math.abs(p.x - before[i].x) + Math.abs(p.y - before[i].y) > 1e-4);
  body.still = moving ? 0 : body.still + 1;
  return true;
}
