import { OBSTACLE_ART } from './art/obstacles';
import { CELL, obstacleAt, SHAPES, type Ground, type Obstacle } from './obstacles';
import { bake } from './pixels';

/** 絵は足もとより上へ伸びるので、画面の上の外にある障害物も拾う */
const OVER = 48;
/** 自分の頭が絵の上の端より下にある（ほとんど隠れている）ときだけ薄くする */
const HEAD = 10;

export function inView(g: Ground, cx: number, cy: number, w: number, h: number, out: Obstacle[]): Obstacle[] {
  out.length = 0;
  for (let gx = Math.floor((cx - OVER) / CELL); gx <= Math.floor((cx + w + OVER) / CELL); gx++)
    for (let gy = Math.floor((cy - OVER) / CELL); gy <= Math.floor((cy + h + OVER * 2) / CELL); gy++) {
      const o = obstacleAt(g, gx, gy);
      if (o && o.x > cx - OVER && o.x < cx + w + OVER && o.y > cy - OVER && o.y < cy + h + OVER * 2) out.push(o);
    }
  return out.sort((a, b) => a.y - b.y);
}

export function drawObstacles(
  ctx: CanvasRenderingContext2D,
  list: Obstacle[],
  now: number,
  q: (v: number) => number,
  // 手前の障害物に自分がほとんど隠れたら、その障害物を薄くして自分を見せる
  behind?: { x: number; y: number }
): void {
  for (const o of list) {
    const art = OBSTACLE_ART[o.kind];
    const s = SHAPES[o.kind];
    const top = o.y + s.foot - art.h;
    ctx.globalAlpha =
      behind && Math.abs(behind.x - o.x) < art.w / 2 && behind.y - HEAD > top && behind.y < o.y + s.foot ? 0.55 : 1;
    ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
    ctx.beginPath();
    ctx.ellipse(q(o.x), q(o.y + s.foot - 1), art.w * 0.42, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // 湯気だけゆっくり 2 コマを入れ替える（明滅ではなく形が揺れる）
    const frame = art.frames.length > 1 ? Math.floor(now / 500) % art.frames.length : 0;
    ctx.drawImage(bake(art, frame), q(o.x - art.w / 2), q(top));
  }
  ctx.globalAlpha = 1;
}
