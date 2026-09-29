import { sprite, stamp } from '$lib/fx';

/**
 * 手前の客席（画面にかぶせて描く）。客席から見上げたステージの手前に、頭の影とペンライトが並ぶ。
 * もりあがるほど点くペンライトが増え、大きく振り、跳ねる
 */

const PENLIGHT = ['#ff6fa5', '#ff6fa5', '#ffd43b', '#5fd0ff', '#ff6fa5', '#b27bff'];

/** ペンライトの光。色ごとに 1 度だけ描いて使い回す */
const halo = (c: string) =>
  sprite(`idol-halo-${c}`, 64, (ctx) => {
    const g = ctx.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.5);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, 1);
  });

export function drawCrowd(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  beat: number,
  hype: number,
  color: string
) {
  const base = h * 0.93;
  const size = Math.min(w, h) * 0.045;
  const b = Math.max(0, beat);
  for (const row of [0, 1]) {
    const y = base + row * size * 0.9;
    const n = Math.ceil(w / (size * 1.5)) + 1;
    for (let i = 0; i < n; i++) {
      const seed = (i * 7 + row * 13) % 17;
      const x = (i + (row ? 0.5 : 0)) * size * 1.5 - size * 0.3;
      const jump =
        hype > 0.6 ? Math.max(0, Math.sin((b + seed * 0.1) * Math.PI)) * size * 0.25 * (hype - 0.6) * 2.5 : 0;
      if (seed / 17 < 0.25 + 0.75 * hype) {
        const sway = Math.sin((b + (seed % 2) * 0.5) * Math.PI) * (0.25 + 0.45 * hype);
        const len = size * 1.3;
        const hx = x + size * 0.45;
        const hy = y - jump - size * 0.1;
        const tx = hx + Math.sin(sway) * len;
        const ty = hy - Math.cos(sway) * len;
        const c = hype > 0.75 ? PENLIGHT[seed % PENLIGHT.length] : color;
        ctx.globalCompositeOperation = 'lighter';
        stamp(ctx, halo(c), tx, ty, size * 1.8);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = c;
        ctx.lineWidth = size * 0.16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      ctx.fillStyle = row ? '#0b0618' : '#170d2c';
      ctx.beginPath();
      ctx.arc(x, y - jump, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - size * 0.7, y - jump + size * 0.35, size * 1.4, size * 1.5);
    }
  }
}
