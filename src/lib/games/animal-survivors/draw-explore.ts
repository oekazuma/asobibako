import { RELIC_ART, SHRINE_ART } from './art/explore';
import { PALETTE } from './art/palette';
import { CELL } from './obstacles';
import { bake } from './pixels';
import { hasRelic, type RelicId } from './relics';
import { shrineAt, type Shrine } from './shrines';
import type { World } from './world';

const seen: Shrine[] = [];

/** 画面にかかる、まだ使っていない祠を描く。祠は通れるので、奥行きは合わせず敵より先に描く */
export function drawShrines(
  ctx: CanvasRenderingContext2D,
  w: World,
  cx: number,
  cy: number,
  vw: number,
  vh: number,
  q: (v: number) => number
): void {
  seen.length = 0;
  for (let gx = Math.floor((cx - 24) / CELL); gx <= Math.floor((cx + vw + 24) / CELL); gx++)
    for (let gy = Math.floor((cy - 24) / CELL); gy <= Math.floor((cy + vh + 40) / CELL); gy++) {
      const s = shrineAt(w.stage.art, gx, gy);
      if (s && !w.shrinesUsed.includes(s.key)) seen.push(s);
    }
  for (const s of seen) {
    const art = SHRINE_ART[s.kind];
    ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
    ctx.fillRect(q(s.x - 9), q(s.y + 1), 18, 2);
    ctx.drawImage(bake(art), q(s.x - art.w / 2), q(s.y + 2 - art.h));
  }
}

/** 地面の遺物。足もとをうっすら光らせ、ゆっくり上下に揺らす（明滅はしない） */
export function drawRelic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: RelicId,
  now: number,
  q: (v: number) => number
): void {
  const art = RELIC_ART[id];
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = PALETTE.y;
  ctx.beginPath();
  ctx.ellipse(q(x), q(y + 2), 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const bob = Math.sin(now * 2.5) * 1.5;
  ctx.drawImage(bake(art), q(x - art.w / 2), q(y - art.h - 2 + bob));
  ctx.fillStyle = PALETTE.w;
  for (const k of [0, Math.PI]) {
    const a = now * 1.6 + k;
    ctx.fillRect(q(x + Math.cos(a) * 9), q(y - 8 + Math.sin(a) * 5), 1, 1);
  }
}

/** 遺物から RELIC_NEAR に入ると矢印を出す（古い地図があればどこからでも） */
export const RELIC_NEAR = 400;

export function relicTargets(w: World): { x: number; y: number; id: RelicId }[] {
  const p = w.player;
  return w.items
    .filter(
      (it) => it.alive && it.kind === 'relic' && (hasRelic(w, 'map') || Math.hypot(it.x - p.x, it.y - p.y) < RELIC_NEAR)
    )
    .map((it) => ({ x: it.x, y: it.y, id: it.relic! }));
}

/** ご利益の印どうしの間（印 5 ドット・すき間・3 けたの秒が入る） */
export const BLESS_GAP = 26;

const BLESS = [
  ['might', 'r'],
  ['speed', 'l'],
  ['xp', 'u']
] as const;

/** 祠のご利益の残りの秒。祠の玉と同じ色の丸と秒（x, y は左上） */
export function blessings(
  ctx: CanvasRenderingContext2D,
  w: World,
  x: number,
  y: number,
  text: (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string) => void
): void {
  let i = 0;
  for (const [k, c] of BLESS) {
    const left = w.blessing[k];
    if (left <= 0) continue;
    const sx = x + i * BLESS_GAP;
    ctx.fillStyle = PALETTE.k;
    ctx.fillRect(sx, y, 5, 5);
    ctx.fillStyle = PALETTE[c];
    ctx.fillRect(sx + 1, y + 1, 3, 3);
    text(ctx, String(Math.ceil(left)), sx + 7, y, PALETTE.w);
    i++;
  }
}
