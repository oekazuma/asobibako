import { isGood, type GameState, type Op } from './engine';

/** 群れの中心は盤面の高さのこの位置に固定し、道のほうを流す */
export const CROWD_Y = 0.78;
/** 描く人数の上限。数字は別に出すので、多すぎる分は描かない */
const MAX_DOTS = 160;
const GOLDEN = 2.39996;

const label = (op: Op) => `${op.kind === 'x' ? '×' : op.kind}${op.n}`;

/** 群れを描き、上端までの高さを返す。広がった群れも道からはみ出さないよう、中心を内側へ寄せる */
function crowd(ctx: CanvasRenderingContext2D, x: number, cy: number, n: number, unit: number, color: string) {
  const dots = Math.min(n, MAX_DOTS);
  const w = ctx.canvas.width / devicePixelRatio;
  const spread = Math.min(w * 0.44, unit * 0.027 * Math.sqrt(dots) + unit * 0.02);
  const cx = Math.min(w - spread, Math.max(spread, x));
  const r = unit * 0.014;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = r * 0.35;
  for (let i = 0; i < dots; i++) {
    const d = unit * 0.027 * Math.sqrt(i);
    const x = cx + Math.cos(i * GOLDEN) * d;
    const y = cy + Math.sin(i * GOLDEN) * d * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  return unit * 0.027 * Math.sqrt(dots) * 0.7;
}

function bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = `800 ${size}px 'Hiragino Maru Gothic ProN', system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.28;
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** w, h は盤面のピクセル。距離 1 は盤面の高さ 1 つぶん */
export function paint(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const baseY = h * CROWD_Y;
  const toY = (at: number) => baseY - (at - state.dist) * h;
  const unit = Math.min(w, h * 0.75);

  // 道の縞。進んだ距離に合わせて流す
  const band = 0.1;
  ctx.fillStyle = '#e8f6ff';
  for (let k = Math.floor(state.dist / band) - 2; k < state.dist / band + 12; k++) {
    if (k % 2) continue;
    ctx.fillRect(0, toY((k + 1) * band), w, h * band);
  }
  ctx.fillStyle = '#7fd67f';
  ctx.fillRect(0, 0, w * 0.03, h);
  ctx.fillRect(w * 0.97, 0, w * 0.03, h);

  const goalY = toY(state.length);
  if (goalY > -h) {
    ctx.fillStyle = '#ffe0e3';
    ctx.fillRect(0, goalY - h, w, h);
    const r = crowd(ctx, w / 2, goalY - unit * 0.12, state.boss, unit, '#ff4d5e');
    bubble(ctx, `🏰 ${state.boss}`, w / 2, goalY - unit * 0.12 - r - unit * 0.06, unit * 0.07, '#d02c3e');
  }

  for (const item of state.items) {
    const y = toY(item.at);
    if (y < -h * 0.2 || y > h * 1.2) continue;
    if (item.type === 'gates') {
      if (item.done) continue;
      const gh = unit * 0.12;
      for (const [op, x0] of [
        [item.left, 0],
        [item.right, w / 2]
      ] as const) {
        const good = isGood(op);
        ctx.fillStyle = good ? 'rgb(31 155 255 / 0.55)' : 'rgb(255 77 94 / 0.55)';
        ctx.fillRect(x0 + w * 0.02, y - gh, w * 0.46, gh);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = unit * 0.008;
        ctx.strokeRect(x0 + w * 0.02, y - gh, w * 0.46, gh);
        bubble(ctx, label(op), x0 + w * 0.25, y - gh / 2, unit * 0.075, good ? '#0b6fcc' : '#d02c3e');
      }
    } else {
      // ぶつかった敵は、打ち合いの間だけ群れの手前に残す
      const fighting = state.fight?.item === item;
      if (item.done && !fighting) continue;
      const n = fighting ? state.fight!.n : item.n;
      if (n <= 0) continue;
      const cy = fighting ? baseY - unit * 0.1 : y;
      const r = crowd(ctx, item.x * w, cy, n, unit, '#ff4d5e');
      bubble(ctx, String(n), item.x * w, cy - r - unit * 0.05, unit * 0.06, '#d02c3e');
    }
  }

  if (state.count > 0) {
    const r = crowd(ctx, state.x * w, baseY, state.count, unit, '#1f9bff');
    bubble(
      ctx,
      String(state.count),
      Math.min(w * 0.8, Math.max(w * 0.2, state.x * w)),
      baseY - r - unit * 0.06,
      unit * 0.08,
      '#0b6fcc'
    );
  }
}
