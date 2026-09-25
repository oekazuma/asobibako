/** 座標は盤面の高さを 1 とした単位。x は 0..aspect、y は 0..1 */
export type Point = [number, number];

export interface Stroke {
  color: string;
  pts: Point[];
}

/**
 * 体に対する線の役目。face は体の中に描いたもの、still は体から離れた線や体から下へ長く伸びた線（棒人間の胴や足）で、
 * どちらも体といっしょに動くだけ。still まで振ると、つながって描いた線がばらばらに外れて見える
 */
export type Role = 'body' | 'face' | 'still' | 'leg' | 'arm' | 'top' | 'tail';
export type Kind = 'hop' | 'walk' | 'fly' | 'crawl';

export interface Part {
  color: string;
  /** 生き物の原点からの相対位置 */
  pts: Point[];
  filled: boolean;
  role: Role;
  /** 体とつながっている点。足や腕はここを軸に振る */
  anchor: Point;
  /** 体の右にあれば 1。左右の足を互い違いに、腕を左右そろえて振る */
  side: 1 | -1;
}

export interface Creature {
  /** 描く順（後ろの手足・体・顔）に並んでいる */
  parts: Part[];
  kind: Kind;
  /** 体の中に何も描いていないときは目を付ける */
  eyes: boolean;
  /** 体の半径。体のない絵は大きさの半分 */
  r: number;
  x: number;
  y: number;
  /** 原点からの外枠 [左, 上, 右, 下] */
  box: [number, number, number, number];
  dir: 1 | -1;
  vy: number;
  /** 生まれてからの秒数。ふくらむ演出と動きの位相に使う */
  age: number;
}

export interface World {
  aspect: number;
  creatures: Creature[];
}

export const COLORS = [
  { hex: '#f04438', name: 'あか' },
  { hex: '#f5913e', name: 'オレンジ' },
  { hex: '#ffd84d', name: 'きいろ' },
  { hex: '#b3ec3a', name: 'きみどり' },
  { hex: '#3bb54a', name: 'みどり' },
  { hex: '#5ee0c8', name: 'みずいろ' },
  { hex: '#63a8f7', name: 'あお' },
  { hex: '#a974f2', name: 'むらさき' },
  { hex: '#f25ea6', name: 'ピンク' },
  { hex: '#ffb3d1', name: 'うすピンク' },
  { hex: '#ffd6b0', name: 'はだいろ' },
  { hex: '#8a5a3c', name: 'ちゃいろ' },
  { hex: '#ffffff', name: 'しろ' },
  { hex: '#2b2d42', name: 'くろ' }
] as const;

const MIN_RADIUS = 0.03;
/** これより長く横へ伸びた線はしっぽ。手足より長いものをくねらせて這わせる */
const TAIL = 2.5;
const SPEED: Record<Kind, number> = { hop: 0.2, walk: 0.08, fly: 0.12, crawl: 0.12 };
const MAX = 12;

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

const radius = (pts: Point[], [cx, cy]: Point) =>
  pts.reduce((sum, [x, y]) => sum + Math.hypot(x - cx, y - cy), 0) / pts.length;

function bounds(pts: Point[]): [number, number, number, number] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function area(pts: Point[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}

function inside([x, y]: Point, poly: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** 輪とみなすのに要る、中心のまわりを回った角度。閉じきっていなくても 4 分の 3 周ほど回っていれば繋げる */
const LOOP_TURN = Math.PI * 1.5;

/** 中心のまわりを十分に回った線。大きさを問わず中を塗る */
export function closed(pts: Point[]): boolean {
  if (pts.length < 6) return false;
  const [cx, cy] = center(pts);
  let turn = 0;
  for (let i = 1; i < pts.length; i++) {
    let d = Math.atan2(pts[i][1] - cy, pts[i][0] - cx) - Math.atan2(pts[i - 1][1] - cy, pts[i - 1][0] - cx);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    turn += d;
  }
  return Math.abs(turn) >= LOOP_TURN;
}

/** 体になれる輪か。閉じていて、ある程度の大きさがある */
export const isLoop = (pts: Point[]) => closed(pts) && radius(pts, center(pts)) >= MIN_RADIUS;

const RANK: Record<Role, number> = { still: 0, leg: 0, arm: 0, top: 0, tail: 0, body: 1, face: 2 };

/** 体の外へ出た線を、体の中心から見た向きと長さで手足に分ける */
function limb(pts: Point[], anchor: Point, r: number): Role {
  const [mx, my] = center(pts);
  const reach = Math.max(...pts.map(([x, y]) => Math.hypot(x - anchor[0], y - anchor[1])));
  if (my > 0 && Math.abs(mx) < my * 1.2) return reach > r * 1.8 ? 'still' : 'leg';
  if (my < 0 && Math.abs(mx) < -my) return 'top';
  return length(pts) > r * TAIL ? 'tail' : 'arm';
}

/**
 * 描いた線をまとめて 1 匹にする。いちばん大きな輪が体になり、ほかの線は体の中なら顔、外なら向きで手足になる。
 * 動き方は手足で決まる（しっぽは這う、足は歩く、腕は飛ぶ、何もなければ跳ねる）。輪のない絵は全体をくねらせて這う
 */
export function hatch(strokes: Stroke[], rand = Math.random): Creature | null {
  if (!strokes.length) return null;
  const all = strokes.flatMap((s) => s.pts);
  const body = strokes
    .filter((s) => isLoop(s.pts))
    .reduce<Stroke | null>((big, s) => (!big || area(s.pts) > area(big.pts) ? s : big), null);
  const [l, t, rr, b] = bounds(all);
  const [x, y] = body ? center(body.pts) : [(l + rr) / 2, (t + b) / 2];
  const r = body ? radius(body.pts, [x, y]) : Math.max(MIN_RADIUS, rr - l, b - t) / 2;

  const parts = strokes.map((s): Part => {
    const pts = s.pts.map(([px, py]): Point => [px - x, py - y]);
    const filled = closed(s.pts);
    const [mx] = center(pts);
    const base = { color: s.color, pts, filled, side: mx < 0 ? -1 : 1, anchor: [0, 0] as Point } as const;
    if (s === body) return { ...base, role: 'body' };
    if (!body) return { ...base, role: 'tail' };
    if (s.pts.filter((p) => inside(p, body.pts)).length * 2 >= s.pts.length) return { ...base, role: 'face' };
    const anchor = pts.reduce((a, p) => (Math.hypot(...p) < Math.hypot(...a) ? p : a));
    if (Math.hypot(...anchor) > r * 1.4) return { ...base, role: 'still', anchor };
    return { ...base, role: limb(pts, anchor, r), anchor };
  });
  // しっぽは片側にだけ伸びる。左右の両方へ長く伸ばした線ははね
  const tails = parts.filter((p) => body && p.role === 'tail');
  if (new Set(tails.map((p) => p.side)).size === 2) for (const p of tails) p.role = 'arm';
  parts.sort((a, b) => RANK[a.role] - RANK[b.role] || Number(b.filled) - Number(a.filled) || area(b.pts) - area(a.pts));

  const has = (role: Role) => parts.some((p) => p.role === role);
  const kind: Kind = !body || has('tail') ? 'crawl' : has('leg') ? 'walk' : has('arm') ? 'fly' : 'hop';
  const tail = parts.find((p) => p.role === 'tail');
  // しっぽのある生き物は頭の側へ進む
  const dir = tail && body ? (center(tail.pts)[0] > 0 ? -1 : 1) : rand() < 0.5 ? -1 : 1;
  return {
    parts,
    kind,
    eyes: !!body && !has('face'),
    r,
    x,
    y,
    box: [l - x, t - y, rr - x, b - y],
    dir,
    vy: kind === 'fly' ? (rand() - 0.5) * 0.12 : 0,
    age: 0
  };
}

const ring = (cx: number, cy: number, rx: number, ry: number): Point[] =>
  Array.from({ length: 24 }, (_, i) => {
    const t = (i / 23) * Math.PI * 2;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
  });

/** ボタンで出てくる生き物。まるい体に、足・腕・しっぽのどれかが付くか何も付かない */
export function random(aspect: number, rand = Math.random): Creature {
  const pick = () => COLORS[Math.floor(rand() * (COLORS.length - 2))].hex;
  const r = 0.05 + rand() * 0.03;
  const x = 0.15 * aspect + rand() * 0.7 * aspect;
  const y = 0.15 + rand() * 0.6;
  const extra = pick();
  const strokes: Stroke[] = [{ color: pick(), pts: ring(x, y, r, r) }];
  const bud = (dx: number, dy: number, rx: number, ry: number) =>
    strokes.push({ color: extra, pts: ring(x + dx, y + dy, rx, ry) });
  const pattern = Math.floor(rand() * 4);
  if (pattern === 1) for (const s of [-1, 1]) bud(s * r * 0.5, r * 1.05, r * 0.35, r * 0.3);
  if (pattern === 2) for (const s of [-1, 1]) bud(s * r * 1.2, 0, r * 0.35, r * 0.25);
  if (pattern === 3) {
    const s = rand() < 0.5 ? -1 : 1;
    const len = r * (3 + rand() * 2);
    strokes.push({
      color: extra,
      pts: Array.from({ length: 10 }, (_, i): Point => [x + s * (r + (len * i) / 9), y])
    });
  }
  const c = hatch(strokes, rand)!;
  // しっぽが画面の外にはみ出さないよう、内側へ寄せる
  c.x = Math.min(Math.max(c.x, -c.box[0]), aspect - c.box[2]);
  return c;
}

export function add(world: World, c: Creature): void {
  world.creatures.push(c);
  if (world.creatures.length > MAX) world.creatures.shift();
}

export interface Pose {
  /** 地面から浮かせる高さ */
  lift: number;
  /** 足もとを軸にした伸び縮み */
  sx: number;
  sy: number;
  tilt: number;
}

/** 跳ねる 1 回の長さ（秒）と、そのうち宙にいる区間 */
const HOP = 1;
const AIR: [number, number] = [0.2, 0.8];

export function pose(c: Creature): Pose {
  const t = c.age;
  switch (c.kind) {
    case 'hop': {
      const p = (t % HOP) / HOP;
      if (p < AIR[0] || p >= AIR[1]) {
        const q = p < AIR[0] ? p / AIR[0] : (p - AIR[1]) / (1 - AIR[1]);
        const s = Math.sin(q * Math.PI) * 0.15;
        return { lift: 0, sx: 1 + s, sy: 1 - s, tilt: 0 };
      }
      const q = (p - AIR[0]) / (AIR[1] - AIR[0]);
      return { lift: Math.sin(q * Math.PI) * (0.05 + c.r * 0.8), sx: 0.95, sy: 1.06, tilt: c.dir * 0.12 };
    }
    case 'walk':
      return { lift: Math.abs(Math.sin(t * 6)) * c.r * 0.25, sx: 1, sy: 1, tilt: Math.sin(t * 6) * 0.08 };
    case 'fly':
      return { lift: (Math.sin(t * 3) * 0.5 + 0.5) * c.r * 0.6, sx: 1, sy: 1, tilt: c.dir * 0.1 };
    case 'crawl': {
      const s = Math.sin(t * 7) * 0.08;
      return { lift: 0, sx: 1 + s, sy: 1 - s * 0.5, tilt: 0 };
    }
  }
}

/** 生まれて少しふくらんでから動きだし、画面の端で折り返す */
export function step(world: World, dt: number): void {
  for (const c of world.creatures) {
    c.age += dt;
    if (c.age < 0.6) continue;
    let v = SPEED[c.kind];
    if (c.kind === 'hop') v *= pose(c).lift > 0 ? 1 : 0;
    if (c.kind === 'crawl') v *= 1 + Math.sin(c.age * 7);
    c.x += c.dir * v * dt;
    c.y += c.vy * dt;
    const [l, t, r, b] = c.box;
    if (c.x + l < 0) c.dir = 1;
    if (c.x + r > world.aspect) c.dir = -1;
    if (c.y + t < 0) c.vy = Math.abs(c.vy);
    if (c.y + b > 1) c.vy = -Math.abs(c.vy);
  }
}
