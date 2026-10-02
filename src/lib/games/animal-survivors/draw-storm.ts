import { PALETTE } from './art/palette';
import type { World } from './world';

const FLAKES = 70;
const FADE = 1.5;

/** 吹雪のかすみと、風の向きに流れる雪。HUD より先に、仮想画面の座標で描く */
export function blizzard(ctx: CanvasRenderingContext2D, w: World, vw: number, vh: number, now: number): void {
  const s = w.storm;
  if (s.left <= 0) return;
  const len = w.stage.storms[s.next - 1]?.len ?? s.left;
  const a = Math.min(1, (len - s.left) / FADE, s.left / FADE);
  ctx.globalAlpha = 0.4 * a;
  ctx.fillStyle = PALETTE.w;
  ctx.fillRect(0, 0, vw, vh);
  // 雪の地面の上でも見えるよう、流れる雪は灰青で描く
  ctx.globalAlpha = 0.7 * a;
  ctx.fillStyle = PALETTE.S;
  const span = vw + vh;
  for (let i = 0; i < FLAKES; i++) {
    // 粒ごとに決まった位置と速さで、風の向きへ流して画面の端で回す
    const h1 = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const h2 = (Math.sin(i * 78.233) * 12345.6789) % 1;
    const speed = 140 + Math.abs(h2) * 80;
    const t = now * speed;
    const x = (((Math.abs(h1) * span + t * s.wx) % span) + span) % span;
    const y = (((Math.abs(h2) * span + t * s.wy) % span) + span) % span;
    const px = Math.round(x - vh / 2);
    const py = Math.round(y - vw / 2);
    for (let k = 0; k < 7; k++) ctx.fillRect(Math.round(px - s.wx * k), Math.round(py - s.wy * k), 1, 1);
  }
  ctx.globalAlpha = 1;
}
