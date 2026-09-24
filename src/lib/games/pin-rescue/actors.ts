import { shadow, sprite, stamp } from '$lib/fx';
import { WORLD_H, type GameState, type Walker } from './engine';

type Face = 'calm' | 'happy' | 'scared';

const INK = '#2b2d42';
const STEEL = '#4a4f68';
const SKIN = '#ffd9b8';

/** 絵の大きさ（幅・高さ）。足もとが体の円の下端に来るよう、正方形の 0.97 の高さに足を描く */
const SIZE = { hero: 0.27, princess: 0.24, monster: 0.26 };
const FEET = 0.97;

function steel(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#f4f6fb');
  g.addColorStop(0.5, '#c9cedd');
  g.addColorStop(1, '#8c92a8');
  return g;
}

function outline(c: CanvasRenderingContext2D, fill: string | CanvasGradient, width = 0.018) {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = width;
  c.strokeStyle = STEEL;
  c.stroke();
}

/** 兜と鎧の勇者。顔は表情を変えるので、ここでは兜のすき間を肌色に塗っておくだけ */
const knight = () =>
  sprite('knight', 256, (c) => {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    // マント
    c.beginPath();
    c.moveTo(0.33, 0.42);
    c.lineTo(0.67, 0.42);
    c.lineTo(0.76, 0.88);
    c.lineTo(0.24, 0.88);
    c.closePath();
    outline(c, '#d8344a');
    // 足
    for (const x of [0.37, 0.53]) {
      c.beginPath();
      c.roundRect(x, 0.78, 0.1, 0.19, 0.03);
      outline(c, steel(c, x, 0.78, x + 0.1, 0.97));
    }
    // 胴の鎧と、青い上着と帯
    c.beginPath();
    c.roundRect(0.32, 0.42, 0.36, 0.38, 0.08);
    outline(c, steel(c, 0.32, 0.42, 0.68, 0.8));
    c.beginPath();
    c.roundRect(0.42, 0.45, 0.16, 0.34, 0.03);
    c.fillStyle = '#1f9bff';
    c.fill();
    c.beginPath();
    c.arc(0.5, 0.57, 0.04, 0, Math.PI * 2);
    c.fillStyle = '#ffc233';
    c.fill();
    c.fillStyle = '#7a4a22';
    c.fillRect(0.33, 0.7, 0.34, 0.045);
    c.fillStyle = '#ffc233';
    c.fillRect(0.47, 0.695, 0.06, 0.055);
    // 剣（右手）
    c.beginPath();
    c.moveTo(0.8, 0.6);
    c.lineTo(0.78, 0.2);
    c.lineTo(0.815, 0.14);
    c.lineTo(0.85, 0.2);
    c.lineTo(0.83, 0.6);
    c.closePath();
    outline(c, '#eef1f8', 0.014);
    c.beginPath();
    c.roundRect(0.75, 0.585, 0.13, 0.035, 0.015);
    outline(c, '#ffc233', 0.012);
    c.beginPath();
    c.arc(0.815, 0.65, 0.045, 0, Math.PI * 2);
    outline(c, steel(c, 0.77, 0.6, 0.86, 0.7));
    c.beginPath();
    c.arc(0.69, 0.47, 0.07, 0, Math.PI * 2);
    outline(c, steel(c, 0.62, 0.4, 0.76, 0.54));
    // 盾（左手）
    c.beginPath();
    c.moveTo(0.14, 0.5);
    c.lineTo(0.38, 0.5);
    c.lineTo(0.38, 0.66);
    c.quadraticCurveTo(0.26, 0.82, 0.26, 0.82);
    c.quadraticCurveTo(0.14, 0.7, 0.14, 0.66);
    c.closePath();
    c.fillStyle = '#1f9bff';
    c.fill();
    c.lineWidth = 0.03;
    c.strokeStyle = '#ffc233';
    c.stroke();
    c.fillStyle = '#fff';
    c.fillRect(0.245, 0.54, 0.03, 0.2);
    c.fillRect(0.18, 0.6, 0.16, 0.03);
    // 兜と飾りの羽根
    c.beginPath();
    c.ellipse(0.5, 0.07, 0.05, 0.09, 0.3, 0, Math.PI * 2);
    outline(c, '#ff4d5e', 0.014);
    c.beginPath();
    c.arc(0.5, 0.28, 0.19, 0, Math.PI * 2);
    outline(c, steel(c, 0.31, 0.09, 0.69, 0.47), 0.02);
    c.beginPath();
    c.ellipse(0.5, 0.31, 0.125, 0.11, 0, 0, Math.PI * 2);
    c.fillStyle = SKIN;
    c.fill();
    c.lineWidth = 0.014;
    c.strokeStyle = STEEL;
    c.stroke();
  });

const princessBody = () =>
  sprite('princess', 256, (c) => {
    c.lineJoin = 'round';
    // 長い髪（後ろ）
    c.beginPath();
    c.ellipse(0.5, 0.36, 0.2, 0.25, 0, 0, Math.PI * 2);
    c.fillStyle = '#f2b632';
    c.fill();
    // ドレス
    c.beginPath();
    c.moveTo(0.42, 0.46);
    c.lineTo(0.58, 0.46);
    c.lineTo(0.8, 0.95);
    c.quadraticCurveTo(0.5, 1.0, 0.2, 0.95);
    c.closePath();
    c.fillStyle = '#ff9fb3';
    c.fill();
    c.lineWidth = 0.018;
    c.strokeStyle = '#d0587a';
    c.stroke();
    c.fillStyle = '#fff';
    for (const y of [0.72, 0.86]) {
      c.beginPath();
      c.ellipse(0.5, y, 0.17 + (y - 0.72) * 0.6, 0.02, 0, 0, Math.PI * 2);
      c.fill();
    }
    // 腕
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(0.5 + s * 0.13, 0.62, 0.035, 0, Math.PI * 2);
      c.fillStyle = SKIN;
      c.fill();
    }
    // 顔の土台と前髪
    c.beginPath();
    c.arc(0.5, 0.3, 0.13, 0, Math.PI * 2);
    c.fillStyle = SKIN;
    c.fill();
    c.beginPath();
    c.ellipse(0.5, 0.2, 0.14, 0.07, 0, Math.PI, Math.PI * 2);
    c.fillStyle = '#f2b632';
    c.fill();
    // 冠
    c.beginPath();
    c.moveTo(0.38, 0.13);
    c.lineTo(0.4, 0.04);
    c.lineTo(0.45, 0.09);
    c.lineTo(0.5, 0.02);
    c.lineTo(0.55, 0.09);
    c.lineTo(0.6, 0.04);
    c.lineTo(0.62, 0.13);
    c.closePath();
    c.fillStyle = '#ffc233';
    c.fill();
    c.lineWidth = 0.012;
    c.strokeStyle = '#e39a00';
    c.stroke();
    c.beginPath();
    c.arc(0.5, 0.09, 0.018, 0, Math.PI * 2);
    c.fillStyle = '#ff4d5e';
    c.fill();
  });

const monsterBody = () =>
  sprite('monster', 256, (c) => {
    c.lineJoin = 'round';
    // こん棒
    c.save();
    c.translate(0.84, 0.6);
    c.rotate(0.35);
    c.beginPath();
    c.roundRect(-0.03, -0.38, 0.06, 0.4, 0.03);
    c.fillStyle = '#9b6a3c';
    c.fill();
    c.beginPath();
    c.ellipse(0, -0.36, 0.07, 0.11, 0, 0, Math.PI * 2);
    c.fillStyle = '#7a4a22';
    c.fill();
    c.restore();
    // 角
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(0.5 + s * 0.16, 0.22);
      c.quadraticCurveTo(0.5 + s * 0.3, 0.1, 0.5 + s * 0.26, 0.02);
      c.lineTo(0.5 + s * 0.08, 0.2);
      c.closePath();
      c.fillStyle = '#fff3d6';
      c.fill();
      c.lineWidth = 0.014;
      c.strokeStyle = '#8a6a3a';
      c.stroke();
    }
    // 足
    for (const x of [0.34, 0.56]) {
      c.beginPath();
      c.roundRect(x, 0.8, 0.12, 0.17, 0.05);
      c.fillStyle = '#3f8f3a';
      c.fill();
    }
    // 体
    c.beginPath();
    c.ellipse(0.5, 0.55, 0.3, 0.34, 0, 0, Math.PI * 2);
    const g = c.createRadialGradient(0.42, 0.42, 0.05, 0.5, 0.55, 0.36);
    g.addColorStop(0, '#8ee07a');
    g.addColorStop(1, '#3f9a36');
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 0.02;
    c.strokeStyle = '#2d6b28';
    c.stroke();
    // おなか
    c.beginPath();
    c.ellipse(0.5, 0.66, 0.16, 0.14, 0, 0, Math.PI * 2);
    c.fillStyle = '#c8f0a8';
    c.fill();
    // 怒った目
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(0.5 + s * 0.11, 0.42, 0.07, 0.08, 0, 0, Math.PI * 2);
      c.fillStyle = '#fff';
      c.fill();
      c.beginPath();
      c.arc(0.5 + s * 0.1, 0.44, 0.035, 0, Math.PI * 2);
      c.fillStyle = INK;
      c.fill();
      c.beginPath();
      c.moveTo(0.5 + s * 0.2, 0.31);
      c.lineTo(0.5 + s * 0.04, 0.37);
      c.lineWidth = 0.03;
      c.lineCap = 'round';
      c.strokeStyle = INK;
      c.stroke();
    }
    // 牙の口
    c.beginPath();
    c.ellipse(0.5, 0.55, 0.12, 0.05, 0, 0, Math.PI);
    c.fillStyle = '#5b1f2a';
    c.fill();
    c.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(0.5 + s * 0.09, 0.55);
      c.lineTo(0.5 + s * 0.06, 0.61);
      c.lineTo(0.5 + s * 0.035, 0.55);
      c.fill();
    }
  });

const bombBody = () =>
  sprite('bomb', 128, (c) => {
    c.beginPath();
    c.roundRect(0.42, 0.1, 0.16, 0.14, 0.03);
    c.fillStyle = '#6b6f86';
    c.fill();
    c.beginPath();
    c.moveTo(0.5, 0.12);
    c.quadraticCurveTo(0.6, 0.0, 0.72, 0.06);
    c.lineWidth = 0.04;
    c.strokeStyle = '#c8a06a';
    c.stroke();
    c.beginPath();
    c.arc(0.5, 0.58, 0.36, 0, Math.PI * 2);
    const g = c.createRadialGradient(0.38, 0.45, 0.04, 0.5, 0.58, 0.38);
    g.addColorStop(0, '#7b8098');
    g.addColorStop(1, '#23252f');
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 0.035;
    c.strokeStyle = '#fff';
    c.stroke();
  });

/** 沈んでいるあいだ、頭から泡が昇る */
function bubbles(ctx: CanvasRenderingContext2D, w: Walker, now: number) {
  ctx.strokeStyle = 'rgb(255 255 255 / 0.9)';
  ctx.lineWidth = 0.004;
  for (let i = 0; i < 3; i++) {
    const t = (now * 0.8 + i / 3) % 1;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.arc(w.x + Math.sin(now * 4 + i) * 0.015, w.y - w.r * 2 - t * 0.12, 0.008 + i * 0.003, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** 目と口。表情だけは毎回描く */
function face(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, look: Face) {
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const ex = x + side * s * 0.38;
    ctx.beginPath();
    if (look === 'happy') {
      ctx.arc(ex, y, s * 0.14, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ctx.arc(ex, y, s * (look === 'scared' ? 0.16 : 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgb(255 120 140 / 0.45)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * s * 0.62, y + s * 0.28, s * 0.14, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  if (look === 'scared') {
    ctx.ellipse(x, y + s * 0.45, s * 0.13, s * 0.17, 0, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  } else {
    ctx.arc(x, y + s * 0.3, s * (look === 'happy' ? 0.26 : 0.18), 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

/** 前のフレームからの動き。歩いていれば体を弾ませ、進む向きへ絵を向ける */
const gait = new WeakMap<Walker, { x: number; dir: number; walking: boolean }>();

function place(
  ctx: CanvasRenderingContext2D,
  w: Walker,
  img: HTMLCanvasElement,
  d: number,
  now: number,
  hop: number
): { x: number; top: number; dir: number } {
  const g = gait.get(w) ?? { x: w.x, dir: 1, walking: false };
  const dx = w.x - g.x;
  g.walking = Math.abs(dx) > 1e-5;
  if (g.walking) g.dir = Math.sign(dx);
  g.x = w.x;
  gait.set(w, g);
  const bob = g.walking ? Math.abs(Math.sin(now * 12)) * 0.012 : Math.sin(now * 3) * 0.003;
  const feet = w.y + w.r;
  const top = feet - FEET * d - bob - hop;
  if (feet > WORLD_H - 0.02) shadow(ctx, w.x, WORLD_H - 0.01, w.r * 0.9, 0.25);
  ctx.save();
  ctx.translate(w.x, top + d / 2);
  ctx.scale(g.dir, 1);
  stamp(ctx, img, 0, 0, d);
  ctx.restore();
  return { x: w.x, top, dir: g.dir };
}

/** 勇者・姫・怪物。ctx は engine の座標（幅 1）がそのまま描ける変換にしておく */
export function drawActors(ctx: CanvasRenderingContext2D, state: GameState, now: number) {
  const cheer = state.result === 'clear' ? Math.abs(Math.sin(now * 8)) * 0.04 : 0;
  for (const b of state.bombs) {
    if (!b.alive) continue;
    stamp(ctx, bombBody(), b.x, b.y - b.r * 0.2, b.r * 2.8);
    // 導火線の先の火花
    const r = 0.012 * (1 + Math.sin(now * 20) * 0.3);
    ctx.fillStyle = '#ffc233';
    ctx.beginPath();
    ctx.arc(b.x + b.r * 0.62, b.y - b.r * 1.55, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const m of state.monsters) if (m.alive) place(ctx, m, monsterBody(), SIZE.monster, now, 0);

  if (state.princess?.alive) {
    const d = SIZE.princess;
    const p = place(ctx, state.princess, princessBody(), d, now, cheer);
    const look: Face = state.result === 'clear' ? 'happy' : state.result ? 'scared' : 'calm';
    face(ctx, p.x, p.top + 0.3 * d, d * 0.12, look);
  }

  const d = SIZE.hero;
  const h = place(ctx, state.hero, knight(), d, now, cheer);
  const look: Face = state.result === 'clear' ? 'happy' : state.result && state.result !== 'stuck' ? 'scared' : 'calm';
  face(ctx, h.x, h.top + 0.3 * d, d * 0.1, look);
  if (state.under > 0 && !state.result) {
    bubbles(ctx, state.hero, now);
    if (state.princess) bubbles(ctx, state.princess, now);
  }
}
