import { FACE, type Animal, type AnimalId, type Expression } from '../animals';
import { LINE, LW, ink, oval } from './style';

const EYE = '#3a2418';
const TEAR = '#7fd0ff';
const TAU = Math.PI * 2;

/** 輪郭を四角に寄せる度合い（2 で楕円）。ワニとカバは横に広い口に合わせて顔を張らせる */
const SQUARE: Partial<Record<AnimalId, number>> = { croc: 2.5, hippo: 2.3 };

export function mouthPath(a: Animal): Path2D {
  const p = new Path2D();
  p.ellipse(a.mouth.cx, a.mouth.cy, a.mouth.rx, a.mouth.ry, 0, 0, TAU);
  return p;
}

function headPath(a: Animal): Path2D {
  const n = SQUARE[a.id] ?? 2;
  const { rx, ry } = a.head;
  const p = new Path2D();
  const steps = 96;
  for (let k = 0; k < steps; k++) {
    const g = (k / steps) * TAU;
    const c = Math.cos(g);
    const s = Math.sin(g);
    const x = FACE.x + rx * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = FACE.y + ry * Math.sign(s) * Math.abs(s) ** (2 / n);
    if (k === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/** 線の色で一回り太らせて塗ってから中を塗る。丸を重ねた房やこぶのふちを 1 本の線に見せる */
function lobes(
  ctx: CanvasRenderingContext2D,
  pts: readonly (readonly [number, number])[],
  r: number,
  fill: string,
  w = LW
): void {
  ctx.fillStyle = LINE;
  for (const [x, y] of pts) {
    oval(ctx, x, y, r + w, r + w);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  for (const [x, y] of pts) {
    oval(ctx, x, y, r, r);
    ctx.fill();
  }
}

function mane(ctx: CanvasRenderingContext2D, a: Animal): void {
  const ring = (n: number, rx: number, ry: number, shift: number) =>
    Array.from({ length: n }, (_, k) => {
      const g = ((k + shift) / n) * TAU;
      return [FACE.x + Math.cos(g) * rx, FACE.y + Math.sin(g) * ry] as const;
    });
  lobes(ctx, ring(16, a.head.rx - 0.02, a.head.ry + 0.02, 0), 0.075, '#dc7f2e');
  lobes(ctx, ring(16, a.head.rx - 0.04, a.head.ry - 0.02, 0.5), 0.06, '#f0a13e');
}

function ears(ctx: CanvasRenderingContext2D, a: Animal): void {
  const x = FACE.x;
  for (const s of [-1, 1]) {
    if (a.ears === 'round') {
      const ex = x + s * (a.head.rx * 0.68);
      oval(ctx, ex, 0.2, 0.095, 0.095);
      ink(ctx, a.fur);
      oval(ctx, ex, 0.21, 0.052, 0.052);
      ctx.fillStyle = a.inner;
      ctx.fill();
    } else if (a.ears === 'long') {
      const ex = x + s * 0.155;
      oval(ctx, ex, 0.135, 0.068, 0.13, s * 0.28);
      ink(ctx, a.fur);
      oval(ctx, ex + s * 0.004, 0.15, 0.034, 0.095, s * 0.28);
      ctx.fillStyle = a.inner;
      ctx.fill();
    } else if (a.ears === 'triangle' && a.extra === 'snout') {
      // ブタの耳は先が前へ折れる。ネコの立った耳と見分けるため
      ctx.beginPath();
      ctx.moveTo(x + s * 0.13, 0.25);
      ctx.lineTo(x + s * 0.25, 0.1);
      ctx.lineTo(x + s * 0.39, 0.11);
      ctx.quadraticCurveTo(x + s * 0.42, 0.22, x + s * 0.41, 0.31);
      ctx.closePath();
      ink(ctx, a.fur);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, 0.25);
      ctx.lineTo(x + s * 0.27, 0.15);
      ctx.lineTo(x + s * 0.37, 0.16);
      ctx.lineTo(x + s * 0.38, 0.28);
      ctx.closePath();
      ctx.fillStyle = a.inner;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.24, 0.1);
      ctx.quadraticCurveTo(x + s * 0.32, 0.07, x + s * 0.4, 0.11);
      ctx.quadraticCurveTo(x + s * 0.4, 0.2, x + s * 0.36, 0.24);
      ctx.quadraticCurveTo(x + s * 0.3, 0.16, x + s * 0.24, 0.1);
      ctx.closePath();
      ink(ctx, a.fur);
      ctx.save();
      ctx.clip();
      oval(ctx, x + s * 0.36, 0.2, 0.05, 0.08, s * 0.4);
      ctx.fillStyle = a.shade;
      ctx.fill();
      ctx.restore();
    } else if (a.ears === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.13, 0.26);
      ctx.quadraticCurveTo(x + s * 0.25, 0.12, x + s * 0.33, 0.035);
      ctx.quadraticCurveTo(x + s * 0.4, 0.15, x + s * 0.41, 0.32);
      ctx.closePath();
      ink(ctx, a.fur);
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, 0.26);
      ctx.lineTo(x + s * 0.325, 0.1);
      ctx.lineTo(x + s * 0.37, 0.29);
      ctx.closePath();
      ctx.fillStyle = a.inner;
      ctx.fill();
    } else if (a.ears === 'small') {
      const ex = x + s * 0.27;
      oval(ctx, ex, 0.16, 0.055, 0.05, s * 0.4);
      ink(ctx, a.fur);
      oval(ctx, ex, 0.165, 0.028, 0.026, s * 0.4);
      ctx.fillStyle = a.inner;
      ctx.fill();
    } else if (a.ears === 'bumps') {
      // ワニの目は頭の上のこぶに乗り、こぶのあいだに背中のうろこがのぞく
      if (s === 1) {
        lobes(
          ctx,
          [
            [x - 0.05, 0.2],
            [x + 0.05, 0.2],
            [x, 0.185]
          ],
          0.035,
          a.shade
        );
      }
      oval(ctx, x + s * 0.17, a.eyeY - 0.015, 0.1, 0.095);
      ink(ctx, a.fur);
    }
  }
}

function head(ctx: CanvasRenderingContext2D, a: Animal): void {
  const path = headPath(a);
  ctx.fillStyle = a.fur;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = a.shade;
  ctx.fill(path);
  ctx.translate(-0.03, -0.045);
  ctx.fillStyle = a.fur;
  ctx.fill(path);
  ctx.restore();
  ctx.save();
  ctx.clip(path);
  markings(ctx, a);
  ctx.restore();
  ctx.lineWidth = LW;
  ctx.strokeStyle = LINE;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  oval(ctx, FACE.x - a.head.rx * 0.48, FACE.y - a.head.ry * 0.68, a.head.rx * 0.2, a.head.ry * 0.075, -0.5);
  ctx.fillStyle = 'rgb(255 255 255 / 0.4)';
  ctx.fill();
  if (a.ears === 'bumps') {
    // 目のこぶは頭の上に盛り上がって見えるよう、頭の線をまたいで上半分のふちだけ引き直す
    for (const s of [-1, 1]) {
      const bx = FACE.x + s * 0.17;
      const by = a.eyeY - 0.015;
      oval(ctx, bx, by, 0.1 - LW / 2, 0.095 - LW / 2);
      ctx.fillStyle = a.fur;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bx, by, 0.1, 0.095, 0, Math.PI * 0.92, Math.PI * 2.08);
      ctx.stroke();
    }
  }
  if (a.ears === 'floppy') {
    for (const s of [-1, 1]) {
      const ex = FACE.x + s * 0.365;
      oval(ctx, ex, 0.4, 0.09, 0.2, s * 0.22);
      ink(ctx, a.inner);
      oval(ctx, ex - s * 0.028, 0.36, 0.024, 0.1, s * 0.22);
      ctx.fillStyle = 'rgb(255 255 255 / 0.2)';
      ctx.fill();
    }
  }
}

/** 顔の模様。頭の形で切り取った中に描く */
function markings(ctx: CanvasRenderingContext2D, a: Animal): void {
  const x = FACE.x;
  const top = FACE.y - a.head.ry;
  ctx.fillStyle = a.shade;
  if (a.id === 'cat') {
    for (const k of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + k * 0.06 - 0.018, top);
      ctx.lineTo(x + k * 0.06 + 0.018, top);
      ctx.lineTo(x + k * 0.05, top + (k === 0 ? 0.11 : 0.08));
      ctx.closePath();
      ctx.fill();
    }
    for (const s of [-1, 1])
      for (const k of [0, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + s * a.head.rx, 0.5 + k * 0.06);
        ctx.lineTo(x + s * a.head.rx, 0.53 + k * 0.06);
        ctx.lineTo(x + s * (a.head.rx - 0.08), 0.52 + k * 0.06);
        ctx.closePath();
        ctx.fill();
      }
  } else if (a.id === 'dog') {
    oval(ctx, x + 0.15, a.eyeY + 0.005, 0.085, 0.095, 0.3);
    ctx.fill();
  } else if (a.id === 'croc') {
    for (const [dx, dy, r] of [
      [-0.06, 0.3, 0.026],
      [0.05, 0.28, 0.02],
      [0, 0.36, 0.022],
      [-0.2, 0.25, 0.014],
      [0.19, 0.33, 0.016]
    ]) {
      oval(ctx, x + dx, dy, r * 1.2, r);
      ctx.fill();
    }
  } else if (a.id === 'hippo') {
    for (const s of [-1, 1])
      for (const [dx, dy] of [
        [0.36, 0.6],
        [0.4, 0.66],
        [0.33, 0.67]
      ]) {
        oval(ctx, x + s * dx, dy, 0.01, 0.01);
        ctx.fill();
      }
  }
}

function nose(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y - h * 0.35);
  ctx.quadraticCurveTo(x, y - h * 0.75, x + w, y - h * 0.35);
  ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.35, x, y + h * 0.55);
  ctx.quadraticCurveTo(x - w * 0.85, y + h * 0.35, x - w, y - h * 0.35);
  ink(ctx, fill, LW * 0.8);
  oval(ctx, x - w * 0.3, y - h * 0.3, w * 0.3, h * 0.16);
  ctx.fillStyle = 'rgb(255 255 255 / 0.65)';
  ctx.fill();
}

function nostrilBumps(ctx: CanvasRenderingContext2D, a: Animal, gap: number, r: number, y: number): void {
  for (const s of [-1, 1]) {
    const nx = a.mouth.cx + s * gap;
    oval(ctx, nx, y, r * 1.5, r * 1.15);
    ink(ctx, a.muzzle, LW * 0.8);
    oval(ctx, nx + s * r * 0.1, y + r * 0.1, r * 0.75, r * 0.5, s * 0.3);
    ctx.fillStyle = LINE;
    ctx.fill();
  }
}

function snout(ctx: CanvasRenderingContext2D, a: Animal): void {
  const m = a.mouth;
  const top = m.cy - m.ry;
  const big = a.id === 'hippo' ? 0.035 : 0;
  ctx.save();
  ctx.clip(headPath(a));
  oval(ctx, m.cx, m.cy - 0.01 - big, m.rx + 0.06, m.ry + 0.07 + big);
  ctx.fillStyle = a.muzzle;
  ctx.fill();
  ctx.restore();
  if (a.id === 'pig') {
    oval(ctx, m.cx, top - 0.075, 0.1, 0.066);
    ink(ctx, '#f7a1b5');
    oval(ctx, m.cx - 0.035, top - 0.1, 0.03, 0.012, -0.2);
    ctx.fillStyle = 'rgb(255 255 255 / 0.55)';
    ctx.fill();
    for (const s of [-1, 1]) {
      oval(ctx, m.cx + s * 0.038, top - 0.072, 0.018, 0.028);
      ctx.fillStyle = '#a3485d';
      ctx.fill();
    }
  } else if (a.id === 'hippo') nostrilBumps(ctx, a, 0.12, 0.03, top - 0.05);
  else if (a.id === 'croc') nostrilBumps(ctx, a, 0.055, 0.016, top - 0.035);
  else if (a.id === 'rabbit') nose(ctx, m.cx, top - 0.05, 0.03, 0.04, '#f58aa2');
  else if (a.id === 'cat') nose(ctx, m.cx, top - 0.05, 0.036, 0.045, '#f58aa2');
  else if (a.id === 'dog') nose(ctx, m.cx, top - 0.055, 0.065, 0.06, EYE);
  else nose(ctx, m.cx, top - 0.055, 0.05, 0.05, EYE);
  if (a.extra === 'whiskers') {
    ctx.lineWidth = 0.005;
    ctx.strokeStyle = LINE;
    for (const s of [-1, 1])
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(m.cx + s * (m.rx + 0.03), top + 0.04 + k * 0.02);
        ctx.quadraticCurveTo(
          m.cx + s * (m.rx + 0.1),
          top + 0.02 + k * 0.03,
          m.cx + s * (m.rx + 0.16),
          top + 0.03 + k * 0.05
        );
        ctx.stroke();
      }
  }
}

function openEye(ctx: CanvasRenderingContext2D, a: Animal, x: number, y: number): void {
  if (a.id === 'croc') {
    oval(ctx, x, y, 0.05, 0.05);
    ink(ctx, '#f4d64a', LW * 0.8);
    oval(ctx, x, y, 0.015, 0.042);
    ctx.fillStyle = EYE;
    ctx.fill();
  } else {
    oval(ctx, x, y, 0.042, 0.054);
    ctx.fillStyle = EYE;
    ctx.fill();
  }
  oval(ctx, x + 0.015, y - 0.02, 0.016, 0.016);
  ctx.fillStyle = '#fff';
  ctx.fill();
  oval(ctx, x - 0.013, y + 0.022, 0.007, 0.007);
  ctx.fill();
}

function tears(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const wave = Math.sin(t * 6 + s) * 0.008;
  const stream = new Path2D();
  stream.moveTo(x + s * 0.025, y + 0.015);
  stream.quadraticCurveTo(x + s * 0.09, y + 0.03, x + s * 0.085 + wave, y + 0.17);
  ctx.lineCap = 'round';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 0.034 + LW;
  ctx.stroke(stream);
  ctx.strokeStyle = TEAR;
  ctx.lineWidth = 0.034;
  ctx.stroke(stream);
  ctx.strokeStyle = 'rgb(255 255 255 / 0.7)';
  ctx.lineWidth = 0.007;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.055, y + 0.05);
  ctx.quadraticCurveTo(x + s * 0.075, y + 0.07, x + s * 0.078 + wave, y + 0.12);
  ctx.stroke();
  const fall = (t * 1.4 + (s + 1) * 0.25) % 1;
  drop(ctx, x + s * 0.085 + wave, y + 0.2 + fall * 0.1, 0.014, 1 - fall);
}

function drop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2.1);
  ctx.bezierCurveTo(x + r * 0.4, y - r * 1.2, x + r * 1.05, y - r * 0.5, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r * 1.05, y - r * 0.5, x - r * 0.4, y - r * 1.2, x, y - r * 2.1);
  ink(ctx, TEAR, LW * 0.6);
  oval(ctx, x - r * 0.35, y - r * 0.2, r * 0.22, r * 0.4);
  ctx.fillStyle = 'rgb(255 255 255 / 0.85)';
  ctx.fill();
  ctx.restore();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ink(ctx, '#ffd84a', LW * 0.6);
}

function eyes(ctx: CanvasRenderingContext2D, a: Animal, e: Expression, t: number): void {
  const y = a.eyeY;
  const m = a.mouth;
  const blink = e === 'calm' && t % 4.2 < 0.13;
  const cheekY = (y + m.cy - m.ry) / 2 + 0.045;
  for (const s of [-1, 1]) {
    const x = FACE.x + s * (a.ears === 'bumps' ? 0.17 : 0.155);
    // 緑の顔にうすい赤を重ねると泥の色に濁るので、ワニはにっこりのときだけほおを染める
    if (e === 'happy' || a.id !== 'croc') {
      oval(ctx, FACE.x + s * a.head.rx * 0.68, cheekY, 0.058, 0.034);
      ctx.fillStyle = e === 'happy' ? 'rgb(255 105 130 / 0.8)' : 'rgb(255 127 143 / 0.42)';
      ctx.fill();
    }
    if (e === 'happy') {
      ctx.strokeStyle = 'rgb(255 255 255 / 0.8)';
      ctx.lineWidth = 0.006;
      for (const k of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(FACE.x + s * a.head.rx * 0.68 + k * 0.022 + 0.008, cheekY - 0.014);
        ctx.lineTo(FACE.x + s * a.head.rx * 0.68 + k * 0.022 - 0.008, cheekY + 0.014);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 0.014;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = EYE;
    ctx.beginPath();
    if (e === 'happy') {
      ctx.arc(x, y + 0.025, 0.042, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (e === 'hurt') {
      ctx.moveTo(x - s * 0.035, y - 0.032);
      ctx.lineTo(x + s * 0.025, y);
      ctx.lineTo(x - s * 0.035, y + 0.032);
      ctx.stroke();
    } else if (e === 'cry') {
      ctx.arc(x, y - 0.02, 0.04, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
    } else if (blink) {
      ctx.arc(x, y - 0.02, 0.04, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    } else {
      openEye(ctx, a, x, y);
    }
    if (e === 'nervous' || e === 'hurt' || e === 'cry') {
      // 困りまゆは内側が上がる
      const by = y - (e === 'nervous' ? 0.085 : 0.075);
      ctx.lineWidth = 0.013;
      ctx.strokeStyle = EYE;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.05, by + 0.012);
      ctx.quadraticCurveTo(x + s * 0.005, by - 0.018, x - s * 0.04, by - 0.03);
      ctx.stroke();
    }
    if (e === 'cry') tears(ctx, x, y, s, t);
    else if (e === 'hurt') drop(ctx, x + s * 0.05, y + 0.045, 0.012);
  }
  if (e === 'nervous') {
    const slide = (t * 0.5) % 1;
    drop(ctx, FACE.x + a.head.rx * 0.72, Math.max(y, 0.36) - 0.07 + slide * 0.04, 0.02 * (0.9 + slide * 0.2));
  } else if (e === 'happy') {
    const tw = 0.75 + Math.sin(t * 5) * 0.25;
    sparkle(ctx, FACE.x - a.head.rx + 0.01, 0.2, 0.055 * tw);
    sparkle(ctx, FACE.x + a.head.rx - 0.01, 0.3, 0.04 * (1.5 - tw));
  }
}

/**
 * 患者さんを 1 人ぶん描く。歯は口の形で切り取った中に teeth が描く。
 * 口を開けたままなので、気持ちは目・まゆ・ほお・汗・涙で見せる
 */
export function drawPatient(
  ctx: CanvasRenderingContext2D,
  a: Animal,
  e: Expression,
  t: number,
  teeth: (ctx: CanvasRenderingContext2D) => void
): void {
  if (a.extra === 'mane') mane(ctx, a);
  ears(ctx, a);
  head(ctx, a);
  snout(ctx, a);
  const m = a.mouth;
  const mouth = mouthPath(a);
  ctx.fillStyle = '#962a3c';
  ctx.fill(mouth);
  ctx.save();
  ctx.clip(mouth);
  oval(ctx, m.cx, m.cy - m.ry * 0.1, m.rx * 0.5, m.ry * 0.38);
  ctx.fillStyle = '#6e1b2b';
  ctx.fill();
  oval(ctx, m.cx, m.cy + m.ry * 0.58, m.rx * 0.64, m.ry * 0.42);
  ctx.fillStyle = '#f58aa2';
  ctx.fill();
  ctx.strokeStyle = 'rgb(201 72 106 / 0.6)';
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(m.cx, m.cy + m.ry * 0.3);
  ctx.lineTo(m.cx, m.cy + m.ry * 0.6);
  ctx.stroke();
  teeth(ctx);
  ctx.restore();
  ctx.lineWidth = LW * 1.1;
  ctx.strokeStyle = LINE;
  ctx.stroke(mouth);
  eyes(ctx, a, e, t);
}
