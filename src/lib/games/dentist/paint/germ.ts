import { GERM_R, type GermKind } from '../animals';
import { LINE, oval } from './style';

const EYE = '#2e2522';
const BODY: Record<GermKind, string> = { normal: '#bfe88a', quick: '#d7b8ff', boss: '#9fd36c' };
/** 絵を描く単位での半径。GERM_R の大きさに縮めて描く */
const SIZE: Record<GermKind, number> = { normal: 17, quick: 17, boss: 22 };

export interface GermLook {
  /** ピンセットでつままれていると足をばたつかせる */
  held: boolean;
  /** 穴から出てきてからの秒。出てくるときにぽんと膨らむ */
  age: number;
}

function line(ctx: CanvasRenderingContext2D, d: string, width: number, color = EYE): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(new Path2D(d));
}

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  width = 2.3
): void {
  oval(ctx, x, y, rx, ry);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = LINE;
  ctx.stroke();
}

function blob(ctx: CanvasRenderingContext2D, p: Path2D, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.lineWidth = 2.3;
  ctx.strokeStyle = LINE;
  ctx.stroke(p);
}

export function drawGerm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: GermKind,
  t: number,
  look: GermLook
): void {
  const r = SIZE[kind];
  const k = GERM_R[kind] / r;
  const grow = Math.min(1, look.age / 0.25);
  const pop = grow < 1 ? grow * 1.15 : 1;
  const sq = 1 + Math.sin(t * 7 + x * 40) * 0.07;
  const fill = BODY[kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k * sq * pop, k * (2 - sq) * pop);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (look.held)
    for (const s of [-1, 1])
      for (const n of [0, 1]) {
        const g = Math.PI / 2 + s * (0.35 + n * 0.5) + Math.sin(t * 24 + n * 2 + s) * 0.25;
        const [fx, fy] = [Math.cos(g) * r * 1.5, Math.sin(g) * r * 1.5];
        line(ctx, `M${Math.cos(g) * r * 0.7},${Math.sin(g) * r * 0.7} L${fx},${fy}`, 2.6, LINE);
        dot(ctx, fx, fy, 3, 2.3, fill);
      }
  if (kind !== 'quick') for (const s of [-1, 1]) dot(ctx, s * r * 0.72, -r * 0.78, 5, 5, fill);
  const body =
    kind === 'quick'
      ? 'M0,-17 l6,7 8,-2 -1,8 7,5 -7,5 1,8 -8,-2 -6,7 -6,-7 -8,2 1,-8 -7,-5 7,-5 -1,-8 8,2z'
      : `M${r},0 A${r},${r} 0 1,0 ${-r},0 A${r},${r} 0 1,0 ${r},0`;
  blob(ctx, new Path2D(body), fill);
  if (kind === 'quick') line(ctx, 'M-22,-14 l-6,-2 M-22,-6 l-7,1 M22,-14 l6,-2 M22,-6 l7,1', 2, LINE);
  if (kind === 'boss') blob(ctx, new Path2D('M-10,-19 l4,-9 6,6 6,-6 4,9 z'), '#ffd45c');
  if (look.held) {
    line(ctx, 'M-8,-4 L-4,-1 L-8,2 M8,-4 L4,-1 L8,2', 2);
    line(ctx, 'M-10,-9 l6,-2 M10,-9 l-6,-2', 1.8);
    dot(ctx, 0, 8, 2.4, 2.8, '#ee8595', 1.6);
  } else {
    const lx = Math.sin(t * 1.3 + x * 17) * 0.9;
    for (const s of [-1, 1]) {
      oval(ctx, s * 6 + lx, -1, 3.2, 3.2);
      ctx.fillStyle = EYE;
      ctx.fill();
      oval(ctx, s * 6 + lx + 1, -2, 1.1, 1.1);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    line(ctx, 'M-10,-6 l6,2 M10,-6 l-6,2', 1.8);
    line(ctx, 'M-5,6 Q0,10 5,6', 2);
    ctx.fillStyle = '#fff';
    ctx.fill(new Path2D('M-2.5,7.3 l1,2.8 1,-2.4'));
    if (kind === 'boss') line(ctx, 'M-8,5 q4,-3 8,0 q4,-3 8,0', 2.4, LINE);
  }
  ctx.restore();
}
