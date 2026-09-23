import type { Tooth } from '../animals';

/** 角の丸い歯の輪郭 */
export function toothPath(t: Tooth): Path2D {
  const p = new Path2D();
  p.roundRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, t.w * 0.42);
  return p;
}

/** 症状を重ねる前の白い歯。ふちは顔の線より淡くして、口の中を明るく見せる */
export function drawToothBase(ctx: CanvasRenderingContext2D, t: Tooth): void {
  const path = toothPath(t);
  ctx.fillStyle = '#fff';
  ctx.fill(path);
  ctx.lineWidth = 0.006;
  ctx.strokeStyle = '#d8c8c0';
  ctx.stroke(path);
}
