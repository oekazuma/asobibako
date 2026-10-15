import { DARK, EDGE_BLUR, LAMP_LIGHT, lightRadius, streetLightsNear, type StreetLight } from './blackout';
import type { World } from './world';

let layer: HTMLCanvasElement | null = null;
/** 前に抜いた輪の位置と半径。同じなら暗幕を描き直さない */
let drawn = '';
const lamps: StreetLight[] = [];

function hole(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgb(0 0 0 / 1)');
  g.addColorStop(Math.max(0, (r - EDGE_BLUR) / r), 'rgb(0 0 0 / 1)');
  g.addColorStop(1, 'rgb(0 0 0 / 0)');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * 停電の暗幕。仮想画面と同じ大きさの canvas に暗幕を塗って輪を抜き、ドットのまま拡大して重ねる
 * （ふちがドット絵の段になる）。倒れている動物のまわりも抜くのは、子の端末も同じ絵にするため
 */
export function drawDark(
  ctx: CanvasRenderingContext2D,
  w: World,
  cx: number,
  cy: number,
  v: { w: number; h: number },
  still: boolean
): boolean {
  const dark = still ? (w.blackout.left > 0 ? 1 : 0) : w.blackout.dark;
  if (dark <= 0) return false;
  if (!layer || layer.width !== v.w || layer.height !== v.h) {
    layer = document.createElement('canvas');
    layer.width = v.w;
    layer.height = v.h;
    drawn = '';
  }
  const r = lightRadius(w);
  const spots: number[] = [];
  for (const h of w.heroes) if (!h.gone) spots.push(Math.round(h.player.x - cx), Math.round(h.player.y - cy), r);
  streetLightsNear(w.stage.art, cx + v.w / 2, cy + v.h / 2, Math.hypot(v.w, v.h) / 2 + LAMP_LIGHT, lamps);
  for (const s of lamps) spots.push(Math.round(s.x - cx), Math.round(s.y - cy), LAMP_LIGHT);
  const key = spots.join(',');
  if (key !== drawn) {
    drawn = key;
    const c = layer.getContext('2d')!;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, v.w, v.h);
    c.fillStyle = `rgb(4 6 20 / ${DARK})`;
    c.fillRect(0, 0, v.w, v.h);
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < spots.length; i += 3) hole(c, spots[i], spots[i + 1], spots[i + 2]);
  }
  ctx.globalAlpha = dark;
  ctx.drawImage(layer, cx, cy);
  ctx.globalAlpha = 1;
  return true;
}
