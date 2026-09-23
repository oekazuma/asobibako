import type { Creature, Point } from './engine';

/** 描いている途中の線の太さ */
export const PEN = 0.012;
const INK = '#2b2d42';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 少し行き過ぎて戻る、ぷくっとした立ち上がり */
const spring = (t: number) => (t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 1.5) * (1 - t));

function path(ctx: CanvasRenderingContext2D, pts: Point[], close = false) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

export function pen(ctx: CanvasRenderingContext2D, pts: Point[], color: string, alpha = 1) {
  if (pts.length < 2) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = PEN;
  path(ctx, pts);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** 描き終えた頭。閉じていなくても始点と終点を結んで塗る */
export function blob(ctx: CanvasRenderingContext2D, pts: Point[], color: string) {
  path(ctx, pts, true);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = PEN;
  ctx.stroke();
}

/** 胴体をうねらせる。頭から離れるほど大きく揺れ、進む向きに伸び縮みする */
function wiggle(c: Creature, grow: number): Point[] {
  const px = -c.dy;
  const py = c.dx;
  const stretch = 1 + 0.12 * Math.sin(c.age * 7) * grow;
  let along = 0;
  return c.spine.map(([x, y], i) => {
    if (i > 0) along += Math.hypot(x - c.spine[i - 1][0], y - c.spine[i - 1][1]);
    const wave = Math.sin(c.age * 7 - along * 25) * Math.min(1, along / 0.2) * c.r * 0.25 * grow;
    return [c.x + x * stretch + px * wave, c.y + y * stretch + py * wave];
  });
}

export function creature(ctx: CanvasRenderingContext2D, c: Creature) {
  const grow = spring(clamp01(c.age / 0.45));
  ctx.strokeStyle = c.body;
  ctx.lineWidth = PEN + (c.r * 1.1 - PEN) * grow;
  path(ctx, wiggle(c, grow), c.filled);
  if (c.filled) {
    ctx.fillStyle = c.body;
    ctx.fill();
  }
  ctx.stroke();

  const head = c.outline.map(([x, y]): Point => [c.x + x, c.y + y]);
  path(ctx, head, true);
  ctx.globalAlpha = clamp01(grow);
  ctx.fillStyle = c.head;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = c.head;
  ctx.lineWidth = PEN + c.r * 0.3 * grow;
  ctx.stroke();

  const hair = clamp01((c.age - 0.25) / 0.3);
  if (hair > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = c.r * 0.12;
    for (const a of [-0.35, 0, 0.35]) {
      const bx = c.x + Math.sin(a) * c.r * 0.9;
      const by = c.y - Math.cos(a) * c.r * 0.9;
      const len = c.r * 0.6 * spring(hair);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.sin(a) * len, by - Math.cos(a) * len);
      ctx.stroke();
    }
  }

  // 顔はいつも正面を向き、目だけ進む向きへ寄せる
  const ex = c.x + c.dx * c.r * 0.2;
  const ey = c.y + c.dy * c.r * 0.15;
  const blink = (c.age + c.r * 40) % 3.5 < 0.12 ? 0.15 : 1;
  ctx.fillStyle = INK;
  ctx.globalAlpha = clamp01(grow);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(ex + side * c.r * 0.3, ey, c.r * 0.1, c.r * 0.2 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
