import { label } from '$lib/fx';
import { APPROACH, SPECIAL_APPROACH } from './chart';
import { along, WINDOW, type Judge, type Placed } from './judge';

/**
 * ノーツの絵（画面のピクセル）。ステージの上に浮かぶ光の輪で、外の輪が縮んで重なった瞬間に押す。
 * 手から出るノーツは、アイドルの手からノーツへ細い光の線を引き、手を伸ばした先に出たことが分かるようにする
 */

type Ctx = CanvasRenderingContext2D;

const PINK = '#ff6fa5';
const GOLD = '#ffc233';
const CYAN = '#5fd0ff';

type P = [number, number];

export interface NoteView {
  t: number;
  /** 1 拍の秒 */
  beat: number;
  /** アイドルの両手の画面の位置 */
  hands: [P, P];
}

const ease = (u: number) => 1 - (1 - Math.min(1, u)) ** 3;

export function drawNotes(ctx: Ctx, v: NoteView, judge: Judge) {
  const r = judge.radius;
  // 後に叩くノーツほど奥に描き、次に叩くノーツを上に重ねる
  for (let i = judge.notes.length - 1; i >= 0; i--) {
    const n = judge.notes[i];
    const held = judge.holding(i);
    if (judge.grades[i] !== null && !held) continue;
    const lead = (n.kind === 'special' ? SPECIAL_APPROACH : APPROACH) * v.beat;
    if (v.t < n.t - lead || v.t > n.end + WINDOW.good) continue;
    const u = (v.t - (n.t - lead)) / lead;
    const [x, y] = [n.x, n.y];
    ctx.save();
    ctx.globalAlpha = Math.min(1, u * 4);
    if (n.kind === 'special') special(ctx, x, y, r * 4, u, v.t);
    else {
      if (n.hand !== null && !held) link(ctx, v.hands[n.hand], [x, y], u);
      if (n.kind === 'slide') slide(ctx, n, r, v.t, held);
      if (!held || n.kind === 'hold') target(ctx, n, x, y, r, u, v.t, held);
    }
    ctx.restore();
  }
}

/** 手からノーツへの細い光 */
function link(ctx: Ctx, from: P, to: P, u: number) {
  const g = ctx.createLinearGradient(...from, ...to);
  g.addColorStop(0, 'rgba(255, 255, 255, 0)');
  g.addColorStop(1, `rgba(255, 230, 245, ${0.5 * u})`);
  ctx.strokeStyle = g;
  ctx.lineWidth = 3;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(...from);
  ctx.lineTo(...to);
  ctx.stroke();
  ctx.setLineDash([]);
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(color, a));
  g.addColorStop(1, hexA(color, 0));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'source-over';
}

function target(ctx: Ctx, n: Placed, x: number, y: number, r: number, u: number, t: number, held: boolean) {
  const color = n.kind === 'hold' ? GOLD : n.kind === 'slide' ? CYAN : PINK;
  const pop = u < 0.15 ? 0.5 + 0.5 * ease(u / 0.15) : 1;
  const rr = r * pop;
  glow(ctx, x, y, rr * 2.2, color, 0.45);
  const body = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(1, color);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = rr * 0.14;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  if (n.kind === 'hold') {
    ctx.beginPath();
    ctx.arc(x, y, rr * 0.72, 0, Math.PI * 2);
    ctx.lineWidth = rr * 0.08;
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (n.shape === 'heart') heart(ctx, x, y + rr * 0.05, rr * 0.45);
  else star(ctx, x, y, rr * (n.shape === 'star' ? 0.55 : 0.38), 0.45, n.shape === 'star' ? 5 : 4);
  ctx.fill();
  if (held) {
    // 押さえているあいだは、輪のまわりを金色のゲージが回る
    const p = Math.min(1, (t - n.t) / (n.end - n.t));
    ctx.strokeStyle = '#fff6b0';
    ctx.lineWidth = rr * 0.28;
    ctx.beginPath();
    ctx.arc(x, y, rr * 1.25, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
    glow(ctx, x, y, rr * 3, GOLD, 0.35 + 0.2 * Math.sin(t * 20));
    return;
  }
  // 縮んでくる外の輪。重なった時が押す時
  const ring = r * (1 + 1.8 * Math.max(0, 1 - u));
  ctx.strokeStyle = hexA(color, 0.4 + 0.6 * u);
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(x, y, ring, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * u})`;
  ctx.lineWidth = r * 0.05;
  ctx.stroke();
}

/** スライドの光の道。押さえているあいだは光の玉が道を進み、指で追いかける */
function slide(ctx: Ctx, n: Placed, r: number, t: number, held: boolean) {
  const pts = n.path;
  const done = held ? Math.min(1, (t - n.t) / (n.end - n.t)) : 0;
  const from = Math.floor(done * (pts.length - 1));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (width: number, style: string) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(...pts[from]);
    for (const p of pts.slice(from + 1)) ctx.lineTo(...p);
    ctx.stroke();
  };
  ctx.globalCompositeOperation = 'lighter';
  line(r * 1.6, hexA(CYAN, 0.18));
  ctx.globalCompositeOperation = 'source-over';
  line(r * 0.9, 'rgba(255, 255, 255, 0.35)');
  line(r * 0.3, hexA(CYAN, 0.9));
  // 進む向きに流れる光の粒
  for (let i = from; i < pts.length - 1; i += 2) {
    const s = (i + ((t * 8) % 2)) / (pts.length - 1);
    const [x, y] = along({ ...n, t: 0, end: 1 }, s);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  const end = pts[pts.length - 1];
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  star(ctx, ...end, r * 0.45, 0.45, 4);
  ctx.fill();
  if (!held) return;
  const [x, y] = along(n, t);
  glow(ctx, x, y, r * 2.6, CYAN, 0.7);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = r * 0.15;
  ctx.stroke();
}

/** スペシャル。虹色の大きな輪が体を囲むように縮み、真ん中の大きな星と重なったら画面のどこを押してもよい */
function special(ctx: Ctx, x: number, y: number, r: number, u: number, t: number) {
  const pop = u < 0.2 ? ease(u / 0.2) : 1;
  glow(ctx, x, y, r * 1.6, GOLD, 0.35 * pop);
  const ring = r * (1 + 2.2 * Math.max(0, 1 - u));
  ctx.lineWidth = r * 0.09;
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `hsla(${(i * 60 + t * 240) % 360}, 95%, 65%, ${0.4 + 0.6 * u})`;
    ctx.beginPath();
    ctx.arc(x, y, ring, (i / 6) * Math.PI * 2 + t * 2, ((i + 1) / 6) * Math.PI * 2 + t * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * pop})`;
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 3) * 0.1);
  const s = r * 0.42 * pop * (1 + 0.06 * Math.sin(t * 12));
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, '#fff6b0');
  g.addColorStop(1, GOLD);
  ctx.fillStyle = g;
  ctx.beginPath();
  star(ctx, 0, 0, s);
  ctx.fill();
  ctx.lineWidth = s * 0.1;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
  label(ctx, 'SPECIAL', x, y - r * 1.15, r * 0.3 * pop, PINK);
}

function star(ctx: Ctx, x: number, y: number, r: number, inner = 0.45, n = 5) {
  ctx.moveTo(x, y - r);
  for (let i = 1; i < n * 2; i++) {
    const a = (i * Math.PI) / n;
    const k = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.sin(a) * k, y - Math.cos(a) * k);
  }
  ctx.closePath();
}

function heart(ctx: Ctx, x: number, y: number, r: number) {
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.3, y + r * 0.1, x - r * 0.9, y - r * 1, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.9, y - r * 1, x + r * 1.3, y + r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}

/** '#rrggbb' に透明度をつける */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}
