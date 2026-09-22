import { emoji, shadow, sprite, stamp } from '$lib/fx';
import type { Seg } from '$lib/segments';
import { HERO_R, R, WALL, WORLD_H, type GameState, type Kind } from './engine';

/** 抜いたピンが外へ滑り出して消えるまでの秒 */
export const SLIDE_S = 0.3;

const LOOK: Record<Kind, [string, string, string]> = {
  gold: ['#fff6b0', '#ffc233', '#c98400'],
  lava: ['#ffb070', '#f0380f', '#9c1206'],
  water: ['#d9f1ff', '#39a7ff', '#1266c4'],
  rock: ['#c9ccd8', '#8a8d9e', '#55586a']
};

/** 粒は光沢のある玉として一度だけ描き、毎フレームは貼るだけにする */
const bead = (kind: Kind) =>
  sprite(`bead:${kind}`, 48, (c) => {
    const [hi, mid, lo] = LOOK[kind];
    const g = c.createRadialGradient(0.38, 0.34, 0.04, 0.5, 0.5, 0.5);
    g.addColorStop(0, hi);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, lo);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0.5, 0.5, 0.48, 0, Math.PI * 2);
    c.fill();
    if (kind === 'gold') {
      c.strokeStyle = 'rgb(255 255 255 / 0.55)';
      c.lineWidth = 0.06;
      c.beginPath();
      c.arc(0.5, 0.5, 0.3, 0, Math.PI * 2);
      c.stroke();
    }
  });

const glow = () =>
  sprite('glow:lava', 64, (c) => {
    const g = c.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.5);
    g.addColorStop(0, 'rgb(255 60 20 / 0.3)');
    g.addColorStop(1, 'rgb(255 40 0 / 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 1, 1);
  });

/** 石積みの壁の背景。盤面の大きさが変わったときだけ描き直す */
export function background(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f3dcb8');
  g.addColorStop(1, '#e4c193');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const bw = Math.max(40, w / 9);
  const bh = bw * 0.45;
  for (let row = 0; row * bh < h; row++) {
    for (let col = -1; col * bw < w; col++) {
      const x = col * bw + (row % 2 ? bw / 2 : 0);
      const y = row * bh;
      ctx.fillStyle = (row * 7 + col * 3) % 5 === 0 ? 'rgb(160 110 60 / 0.16)' : 'rgb(160 110 60 / 0.08)';
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, bw - 4, bh - 4, 5);
      ctx.fill();
    }
  }
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgb(90 50 20 / 0)');
  v.addColorStop(1, 'rgb(90 50 20 / 0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function bar(ctx: CanvasRenderingContext2D, seg: Seg, width: number, colors: [string, string, string]) {
  const [outline, body, light] = colors;
  const stroke = (w: number, color: string, dx = 0, dy = 0) => {
    ctx.beginPath();
    ctx.moveTo(seg[0] + dx, seg[1] + dy);
    ctx.lineTo(seg[2] + dx, seg[3] + dy);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  stroke(width + 0.014, 'rgb(60 30 10 / 0.25)', 0.004, 0.008);
  stroke(width + 0.01, outline);
  stroke(width, body);
  stroke(width * 0.3, light, -width * 0.15, -width * 0.2);
}

/**
 * ctx は engine の座標（幅 1）がそのまま描ける変換にしておく。
 * pulledAt は各ピンを抜いた時刻（秒）、now は今の時刻（秒）
 */
export function paint(ctx: CanvasRenderingContext2D, state: GameState, pulledAt: number[], now: number) {
  ctx.lineCap = 'round';
  // 箱の底。勇者が立つ床
  ctx.fillStyle = 'rgb(120 80 50 / 0.25)';
  ctx.fillRect(0, WORLD_H - 0.012, 1, 0.012);

  for (const wall of state.level.walls) bar(ctx, wall, WALL * 2, ['#5b4636', '#a8845f', '#d6b48c']);

  state.level.pins.forEach((pin, i) => {
    const slide = state.pulled[i] ? (now - pulledAt[i]) / SLIDE_S : 0;
    if (slide >= 1) return;
    const [x1, y1, x2, y2] = pin.seg;
    const dir = pin.handle === 1 ? 1 : -1;
    const ease = slide * slide;
    const ox = (x2 - x1) * ease * dir;
    const oy = (y2 - y1) * ease * dir;
    ctx.globalAlpha = 1 - slide;
    const seg: Seg = [x1 + ox, y1 + oy, x2 + ox, y2 + oy];
    bar(ctx, seg, WALL * 1.7, ['#5d6275', '#d7dbe7', '#ffffff']);
    const hx = pin.handle === 1 ? seg[2] : seg[0];
    const hy = pin.handle === 1 ? seg[3] : seg[1];
    // まだ抜いていないピンのつまみは、押せることが分かるよう脈打たせる
    const pulse = state.pulled[i] ? 1 : 1 + Math.sin(now * 5 + i) * 0.08;
    const r = 0.034 * pulse;
    const ring = ctx.createRadialGradient(hx - r * 0.3, hy - r * 0.3, r * 0.1, hx, hy, r);
    ring.addColorStop(0, '#fff3c4');
    ring.addColorStop(0.5, '#ffc233');
    ring.addColorStop(1, '#d08a00');
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.lineWidth = 0.007;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#8a5a00';
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  const { x, y } = state.level.hero;
  shadow(ctx, x, WORLD_H - 0.01, HERO_R * 0.9, 0.25);
  const face = state.result === 'burned' ? '😱' : state.result === 'clear' ? '🤩' : '🧒';
  const hop = state.result === 'clear' ? Math.abs(Math.sin(now * 8)) * 0.05 : Math.sin(now * 3) * 0.004;
  emoji(ctx, face, x, y - hop, HERO_R * 2.1);

  const d = R * 2.3;
  for (const p of state.particles) stamp(ctx, bead(p.kind), p.x, p.y, d);
  ctx.globalCompositeOperation = 'lighter';
  const flicker = 0.85 + Math.sin(now * 9) * 0.15;
  for (const p of state.particles) if (p.kind === 'lava') stamp(ctx, glow(), p.x, p.y, R * 5 * flicker);
  ctx.globalCompositeOperation = 'source-over';
}
