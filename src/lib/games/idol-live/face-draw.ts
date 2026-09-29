import type { Face } from './dance';

/**
 * 顔の絵（テクスチャ）。頭を正面から見た絵で、目・まゆ・ほお・鼻・口を描く。顔の立体は head.ts の形が受け持ち、
 * ここは平らなアニメ塗りの顔。目がいちばん大事なので、ひとみは何層にも重ねて描く
 */

export const FACE_PX = 1024;
/** 頭の中心から見た、絵の端までの幅と高さ（メートル）。head.ts の UV もこれで写す */
export const FACE_W = 0.22;
export const FACE_H = 0.24;

/** 頭の中心から見た位置（メートル）を、絵の上の位置へ */
export const toPx = (x: number, y: number): [number, number] => [
  FACE_PX * (0.5 + x / FACE_W),
  FACE_PX * (0.5 - y / FACE_H)
];

export const EYE = { x: 0.035, y: -0.012, w: 0.046, h: 0.055 };
const MOUTH_Y = -0.058;
const NOSE_Y = -0.036;

export const SKIN = '#ffe6da';
const LINE = '#3a1f36';
const IRIS = ['#1b2f6e', '#2a86d6', '#6ff3ff'];
const BROW = '#c9567f';

export interface FaceState {
  face: Face;
  /** 歌う口の開き（0..1 を 4 段に丸めて渡す） */
  mouth: number;
  blink: boolean;
}

export const faceKey = (s: FaceState) => `${s.face}:${s.mouth}:${s.blink}`;

type Ctx = CanvasRenderingContext2D;

export function drawFace(ctx: Ctx, s: FaceState) {
  const S = FACE_PX;
  ctx.fillStyle = SKIN;
  ctx.fillRect(0, 0, S, S);
  // あごの下と輪郭のきわに、ほんのり影色
  const jaw = ctx.createRadialGradient(S / 2, S * 0.42, S * 0.3, S / 2, S * 0.5, S * 0.62);
  jaw.addColorStop(0, 'rgba(255, 190, 180, 0)');
  jaw.addColorStop(1, 'rgba(240, 160, 165, 0.35)');
  ctx.fillStyle = jaw;
  ctx.fillRect(0, 0, S, S);
  blush(ctx);
  const closed = s.blink && s.face !== 'star' && s.face !== 'happy';
  for (const side of [-1, 1] as const) {
    const kind: Face = s.face === 'wink' && side > 0 ? 'happy' : s.face === 'wink' ? 'smile' : s.face;
    brow(ctx, side, kind);
    if (closed || kind === 'sing') lidClosed(ctx, side, kind === 'sing');
    else if (kind === 'happy') lidHappy(ctx, side);
    else eye(ctx, side, kind);
  }
  nose(ctx);
  mouth(ctx, s);
}

function blush(ctx: Ctx) {
  for (const side of [-1, 1]) {
    const [x, y] = toPx(side * 0.05, -0.044);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
    g.addColorStop(0, 'rgba(255, 120, 150, 0.45)');
    g.addColorStop(1, 'rgba(255, 120, 150, 0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.4, 0.7);
    ctx.translate(-x, -y);
    ctx.fillRect(x - 100, y - 100, 200, 200);
    ctx.restore();
    ctx.strokeStyle = 'rgba(235, 90, 120, 0.55)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(x + i * 26 - 8, y + 12);
      ctx.lineTo(x + i * 26 + 8, y - 12);
    }
    ctx.stroke();
  }
}

/** 目の枠。side は外がわ（目じり）の向き */
function frame(side: -1 | 1) {
  const [cx, cy] = toPx(side * EYE.x, EYE.y);
  const w = (EYE.w / FACE_W) * FACE_PX;
  const h = (EYE.h / FACE_H) * FACE_PX;
  const inner: [number, number] = [cx - side * w * 0.5, cy + h * 0.02];
  const outer: [number, number] = [cx + side * w * 0.56, cy - h * 0.08];
  return { cx, cy, w, h, inner, outer };
}

function lidPath(ctx: Ctx, side: -1 | 1, squint = 0) {
  const { cx, cy, w, h, inner, outer } = frame(side);
  ctx.moveTo(...inner);
  ctx.bezierCurveTo(cx - side * w * 0.35, cy - h * (0.62 - squint), cx + side * w * 0.3, cy - h * (0.66 - squint), ...outer);
  ctx.bezierCurveTo(cx + side * w * 0.52, cy + h * 0.4, cx + side * w * 0.15, cy + h * 0.56, cx - side * w * 0.12, cy + h * 0.5);
  ctx.quadraticCurveTo(cx - side * w * 0.42, cy + h * 0.4, ...inner);
  ctx.closePath();
}

function eye(ctx: Ctx, side: -1 | 1, kind: Face) {
  const { cx, cy, w, h, inner, outer } = frame(side);
  const squint = kind === 'focus' ? 0.14 : 0;
  ctx.save();
  ctx.beginPath();
  lidPath(ctx, side, squint);
  const white = ctx.createLinearGradient(0, cy - h * 0.6, 0, cy + h * 0.5);
  white.addColorStop(0, '#d9dcf0');
  white.addColorStop(0.35, '#ffffff');
  ctx.fillStyle = white;
  ctx.fill();
  ctx.clip();
  // ひとみ。上は暗く下ほど明るい。縁は濃く
  const ix = cx + side * w * 0.03;
  const iy = cy + h * 0.08;
  const rx = w * 0.37;
  const ry = h * 0.52;
  const g = ctx.createLinearGradient(0, iy - ry, 0, iy + ry);
  g.addColorStop(0, IRIS[0]);
  g.addColorStop(0.5, IRIS[1]);
  g.addColorStop(1, kind === 'star' ? '#b8fbff' : IRIS[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(ix, iy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(15, 25, 70, 0.8)';
  ctx.stroke();
  // ひとみの中の筋
  ctx.strokeStyle = 'rgba(190, 250, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + (0.7 * i) / 8);
    ctx.moveTo(ix + Math.cos(a) * rx * 0.3, iy + Math.sin(a) * ry * 0.3);
    ctx.lineTo(ix + Math.cos(a) * rx * 0.85, iy + Math.sin(a) * ry * 0.85);
  }
  ctx.stroke();
  // 瞳孔と、下に映る明るい三日月
  ctx.fillStyle = '#0c1a48';
  ctx.beginPath();
  ctx.ellipse(ix, iy - ry * 0.05, rx * 0.36, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = kind === 'star' ? 'rgba(255, 190, 240, 0.8)' : 'rgba(150, 255, 250, 0.7)';
  ctx.beginPath();
  ctx.ellipse(ix, iy + ry * 0.55, rx * 0.62, ry * 0.26, 0, 0, Math.PI);
  ctx.ellipse(ix, iy + ry * 0.42, rx * 0.5, ry * 0.18, 0, Math.PI, 0, true);
  ctx.fill();
  // まぶたの落とす影
  const lid = ctx.createLinearGradient(0, cy - h * 0.6, 0, cy - h * 0.05);
  lid.addColorStop(0, 'rgba(40, 20, 80, 0.55)');
  lid.addColorStop(1, 'rgba(40, 20, 80, 0)');
  ctx.fillStyle = lid;
  ctx.fillRect(cx - w, cy - h, w * 2, h);
  // ハイライト。光の来る左上に大きく、右下に小さく、きらりと小さな星
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (kind === 'star') sparkle(ctx, ix - rx * 0.28, iy - ry * 0.3, rx * 0.5);
  else ctx.ellipse(ix - rx * 0.32, iy - ry * 0.3, rx * 0.34, ry * 0.26, -0.4, 0, Math.PI * 2);
  ctx.moveTo(ix + rx * 0.45, iy + ry * 0.28);
  ctx.arc(ix + rx * 0.35, iy + ry * 0.28, rx * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  sparkle(ctx, ix + rx * 0.35, iy - ry * 0.42, rx * 0.16);
  ctx.fill();
  ctx.restore();
  // 上まつげ。太く、目じりで跳ねる
  ctx.fillStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(inner[0], inner[1] + 4);
  ctx.bezierCurveTo(cx - side * w * 0.35, cy - h * (0.66 - squint), cx + side * w * 0.3, cy - h * (0.72 - squint), outer[0] + side * w * 0.14, outer[1] - h * 0.14);
  ctx.lineTo(outer[0] + side * w * 0.06, outer[1] + h * 0.04);
  ctx.bezierCurveTo(cx + side * w * 0.3, cy - h * (0.58 - squint), cx - side * w * 0.35, cy - h * (0.55 - squint), inner[0], inner[1] + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  for (const [dx, dy, len] of [
    [0.44, -0.3, 0.2],
    [0.3, -0.52, 0.16]
  ]) {
    const [x, y] = [cx + side * w * dx, cy + h * dy];
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + side * w * len * 0.8, y - h * len * 0.2, x + side * w * len, y - h * len * 0.7);
    ctx.lineTo(x - side * 4, y + 6);
  }
  ctx.fill();
  // 二重まぶたの線と、下まつげ
  ctx.strokeStyle = 'rgba(120, 60, 90, 0.55)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - side * w * 0.25, cy - h * (0.78 - squint));
  ctx.quadraticCurveTo(cx + side * w * 0.15, cy - h * (0.86 - squint), cx + side * w * 0.45, cy - h * (0.68 - squint));
  ctx.stroke();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + side * w * 0.12, cy + h * 0.52);
  ctx.quadraticCurveTo(cx + side * w * 0.38, cy + h * 0.44, cx + side * w * 0.48, cy + h * 0.28);
  ctx.stroke();
}

/** 4 本の光の筋のきらり */
function sparkle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.moveTo(x, y - r);
  for (let i = 1; i <= 8; i++) {
    const a = (i * Math.PI) / 4;
    const k = i % 2 ? r * 0.28 : r;
    ctx.lineTo(x + Math.sin(a) * k, y - Math.cos(a) * k);
  }
  ctx.closePath();
}

/** 笑った目（^ ^） */
function lidHappy(ctx: Ctx, side: -1 | 1) {
  const { cx, cy, w, h } = frame(side);
  ctx.strokeStyle = LINE;
  ctx.lineCap = 'round';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(cx - side * w * 0.45, cy + h * 0.12);
  ctx.quadraticCurveTo(cx, cy - h * 0.55, cx + side * w * 0.5, cy + h * 0.08);
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx + side * w * 0.42, cy - h * 0.05);
  ctx.lineTo(cx + side * w * 0.62, cy - h * 0.2);
  ctx.stroke();
}

/** 閉じた目。歌っているときは、まつげを下ろしてうっとり */
function lidClosed(ctx: Ctx, side: -1 | 1, soft: boolean) {
  const { cx, cy, w, h } = frame(side);
  ctx.strokeStyle = LINE;
  ctx.lineCap = 'round';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(cx - side * w * 0.48, cy);
  ctx.quadraticCurveTo(cx, cy + h * (soft ? 0.3 : 0.15), cx + side * w * 0.52, cy - h * 0.06);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (const u of [0.1, 0.3, 0.46]) {
    const x = cx + side * w * u;
    const y = cy + h * (soft ? 0.24 : 0.12) - h * u * 0.3;
    ctx.moveTo(x, y);
    ctx.lineTo(x + side * w * 0.05, y + h * 0.14);
  }
  ctx.stroke();
}

function brow(ctx: Ctx, side: -1 | 1, kind: Face) {
  const { cx, cy, w, h } = frame(side);
  const lift = kind === 'happy' || kind === 'star' ? -h * 0.08 : 0;
  const knit = kind === 'focus' ? h * 0.12 : 0;
  ctx.strokeStyle = BROW;
  ctx.lineCap = 'round';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx - side * w * 0.38, cy - h * 1.02 + lift + knit);
  ctx.quadraticCurveTo(cx + side * w * 0.05, cy - h * 1.16 + lift, cx + side * w * 0.46, cy - h * 1.0 + lift);
  ctx.stroke();
}

function nose(ctx: Ctx) {
  const [x, y] = toPx(0.004, NOSE_Y);
  ctx.strokeStyle = 'rgba(200, 120, 120, 0.7)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 4);
  ctx.lineTo(x + 4, y);
  ctx.stroke();
}

function mouth(ctx: Ctx, s: FaceState) {
  const [x, y] = toPx(0, MOUTH_Y);
  const open = s.mouth > 0.05 ? s.mouth : s.face === 'happy' || s.face === 'star' || s.face === 'wink' ? 0.5 : 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (open <= 0) {
    ctx.strokeStyle = '#b3485f';
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (s.face === 'focus') {
      ctx.moveTo(x - 18, y + 4);
      ctx.lineTo(x + 18, y + 4);
    } else {
      ctx.moveTo(x - 30, y - 4);
      ctx.quadraticCurveTo(x, y + 18, x + 30, y - 4);
    }
    ctx.stroke();
    return;
  }
  const w = 26 + 16 * open;
  const h = 14 + 44 * open;
  ctx.beginPath();
  ctx.moveTo(x - w, y - 6);
  ctx.quadraticCurveTo(x, y + 2, x + w, y - 6);
  ctx.quadraticCurveTo(x + w * 0.85, y + h, x, y + h);
  ctx.quadraticCurveTo(x - w * 0.85, y + h, x - w, y - 6);
  ctx.closePath();
  ctx.fillStyle = '#9c2140';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ff8ea4';
  ctx.beginPath();
  ctx.ellipse(x, y + h, w * 0.7, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - w, y - 8, w * 2, 8 + h * 0.12);
  ctx.restore();
  ctx.strokeStyle = '#8a2a44';
  ctx.lineWidth = 5;
  ctx.stroke();
}
