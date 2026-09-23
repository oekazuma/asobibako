import { GERM_R, type GermKind } from '../animals';
import { LINE, oval } from './style';

const BODY: Record<GermKind, [string, string]> = {
  normal: ['#82d65a', '#4fa83a'],
  quick: ['#b27bff', '#7c4fd6'],
  boss: ['#5fae3c', '#3b7a25']
};

export interface GermLook {
  /** ピンセットでつままれていると足をばたつかせる */
  held: boolean;
  /** 穴から出てきてからの秒。出てくるときにぽんと膨らむ */
  age: number;
}

/** バイキンのまわりの突起。すばやいバイキンはとげにして、ふつうのものと形でも見分けられるようにする */
function outline(r: number, kind: GermKind, t: number): Path2D {
  const p = new Path2D();
  const n = kind === 'boss' ? 9 : 7;
  for (let k = 0; k < n; k++) {
    const g = (k / n) * Math.PI * 2 - Math.PI / 2 + Math.sin(t * 3) * 0.05;
    const next = g + (Math.PI * 2) / n;
    const mid = (g + next) / 2;
    if (kind === 'quick') {
      p.lineTo(Math.cos(g) * r, Math.sin(g) * r);
      p.lineTo(Math.cos(mid) * r * 1.45, Math.sin(mid) * r * 1.45);
    } else {
      const bulge = r * 1.42;
      if (k === 0) p.moveTo(Math.cos(g) * r, Math.sin(g) * r);
      p.bezierCurveTo(
        Math.cos(g + 0.12) * bulge,
        Math.sin(g + 0.12) * bulge,
        Math.cos(next - 0.12) * bulge,
        Math.sin(next - 0.12) * bulge,
        Math.cos(next) * r,
        Math.sin(next) * r
      );
    }
  }
  p.closePath();
  return p;
}

export function drawGerm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: GermKind,
  t: number,
  look: GermLook
): void {
  const r = GERM_R[kind];
  // 患者さんと同じ太さの線では、小さなバイキンの色がつぶれる
  const lw = r * 0.14;
  const grow = Math.min(1, look.age / 0.25);
  const pop = grow < 1 ? grow * 1.15 : 1;
  const sq = 1 + Math.sin(t * 7 + x * 40) * 0.07;
  const [fill, shade] = BODY[kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sq * pop, (2 - sq) * pop);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LINE;
  if (look.held) {
    for (const s of [-1, 1])
      for (const k of [0, 1]) {
        const swing = Math.sin(t * 24 + k * 2 + s) * 0.6;
        const g = Math.PI / 2 + s * (0.35 + k * 0.5) + swing * 0.4;
        const fx = Math.cos(g) * r * 1.65;
        const fy = Math.sin(g) * r * 1.65;
        ctx.lineWidth = lw * 1.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(g) * r * 0.7, Math.sin(g) * r * 0.7);
        ctx.lineTo(fx, fy);
        ctx.stroke();
        oval(ctx, fx, fy, r * 0.16, r * 0.12);
        ctx.fillStyle = shade;
        ctx.fill();
        ctx.lineWidth = lw * 0.8;
        ctx.stroke();
      }
  }
  const body = outline(r, kind, t);
  ctx.fillStyle = shade;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.translate(-r * 0.12, -r * 0.16);
  ctx.fillStyle = fill;
  ctx.fill(body);
  ctx.restore();
  ctx.lineWidth = lw;
  ctx.stroke(body);
  oval(ctx, -r * 0.45, -r * 0.62, r * 0.26, r * 0.13, -0.6);
  ctx.fillStyle = 'rgb(255 255 255 / 0.5)';
  ctx.fill();
  // 目はきょろきょろ動かす。つままれているあいだは下（ゴミ箱のほう）を見て焦る
  const lookX = look.held ? 0 : Math.sin(t * 1.3 + x * 17) * r * 0.08;
  const lookY = look.held ? r * 0.07 : 0;
  const eyeR = look.held ? r * 0.3 : r * 0.26;
  for (const s of [-1, 1]) {
    const ex = s * r * 0.36;
    oval(ctx, ex, -r * 0.08, eyeR, eyeR * 1.15);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
    oval(ctx, ex + lookX, -r * 0.05 + lookY, r * (look.held ? 0.08 : 0.12), r * (look.held ? 0.08 : 0.13));
    ctx.fillStyle = LINE;
    ctx.fill();
    ctx.lineWidth = lw * (kind === 'boss' ? 1.5 : 1.1);
    ctx.beginPath();
    if (look.held) {
      ctx.moveTo(s * r * 0.6, -r * 0.44);
      ctx.lineTo(s * r * 0.16, -r * 0.54);
    } else {
      ctx.moveTo(s * r * 0.64, -r * 0.52);
      ctx.lineTo(s * r * 0.12, -r * 0.34);
    }
    ctx.stroke();
  }
  ctx.lineWidth = lw;
  if (look.held) {
    oval(ctx, 0, r * 0.5, r * 0.14, r * 0.17);
    ctx.fillStyle = '#6e1b2b';
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'boss') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.46, r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.42, r * 0.46, r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.95, -r * 0.46, r * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#6e1b2b';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.34, r * 0.33);
      ctx.lineTo(s * r * 0.26, r * 0.52);
      ctx.lineTo(s * r * 0.17, r * 0.36);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, r * 0.36);
    ctx.quadraticCurveTo(0, r * 0.72, r * 0.36, r * 0.36);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, r * 0.47);
    ctx.lineTo(-r * 0.11, r * 0.68);
    ctx.lineTo(-r * 0.02, r * 0.53);
    if (kind === 'quick') {
      ctx.moveTo(r * 0.2, r * 0.47);
      ctx.lineTo(r * 0.11, r * 0.68);
      ctx.lineTo(r * 0.02, r * 0.53);
    }
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = lw * 0.6;
    ctx.stroke();
  }
  if (kind === 'boss') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.92);
    for (const [px, py] of [
      [-0.58, -1.5],
      [-0.28, -1.15],
      [0, -1.62],
      [0.28, -1.15],
      [0.58, -1.5],
      [0.5, -0.92]
    ])
      ctx.lineTo(px * r, py * r);
    ctx.closePath();
    ctx.fillStyle = '#ffc233';
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.stroke();
    oval(ctx, 0, -r * 1.08, r * 0.09, r * 0.09);
    ctx.fillStyle = '#ff5a6e';
    ctx.fill();
  }
  ctx.restore();
}
