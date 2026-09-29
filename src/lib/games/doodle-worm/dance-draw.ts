import { SPOTS, spotAt, WINDOW, type Chart, type Judge } from './dance';

/** ノーツの色。となりのノーツと見分けやすいよう順に変える。長押しは金色 */
const COLORS = ['#ff7eb6', '#63a8f7', '#b3ec3a', '#a974f2', '#5ee0c8'];
const HOLD = '#ffc233';

/** ノーツの半径（盤面の高さを 1 とした単位） */
export const noteRadius = (aspect: number) => Math.min(aspect * 0.075, 0.058);

/** 弧の場所の番号を盤面の座標に直す */
export const placer =
  (aspect: number) =>
  (spot: number): [number, number] => {
    const [u, v] = spotAt(spot);
    return [u * aspect, v];
  };

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** 舞台の上から当たる光。拍の頭で明るくなり、拍の終わりへ向けて落ちる */
export function lights(ctx: CanvasRenderingContext2D, aspect: number, beat: number) {
  const glow = 0.1 + 0.18 * (1 - beat);
  for (let i = 0; i < 5; i++) {
    const x = aspect * (0.1 + i * 0.2);
    ctx.fillStyle = `rgb(255 255 255 / ${glow * (i % 2 ? 0.7 : 1)})`;
    ctx.beginPath();
    ctx.moveTo(x - 0.02, 0);
    ctx.lineTo(x + 0.02, 0);
    ctx.lineTo(aspect / 2 + (x - aspect / 2) * 0.35 + 0.09, 0.5);
    ctx.lineTo(aspect / 2 + (x - aspect / 2) * 0.35 - 0.09, 0.5);
    ctx.fill();
  }
  // 踊る子の立つ台
  ctx.fillStyle = 'rgb(255 255 255 / 0.18)';
  ctx.beginPath();
  ctx.ellipse(aspect / 2, 0.47, aspect * 0.3, 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * ノーツと、外から縮んでくるタイミングの輪。輪がノーツのふちに重なった瞬間が押す時刻。
 * 押す場所がどこに出るか前もって分かるよう、弧の場所にはいつも薄い丸を置く
 */
export function notes(ctx: CanvasRenderingContext2D, aspect: number, c: Chart, judge: Judge, t: number) {
  const r = noteRadius(aspect);
  const at = placer(aspect);
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = 'rgb(255 255 255 / 0.25)';
  for (let i = 0; i < SPOTS; i++) {
    ring(ctx, ...at(i), r);
    ctx.stroke();
  }
  const held = new Set(judge.holding.values());
  // 早いノーツを上に重ねるので、遅いほうから描く
  for (let i = c.notes.length - 1; i >= 0; i--) {
    const n = c.notes[i];
    const until = n.t - t;
    if (judge.grades[i] !== null || until > c.lead || (until < -WINDOW.near && !held.has(i))) continue;
    const [x, y] = at(n.spot);
    const color = n.len ? HOLD : COLORS[i % COLORS.length];
    ctx.globalAlpha = Math.min(1, (c.lead - until) / 0.25);
    if (until > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = r * 0.16;
      ring(ctx, x, y, r * (1 + (2.2 * until) / c.lead));
      ctx.stroke();
    }
    ring(ctx, x, y, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = r * 0.18;
    ctx.stroke();
    ring(ctx, x, y, r * 0.32);
    ctx.fillStyle = '#fff';
    ctx.fill();
    if (!n.len) continue;
    // 長押しは内側の輪で見分け、押さえているあいだは残りを白い弧で見せる
    ctx.lineWidth = r * 0.12;
    ring(ctx, x, y, r * 0.62);
    ctx.stroke();
    if (!held.has(i)) continue;
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, (t - n.t) / n.len));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
