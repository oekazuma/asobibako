import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import type { ViewSize } from './draw';
import { text } from './font';
import { bake } from './pixels';
import type { World } from './world';

type Snap = (v: number) => number;

/** 床に出す予告（地ならしの輪と突進の矢印）。敵より先に描く */
export function hazardsBelow(ctx: CanvasRenderingContext2D, w: World, q: Snap, now: number): void {
  for (const h of w.hazards) {
    if (!h.alive) continue;
    if (h.kind === 'slam' && h.delay > 0) {
      const t = 1 - h.delay / 1;
      ctx.fillStyle = 'rgb(216 70 60 / 0.25)';
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + 8), h.r * t, h.r * t * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgb(216 70 60 / 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + 8), h.r, h.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (h.kind === 'dash') {
      const owner = w.enemies[h.owner];
      const a = Math.atan2(h.vy, h.vx);
      ctx.save();
      ctx.translate(q(owner.x), q(owner.y + 6));
      ctx.rotate(a);
      // 枠は点滅させ、中は突進が近づくほど先まで赤く満ちる
      const fill = Math.min(1, 1 - h.delay / 0.7);
      const arrow = () => {
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(h.r - 12, -5);
        ctx.lineTo(h.r - 12, -11);
        ctx.lineTo(h.r, 0);
        ctx.lineTo(h.r - 12, 11);
        ctx.lineTo(h.r - 12, 5);
        ctx.lineTo(0, 5);
        ctx.closePath();
      };
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = PALETTE.r;
      arrow();
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = PALETTE.r;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, -12, h.r * fill, 24);
      ctx.clip();
      arrow();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = Math.floor(now * 8) % 2 ? 0.9 : 0.5;
      ctx.strokeStyle = PALETTE.w;
      ctx.lineWidth = 1.5;
      arrow();
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}

/** 飛んでいる糸の玉と、地ならしの衝撃波 */
export function hazardsAbove(ctx: CanvasRenderingContext2D, w: World, q: Snap): void {
  for (const h of w.hazards) {
    if (!h.alive) continue;
    if (h.kind === 'web') ctx.drawImage(bake(ITEM_ART[h.art ?? 'web']), q(h.x - 4), q(h.y - 4));
    else if (h.kind === 'slam' && h.delay <= 0) {
      const t = 1 - h.life / 0.3;
      ctx.globalAlpha = 0.8 * (1 - t);
      ctx.lineWidth = 3;
      for (const [k, color] of [
        [1, PALETTE.w],
        [0.8, PALETTE.o]
      ] as const) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.ellipse(q(h.x), q(h.y + 8), h.r * (0.6 + t * 0.6) * k, h.r * (0.6 + t * 0.6) * k * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}

/** HUD の HP の棒の下に、いるボスの数だけ HP の棒を並べる */
export function bossBars(ctx: CanvasRenderingContext2D, w: World, v: ViewSize, top: number): void {
  let y = top + 22;
  for (const e of w.enemies) {
    if (!e.alive || !e.def.boss) continue;
    const width = v.w - 60;
    text(ctx, 'BOSS', 6, y - 1, PALETTE.y);
    ctx.fillStyle = PALETTE.k;
    ctx.fillRect(28, y - 1, width + 2, 6);
    ctx.fillStyle = '#3a1d4a';
    ctx.fillRect(29, y, width, 4);
    ctx.fillStyle = PALETTE.v;
    ctx.fillRect(29, y, Math.round((width * Math.max(0, e.hp)) / e.def.hp), 4);
    ctx.fillStyle = 'rgb(255 255 255 / 0.35)';
    ctx.fillRect(29, y, Math.round((width * Math.max(0, e.hp)) / e.def.hp), 1);
    y += 10;
  }
}
