import { FACE, FACE_UNIT as U, type Animal, type AnimalId, type Expression } from '../animals';
import { LINE, LW, oval } from './style';

const EYE = '#2e2522';
const TAU = Math.PI * 2;
/** 顔の単位での線の太さ */
const W = LW / U;

/** 下がほんの少しふくらんだ、おもちの形の顔 */
const HEAD = 'M-78,8 C-80,-80 80,-80 78,8 C80,80 -80,80 -78,8 Z';

const circle = (x: number, y: number, rx: number, ry = rx) =>
  `M${x + rx},${y} a${rx},${ry} 0 1,0 ${-rx * 2},0 a${rx},${ry} 0 1,0 ${rx * 2},0`;

/**
 * 右側の耳（左は鏡に映して描く）。付け根は頭の輪郭より内側まで伸ばし、頭を上に塗って隠す。
 * 輪郭の外で閉じると、付け根に背景がのぞいて耳が浮いて見える
 */
const EARS: Partial<Record<AnimalId, [string, string?]>> = {
  bear: [circle(50, -52, 18), circle(52, -56, 8)],
  lion: [circle(46, -54, 13)],
  rabbit: ['M14,-38 C4,-120 48,-124 44,-36 Z', 'M20,-42 C14,-108 40,-112 36,-40 Z'],
  cat: ['M20,-44 Q50,-128 70,-16 Z', 'M33,-50 Q51,-100 60,-36 Z'],
  pig: ['M26,-46 Q66,-116 72,-14 Z'],
  hippo: [circle(46, -50, 10, 8)],
  frog: [circle(34, -62, 20)]
};

/** 顔の前に垂れる耳 */
const DOG_EAR = 'M46,-50 C92,-58 96,4 74,10 C60,2 50,-24 46,-50 Z';

export function mouthPath(a: Animal): Path2D {
  const p = new Path2D();
  p.ellipse(a.mouth.cx, a.mouth.cy, a.mouth.rx, a.mouth.ry, 0, 0, TAU);
  return p;
}

function shape(ctx: CanvasRenderingContext2D, d: string, fill: string, line = true): void {
  const p = new Path2D(d);
  ctx.fillStyle = fill;
  ctx.fill(p);
  if (!line) return;
  ctx.lineWidth = W;
  ctx.strokeStyle = LINE;
  ctx.stroke(p);
}

/** 右半分を描いて、左右に映す。映しても向きを変えたくない線は s を掛けて打ち消す */
function both(ctx: CanvasRenderingContext2D, draw: (s: number) => void): void {
  for (const s of [1, -1]) {
    ctx.save();
    ctx.scale(s, 1);
    draw(s);
    ctx.restore();
  }
}

function stroke(ctx: CanvasRenderingContext2D, d: string, width: number, color = EYE): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(new Path2D(d));
}

function head(ctx: CanvasRenderingContext2D, a: Animal): void {
  if (a.id === 'lion')
    for (let k = 0; k < 12; k++) {
      const g = (k / 12) * TAU;
      shape(ctx, circle(Math.cos(g) * 70, 2 + Math.sin(g) * 74, 18), a.acc);
    }
  const ear = EARS[a.id];
  if (ear)
    both(ctx, () => {
      shape(ctx, ear[0], a.fur);
      if (ear[1]) shape(ctx, ear[1], a.acc, false);
    });
  shape(ctx, HEAD, a.fur);
  if (a.id === 'frog')
    // 目のこぶは頭の線の上に盛り上げて見せるため、ふちの内側だけ塗り直して頭の線を消す
    both(ctx, () => {
      shape(ctx, circle(34, -62, 20 - W / 2), a.fur, false);
      stroke(ctx, 'M20,-36 q6,-5 12,0', 3, a.acc);
    });
  if (a.id === 'dog') both(ctx, () => shape(ctx, DOG_EAR, a.acc));
}

function nose(ctx: CanvasRenderingContext2D, a: Animal): void {
  const top = (a.mouth.cy - a.mouth.ry - FACE.y) / U;
  if (a.id === 'pig') {
    shape(ctx, circle(0, top - 12, 15, 10), a.acc);
    ctx.fillStyle = LINE;
    for (const s of [-1, 1]) {
      oval(ctx, s * 5, top - 12, 2.3, 3.4);
      ctx.fill();
    }
  } else if (a.id === 'hippo' || a.id === 'frog') {
    ctx.fillStyle = LINE;
    for (const s of [-1, 1]) {
      oval(ctx, s * 9, top - 9, 2.4, 1.8);
      ctx.fill();
    }
  } else if (a.id === 'rabbit') {
    shape(ctx, `M-4,${top - 10} h8 l-4,4 z`, '#ff9fb3');
  } else {
    oval(ctx, 0, top - 9, 5, 3.6);
    ctx.fillStyle = EYE;
    ctx.fill();
  }
}

function mouth(ctx: CanvasRenderingContext2D, a: Animal, teeth: (ctx: CanvasRenderingContext2D) => void): void {
  const m = a.mouth;
  const path = mouthPath(a);
  ctx.fillStyle = '#f7a1ae';
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  oval(ctx, m.cx, m.cy - m.ry * 0.05, m.rx * 0.5, m.ry * 0.36);
  ctx.fillStyle = '#ee8595';
  ctx.fill();
  oval(ctx, m.cx, m.cy + m.ry * 0.66, m.rx * 0.6, m.ry * 0.42);
  ctx.fillStyle = '#ffc4ce';
  ctx.fill();
  teeth(ctx);
  ctx.restore();
  ctx.lineWidth = LW;
  ctx.strokeStyle = LINE;
  ctx.stroke(path);
}

/** 涙や汗のしずく。上がとがる */
function drop(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, alpha = 1): void {
  ctx.globalAlpha = alpha;
  shape(ctx, `M${x},${y} q7,10 0,14 q-7,-4 0,-14`, fill, false);
  stroke(ctx, `M${x},${y} q7,10 0,14 q-7,-4 0,-14`, 1.4, '#7cc4ea');
  ctx.globalAlpha = 1;
}

function eyes(ctx: CanvasRenderingContext2D, a: Animal, e: Expression, t: number): void {
  const frog = a.id === 'frog';
  const x = frog ? 34 : 40;
  const y = frog ? -62 : -16;
  const blink = e === 'calm' && t % 4.2 < 0.13;
  both(ctx, (s) => {
    const [cx, cy] = frog ? [52, -22] : [a.id === 'dog' ? 54 : 60, -2];
    ctx.globalAlpha = e === 'happy' ? 0.9 : 0.65;
    oval(ctx, cx, cy, 10, 6);
    ctx.fillStyle = '#ffb3bf';
    ctx.fill();
    ctx.globalAlpha = 1;
    stroke(
      ctx,
      `M${cx - 5},${cy + 3} l${3 * s},-6 M${cx},${cy + 3} l${3 * s},-6 M${cx + 5},${cy + 3} l${3 * s},-6`,
      1.2,
      '#f08a9c'
    );
    if (e === 'hurt') stroke(ctx, `M${x + 6},${y - 5} L${x - 3},${y} L${x + 6},${y + 5}`, 2.6);
    else if (e === 'cry') stroke(ctx, `M${x - 6},${y - 1} Q${x},${y + 4} ${x + 6},${y - 1}`, 2.6);
    else if (e === 'happy') stroke(ctx, `M${x - 6},${y + 2} Q${x},${y - 5} ${x + 6},${y + 2}`, 2.6);
    else if (blink) stroke(ctx, `M${x - 5},${y} Q${x},${y + 2} ${x + 5},${y}`, 2.4);
    else {
      oval(ctx, x, y, 5.2, 5.2);
      ctx.fillStyle = EYE;
      ctx.fill();
      oval(ctx, x + 1.8, y - 1.8, 1.9, 1.9);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    // 困りまゆは内側を上げる
    if (e === 'nervous' || e === 'hurt' || e === 'cry') stroke(ctx, `M${x + 7},${y - 12} L${x - 4},${y - 15}`, 2.2);
    if (e === 'cry') {
      const f = (t * 0.7 + 0.5) % 1;
      drop(ctx, x, y + 4 + f * 8, '#aee2ff', 1 - f * f);
    }
  });
  // 汗は頭の横に置く。カエルの目の高さに合わせると頭の上に浮いてしまう
  if (e === 'nervous') drop(ctx, 64, -40 + ((t * 0.5) % 1) * 4, '#d4efff');
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
  const face = (draw: () => void) => {
    ctx.save();
    ctx.translate(FACE.x, FACE.y);
    ctx.scale(U, U);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw();
    ctx.restore();
  };
  face(() => {
    head(ctx, a);
    nose(ctx, a);
  });
  mouth(ctx, a, teeth);
  face(() => eyes(ctx, a, e, t));
}
