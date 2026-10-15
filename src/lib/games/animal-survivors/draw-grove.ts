import { FAIRY_RING_ART } from './art/grove';
import { PALETTE } from './art/palette';
import { RING_DY } from './bosses';
import { BURST_SECS, chargeTime, RING_R } from './fairy';
import { bake } from './pixels';
import type { World } from './world';

/** 地面の上・敵の下。ためているあいだは輪の内側を下から光で満たす */
export function drawRing(ctx: CanvasRenderingContext2D, w: World, q: (v: number) => number): void {
  const f = w.fairy;
  const ring = f.ring;
  if (!ring) return;
  const art = FAIRY_RING_ART;
  const cy = ring.y + RING_DY;
  if (f.charge > 0) {
    const k = Math.min(1, f.charge / chargeTime(w));
    ctx.save();
    ctx.beginPath();
    ctx.arc(ring.x, cy, RING_R - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PALETTE.w;
    ctx.fillRect(ring.x - RING_R, cy + RING_R - 2 - (RING_R * 2 - 4) * k, RING_R * 2, RING_R * 2);
    ctx.restore();
  }
  // 絵の中の輪の中心は (34, 38)
  ctx.drawImage(bake(art), q(ring.x - 34), q(cy - 38));
}

/** 満ちた光。輪の中心から白い円が広がって消える。動きを減らす設定では出さない */
export function drawBurst(ctx: CanvasRenderingContext2D, w: World, still: boolean): void {
  const f = w.fairy;
  if (f.burst <= 0 || still) return;
  const k = 1 - f.burst / BURST_SECS;
  ctx.globalAlpha = (1 - k) * 0.6;
  ctx.fillStyle = PALETTE.w;
  ctx.beginPath();
  ctx.arc(f.bx, f.by + RING_DY, RING_R + k * Math.hypot(w.view.w, w.view.h) * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
