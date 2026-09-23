/** 座標は盤面の高さを 1 とした単位。x は 0..aspect、y は 0..1 */
export type Point = [number, number];

export interface Stroke {
  color: string;
  pts: Point[];
}

export interface Creature {
  head: string;
  body: string;
  /** 頭の輪郭と胴体の線。どちらも頭の中心からの相対位置 */
  outline: Point[];
  spine: Point[];
  x: number;
  y: number;
  r: number;
  /** 進む向き（長さ 1） */
  dx: number;
  dy: number;
  /** 生まれてからの秒数。ふくらむ演出と這う動きの位相に使う */
  age: number;
}

export interface World {
  aspect: number;
  creatures: Creature[];
}

export const COLORS = ['#ffd84d', '#b3ec3a', '#f5913e', '#f25ea6', '#5ee0c8', '#63a8f7', '#a974f2', '#4a3230'] as const;

const MIN_RADIUS = 0.03;
const MIN_BODY = 0.05;
const SPEED = 0.12;

function center(pts: Point[]): Point {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

function length(pts: Point[]): number {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return sum;
}

/** 輪とみなすのに要る、中心のまわりを回った角度。閉じきっていなくても 4 分の 3 周ほど回っていれば繋げる */
const LOOP_TURN = Math.PI * 1.5;

/** 頭になる輪か。中心のまわりを十分に回っていて、ある程度の大きさがあれば頭とみなす */
export function isLoop(pts: Point[]): boolean {
  if (pts.length < 6) return false;
  const [cx, cy] = center(pts);
  const r = pts.reduce((sum, [x, y]) => sum + Math.hypot(x - cx, y - cy), 0) / pts.length;
  let turn = 0;
  for (let i = 1; i < pts.length; i++) {
    let d = Math.atan2(pts[i][1] - cy, pts[i][0] - cx) - Math.atan2(pts[i - 1][1] - cy, pts[i - 1][0] - cx);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    turn += d;
  }
  return r >= MIN_RADIUS && Math.abs(turn) >= LOOP_TURN;
}

export const isBody = (pts: Point[]) => length(pts) >= MIN_BODY;

/** 頭と胴体から生き物を作る。胴体のうち頭から遠い端を尻尾にして、尻尾から頭へ向かって進む */
export function hatch(head: Stroke, body: Stroke): Creature {
  const [x, y] = center(head.pts);
  const r = head.pts.reduce((sum, [px, py]) => sum + Math.hypot(px - x, py - y), 0) / head.pts.length;
  const far = (p: Point) => Math.hypot(p[0] - x, p[1] - y);
  // 胴体は首から尻尾の順に並べる。うねりは首側を抑えるので、描いた向きのままだと首が揺れてしまう
  const pts = far(body.pts[0]) > far(body.pts[body.pts.length - 1]) ? body.pts.toReversed() : body.pts;
  const tail = pts[pts.length - 1];
  const d = Math.hypot(x - tail[0], y - tail[1]) || 1;
  return {
    head: head.color,
    body: body.color,
    outline: head.pts.map(([px, py]) => [px - x, py - y]),
    spine: pts.map(([px, py]) => [px - x, py - y]),
    x,
    y,
    r,
    dx: (x - tail[0]) / d,
    dy: (y - tail[1]) / d,
    age: 0
  };
}

/** ボタンで出てくる生き物。まっすぐな胴体で、画面のどこかから好きな向きへ這う */
export function random(aspect: number, rand = Math.random): Creature {
  const pick = () => COLORS[Math.floor(rand() * COLORS.length)];
  const r = 0.045 + rand() * 0.03;
  const a = rand() * Math.PI * 2;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const len = 0.15 + rand() * 0.15;
  const outline: Point[] = Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2;
    return [Math.cos(t) * r, Math.sin(t) * r];
  });
  const spine: Point[] = Array.from({ length: 10 }, (_, i) => [-dx * len * (i / 9), -dy * len * (i / 9)]);
  return {
    head: pick(),
    body: pick(),
    outline,
    spine,
    x: 0.15 * aspect + rand() * 0.7 * aspect,
    y: 0.15 + rand() * 0.6,
    r,
    dx,
    dy,
    age: 0
  };
}

/** 見た目より少し余裕をもって外へ出たか */
function gone(c: Creature, aspect: number): boolean {
  const reach = Math.max(c.r, ...c.spine.map(([x, y]) => Math.hypot(x, y))) + c.r;
  return c.x < -reach || c.x > aspect + reach || c.y < -reach || c.y > 1 + reach;
}

/** 生まれて少しふくらんでから、尺取り虫のように伸び縮みしながら進む。画面の外へ出たら消える */
export function step(world: World, dt: number): void {
  for (const c of world.creatures) {
    c.age += dt;
    if (c.age < 0.6) continue;
    const pace = SPEED * (1 + Math.sin(c.age * 7));
    c.x += c.dx * pace * dt;
    c.y += c.dy * pace * dt;
  }
  world.creatures = world.creatures.filter((c) => !gone(c, world.aspect));
}
