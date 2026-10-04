import { pulse } from './draw-boss';
import { POOL_LIFE } from './eruption';
import { bake, type Art } from './pixels';
import type { World } from './world';

/** 地面は上から見ているので、池と割れ目は縦につぶした楕円にする */
const SQUASH = 1.6;
const pools = new Map<number, Art>();
const cracks = new Map<number, Art>();

/** 大きさごとに 1 度だけドット絵を作る（池は毎回大きさがちがうので表に持てない） */
function poolArt(r: number): Art {
  const hit = pools.get(r);
  if (hit) return hit;
  const w = r * 2 + 4;
  const h = Math.ceil((r * 2) / SQUASH) + 4;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - w / 2, (y + 0.5 - h / 2) * SQUASH);
      const k = d / r;
      const n = (x * 7 + y * 13) % 9;
      row +=
        d <= r
          ? k < 0.6 && n === 0
            ? 'y'
            : k < 0.55
              ? 'o'
              : k < 0.85
                ? 'r'
                : 'R'
          : d <= r + 1.5
            ? (x + y) % 3
              ? 'N'
              : 'k'
            : '.';
    }
    rows.push(row);
  }
  const art = { w, h, frames: [rows] };
  pools.set(r, art);
  return art;
}

/** 割れ目の予告。点線の輪と、まん中から伸びる 5 本のひび。2 コマで明滅する */
function crackArt(r: number): Art {
  const hit = cracks.get(r);
  if (hit) return hit;
  const w = r * 2 + 3;
  const h = Math.ceil((r * 2) / SQUASH) + 3;
  const frame = (on: string, off: string) => {
    const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
    for (let a = 0; a < 360; a += 12) {
      const t = (a * Math.PI) / 180;
      const x = Math.round(w / 2 + Math.cos(t) * r);
      const y = Math.round(h / 2 + (Math.sin(t) * r) / SQUASH);
      if (g[y]?.[x]) g[y][x] = on;
    }
    for (let k = 0; k < 5; k++) {
      const t = ((k * 72 + 20) * Math.PI) / 180;
      for (let i = 0; i < r; i++) {
        const x = Math.round(w / 2 + Math.cos(t) * i + (i % 3 === 0 ? 1 : 0));
        const y = Math.round(h / 2 + (Math.sin(t) * i) / SQUASH);
        if (g[y]?.[x]) g[y][x] = i % 2 ? on : off;
      }
    }
    return g.map((row) => row.join(''));
  };
  const art = { w, h, frames: [frame('o', 'r'), frame('y', 'o')] };
  cracks.set(r, art);
  return art;
}

/** 地面の上・敵の下に描く。池は噴き出してすぐ広がり、消える前の 1 秒で縮む */
export function drawLava(ctx: CanvasRenderingContext2D, w: World, now: number): void {
  for (const l of w.lava) {
    if (l.life <= 0) continue;
    if (l.warn > 0) {
      const art = crackArt(Math.round(l.r));
      // 2 コマを切り替えるとチカチカするので、光るコマを重ねる濃さを変える
      const x = Math.round(l.x - art.w / 2);
      const y = Math.round(l.y - art.h / 2);
      ctx.drawImage(bake(art, 0), x, y);
      ctx.globalAlpha = pulse(now);
      ctx.drawImage(bake(art, 1), x, y);
      ctx.globalAlpha = 1;
      continue;
    }
    const k = Math.min(1, (POOL_LIFE - l.life) / 0.3, l.life / 1);
    const art = poolArt(Math.max(3, Math.round(l.r * k)));
    ctx.drawImage(bake(art), Math.round(l.x - art.w / 2), Math.round(l.y - art.h / 2));
  }
}
