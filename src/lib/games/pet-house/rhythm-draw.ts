import { icon } from '$lib/fx';
import type { IconName } from '$lib/icons';
import type { Chart, Motion, Play } from './rhythm';

/**
 * リズムあそびのレーン。画面の下に横 1 本、ノーツは右から左の輪（判定の輪）へ流れる。
 * 音が無くても叩けるよう、輪は拍ごとに弾み、1 小節ごとにレーンが光り、次のノーツには輪へ縮む外輪を重ねる
 */

const LINE = '#5b4a42';
/** ノーツが右の端に出てから輪に届くまでの拍 */
const LEAD = 4;

export const NOTE_COLOR: Record<Motion, string> = {
  tap: '#ff7eb3',
  down: '#4fa8ff',
  up: '#ff9f40',
  side: '#4cc38a',
  circle: '#b27bff',
  hold: '#ffc233'
};

/** 判定の輪の中心と半径、ノーツが右の端に出てから輪に届くまでの道のり（ピクセル）。盤面の大きさだけで決まる */
export function lane(w: number, h: number) {
  const r = Math.min(72, Math.max(40, w * 0.11));
  const x = Math.max(r * 1.5, w * 0.2);
  return { x, y: h * 0.74, r, reach: w + r - x };
}

export function drawLane(ctx: CanvasRenderingContext2D, w: number, h: number, c: Chart, play: Play, t: number) {
  const L = lane(w, h);
  const beat = t / c.beat;
  const pulse = beat >= 0 ? Math.exp(-(beat % 1) * 6) : 0;
  const bar = beat >= 0 ? Math.exp(-((beat / 4) % 1) * 5) : 0;
  const speed = L.reach / (LEAD * c.beat);
  const top = L.y - L.r * 1.4;
  const height = L.r * 2.8;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // レーンの帯。小節の頭で金色に光る
  ctx.beginPath();
  ctx.roundRect(8, top, w - 16, height, height / 2);
  ctx.fillStyle = 'rgb(255 250 242 / 0.82)';
  ctx.fill();
  if (bar > 0.02) {
    ctx.fillStyle = `rgb(255 214 102 / ${0.45 * bar})`;
    ctx.fill();
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  // 帯のふちの水玉が拍ごとに跳ねる
  ctx.fillStyle = '#ffb3cf';
  for (let i = 0, n = Math.floor(w / 56); i < n; i++) {
    const x = ((i + 0.5) * w) / n;
    const hop = (i % 2 === Math.floor(beat) % 2 ? 7 : 2) * pulse;
    ctx.beginPath();
    ctx.arc(x, top - 10 - hop, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 判定の輪
  const R = L.r * (1 + 0.12 * pulse);
  ctx.beginPath();
  ctx.arc(L.x, L.y, R, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.globalAlpha = 0.25;
  icon(ctx, 'paw', L.x, L.y, L.r * 1.2);
  ctx.globalAlpha = 1;

  // 流れてくるノーツ。先のものほど下に描く
  const next = play.grades.findIndex((g) => g === null);
  for (let i = play.notes.length - 1; i >= 0; i--) {
    const n = play.notes[i];
    const held = play.held(i);
    if (play.grades[i] !== null) continue;
    const x = held ? L.x : L.x + (n.t - t) * speed;
    if (x - L.r > w) continue;
    const near = Math.max(0, Math.min(1, 1 - (n.t - t) / (1.5 * c.beat)));
    const r = L.r * (0.8 + 0.2 * near) * (n.trick ? 1.05 : 0.92);
    if (n.motion === 'hold') tail(ctx, x, L.x + (n.t + n.len - t) * speed, L.y, r, held);
    drawNote(ctx, n.motion, n.trick, x, L.y, r, near);
    // 次のノーツが輪に重なる瞬間に、外輪も輪の大きさまで縮みきる
    if (i === next && !held && n.t - t < c.beat && n.t - t > -0.1) {
      const k = Math.max(0, (n.t - t) / c.beat);
      ctx.globalAlpha = 1 - 0.6 * k;
      ctx.beginPath();
      ctx.arc(L.x, L.y, L.r * (1 + 1.3 * k), 0, Math.PI * 2);
      ctx.lineWidth = 7;
      ctx.strokeStyle = NOTE_COLOR[n.motion];
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

/** 長押しの帯。押さえているあいだは輪から終わりまでが縮んでいく */
function tail(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, r: number, held: boolean) {
  ctx.beginPath();
  ctx.roundRect(x0, y - r * 0.45, Math.max(0, x1 - x0), r * 0.9, r * 0.45);
  ctx.fillStyle = held ? '#ffe28a' : 'rgb(255 194 51 / 0.7)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}

const ICON: Partial<Record<Motion, IconName>> = { tap: 'paw', hold: 'heart' };
const ARROW: Partial<Record<Motion, number>> = { down: Math.PI / 2, up: -Math.PI / 2, side: 0 };

/** 白いふちと下に厚みのある影を持つ丸。近づくほど明るい（near 0..1）。遊び方の札の見本にも使う */
export function drawNote(
  ctx: CanvasRenderingContext2D,
  m: Motion,
  trick: boolean,
  x: number,
  y: number,
  r: number,
  near: number
) {
  ctx.globalAlpha = 0.75 + 0.25 * near;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.12, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgb(91 74 66 / 0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = NOTE_COLOR[m];
  ctx.fill();
  ctx.lineWidth = Math.max(4, r * 0.1);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.globalAlpha = 1;
  const name = trick && m === 'tap' ? 'heart' : ICON[m];
  if (name) return icon(ctx, name, x, y, r * 1.15);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = r * 0.2;
  const a = ARROW[m];
  if (a !== undefined) {
    arrow(ctx, x, y, r * 0.55, a);
    if (m === 'side') arrow(ctx, x, y, r * 0.55, Math.PI);
    return;
  }
  // ぐるっと。ほぼ 1 周の弧の先に、回る向きの矢じり
  const k = r * 0.5;
  const end = Math.PI * 1.2;
  ctx.beginPath();
  ctx.arc(x, y, k, -Math.PI * 0.4, end);
  ctx.stroke();
  head(ctx, x + Math.cos(end) * k, y + Math.sin(end) * k, end + Math.PI / 2, r * 0.32);
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, a: number) {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  ctx.beginPath();
  ctx.moveTo(x - dx * len * 0.2, y - dy * len * 0.2);
  ctx.lineTo(x + dx * len * 0.6, y + dy * len * 0.6);
  ctx.stroke();
  head(ctx, x + dx * len, y + dy * len, a, len * 0.55);
}

function head(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(a - 0.6) * s, y - Math.sin(a - 0.6) * s);
  ctx.lineTo(x - Math.cos(a + 0.6) * s, y - Math.sin(a + 0.6) * s);
  ctx.closePath();
  ctx.fill();
}
