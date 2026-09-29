import type { Coord } from './outfits';
import type { Body, Face, P } from './pose';
import { ACCS, arm, LINE, legwear, limb, LW, shape, shoe, SKIN, SKIRTS, star, TAILS, TOPS } from './wear-draw';

/**
 * アイドル（陽向ミオ）の絵。関節の位置（Body）を受け取り、世界の座標のまま描く。
 * ツインテールとスカートは頭と腰の動きから遅れて揺れ、顔は turn だけ目鼻と前髪をずらして振り向いたように見せる
 */

const HAIR = '#ff8db5';
const HAIR_DARK = '#e8659a';
const HAIR_LIGHT = '#ffc6da';
const IRIS_TOP = '#1d4f8c';
const IRIS = '#45c3f0';
const BROW = '#d0527f';

type Ctx = CanvasRenderingContext2D;

export interface Mood {
  /** 歌う口の開き 0..1 */
  mouth: number;
  /** かっこうの表情を上書きする */
  face?: Face;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** ばね。target に向かって揺れながら落ち着く */
class Spring {
  x = 0;
  v = 0;
  step(target: number, dt: number, k = 60, c = 7) {
    this.v += ((target - this.x) * k - this.v * c) * dt;
    this.x += this.v * dt;
  }
}

export class Idol {
  readonly #swing = new Spring();
  readonly #lift = new Spring();
  readonly #flare = new Spring();
  #prev: { head: P; hip: P } | null = null;
  #blink = 0;
  #nextBlink = 2;

  /** 揺れものとまばたきを進める。描く前に毎フレーム呼ぶ */
  update(b: Body, dt: number): void {
    if (this.#prev && dt > 0) {
      const vx = (b.head[0] - this.#prev.head[0]) / dt;
      const vy = (b.head[1] - this.#prev.head[1]) / dt;
      const hv = Math.hypot(b.hip[0] - this.#prev.hip[0], b.hip[1] - this.#prev.hip[1]) / dt;
      this.#swing.step(clamp(vx * 0.9, -0.8, 0.8), dt);
      this.#lift.step(clamp(vy * 1.4, -0.3, 0.7), dt, 50, 6);
      this.#flare.step(clamp(hv * 2.2, 0, 1), dt, 40, 5);
    }
    this.#prev = { head: b.head, hip: b.hip };
    this.#nextBlink -= dt;
    if (this.#nextBlink < 0) [this.#blink, this.#nextBlink] = [0.14, 2 + Math.random() * 3];
    this.#blink = Math.max(0, this.#blink - dt);
  }

  draw(ctx: Ctx, b: Body, look: Coord, mood: Mood): void {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const s of [-1, 1] as const) this.#tail(ctx, b, s);
    head(ctx, b, () => backHair(ctx));
    for (const i of [0, 1] as const) {
      limb(ctx, [b.hipJ[i], b.knee[i], b.ankle[i]], 0.042, SKIN);
      legwear(ctx, b, i, look.shoes);
      shoe(ctx, b.ankle[i], i ? 1 : -1, look.shoes);
    }
    frame(ctx, b.hip, b.lean, () => {
      shape(ctx, SKIN, () => ctx.roundRect(-0.019, -0.3, 0.038, 0.08, 0.01));
      TOPS[look.top](ctx);
    });
    frame(ctx, b.hip, b.lean * 0.4, () => SKIRTS[look.bottom](ctx, Math.max(0, this.#flare.x)));
    for (const i of [0, 1] as const) {
      arm(ctx, b, i, look.top);
      hand(ctx, b, i);
    }
    const face = mood.face ?? b.pose.face;
    head(ctx, b, () => {
      faceShape(ctx, b.turn, face, mood.mouth, this.#blink > 0);
      bangs(ctx, b.turn * 0.012);
      brows(ctx, b.turn * 0.02, face);
      for (const s of [-1, 1] as const) ACCS[look.acc].tie(ctx, s);
      ACCS[look.acc].head(ctx);
    });
    ctx.restore();
  }

  /** ツインテール。根元は頭について回り、先は重さで下を向いて揺れる */
  #tail(ctx: Ctx, b: Body, s: -1 | 1) {
    const [c, sn] = [Math.cos(b.tilt), Math.sin(b.tilt)];
    const root: P = [b.head[0] + s * TAILS[0] * c - TAILS[1] * sn, b.head[1] + s * TAILS[0] * sn + TAILS[1] * c];
    ctx.save();
    ctx.translate(...root);
    ctx.rotate(-s * 0.32 + b.tilt * 0.6 + this.#swing.x - s * this.#lift.x);
    const g = ctx.createLinearGradient(0, 0, 0, 0.34);
    g.addColorStop(0, HAIR);
    g.addColorStop(1, HAIR_DARK);
    shape(ctx, g, () => {
      ctx.moveTo(-s * 0.02, 0);
      ctx.bezierCurveTo(s * 0.09, 0.0, s * 0.11, 0.17, s * 0.045, 0.3);
      ctx.quadraticCurveTo(s * 0.02, 0.35, -s * 0.01, 0.33);
      ctx.quadraticCurveTo(s * 0.03, 0.3, s * 0.02, 0.22);
      ctx.bezierCurveTo(s * 0.01, 0.13, -s * 0.03, 0.08, -s * 0.02, 0);
    });
    ctx.strokeStyle = HAIR_LIGHT;
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.moveTo(s * 0.02, 0.03);
    ctx.quadraticCurveTo(s * 0.075, 0.12, s * 0.045, 0.24);
    ctx.stroke();
    ctx.restore();
  }
}

function frame(ctx: Ctx, at: P, angle: number, draw: () => void) {
  ctx.save();
  ctx.translate(...at);
  ctx.rotate(angle);
  draw();
  ctx.restore();
}

const head = (ctx: Ctx, b: Body, draw: () => void) => frame(ctx, b.head, b.tilt, draw);

function hairFill(ctx: Ctx) {
  const g = ctx.createLinearGradient(0, -0.14, 0, 0.1);
  g.addColorStop(0, HAIR_LIGHT);
  g.addColorStop(0.35, HAIR);
  g.addColorStop(1, HAIR_DARK);
  return g;
}

function backHair(ctx: Ctx) {
  shape(ctx, HAIR_DARK, () => {
    ctx.moveTo(-0.132, -0.02);
    ctx.bezierCurveTo(-0.15, -0.16, 0.15, -0.16, 0.132, -0.02);
    ctx.bezierCurveTo(0.14, 0.06, 0.13, 0.12, 0.1, 0.15);
    ctx.quadraticCurveTo(0, 0.12, -0.1, 0.15);
    ctx.bezierCurveTo(-0.13, 0.12, -0.14, 0.06, -0.132, -0.02);
  });
}

function faceShape(ctx: Ctx, turn: number, face: Face, mouth: number, blink: boolean) {
  shape(ctx, SKIN, () => {
    ctx.moveTo(-0.112, -0.02);
    ctx.bezierCurveTo(-0.114, 0.06, -0.05, 0.1, 0, 0.104);
    ctx.bezierCurveTo(0.05, 0.1, 0.114, 0.06, 0.112, -0.02);
    ctx.bezierCurveTo(0.11, -0.125, -0.11, -0.125, -0.112, -0.02);
  });
  const ox = turn * 0.02;
  ctx.fillStyle = 'rgba(255, 110, 150, 0.3)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(ox + s * 0.066, 0.046, 0.022, 0.011, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of [-1, 1] as const) {
    const narrow = s * turn > 0 ? 1 - 0.25 * Math.abs(turn) : 1;
    const kind = face === 'wink' && s > 0 ? 'happy' : face;
    eye(ctx, ox + s * 0.047, 0.012, s, narrow, kind, blink);
  }
  lips(ctx, ox * 1.1, 0.068, face, mouth);
}

function eye(ctx: Ctx, x: number, y: number, s: -1 | 1, narrow: number, face: Face, blink: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(narrow, 1);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 0.009;
  if (face === 'happy' || face === 'sing' || (blink && face !== 'star')) {
    ctx.beginPath();
    if (face === 'happy') {
      ctx.moveTo(-0.024, 0.008);
      ctx.quadraticCurveTo(0, -0.03, 0.024, 0.008);
    } else {
      ctx.moveTo(-0.025, 0);
      ctx.quadraticCurveTo(0, 0.018, 0.025, 0);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  shape(ctx, '#ffffff', () => ctx.ellipse(0, 0.002, 0.027, 0.034, 0, 0, Math.PI * 2), false);
  const g = ctx.createLinearGradient(0, -0.03, 0, 0.035);
  g.addColorStop(0, IRIS_TOP);
  g.addColorStop(1, face === 'star' ? '#7ee6ff' : IRIS);
  shape(ctx, g, () => ctx.ellipse(0, 0.005, 0.022, 0.03, 0, 0, Math.PI * 2), false);
  shape(ctx, IRIS_TOP, () => ctx.ellipse(0, 0.007, 0.01, 0.014, 0, 0, Math.PI * 2), false);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (face === 'star') star(ctx, -0.004, -0.004, 0.016, 0.4, 4);
  else ctx.arc(-0.009, -0.01, 0.0075, 0, Math.PI * 2);
  ctx.moveTo(0.012, 0.014);
  ctx.arc(0.008, 0.014, 0.004, 0, Math.PI * 2);
  ctx.fill();
  // 上まつげ。目じり（外側）をはね上げる
  ctx.beginPath();
  ctx.moveTo(-s * 0.028, -0.014);
  ctx.quadraticCurveTo(-s * 0.004, -0.045, s * 0.03, -0.024);
  ctx.lineTo(s * 0.037, -0.014);
  ctx.stroke();
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(-0.012, 0.037);
  ctx.lineTo(0.012, 0.037);
  ctx.stroke();
  ctx.restore();
}

function lips(ctx: Ctx, x: number, y: number, face: Face, mouth: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = LW;
  const open = mouth > 0.05 ? mouth : face === 'happy' || face === 'star' || face === 'wink' ? 0.45 : 0;
  if (open > 0) {
    const w = 0.014 + 0.008 * open;
    const h = 0.008 + 0.022 * open;
    ctx.beginPath();
    ctx.moveTo(-w, -0.002);
    ctx.quadraticCurveTo(0, 0.004, w, -0.002);
    ctx.quadraticCurveTo(w * 0.9, h, 0, h);
    ctx.quadraticCurveTo(-w * 0.9, h, -w, -0.002);
    ctx.fillStyle = '#c2334f';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ff8aa0';
    ctx.beginPath();
    ctx.ellipse(0, h, w * 0.7, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.stroke();
  } else {
    ctx.beginPath();
    if (face === 'focus') {
      ctx.moveTo(-0.01, 0.004);
      ctx.lineTo(0.01, 0.004);
    } else {
      ctx.moveTo(-0.014, 0);
      ctx.quadraticCurveTo(0, 0.013, 0.014, 0);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function bangs(ctx: Ctx, ox: number) {
  ctx.save();
  ctx.translate(ox, 0);
  shape(ctx, hairFill(ctx), () => {
    ctx.moveTo(-0.126, 0.06);
    ctx.bezierCurveTo(-0.14, -0.07, -0.1, -0.138, 0, -0.138);
    ctx.bezierCurveTo(0.1, -0.138, 0.14, -0.07, 0.126, 0.06);
    ctx.quadraticCurveTo(0.112, 0.01, 0.1, -0.012);
    const tips: P[] = [
      [0.085, -0.04],
      [0.066, -0.006],
      [0.046, -0.052],
      [0.02, -0.012],
      [0.0, -0.058],
      [-0.024, -0.01],
      [-0.046, -0.052],
      [-0.068, -0.004],
      [-0.086, -0.04],
      [-0.1, -0.012]
    ];
    let prev: P = [0.1, -0.012];
    for (const p of tips) {
      ctx.quadraticCurveTo((prev[0] + p[0]) / 2, Math.min(prev[1], p[1]) - 0.006, ...p);
      prev = p;
    }
    ctx.quadraticCurveTo(-0.112, 0.01, -0.126, 0.06);
  });
  // 天使の輪のつや
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.ellipse(0, -0.07, 0.085, 0.035, 0, Math.PI * 1.1, Math.PI * 1.45);
  ctx.moveTo(0.02, -0.105);
  ctx.ellipse(0, -0.07, 0.085, 0.035, 0, Math.PI * 1.55, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

function brows(ctx: Ctx, ox: number, face: Face) {
  ctx.strokeStyle = BROW;
  ctx.lineWidth = 0.005;
  const down = face === 'focus' ? 0.012 : 0;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const x = ox + s * 0.047;
    ctx.moveTo(x - s * 0.02, -0.05 + down);
    ctx.quadraticCurveTo(x, -0.062, x + s * 0.02, -0.056 + down * 0.3);
  }
  ctx.stroke();
}

function hand(ctx: Ctx, b: Body, i: 0 | 1) {
  const g = i ? b.pose.gripR : b.pose.gripL;
  const [x, y] = b.hand[i];
  const a = b.fore[i];
  const finger = (da: number, len: number) =>
    limb(
      ctx,
      [
        [x, y],
        [x + Math.cos(a + da) * len, y + Math.sin(a + da) * len]
      ],
      0.012,
      SKIN
    );
  if (g === 'point') finger(0, 0.04);
  if (g === 'v') {
    finger(-0.3, 0.042);
    finger(0.3, 0.042);
  }
  shape(ctx, SKIN, () => ctx.arc(x, y, g === 'fist' ? 0.02 : 0.023, 0, Math.PI * 2));
  // 親指。手のひらの、体の内がわ寄りに小さく出す
  if (g === 'open' || g === 'heart') {
    const t = a + (i ? -1 : 1) * 1.3;
    shape(ctx, SKIN, () =>
      ctx.ellipse(x + Math.cos(t) * 0.02, y + Math.sin(t) * 0.02, 0.011, 0.008, t, 0, Math.PI * 2)
    );
  }
}
