import { area, closed, hatch, pose, type Creature, type Part, type Point, type Stroke } from './engine';

/** 描いている途中の線の太さ */
export const PEN = 0.012;
const INK = '#2b2d42';
/** 塗った形のふち。しろで塗っても地から浮くように */
const RIM = 'rgb(43 45 66 / 0.25)';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 少し行き過ぎて戻る、ぷくっとした立ち上がり */
const spring = (t: number) => (t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 1.5) * (1 - t));

function path(ctx: CanvasRenderingContext2D, pts: Point[], close = false) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

function draw(ctx: CanvasRenderingContext2D, pts: Point[], color: string, filled: boolean, width = PEN) {
  if (!pts.length) return;
  ctx.fillStyle = color;
  // 点を打っただけの線（目など）は、長さ 0 の線だと何も描かれないので丸を置く
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], width * 1.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  path(ctx, pts, filled);
  if (filled) ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  if (!filled) return;
  ctx.strokeStyle = RIM;
  ctx.lineWidth = PEN * 0.4;
  ctx.stroke();
}

export function pen(ctx: CanvasRenderingContext2D, pts: Point[], color: string) {
  draw(ctx, pts, color, false);
}

/** まだ動きだしていない絵。塗る輪を大きい順に下へ敷き、線はその上に描く */
export function sketch(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  const layers = strokes.map((s) => ({ ...s, filled: closed(s.pts) }));
  layers.sort((a, b) => Number(b.filled) - Number(a.filled) || area(b.pts) - area(a.pts));
  for (const s of layers) draw(ctx, s.pts, s.color, s.filled);
}

/** 手足を付け根のまわりに振る角度 */
function swing(c: Creature, p: Part): number {
  const t = c.age;
  switch (p.role) {
    case 'leg':
      return c.kind === 'walk'
        ? Math.sin(t * 6 + (p.side > 0 ? Math.PI : 0)) * 0.45
        : Math.sin(t * 10 + p.anchor[0] * 40) * 0.3;
    case 'arm':
      return -p.side * Math.sin(t * (c.kind === 'fly' ? 14 : 5)) * (c.kind === 'fly' ? 0.6 : 0.3);
    case 'top':
      return Math.sin(t * 9 + p.side) * 0.2;
    default:
      return 0;
  }
}

/** しっぽは付け根から離れるほど大きくうねる */
function wave(c: Creature, p: Part, grow: number): Point[] {
  const [ax, ay] = p.anchor;
  const amp = Math.min(c.r, 0.08) * 0.35 * grow;
  return p.pts.map(([x, y]): Point => {
    const d = Math.hypot(x - ax, y - ay);
    return [x, y + Math.sin(c.age * 7 - d * 25) * Math.min(1, d / 0.2) * amp];
  });
}

/** 手足の線は動きだすとぷくっと太る。体のある生き物のしっぽは、むかしのムシのように胴体の太さまで */
function width(c: Creature, p: Part, grow: number): number {
  if (p.filled || p.role === 'body' || p.role === 'face') return PEN;
  const fat = p.role === 'tail' && c.parts.some((q) => q.role === 'body') ? c.r * 0.8 : PEN * 2.5;
  return PEN + (fat - PEN) * grow;
}

/** 黒やちゃいろの体には白い目を付ける */
function dark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 110;
}

function eyes(ctx: CanvasRenderingContext2D, c: Creature) {
  const ex = c.dir * c.r * 0.2;
  const ey = -c.r * 0.15;
  const blink = (c.age + c.r * 40) % 3.5 < 0.12 ? 0.15 : 1;
  ctx.fillStyle = dark(c.parts.find((p) => p.role === 'body')!.color) ? '#fff' : INK;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(ex + side * c.r * 0.3, ey, c.r * 0.1, c.r * 0.2 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function creature(ctx: CanvasRenderingContext2D, c: Creature) {
  const grow = spring(clamp01(c.age / 0.45));
  const { lift, sx, sy, tilt } = pose(c);
  const g = 0.6 + 0.4 * grow;
  const foot = c.box[3];
  ctx.save();
  ctx.translate(c.x, c.y + foot - lift);
  ctx.rotate(tilt);
  ctx.scale(sx * g, sy * g);
  ctx.translate(0, -foot);
  for (const p of c.parts) {
    const w = width(c, p, grow);
    if (p.role === 'tail') {
      draw(ctx, wave(c, p, grow), p.color, p.filled, w);
      continue;
    }
    const a = swing(c, p) * grow;
    ctx.save();
    ctx.translate(p.anchor[0], p.anchor[1]);
    ctx.rotate(a);
    ctx.translate(-p.anchor[0], -p.anchor[1]);
    draw(ctx, p.pts, p.color, p.filled, w);
    ctx.restore();
  }
  if (c.eyes) eyes(ctx, c);
  ctx.restore();
}

/** ふくらみきって跳ねる前の、止まったかっこうで枠いっぱいに描く */
function frame(strokes: Stroke[], size: number, background?: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = hatch(strokes);
  const ctx = canvas.getContext('2d');
  if (!c || !ctx) return '';
  c.age = 1;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  const [l, t, r, b] = c.box;
  const pad = Math.max(PEN * 3, c.r * 0.5);
  const s = Math.min(size / (r - l + pad * 2), size / (b - t + pad * 2));
  ctx.setTransform(s, 0, 0, s, size / 2 - s * (c.x + (l + r) / 2), size / 2 - s * (c.y + (t + b) / 2));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  creature(ctx, c);
  return canvas.toDataURL();
}

const portraits = new WeakMap<Stroke[], string>();

/**
 * ずかんの絵の画像（data URL）。canvas を何十枚も並べると iPad でスクロールの合成が重くなるので、
 * 画像にして <img> で並べる
 */
export function portrait(strokes: Stroke[]): string {
  const cached = portraits.get(strokes);
  if (cached) return cached;
  const url = frame(strokes, 160);
  portraits.set(strokes, url);
  return url;
}

/**
 * 写真アプリに入れる絵。透けていると写真アプリで黒く見えるので白く塗る。保存するときだけ作るので覚えない
 */
export const picture = (strokes: Stroke[]) => frame(strokes, 1024, '#fff');
