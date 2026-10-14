import { inkArt, shallowArt } from './art/shallows';
import { bake } from './pixels';
import { SHALLOW_GROW } from './tide';
import type { World } from './world';

/** 地面の上・敵の下に描く。水は 3 段でにじんで広がり、消える前の 1 秒で縮む */
export function drawShallows(ctx: CanvasRenderingContext2D, w: World): void {
  for (const s of w.shallows) {
    if (s.life <= 0) continue;
    const k = Math.min(1, s.life / 1);
    const r = Math.max(3, Math.round(s.r * k));
    const grown = s.grow <= 0 ? 1 : 1 - s.grow / SHALLOW_GROW;
    const art = s.ink ? inkArt(r) : shallowArt(r, s.grow <= 0 ? 2 : grown < 0.5 ? 0 : 1);
    ctx.drawImage(bake(art), Math.round(s.x - art.w / 2), Math.round(s.y - art.h / 2));
  }
}
