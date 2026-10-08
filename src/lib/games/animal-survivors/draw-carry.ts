import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import { ALTAR_R, CARRY_REACH } from './carry';
import { pulse } from './draw-boss';
import { bake, type Art } from './pixels';
import type { World } from './world';

/** 2 倍で描く宝箱の左上。動くものなので、ほかの絵と同じく端末の画素に丸める（q は draw.ts の丸め） */
export function chestAt(c: { x: number; y: number }, art: Art, q: (v: number) => number): { x: number; y: number } {
  return { x: q(c.x - art.w), y: q(c.y - art.h * 2 + 6) };
}

/** 祭壇と宝箱のまわりの輪（地面の高さで、敵より先に描く）。光はなめらかに強めて弱める */
export function drawCarry(ctx: CanvasRenderingContext2D, w: World, now: number): void {
  const c = w.carry;
  if (!c) return;
  const glow = 0.45 + 0.35 * pulse(now);
  ctx.globalAlpha = glow * 0.35;
  ctx.fillStyle = PALETTE.y;
  ctx.beginPath();
  ctx.ellipse(c.ax, c.ay, ALTAR_R + 6, (ALTAR_R + 6) * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = glow;
  ctx.strokeStyle = PALETTE.y;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 寄っている動物 1 匹ごとに輪の半分を光らせ、2 匹目が要ることを見せる
  const r = CARRY_REACH * 0.7;
  c.near.forEach((on, k) => {
    ctx.globalAlpha = on ? 1 : 0.4;
    ctx.strokeStyle = on ? PALETTE.y : PALETTE.w;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 6, r, r * 0.55, 0, k * Math.PI + Math.PI / 2, (k + 1) * Math.PI + Math.PI / 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

/** 重い宝箱と祭壇への向きの矢印。障害物と同じく足もとの高さの順で、敵や障害物と混ぜて描く */
export function drawCarryChest(ctx: CanvasRenderingContext2D, w: World, q: (v: number) => number): void {
  const c = w.carry;
  if (!c) return;
  const a = ITEM_ART.chest;
  const at = chestAt(c, a, q);
  ctx.drawImage(bake(a), at.x, at.y, a.w * 2, a.h * 2);
  if (c.near.length > 1 && c.near.every(Boolean)) {
    const ang = Math.atan2(c.ay - c.y, c.ax - c.x);
    const arrow = ITEM_ART.arrow;
    ctx.save();
    ctx.translate(q(c.x + Math.cos(ang) * 26), q(c.y + Math.sin(ang) * 26));
    ctx.rotate(ang);
    ctx.drawImage(bake(arrow), -Math.floor(arrow.w / 2), -Math.floor(arrow.h / 2));
    ctx.restore();
  }
}
