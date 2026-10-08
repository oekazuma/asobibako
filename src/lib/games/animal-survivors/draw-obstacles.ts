import { OBSTACLE_ART } from './art/obstacles';
import { CELL, obstacleAt, SHAPES, type Ground, type Obstacle } from './obstacles';
import { bake } from './pixels';

/** 絵は足もとより上へ伸びるので、画面の上の外にある障害物も拾う */
const OVER = 48;
/** 自分の頭が絵の上の端より下にある（ほとんど隠れている）ときだけ薄くする */
const HEAD = 10;

/** 描く範囲（画面の左上 cx・cy と大きさ）に、絵の大きさぶんの余白を足した中か */
export function onScreen(x: number, y: number, cx: number, cy: number, vw: number, vh: number, pad = 48): boolean {
  return x > cx - pad && x < cx + vw + pad && y > cy - pad && y < cy + vh + pad;
}

/** 湯気の 2 コマを入れ替える番号（now は秒）。ゆっくり入れ替えて、明滅ではなく形の揺れに見せる */
export const steamFrame = (now: number, n: number) => (n > 1 ? Math.floor(now / 0.5) % n : 0);

export function inView(g: Ground, cx: number, cy: number, w: number, h: number, out: Obstacle[]): Obstacle[] {
  out.length = 0;
  for (let gx = Math.floor((cx - OVER) / CELL); gx <= Math.floor((cx + w + OVER) / CELL); gx++)
    for (let gy = Math.floor((cy - OVER) / CELL); gy <= Math.floor((cy + h + OVER * 2) / CELL); gy++) {
      const o = obstacleAt(g, gx, gy);
      if (o && o.x > cx - OVER && o.x < cx + w + OVER && o.y > cy - OVER && o.y < cy + h + OVER * 2) out.push(o);
    }
  return out.sort((a, b) => feetOf(a) - feetOf(b));
}

/** 絵の下の端。敵や自分と奥行きを比べる高さ */
export const feetOf = (o: Obstacle) => o.y + SHAPES[o.kind].foot;

/** 足もとの順に並んだ障害物を、足もとの高さで敵のあいだに差し込む（奥のものから描くと手前が上に重なる） */
export function byFeet<T>(items: T[], feet: (t: T) => number, obs: Obstacle[]): (T | Obstacle)[] {
  const sorted = [...items].sort((a, b) => feet(a) - feet(b));
  const out: (T | Obstacle)[] = [];
  let j = 0;
  for (const it of sorted) {
    while (j < obs.length && feetOf(obs[j]) <= feet(it)) out.push(obs[j++]);
    out.push(it);
  }
  while (j < obs.length) out.push(obs[j++]);
  return out;
}

/**
 * 真ん中 (x, y)・高さ h の体より手前にあって、その絵に重なる障害物か。
 * 自分は敵より上に描くので、手前の障害物は自分のあとにもう一度描いて隠す
 */
export function covers(o: Obstacle, x: number, y: number, h: number): boolean {
  const art = OBSTACLE_ART[o.kind];
  const base = feetOf(o);
  return base > y + h / 2 && base - art.h < y + h / 2 && Math.abs(o.x - x) < art.w / 2 + h / 2;
}

export function drawObstacles(
  ctx: CanvasRenderingContext2D,
  list: Obstacle[],
  now: number,
  q: (v: number) => number,
  // 手前の障害物に自分がほとんど隠れたら、その障害物を薄くして自分を見せる
  behind?: { x: number; y: number },
  // 自分の前に描き直すときは、影を重ねて濃くしない
  shade = true
): void {
  for (const o of list) {
    const art = OBSTACLE_ART[o.kind];
    const s = SHAPES[o.kind];
    const top = o.y + s.foot - art.h;
    ctx.globalAlpha =
      behind && Math.abs(behind.x - o.x) < art.w / 2 && behind.y - HEAD > top && behind.y < o.y + s.foot ? 0.55 : 1;
    if (shade) {
      ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
      ctx.beginPath();
      ctx.ellipse(q(o.x), q(o.y + s.foot - 1), art.w * 0.42, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const frame = steamFrame(now, art.frames.length);
    ctx.drawImage(bake(art, frame), q(o.x - art.w / 2), q(top));
  }
  ctx.globalAlpha = 1;
}
