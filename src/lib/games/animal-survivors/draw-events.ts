import { ANIMAL_ART } from './art/animals';
import { ITEM_ART } from './art/items';
import { barsTop, pulse } from './draw-boss';
import { PALETTE } from './art/palette';
import { text, textWidth } from './font';
import { bake } from './pixels';
import { RELIC_ART } from './art/explore';
import { relicTargets } from './draw-explore';
import { inPinch } from './heroes';
import type { World } from './world';

const CONFETTI = 40;
const COLORS = [PALETTE.r, PALETTE.y, PALETTE.u, PALETTE.p, PALETTE.l];

/**
 * 画面の外のものへの向きの矢印を置く位置と向き（画面の中なら null）。
 * 仮想画面の座標で、HUD（上）と持ちもの（下）にかからない内側に置く
 */
export function edgeAt(
  w: World,
  to: { x: number; y: number },
  vw: number,
  vh: number,
  top: number
): { x: number; y: number; angle: number } | null {
  const dx = to.x - w.player.x;
  const dy = to.y - w.player.y;
  if (Math.abs(dx) < vw / 2 - 8 && Math.abs(dy) < vh / 2 - 8) return null;
  const left = 14;
  const right = vw - 14;
  // 上はボスの体力バー（1 本 10 ドット）の下、下は持ちものの欄の上
  const bars = w.enemies.filter((e) => e.alive && e.def.boss).length;
  const up = barsTop(w, top) + 4 + 10 * bars;
  const down = vh - 52;
  const cx = vw / 2;
  const cy = vh / 2;
  // 自分（画面のまん中）から宝箱の向きへ伸ばし、内側の枠に当たった所に置く
  const k = Math.min(
    dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity,
    dy > 0 ? (down - cy) / dy : dy < 0 ? (up - cy) / dy : Infinity
  );
  return { x: Math.round(cx + dx * k), y: Math.round(cy + dy * k), angle: Math.atan2(dy, dx) };
}

/** 画面の外のものへの向きの矢印を画面の端に描き、置いた位置を返す（画面の中なら描かずに null） */
function edgeArrow(
  ctx: CanvasRenderingContext2D,
  w: World,
  to: { x: number; y: number },
  vw: number,
  vh: number,
  top: number
): { x: number; y: number } | null {
  const at = edgeAt(w, to, vw, vh, top);
  if (!at) return null;
  const a = ITEM_ART.arrow;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(at.angle);
  ctx.drawImage(bake(a), -Math.floor(a.w / 2), -Math.floor(a.h / 2));
  ctx.restore();
  return at;
}

/** 矢印を出す相棒（ふたりで遊ぶときの、自分でない動物） */
export const partners = (w: World) => [...w.heroes.keys()].filter((i) => i !== w.cur && !w.heroes[i].gone);

/** 相棒のピンチの赤。ゆっくり強めて弱める（大群の中で点滅させない） */
function pinchAlpha(now: number): number {
  return 0.35 + 0.45 * pulse(now);
}

/**
 * 画面の外の相棒への矢印。宝箱やヌシの矢印と見分けるよう、相棒の顔を画面の内側へ添える。
 * ピンチ（HP 3 割未満か倒れている）なら矢印と顔のうしろに赤い丸を出す
 */
export function partnerArrows(
  ctx: CanvasRenderingContext2D,
  w: World,
  vw: number,
  vh: number,
  top: number,
  now: number
): void {
  for (const i of partners(w)) {
    const h = w.heroes[i];
    const near = edgeAt(w, h.player, vw, vh, top);
    if (!near) continue;
    const face = ANIMAL_ART[h.animal.id].forms[0].walk;
    const y = near.y > vh / 2 ? near.y - 6 - face.h : near.y + 6;
    const x = Math.min(vw - face.w - 2, Math.max(2, near.x - Math.floor(face.w / 2)));
    if (inPinch(h)) {
      ctx.globalAlpha = pinchAlpha(now);
      ctx.fillStyle = PALETTE.r;
      ctx.beginPath();
      ctx.arc(near.x, near.y, 9, 0, Math.PI * 2);
      ctx.arc(x + face.w / 2, y + face.h / 2, face.w / 2 + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    edgeArrow(ctx, w, h.player, vw, vh, top);
    ctx.drawImage(bake(face), x, y);
  }
}

/** 画面の中のピンチの相棒の足もとの赤い輪（自分の動物には出さない） */
export function pinchRing(ctx: CanvasRenderingContext2D, w: World, i: number, now: number): void {
  const h = w.heroes[i];
  if (i === w.cur || !inPinch(h)) return;
  const p = h.player;
  ctx.globalAlpha = pinchAlpha(now);
  ctx.strokeStyle = PALETTE.r;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 8, 12, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** 宝の地図の宝箱が消えるまでの秒を、この秒より少なくなったら明滅させる */
const HURRY = 10;

/** 画面の外の重い宝箱と祭壇への矢印。宝箱か祭壇の印と残り秒を画面の内側へ添える */
export function carryArrows(
  ctx: CanvasRenderingContext2D,
  w: World,
  vw: number,
  vh: number,
  top: number,
  now: number
): void {
  const c = w.carry;
  if (!c) return;
  const s = String(Math.ceil(c.life));
  ctx.globalAlpha = c.life > HURRY ? 1 : 0.45 + 0.55 * pulse(now);
  const box = edgeArrow(ctx, w, c, vw, vh, top);
  if (box) {
    const art = ITEM_ART.chest;
    const y = box.y > vh / 2 ? box.y - 6 - art.h - 7 : box.y + 6;
    ctx.drawImage(bake(art), box.x - Math.floor(art.w / 2), y);
    text(ctx, s, box.x - Math.round(textWidth(s) / 2), y + art.h + 1, PALETTE.y);
  }
  const altar = edgeArrow(ctx, w, { x: c.ax, y: c.ay }, vw, vh, top);
  if (altar) {
    const y = altar.y > vh / 2 ? altar.y - 12 : altar.y + 10;
    ctx.strokeStyle = PALETTE.y;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(altar.x, y, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 下の端では矢印が輪の下に来るので、秒は輪の上に置く
    if (!box) text(ctx, s, altar.x - Math.round(textWidth(s) / 2), altar.y > vh / 2 ? y - 10 : y + 5, PALETTE.y);
  }
  ctx.globalAlpha = 1;
}

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

/** 遺物の絵を添える高さ。下半分では HUD の武器の枠に重ならないよう、矢印の上に出す */
export const relicIconY = (atY: number, vh: number) => (atY > vh / 2 ? atY - 18 : atY + 6);

/** 画面の外の遺物への矢印。宝箱やヌシと見分けるよう、遺物の絵を画面の内側へ添える */
export function relicArrows(ctx: CanvasRenderingContext2D, w: World, vw: number, vh: number, top: number): void {
  for (const t of relicTargets(w)) {
    const at = edgeArrow(ctx, w, t, vw, vh, top);
    if (at) ctx.drawImage(bake(RELIC_ART[t.id]), at.x - 6, relicIconY(at.y, vh));
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
