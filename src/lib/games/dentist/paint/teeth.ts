import type { Tooth } from '../animals';
import { LINE } from './style';

/** 歯の輪郭。とがった歯は口の内側（上の歯は下、下の歯は上）へとがらせる */
export function toothPath(t: Tooth): Path2D {
  const p = new Path2D();
  const l = t.x - t.w / 2;
  const r = t.x + t.w / 2;
  const top = t.y - t.h / 2;
  const bottom = t.y + t.h / 2;
  const k = t.w * 0.38;
  if (t.shape === 'fang') {
    const tip = t.row === 'upper' ? bottom : top;
    const base = t.row === 'upper' ? top : bottom;
    const turn = t.row === 'upper' ? 1 : -1;
    p.moveTo(l, base);
    p.lineTo(r, base);
    p.lineTo(r, base + turn * t.h * 0.45);
    p.quadraticCurveTo(r, tip - turn * t.h * 0.1, t.x, tip);
    p.quadraticCurveTo(l, tip - turn * t.h * 0.1, l, base + turn * t.h * 0.45);
    p.closePath();
    return p;
  }
  p.moveTo(l + k, top);
  p.lineTo(r - k, top);
  p.quadraticCurveTo(r, top, r, top + k);
  p.lineTo(r, bottom - k);
  p.quadraticCurveTo(r, bottom, r - k, bottom);
  p.lineTo(l + k, bottom);
  p.quadraticCurveTo(l, bottom, l, bottom - k);
  p.lineTo(l, top + k);
  p.quadraticCurveTo(l, top, l + k, top);
  p.closePath();
  return p;
}

/** 症状を重ねる前の、白い歯とつや */
export function drawToothBase(ctx: CanvasRenderingContext2D, t: Tooth): void {
  const path = toothPath(t);
  ctx.save();
  ctx.fillStyle = '#fffdf6';
  ctx.fill(path);
  ctx.clip(path);
  ctx.fillStyle = '#ece4d3';
  ctx.fillRect(t.x + t.w * 0.18, t.y - t.h, t.w, t.h * 2);
  ctx.fillStyle = 'rgb(255 255 255 / 0.9)';
  ctx.fillRect(t.x - t.w * 0.32, t.y - t.h * 0.2, t.w * 0.14, t.h * 0.42);
  ctx.restore();
  ctx.lineWidth = 0.005;
  ctx.strokeStyle = LINE;
  ctx.stroke(path);
}
