import { animal } from './animals';
import { goldArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import { LINK_SHOW } from './link';
import { HALVES } from './link-halves';
import { bake } from './pixels';
import type { World } from './world';

const ICON = 36;

/** 連携の技の絵。広がりながら薄くなる金色の形と、動物の最初の武器の絵を金色で大きく（点滅させない） */
export function drawLink(ctx: CanvasRenderingContext2D, w: World): void {
  for (const s of w.link.shows) {
    const k = Math.min(1, s.t / LINK_SHOW);
    const shape = HALVES[s.animal].shape;
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - k);
    ctx.fillStyle = PALETTE.y;
    ctx.strokeStyle = PALETTE.y;
    ctx.translate(s.x, s.y);
    if (shape.kind === 'ring') {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, shape.r * (0.3 + 0.7 * k), 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.kind === 'cone') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, shape.len * (0.3 + 0.7 * k), s.angle - shape.spread / 2, s.angle + shape.spread / 2);
      ctx.closePath();
      ctx.fill();
    } else
      for (const a of shape.angles) {
        ctx.save();
        ctx.rotate(s.angle + a);
        ctx.fillRect(0, -shape.width / 2, shape.len * (0.3 + 0.7 * k), shape.width);
        ctx.restore();
      }
    ctx.restore();
    ctx.globalAlpha = 1 - k;
    const art = bake(goldArt(ITEM_ART[`weapon-${animal(s.animal).weapon}`]));
    ctx.drawImage(art, Math.round(s.x - ICON / 2), Math.round(s.y - ICON - 10 * k), ICON, ICON);
    ctx.globalAlpha = 1;
  }
}
