import { icon } from '$lib/fx';
import type { Advice } from '../advice';
import { TRASH, type ToolId } from '../engine';
import { LINE, LW, ink } from './style';

/** 道具の絵（24 × 24）の中で、先端にあたる点 */
const ANCHOR: Record<ToolId, [number, number]> = {
  brush: [17, 6],
  drill: [22, 12.5],
  tweezers: [12, 21],
  filling: [19, 10],
  pliers: [12, 3],
  shot: [13, 21.5],
  pat: [12, 14]
};
export const TOOL_SIZE = 0.2;

/** 診察室の壁。画面のピクセル座標で描く */
export function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#fff8ea');
  wall.addColorStop(1, '#f3e6cc');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgb(74 46 31 / 0.05)';
  ctx.lineWidth = 2;
  const cell = Math.max(40, w / 10);
  for (let x = cell; x < w; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = cell; y < h; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const lamp = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.6);
  lamp.addColorStop(0, 'rgb(255 255 255 / 0.7)');
  lamp.addColorStop(1, 'rgb(255 255 255 / 0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h);
}

/** lid はバイキンが落ちた直後に 1、だんだん 0 へ戻る */
export function drawTrash(ctx: CanvasRenderingContext2D, lid: number): void {
  const { x, y } = TRASH;
  ctx.beginPath();
  ctx.moveTo(x - 0.06, y - 0.04);
  ctx.lineTo(x + 0.06, y - 0.04);
  ctx.lineTo(x + 0.05, y + 0.08);
  ctx.quadraticCurveTo(x + 0.048, y + 0.095, x + 0.03, y + 0.095);
  ctx.lineTo(x - 0.03, y + 0.095);
  ctx.quadraticCurveTo(x - 0.048, y + 0.095, x - 0.05, y + 0.08);
  ctx.closePath();
  ink(ctx, '#57aef5');
  ctx.strokeStyle = 'rgb(255 255 255 / 0.55)';
  ctx.lineWidth = LW;
  for (const dx of [-0.025, 0, 0.025]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y - 0.015);
    ctx.lineTo(x + dx * 0.9, y + 0.075);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x - 0.07, y - 0.05);
  ctx.rotate(-lid * 0.6);
  ctx.beginPath();
  ctx.roundRect(0, -0.012, 0.14, 0.024, 0.012);
  ink(ctx, '#57aef5');
  ctx.restore();
}

/** 持っている道具を、先端が tip に来るように大きく描く */
export function drawTool(
  ctx: CanvasRenderingContext2D,
  tool: ToolId,
  tip: readonly [number, number],
  busy: boolean,
  still: boolean
): void {
  const [ax, ay] = ANCHOR[tool];
  let x = tip[0] + ((12 - ax) / 24) * TOOL_SIZE;
  let y = tip[1] + ((12 - ay) / 24) * TOOL_SIZE;
  if (busy && tool === 'drill' && !still) {
    x += (Math.random() - 0.5) * 0.004;
    y += (Math.random() - 0.5) * 0.004;
  }
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = LINE;
  ctx.beginPath();
  ctx.ellipse(x + 0.012, y + 0.02, TOOL_SIZE * 0.3, TOOL_SIZE * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  icon(ctx, tool, x, y, TOOL_SIZE, 0, 256);
}

/** 迷っている子に、次にやる場所で半透明の指が動きを見せる */
export function drawGhost(ctx: CanvasRenderingContext2D, a: Advice, t: number, trash: readonly [number, number]): void {
  const phase = (t % 1.6) / 1.6;
  let x = a.x;
  let y = a.y;
  if (a.tool === 'tweezers') {
    x += (trash[0] - a.x) * phase;
    y += (trash[1] - a.y) * phase;
  } else if (a.tool === 'pliers') {
    y += Math.sin(phase * Math.PI) * 0.05 * (a.y < 0.74 ? 1 : -1);
  } else if (a.tool === 'shot') {
    y -= Math.abs(Math.sin(phase * Math.PI * 2)) * 0.03;
  } else {
    x += Math.cos(phase * Math.PI * 4) * 0.025;
    y += Math.sin(phase * Math.PI * 4) * 0.015;
  }
  ctx.save();
  ctx.globalAlpha = 0.6;
  // 指先（アイコンの (12, 5)）を場所に合わせる
  icon(ctx, 'tap', x, y + (7 / 24) * 0.14, 0.14, 0, 192);
  ctx.restore();
}
