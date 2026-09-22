import { emoji } from '$lib/canvas';
import type { Seg } from '$lib/segments';
import { HERO_R, R, WALL, type GameState, type Kind } from './engine';

const FILL: Record<Kind, string> = { gold: '#ffc233', lava: '#ff5a1f', water: '#39a7ff', rock: '#8a8d9e' };
const EDGE: Record<Kind, string> = { gold: '#e39a00', lava: '#d12d0b', water: '#1478d4', rock: '#62657a' };
/** 抜いたピンが外へ滑り出して消えるまでの秒 */
export const SLIDE_S = 0.3;

function line(ctx: CanvasRenderingContext2D, seg: Seg, width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(seg[0], seg[1]);
  ctx.lineTo(seg[2], seg[3]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/**
 * ctx は engine の座標（幅 1）がそのまま描ける変換にしておく。
 * pulledAt は各ピンを抜いた時刻（秒）、now は今の時刻（秒）
 */
export function paint(ctx: CanvasRenderingContext2D, state: GameState, pulledAt: number[], now: number) {
  ctx.lineCap = 'round';
  for (const wall of state.level.walls) {
    line(ctx, wall, WALL * 2 + 0.012, '#fff');
    line(ctx, wall, WALL * 2, '#7b5a45');
  }

  state.level.pins.forEach((pin, i) => {
    const slide = state.pulled[i] ? (now - pulledAt[i]) / SLIDE_S : 0;
    if (slide >= 1) return;
    const [x1, y1, x2, y2] = pin.seg;
    const dir = pin.handle === 1 ? 1 : -1;
    const ox = (x2 - x1) * slide * dir;
    const oy = (y2 - y1) * slide * dir;
    ctx.globalAlpha = 1 - slide;
    const seg: Seg = [x1 + ox, y1 + oy, x2 + ox, y2 + oy];
    line(ctx, seg, WALL * 2 + 0.01, '#fff');
    line(ctx, seg, WALL * 2, '#c9ccd8');
    const hx = pin.handle === 1 ? seg[2] : seg[0];
    const hy = pin.handle === 1 ? seg[3] : seg[1];
    ctx.beginPath();
    ctx.arc(hx, hy, 0.032, 0, Math.PI * 2);
    ctx.fillStyle = '#ffc233';
    ctx.fill();
    ctx.lineWidth = 0.008;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  for (const p of state.particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, R * 1.12, 0, Math.PI * 2);
    ctx.fillStyle = FILL[p.kind];
    ctx.fill();
    ctx.lineWidth = 0.004;
    ctx.strokeStyle = EDGE[p.kind];
    ctx.stroke();
  }

  const { x, y } = state.level.hero;
  const face = state.result === 'burned' ? '😱' : state.result === 'clear' ? '🤩' : '🧒';
  emoji(ctx, face, x, y, HERO_R * 2.1);
}
