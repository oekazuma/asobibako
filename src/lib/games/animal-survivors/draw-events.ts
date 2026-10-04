import { ITEM_ART } from './art/items';
import { pulse } from './draw-boss';
import { PALETTE } from './art/palette';
import { text, textWidth } from './font';
import { bake } from './pixels';
import type { World } from './world';

const CONFETTI = 40;
const COLORS = [PALETTE.r, PALETTE.y, PALETTE.u, PALETTE.p, PALETTE.l];

/**
 * 画面の外のものへの向きの矢印を画面の端に描き、置いた位置を返す（画面の中なら描かずに null）。
 * 仮想画面の座標で、HUD（上）と持ちもの（下）にかからない内側に置く
 */
function edgeArrow(
  ctx: CanvasRenderingContext2D,
  w: World,
  to: { x: number; y: number },
  vw: number,
  vh: number,
  top: number
): { x: number; y: number } | null {
  const dx = to.x - w.player.x;
  const dy = to.y - w.player.y;
  if (Math.abs(dx) < vw / 2 - 8 && Math.abs(dy) < vh / 2 - 8) return null;
  const left = 14;
  const right = vw - 14;
  // 上はボスの体力バー（1 本 10 ドット）の下、下は持ちものの欄の上
  const bars = w.enemies.filter((e) => e.alive && e.def.boss).length;
  const up = top + 26 + 10 * bars;
  const down = vh - 52;
  const cx = vw / 2;
  const cy = vh / 2;
  // 自分（画面のまん中）から宝箱の向きへ伸ばし、内側の枠に当たった所に置く
  const k = Math.min(
    dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity,
    dy > 0 ? (down - cy) / dy : dy < 0 ? (up - cy) / dy : Infinity
  );
  const x = Math.round(cx + dx * k);
  const y = Math.round(cy + dy * k);
  const a = ITEM_ART.arrow;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.drawImage(bake(a), -Math.floor(a.w / 2), -Math.floor(a.h / 2));
  ctx.restore();
  return { x, y };
}

/** 宝の地図の宝箱が消えるまでの秒を、この秒より少なくなったら明滅させる */
const HURRY = 10;

/**
 * 宝の地図の宝箱への案内。画面の外なら端の矢印に宝箱と残り秒を添え、画面の中なら宝箱の上に
 * はずむ矢印と残り秒を出す（ふつうの宝箱と見分け、消えるまでの秒を見せる）
 */
export function treasureArrow(
  ctx: CanvasRenderingContext2D,
  w: World,
  vw: number,
  vh: number,
  top: number,
  now: number
): void {
  const t = w.treasure;
  if (!t?.alive) return;
  const left = t.life ?? 0;
  const s = String(Math.ceil(left));
  ctx.globalAlpha = left > HURRY ? 1 : 0.45 + 0.55 * pulse(now);
  const at = edgeArrow(ctx, w, t, vw, vh, top);
  if (at) {
    // 宝箱と秒は画面の内側へ添える（下の端では持ちものの欄にかかるので上に置く）
    const c = ITEM_ART.chest;
    const y = at.y > vh / 2 ? at.y - 6 - c.h - 7 : at.y + 6;
    ctx.drawImage(bake(c), at.x - Math.floor(c.w / 2), y);
    text(ctx, s, at.x - Math.round(textWidth(s) / 2), y + c.h + 1, PALETTE.y);
  } else {
    const x = Math.round(vw / 2 + t.x - w.player.x);
    const y = Math.round(vh / 2 + t.y - w.player.y) - 18 + Math.round(Math.sin(now * 6) * 2);
    const a = ITEM_ART.arrow;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(bake(a), -Math.floor(a.w / 2), -Math.floor(a.h / 2));
    ctx.restore();
    text(ctx, s, x - Math.round(textWidth(s) / 2), y - 14, PALETTE.y);
  }
  ctx.globalAlpha = 1;
}

/** 画面の外のヌシへの矢印。宝箱の矢印と見分けるよう、残り秒の代わりに王冠を添える */
export function chiefArrows(ctx: CanvasRenderingContext2D, w: World, vw: number, vh: number, top: number): void {
  const c = ITEM_ART.crown;
  for (const e of w.enemies) {
    if (!e.alive || !e.def.chief) continue;
    const at = edgeArrow(ctx, w, e, vw, vh, top);
    if (at) ctx.drawImage(bake(c), at.x - Math.floor(c.w / 2), at.y + 6);
  }
}

/** お祭りのあいだ、画面の左右と上の縁に紙ふぶきを降らせる */
export function confetti(ctx: CanvasRenderingContext2D, w: World, vw: number, vh: number, now: number): void {
  if (w.festival <= 0) return;
  ctx.globalAlpha = Math.min(1, w.festival / 1.5);
  for (let i = 0; i < CONFETTI; i++) {
    const h1 = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1);
    const h2 = Math.abs((Math.sin(i * 78.233) * 12345.6789) % 1);
    // 4 割は上の帯、残りは左右の帯に置く
    const band = i % 5 === 0 || i % 5 === 1 ? 'top' : i % 2 ? 'left' : 'right';
    const fall = (h2 * vh + now * (30 + h1 * 30)) % vh;
    const x = band === 'top' ? h1 * vw : band === 'left' ? 4 + h1 * 22 + Math.sin(now * 3 + i) * 3 : vw - 26 + h1 * 22;
    const y = band === 'top' ? (fall % 40) + 4 : fall;
    ctx.fillStyle = COLORS[i % COLORS.length];
    const flip = Math.floor(now * 6 + i) % 2;
    ctx.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, flip ? 1 : 3);
  }
  ctx.globalAlpha = 1;
}
