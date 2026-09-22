import { emoji } from '$lib/canvas';
import type { Seg } from '$lib/segments';
import { BEE_R, DOG_R, LINE, type GameState } from './engine';

function line(ctx: CanvasRenderingContext2D, seg: Seg, width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(seg[0], seg[1]);
  ctx.lineTo(seg[2], seg[3]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** ctx は engine の座標（幅 1）がそのまま描ける変換にしておく */
export function paint(ctx: CanvasRenderingContext2D, state: GameState, now: number) {
  const { level } = state;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const wall of level.walls) {
    line(ctx, wall, LINE * 2 + 0.01, '#fff');
    line(ctx, wall, LINE * 2, '#5aa84f');
  }

  for (const hive of level.hives) {
    ctx.beginPath();
    ctx.ellipse(hive.x, hive.y, 0.06, 0.075, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f5b83d';
    ctx.fill();
    ctx.lineWidth = 0.008;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#b8761b';
    for (const dy of [-0.035, 0, 0.035]) ctx.fillRect(hive.x - 0.05, hive.y + dy - 0.005, 0.1, 0.01);
    ctx.beginPath();
    ctx.arc(hive.x, hive.y + 0.03, 0.014, 0, Math.PI * 2);
    ctx.fillStyle = '#5b3a12';
    ctx.fill();
  }

  if (state.stroke.length > 0) {
    ctx.beginPath();
    ctx.moveTo(state.stroke[0].x, state.stroke[0].y);
    for (const p of state.stroke) ctx.lineTo(p.x, p.y);
    if (state.stroke.length === 1) ctx.lineTo(state.stroke[0].x + 0.001, state.stroke[0].y);
    ctx.lineWidth = LINE * 2 + 0.01;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.lineWidth = LINE * 2;
    ctx.strokeStyle = '#2b2d42';
    ctx.stroke();
  }

  const { dog } = level;
  const face = state.result === 'stung' ? '😵' : state.result === 'clear' ? '🥰' : '🐶';
  // 刺されそうなときに少し震わせる
  const near = state.bees.some((b) => Math.hypot(b.x - dog.x, b.y - dog.y) < DOG_R * 3);
  const shake = near && !state.result ? Math.sin(now * 60) * 0.006 : 0;
  emoji(ctx, face, dog.x + shake, dog.y, DOG_R * 2.2);

  for (const bee of state.bees) {
    const flap = 1 + Math.sin(now * 40 + bee.x * 50) * 0.08;
    emoji(ctx, '🐝', bee.x, bee.y, BEE_R * 2.6 * flap);
  }
}
