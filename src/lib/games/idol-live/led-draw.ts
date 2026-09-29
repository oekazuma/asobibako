import type { Scene } from './chart';

/**
 * うしろの大きな LED スクリーンの絵（テクスチャ）。点の並びに、区間ごとの模様を拍に合わせて流す。
 * サビでスペシャルをきめると、真ん中に大きなハートを出す。もりあがりで明るさが変わる
 */

export const LED_W = 512;
export const LED_H = 224;
const COLS = 96;
const ROWS = 42;

export const LED: Record<Scene, string[]> = {
  intro: ['#8a6bff', '#ff9ccf'],
  verse: ['#ff6fa5', '#ffffff', '#ffb3d9'],
  bridge: ['#ff4fd8', '#8a6bff', '#5fd0ff'],
  chorus: ['#ff6fa5', '#ffd43b', '#5fd0ff', '#8affc1'],
  break: ['#ffd43b', '#ff6fa5', '#b27bff'],
  finale: ['#ffd43b', '#ffffff', '#ff6fa5']
};

const pulseOf = (beat: number) => (beat >= 0 ? Math.exp(-(beat - Math.floor(beat)) * 5) : 0);

/** ハートの形の中なら 1（u, v は -1..1） */
function inHeart(u: number, v: number): boolean {
  const x = u * 1.2;
  const y = -v * 1.2 + 0.25;
  return (x * x + y * y - 1) ** 3 - x * x * y * y * y < 0;
}

export function drawLed(ctx: CanvasRenderingContext2D, scene: Scene, beat: number, hype: number, lit: boolean) {
  ctx.fillStyle = '#07031a';
  ctx.fillRect(0, 0, LED_W, LED_H);
  const colors = LED[scene];
  const b = Math.max(0, beat);
  // 背景がアイドルより目立たないよう、明るさは控えめに
  const on = 0.18 + 0.42 * hype;
  const cw = LED_W / COLS;
  const ch = LED_H / ROWS;
  const pulse = pulseOf(b);
  for (let i = 0; i < COLS; i++)
    for (let j = 0; j < ROWS; j++) {
      const u = (i / (COLS - 1)) * 2 - 1;
      const v = (j / (ROWS - 1)) * 2 - 1;
      let l: number;
      switch (scene) {
        case 'verse':
          l = 0.5 + 0.5 * Math.sin(i * 0.3 - b * Math.PI * 0.5 + Math.sin(j * 0.4));
          break;
        case 'bridge':
          l =
            1 - (j + 0.5) / ROWS <
            (0.3 + 0.65 * Math.abs(Math.sin(Math.floor(i / 6) * 1.7 + Math.floor(b) * 2.1))) * (0.4 + 0.6 * pulse)
              ? 1
              : 0.06;
          break;
        case 'chorus':
          l = Math.max(0, Math.cos(Math.hypot(u * 2.2, v) * 5 - (b % 1) * 2 * Math.PI)) ** 3;
          break;
        case 'break':
          l = (Math.floor(i / 6) + Math.floor(j / 6) + Math.floor(b)) % 2 ? pulse : 0.08;
          break;
        default:
          l = 0.2 + 0.8 * Math.max(0, Math.sin(i * 12.9898 + j * 78.233 + b * 1.3)) ** 8;
      }
      // サビでスペシャルをきめたら、真ん中に大きなハート
      if (lit && inHeart(u * 2.6, v * 1.15)) l = 0.75 + 0.25 * pulse;
      const a = l * on;
      if (a < 0.05) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle =
        lit && inHeart(u * 2.6, v * 1.15) ? '#ff5c9a' : colors[(i + j * 3 + Math.floor(b / 4)) % colors.length];
      ctx.beginPath();
      ctx.arc((i + 0.5) * cw, (j + 0.5) * ch, cw * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.globalAlpha = 1;
}
