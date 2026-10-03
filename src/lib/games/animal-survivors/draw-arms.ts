import { ANIMAL_ART } from './art/animals';
import { goldArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import { frameAt, hash } from './draw';
import { bake, type Art } from './pixels';
import { baseOf } from './evolutions';
import { WEAPONS } from './weapons';
import type { World } from './world';

type Snap = (v: number) => number;

/** 進化形の武器の弾・炎・ツタ・線は金色で描く */
const isGold = (w: World, slot: number) => WEAPONS[w.weapons[slot]?.id ?? '']?.evolved ?? false;
const kindOf = (w: World, slot: number) => baseOf(w.weapons[slot]?.id ?? '');

function rotated(
  ctx: CanvasRenderingContext2D,
  q: Snap,
  art: Art,
  x: number,
  y: number,
  angle: number,
  size = 1,
  gold = false
) {
  ctx.save();
  ctx.translate(q(x), q(y));
  ctx.rotate(angle);
  ctx.drawImage(bake(gold ? goldArt(art) : art), (-art.w * size) / 2, (-art.h * size) / 2, art.w * size, art.h * size);
  ctx.restore();
}

/** ダッシュの分身。自分の絵を半透明にして、少し遅れた残像も重ねる */
function afterimage(ctx: CanvasRenderingContext2D, q: Snap, w: World, x: number, y: number, vx: number, vy: number) {
  const art = ANIMAL_ART[w.animal.id].forms[w.form].walk;
  const img = bake(art, 1, vx < 0 ? 'flip' : 'normal');
  for (const [lag, alpha] of [
    [0.06, 0.2],
    [0.03, 0.35],
    [0, 0.6]
  ]) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, q(x - vx * lag - art.w / 2), q(y - vy * lag - art.h / 2));
  }
  ctx.globalAlpha = 1;
}

export function shots(ctx: CanvasRenderingContext2D, w: World, q: Snap): void {
  for (const o of w.shots) {
    if (!o.alive) continue;
    const weapon = kindOf(w, o.slot);
    const gold = isGold(w, o.slot);
    if (weapon === 'dash') afterimage(ctx, q, w, o.x, o.y, o.vx, o.vy);
    else if (weapon === 'acorn') rotated(ctx, q, ITEM_ART.acorn, o.x, o.y, o.age * 10, 1, gold);
    else if (o.kind === 'shot') rotated(ctx, q, ITEM_ART.bone, o.x, o.y, o.age * 14, 1, gold);
    else if (o.kind === 'boomerang') rotated(ctx, q, ITEM_ART.bone, o.x, o.y, o.age * 16, 1.6, gold);
    else if (o.kind === 'homing') rotated(ctx, q, ITEM_ART.fish, o.x, o.y, o.angle, 1, gold);
    else rotated(ctx, q, ITEM_ART.feather, o.x, o.y, o.angle + Math.PI / 2, 1, gold);
  }
}

/** 床に残る炎とツタ。敵より先に描く */
export function zonesBelow(ctx: CanvasRenderingContext2D, w: World, q: Snap, now: number): void {
  for (const f of w.effects) {
    if (!f.alive) continue;
    if (f.kind === 'flame') {
      const art = isGold(w, f.slot) ? goldArt(ITEM_ART.flame) : ITEM_ART.flame;
      ctx.globalAlpha = Math.min(1, (f.life - f.age) / 0.3);
      ctx.drawImage(bake(art, frameAt(now * 8 + f.x, 2)), q(f.x - art.w / 2), q(f.y - art.h + 2));
    } else if (f.kind === 'vine') {
      const art = isGold(w, f.slot) ? goldArt(ITEM_ART.vine) : ITEM_ART.vine;
      ctx.globalAlpha = Math.min(1, (f.life - f.age) / 0.3);
      ctx.drawImage(bake(art, f.age < 0.2 ? 0 : 1), q(f.x - art.w / 2), q(f.y - art.h + 4));
    }
  }
  ctx.globalAlpha = 1;
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.beginPath();
  ctx.moveTo(x + 6, y - 90);
  for (let i = 1; i <= 6; i++) ctx.lineTo(x + (i === 6 ? 0 : (hash(seed, i) - 0.5) * 14), y - 90 + i * 15);
  ctx.stroke();
}

/** 引っかき・輪・雷・爆ぜ */
export function swipes(ctx: CanvasRenderingContext2D, w: World, q: Snap): void {
  ctx.lineCap = 'square';
  for (const f of w.effects) {
    if (!f.alive) continue;
    const t = f.age / f.life;
    const line = isGold(w, f.slot) ? PALETTE.y : PALETTE.w;
    if (f.kind === 'swipe' && kindOf(w, f.slot) === 'claw') {
      // 爪は細い 3 本の爪痕
      ctx.globalAlpha = 0.9 * (1 - t);
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      const ux = Math.cos(f.angle);
      const uy = Math.sin(f.angle);
      for (const k of [-1, 0, 1]) {
        const ox = f.x + ux * f.r * 0.5 - uy * k * 4;
        const oy = f.y + uy * f.r * 0.5 + ux * k * 4;
        ctx.beginPath();
        ctx.moveTo(q(ox - uy * 8 - ux * 6), q(oy + ux * 8 - uy * 6));
        ctx.lineTo(q(ox + uy * 8 + ux * 6), q(oy - ux * 8 + uy * 6));
        ctx.stroke();
      }
    } else if (f.kind === 'cone') {
      // 炎は根もとから先へ伸び、外が赤、内が黄色
      const reach = f.r * Math.min(1, t * 2.5);
      const gold = isGold(w, f.slot);
      for (const [k, color, alpha] of [
        [1, gold ? PALETTE.Y : PALETTE.r, 0.55],
        [0.72, PALETTE.o, 0.6],
        [0.42, PALETTE.y, 0.7]
      ] as const) {
        ctx.globalAlpha = alpha * (1 - t * 0.7);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(q(f.x), q(f.y));
        ctx.arc(q(f.x), q(f.y), reach * k, f.angle - 0.52, f.angle + 0.52);
        ctx.closePath();
        ctx.fill();
      }
      const ember = bake(ITEM_ART.ember);
      for (let n = 0; n < 5; n++) {
        const a = f.angle + (((n * 37) % 10) / 10 - 0.5) * 0.9;
        const d = reach * (0.35 + ((n * 53) % 7) / 10);
        ctx.globalAlpha = 1 - t;
        ctx.drawImage(ember, q(f.x + Math.cos(a) * d - 3), q(f.y + Math.sin(a) * d - 3));
      }
    } else if (f.kind === 'swipe') {
      ctx.globalAlpha = 0.75 * (1 - t);
      ctx.strokeStyle = line;
      for (const [r, lw] of [
        [0.85, 3],
        [0.6, 2]
      ]) {
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * r, f.angle - 0.95 + t * 0.4, f.angle + 0.95 + t * 0.4);
        ctx.stroke();
      }
    } else if (f.kind === 'ring') {
      const r = t * f.r;
      ctx.globalAlpha = 0.75 * (1 - t);
      ctx.lineWidth = 2;
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.u;
      ctx.beginPath();
      ctx.arc(f.x, f.y, Math.max(0, r - 3), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'bolt') {
      ctx.globalAlpha = 0.75 * (1 - t * t);
      ctx.strokeStyle = PALETTE.y;
      ctx.lineWidth = 3;
      bolt(ctx, f.x, f.y, Math.floor(f.born * 60));
      ctx.strokeStyle = PALETTE.w;
      ctx.lineWidth = 1;
      bolt(ctx, f.x, f.y, Math.floor(f.born * 60));
      ctx.fillStyle = PALETTE.y;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === 'burst') {
      ctx.globalAlpha = 0.7 * (1 - t);
      ctx.fillStyle = PALETTE.o;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (0.6 + t * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
