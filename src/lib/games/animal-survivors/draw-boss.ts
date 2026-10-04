import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import type { ViewSize } from './draw';
import { text } from './font';
import { bake } from './pixels';
import { BOAR, TREE } from './bosses-forest';
import { DRAGON } from './bosses-snow';
import { METEOR_IMPACT, METEOR_WARN } from './events';
import { RING_DY, type Hazard } from './bosses';
import type { World } from './world';

type Snap = (v: number) => number;

/** 予告の明滅（0〜1）。色を切り替えて点滅させると、攻撃の多い場面でチカチカするので、なめらかに変える */
export const pulse = (now: number) => 0.5 + 0.5 * Math.sin(now * Math.PI * 2 * 2.5);

function fan(ctx: CanvasRenderingContext2D, h: Hazard, q: Snap) {
  const a = Math.atan2(h.vy, h.vx);
  ctx.beginPath();
  ctx.moveTo(q(h.x), q(h.y));
  ctx.arc(q(h.x), q(h.y), h.r, a - DRAGON.breathAngle / 2, a + DRAGON.breathAngle / 2);
  ctx.closePath();
}

/** 床に出す予告（地ならしの輪・突進の矢印・氷の柱の円・息の扇）。敵より先に描く */
export function hazardsBelow(ctx: CanvasRenderingContext2D, w: World, q: Snap, now: number): void {
  for (const h of w.hazards) {
    if (!h.alive) continue;
    if (h.kind === 'pillar' && h.delay > 0) {
      const t = 1 - h.delay / DRAGON.pillarWarn;
      ctx.fillStyle = 'rgb(111 168 217 / 0.3)';
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + RING_DY), h.r * t, h.r * t * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgb(42 100 200 / 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + RING_DY), h.r, h.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    if (h.kind === 'mud') {
      // 大イノシシの通ったあとの土ぼこり。消えるまでにだんだん薄くなる
      ctx.fillStyle = `rgb(110 74 48 / ${0.4 * Math.min(1, h.life / BOAR.mudLife)})`;
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + 6), h.r, h.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (h.kind === 'root' && h.delay > 0) {
      const t = 1 - h.delay / TREE.warn;
      ctx.fillStyle = 'rgb(110 74 48 / 0.3)';
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + RING_DY), h.r * t, h.r * t * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgb(216 70 60 / ${0.45 + 0.45 * pulse(now)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + RING_DY), h.r, h.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    if (h.kind === 'meteor' && h.delay > 0) {
      const t = 1 - h.delay / METEOR_WARN;
      ctx.fillStyle = 'rgb(255 216 74 / 0.25)';
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y), h.r * t, h.r * t * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgb(255 216 74 / ${0.5 + 0.4 * pulse(now)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y), h.r, h.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    if (h.kind === 'breath' && h.delay > 0) {
      ctx.globalAlpha = 0.2 + 0.15 * pulse(now);
      ctx.fillStyle = PALETTE.u;
      fan(ctx, h, q);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = PALETTE.U;
      ctx.lineWidth = 1.5;
      fan(ctx, h, q);
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    if ((h.kind === 'slam' || h.kind === 'pounce') && h.delay > 0) {
      const t = Math.max(0, 1 - h.delay / (h.warn || 1));
      ctx.fillStyle = 'rgb(216 70 60 / 0.25)';
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + RING_DY), h.r * t, h.r * t * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgb(216 70 60 / 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y + RING_DY), h.r, h.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (h.kind === 'dash') {
      const owner = w.enemies[h.owner];
      const a = Math.atan2(h.vy, h.vx);
      ctx.save();
      ctx.translate(q(owner.x), q(owner.y + 6));
      ctx.rotate(a);
      // 枠は明滅させ、中は突進が近づくほど先まで赤く満ちる
      const fill = Math.min(1, Math.max(0, 1 - h.delay / (h.warn || 0.7)));
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
      ctx.globalAlpha = 0.5 + 0.4 * pulse(now);
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
    else if (h.kind === 'feather') {
      // 大ワシの羽根。飛ぶ向きに寝かせた白い羽
      const a = Math.atan2(h.vy, h.vx);
      ctx.save();
      ctx.translate(q(h.x), q(h.y));
      ctx.rotate(a);
      ctx.fillStyle = PALETTE.k;
      ctx.fillRect(-5, -2, 10, 4);
      ctx.fillStyle = PALETTE.w;
      ctx.fillRect(-4, -1, 8, 2);
      ctx.fillStyle = PALETTE.T;
      ctx.fillRect(-4, -1, 2, 2);
      ctx.restore();
    } else if (h.kind === 'root' && h.delay <= 0) {
      // 地面から根っこのとげが突き出し、しばらくで引っこむ
      const k = Math.min(1, h.life / 0.5);
      ctx.fillStyle = PALETTE.T;
      ctx.strokeStyle = PALETTE.k;
      ctx.lineWidth = 1;
      for (const dx of [-8, 0, 8]) {
        const tall = (dx === 0 ? 18 : 12) * k;
        ctx.beginPath();
        ctx.moveTo(q(h.x + dx - 4), q(h.y + RING_DY));
        ctx.lineTo(q(h.x + dx), q(h.y + 8 - tall));
        ctx.lineTo(q(h.x + dx + 4), q(h.y + RING_DY));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (h.kind === 'pillar' && h.delay <= 0) {
      // 地面から 0.1 秒で突き出す
      const ic = ITEM_ART.icicle;
      const rise = Math.min(1, (0.4 - h.life) / 0.1);
      ctx.drawImage(bake(ic), q(h.x - ic.w), q(h.y + 8 - ic.h * 2 * rise), ic.w * 2, Math.max(1, ic.h * 2 * rise));
    } else if (h.kind === 'breath' && h.delay <= 0) {
      ctx.globalAlpha = 0.45 + Math.random() * 0.15;
      ctx.fillStyle = PALETTE.j;
      fan(ctx, h, q);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (h.kind === 'meteor' && h.delay > 0 && h.delay < 0.35) {
      // 落ちる直前の 0.35 秒だけ、左上から斜めに降らせる
      const k = h.delay / 0.35;
      const m = ITEM_ART.meteor;
      ctx.drawImage(bake(m), q(h.x - m.w / 2 - k * 60), q(h.y - m.h / 2 - k * 90));
    } else if (h.kind === 'meteor' && h.delay <= 0) {
      const t = 1 - h.life / METEOR_IMPACT;
      ctx.globalAlpha = 0.85 * (1 - t);
      ctx.strokeStyle = PALETTE.y;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(q(h.x), q(h.y), h.r * (0.5 + t), h.r * (0.5 + t) * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (h.kind === 'ball') {
      const r = Math.round(h.r);
      ctx.drawImage(bake(ITEM_ART.snowball), q(h.x - r), q(h.y - r), r * 2, r * 2);
    } else if ((h.kind === 'slam' || h.kind === 'pounce') && h.delay <= 0) {
      const t = 1 - h.life / 0.3;
      ctx.globalAlpha = 0.8 * (1 - t);
      ctx.lineWidth = 3;
      for (const [k, color] of [
        [1, PALETTE.w],
        [0.8, PALETTE.o]
      ] as const) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.ellipse(
          q(h.x),
          q(h.y + RING_DY),
          h.r * (0.6 + t * 0.6) * k,
          h.r * (0.6 + t * 0.6) * k * 0.6,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
}

/** HUD の HP の棒の下に、いるボスの数だけ HP の棒を並べる */
/**
 * ボスの登場のあいだ、足もとに広がる土ぼこりの輪と、画面の縁の赤い光（画面は揺らさない）。
 * 輪は世界の座標、縁は仮想画面の座標で描くので、呼ぶ側が変換を切り替えてから呼ぶ
 */
export function introDust(ctx: CanvasRenderingContext2D, w: World, intro: { ids: number[]; t: number }): void {
  const k = (intro.t - 0.6) / 1.2;
  if (k < 0 || k > 1) return;
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = PALETTE.c;
  ctx.lineWidth = 3;
  for (const i of intro.ids) {
    const e = w.enemies[i];
    const r = e.def.r + 6 + k * 50;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.def.r * 0.6, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function introEdge(ctx: CanvasRenderingContext2D, v: ViewSize, intro: { t: number }): void {
  const k = (intro.t - 0.6) / 1.2;
  if (k < 0 || k > 1) return;
  ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7;
  ctx.strokeStyle = PALETTE.r;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, v.w - 4, v.h - 4);
  ctx.globalAlpha = 1;
}

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
