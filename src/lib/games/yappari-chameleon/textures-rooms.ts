import { rng } from './rng';
import { make, type Pattern } from './textures';

const PAINTS = ['#e2262b', '#f6c21c', '#3fae3a', '#8a3fc4'];

/** 本家のロビーの赤・黄・緑・紫の大きなペンキのしぶき。粒は 8px 以上なので、1 枚 8m の模様で 6cm 以上になる */
function splats(g: CanvasRenderingContext2D, seed: number, w: number, h: number, count: number, drip: boolean) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = r() * w;
    const cy = r() * h;
    const big = 50 + r() * 90;
    g.fillStyle = PAINTS[i % PAINTS.length];
    g.beginPath();
    g.arc(cx, cy, big, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 14; k++) {
      const a = r() * Math.PI * 2;
      const d = big * (0.8 + r() * 0.9);
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 8 + r() * big * 0.35, 0, Math.PI * 2);
      g.fill();
    }
    // 垂れるのは壁だけ。床と天井では向きが無いので垂らさない
    if (drip)
      for (let k = 0; k < 3; k++) g.fillRect(cx - big * 0.5 + r() * big, cy, 10 + r() * 8, big * (0.8 + r() * 1.4));
  }
}

/**
 * ロビーの壁。白地に白いアーチの浮き彫り（影とハイライトの線）と、ペンキのしぶき。
 * 1 枚が 8m × 6m で、線は 3cm 以上
 */
export function splashWall(): Pattern {
  return make('splash-wall', 1024, 768, [8, 6], (g) => {
    g.fillStyle = '#f4f2ee';
    g.fillRect(0, 0, 1024, 768);
    for (const cx of [256, 768]) {
      for (const [color, dx] of [
        ['rgb(0 0 0 / 0.14)', 4],
        ['rgb(255 255 255 / 0.95)', -4]
      ] as const) {
        g.strokeStyle = color;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(cx - 200 + dx, 768);
        g.lineTo(cx - 200 + dx, 330);
        g.arc(cx + dx, 330, 200, Math.PI, 0);
        g.lineTo(cx + 200 + dx, 768);
        g.stroke();
      }
    }
    splats(g, 83, 1024, 768, 9, true);
  });
}

/** ロビーの床。白黒の市松（1 枡 0.5m）にしぶき。1 枚が 8m 四方 */
export function splashFloor(): Pattern {
  return make('splash-floor', 1024, 1024, [8, 8], (g) => {
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++) {
        g.fillStyle = (i + j) % 2 ? '#1d1c1b' : '#efebe2';
        g.fillRect(i * 64, j * 64, 64, 64);
      }
    splats(g, 89, 1024, 1024, 6, false);
  });
}

/** ロビーの天井。白地にしぶき。1 枚が 8m 四方 */
export function splashCeiling(): Pattern {
  return make('splash-ceiling', 1024, 1024, [8, 8], (g) => {
    g.fillStyle = '#f4f2ee';
    g.fillRect(0, 0, 1024, 1024);
    splats(g, 97, 1024, 1024, 5, false);
  });
}

/** ロビーの台の上面。赤地に白いペンキの筆の字で HUNTER。1 枚が台の差し渡し 2.4m で、字の線は 4cm 以上 */
export function hunterSign(): Pattern {
  return make('hunter-sign', 512, 512, [2.4, 2.4], (g) => {
    const r = rng(71);
    g.fillStyle = '#c8231e';
    g.fillRect(0, 0, 512, 512);
    g.font = 'bold 104px "Hiragino Mincho ProN", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    // 少しずつずらして重ね、太い筆でこすったように見せる
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = `rgb(255 255 255 / ${0.35 + i * 0.12})`;
      g.lineWidth = 14 - i * 2;
      g.strokeText('HUNTER', 256 + (r() - 0.5) * 8, 256 + (r() - 0.5) * 8);
    }
    g.fillStyle = '#ffffff';
    g.fillText('HUNTER', 256, 256);
    for (let i = 0; i < 18; i++) g.fillRect(70 + r() * 372, 290 + r() * 10, 9, 14 + r() * 40);
  });
}
