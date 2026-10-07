import { itemArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import { overtimeRate, xpNeed } from './drops';
import type { ViewSize } from './draw';
import { text, textWidth } from './font';
import { bake } from './pixels';
import { blessings } from './draw-explore';
import { WEAPONS } from './weapons';
import { coinsOf, type Owned, type World } from './world';

const SLOT = 14;

function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
  back: string
) {
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, ratio))), h);
  ctx.fillStyle = 'rgb(255 255 255 / 0.35)';
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, ratio))), 1);
}

export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function slots(ctx: CanvasRenderingContext2D, owned: Owned[], prefix: string, x: number, y: number) {
  for (let i = 0; i < 6; i++) {
    const sx = x + i * SLOT;
    ctx.fillStyle = 'rgb(36 21 31 / 0.55)';
    ctx.fillRect(sx, y, SLOT - 1, SLOT - 1);
    const o = owned[i];
    if (!o) continue;
    ctx.drawImage(bake(itemArt(`${prefix}-${o.id}`)), sx, y);
    const def = prefix === 'weapon' ? WEAPONS[o.id] : undefined;
    const lv = def?.union ? '+' : def?.special ? '^' : def?.evolved ? '*' : String(o.level);
    text(ctx, lv, sx + SLOT - 5, y + SLOT - 6, PALETTE.y);
  }
}

/** top は仮想ドットでの上の余白（シェルの隅のボタンの下から書く） */
export function hud(ctx: CanvasRenderingContext2D, w: World, v: ViewSize, top: number): void {
  bar(ctx, 1, 1, v.w - 2, 3, w.xp / xpNeed(w.level), PALETTE.u, PALETTE.U);

  text(ctx, `Lv ${w.level}`, 6, top, PALETTE.w);
  const t = clock(w.time);
  text(ctx, t, Math.round((v.w - textWidth(t, 2)) / 2), top - 2, PALETTE.y, 2);
  const kills = String(w.kills);
  const kx = v.w - 6 - textWidth(kills);
  text(ctx, kills, kx, top, PALETTE.w);
  ctx.drawImage(bake(ITEM_ART.skull), kx - 11, top - 2);
  const coins = String(coinsOf(w));
  const cx = v.w - 6 - textWidth(coins);
  text(ctx, coins, cx, top + 11, PALETTE.y);
  ctx.drawImage(bake(ITEM_ART.coin), cx - 10, top + 9);
  if (w.overtime) {
    const rate = `x${overtimeRate(w)}`;
    text(ctx, rate, cx - 14 - textWidth(rate), top + 11, PALETTE.o);
  }

  const hp = Math.ceil(w.player.hp);
  bar(ctx, 6, top + 12, 80, 4, w.player.hp / w.stats.maxHp, PALETTE.r, PALETTE.R);
  text(ctx, `${hp}/${Math.round(w.stats.maxHp)}`, 90, top + 11, PALETTE.w);

  blessings(ctx, w, 6, v.h - SLOT * 2 - 16, text);
  slots(ctx, w.weapons, 'weapon', 6, v.h - SLOT * 2 - 8);
  slots(ctx, w.passives, 'passive', 6, v.h - SLOT - 6);
}
