import { sprite, stamp } from '$lib/fx';
import { toScreen, unit, type Camera } from './camera';
import type { Scene } from './chart';

/**
 * ステージの絵（画面のピクセルで描く）。奥の LED の壁・照明・床・手前の客席。
 * もりあがり（hype）で照明の数と明るさ、LED の模様の強さ、客席のペンライトの数が変わる
 */

type Ctx = CanvasRenderingContext2D;

export interface View {
  w: number;
  h: number;
  cam: Camera;
  beat: number;
  scene: Scene;
  /** 0..1 */
  hype: number;
  /** この区間のはじめのスペシャルをきめた（サビの背景がいちだんと派手になる） */
  lit: boolean;
  /** アイドルのカラー */
  color: string;
}

const SKY: Record<Scene, [string, string]> = {
  intro: ['#1b1238', '#4a2166'],
  verse: ['#15205a', '#4b33a0'],
  bridge: ['#2a0f4d', '#8a2a6e'],
  chorus: ['#0a0830', '#35177a'],
  break: ['#1f0d40', '#6a2485'],
  finale: ['#2a1450', '#d0607a']
};

const LED: Record<Scene, string[]> = {
  intro: ['#8a6bff'],
  verse: ['#ff6fa5', '#ffffff'],
  bridge: ['#ff4fd8', '#8a6bff'],
  chorus: ['#ff6fa5', '#ffd43b', '#5fd0ff', '#8affc1'],
  break: ['#ffd43b', '#ff6fa5'],
  finale: ['#ffd43b', '#ffffff']
};

const pulseOf = (beat: number) => (beat >= 0 ? Math.exp(-(beat - Math.floor(beat)) * 5) : 0);

export function backdrop(ctx: Ctx, v: View) {
  const { w, h, beat, hype } = v;
  ctx.drawImage(strip(...SKY[v.scene]), 0, 0, w, h);
  // 奥ほどカメラに振られない（半分だけ寄る）
  const far = { ...v.cam, zoom: 1 + (v.cam.zoom - 1) * 0.35, fy: v.cam.fy * 0.35, roll: v.cam.roll * 0.5 };
  wall(ctx, v, far);
  if (v.lit || v.scene === 'finale') rays(ctx, v, far);
  beams(ctx, v);
  floor(ctx, v);
  const [cx, cy] = toScreen(v.cam, w, h, [0, -0.5]);
  const k = unit(w, h) * v.cam.zoom;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, k * 0.9);
  glow.addColorStop(0, `rgba(255, 240, 250, ${0.18 + 0.25 * hype + 0.15 * pulseOf(beat) * hype})`);
  glow.addColorStop(1, 'rgba(255, 240, 250, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.fillRect(cx - k, cy - k, k * 2, k * 2);
  ctx.globalCompositeOperation = 'source-over';
}

/** LED の壁。点の並びに、区間ごとの模様を拍に合わせて流す */
function wall(ctx: Ctx, v: View, cam: Camera) {
  const { w, h, beat, hype } = v;
  // 上のふちが画面に入らないよう、壁は頭の上へ高くのばす
  const [x0, y0] = toScreen(cam, w, h, [-1.25, -2.4]);
  const [x1, y1] = toScreen(cam, w, h, [1.25, -0.3]);
  ctx.fillStyle = 'rgba(8, 4, 24, 0.75)';
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, y1 - y0, (x1 - x0) * 0.02);
  ctx.fill();
  const cols = 26;
  const rows = 22;
  const cw = (x1 - x0) / cols;
  const ch = (y1 - y0) / rows;
  const colors = LED[v.scene];
  const b = Math.max(0, beat);
  const on = 0.35 + 0.65 * hype;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const u = i / (cols - 1) - 0.5;
      const q = j / (rows - 1) - 0.5;
      let l: number;
      switch (v.scene) {
        case 'verse':
          l = 0.5 + 0.5 * Math.sin(i * 0.55 - b * Math.PI * 0.5 + Math.sin(j * 0.7));
          break;
        case 'bridge':
          l = j / rows > 1 - (0.35 + 0.6 * Math.abs(Math.sin(i * 1.7 + Math.floor(b) * 2.1))) * pulseOf(b) ? 1 : 0.08;
          break;
        case 'chorus':
          l = Math.max(0, Math.cos((Math.hypot(u * 2.2, q) * 5 - (b % 1) * 2 * Math.PI) * 1)) ** 3;
          break;
        case 'break':
          l = (i + j + Math.floor(b)) % 2 ? pulseOf(b) : 0.1;
          break;
        default:
          l = 0.25 + 0.75 * Math.max(0, Math.sin(i * 12.9898 + j * 78.233 + b * 1.3)) ** 8;
      }
      const a = l * on * 0.85;
      if (a < 0.04) continue;
      ctx.fillStyle = colors[(i + j * 3 + Math.floor(b / 4)) % colors.length];
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x0 + (i + 0.5) * cw, y0 + (j + 0.5) * ch, Math.min(cw, ch) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** スペシャルをきめたあとの、アイドルの後ろで回る光の筋 */
function rays(ctx: Ctx, v: View, cam: Camera) {
  const { w, h, beat } = v;
  const [cx, cy] = toScreen(cam, w, h, [0, -0.6]);
  const r = Math.hypot(w, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(beat * 0.08);
  ctx.globalCompositeOperation = 'lighter';
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * r, Math.sin(a) * r);
    g.addColorStop(0, i % 2 ? 'rgba(255, 220, 120, 0.35)' : 'rgba(255, 140, 200, 0.35)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a - 0.09, a + 0.09);
    ctx.fill();
  }
  ctx.restore();
}

/** 上から差す照明。もりあがるほど本数が増え、拍に合わせて首を振る */
function beams(ctx: Ctx, v: View) {
  const { w, h, beat, hype } = v;
  const n = 2 + Math.round(hype * 6);
  const colors = LED[v.scene];
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = w * ((i + 0.5) / n);
    const swing = Math.sin(beat * Math.PI * 0.25 + i * 1.3) * (0.25 + 0.3 * hype);
    const len = h * 0.95;
    const tx = x + Math.sin(swing) * len;
    const ty = Math.cos(swing) * len;
    const spread = w * 0.07;
    const g = ctx.createLinearGradient(x, 0, tx, ty);
    const c = colors[i % colors.length];
    g.addColorStop(0, hexA(c, 0.28 + 0.2 * hype));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 4, 0);
    ctx.lineTo(x + 4, 0);
    ctx.lineTo(tx + spread, ty);
    ctx.lineTo(tx - spread, ty);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function floor(ctx: Ctx, v: View) {
  const { w, h, beat, hype } = v;
  const [, fy] = toScreen(v.cam, w, h, [0, 0]);
  const k = unit(w, h) * v.cam.zoom;
  const top = fy - k * 0.12;
  ctx.drawImage(strip('#2b1b4f', '#0d0820'), 0, top, w, h - top);
  // 床に映る照明の筋
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -6; i <= 6; i++) {
    ctx.moveTo(w / 2 + i * w * 0.05, top);
    ctx.lineTo(w / 2 + i * w * 0.2, h);
  }
  ctx.stroke();
  // 舞台のふちの光る帯
  const edge = fy + k * 0.16;
  ctx.fillStyle = hexA(v.color, 0.5 + 0.5 * pulseOf(beat) * (0.3 + hype));
  ctx.fillRect(0, edge, w, Math.max(3, k * 0.012));
  const [sx, sy] = toScreen(v.cam, w, h, [0, 0]);
  const pool = ctx.createRadialGradient(sx, sy, 0, sx, sy, k * 0.45);
  pool.addColorStop(0, `rgba(255, 255, 255, ${0.35 + 0.2 * hype})`);
  pool.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = pool;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, 0.28);
  ctx.translate(-sx, -sy);
  ctx.beginPath();
  ctx.arc(sx, sy, k * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const PENLIGHT = ['#ff6fa5', '#ff6fa5', '#ffd43b', '#5fd0ff', '#ff6fa5', '#b27bff'];

/** 手前の客席。頭の影とペンライト。もりあがるほど点くペンライトが増え、大きく振る */
export function crowd(ctx: Ctx, v: View) {
  const { w, h, beat, hype } = v;
  const base = h * 0.9;
  const size = Math.min(w, h) * 0.05;
  const b = Math.max(0, beat);
  for (const row of [0, 1]) {
    const y = base + row * size * 0.9;
    const n = Math.ceil(w / (size * 1.5)) + 1;
    for (let i = 0; i < n; i++) {
      const seed = (i * 7 + row * 13) % 17;
      const x = (i + (row ? 0.5 : 0)) * size * 1.5 - size * 0.3;
      const jump =
        hype > 0.6 ? Math.max(0, Math.sin((b + seed * 0.1) * Math.PI)) * size * 0.25 * (hype - 0.6) * 2.5 : 0;
      const lit = seed / 17 < 0.25 + 0.75 * hype;
      if (lit) {
        const sway = Math.sin((b + (seed % 2) * 0.5) * Math.PI) * (0.25 + 0.45 * hype);
        const len = size * 1.3;
        const hx = x + size * 0.45;
        const hy = y - jump - size * 0.1;
        const tx = hx + Math.sin(sway) * len;
        const ty = hy - Math.cos(sway) * len;
        const c = hype > 0.75 ? PENLIGHT[seed % PENLIGHT.length] : v.color;
        ctx.globalCompositeOperation = 'lighter';
        stamp(ctx, halo(c), tx, ty, size * 1.6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = c;
        ctx.lineWidth = size * 0.16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      ctx.fillStyle = row ? '#0b0618' : '#170d2c';
      ctx.beginPath();
      ctx.arc(x, y - jump, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - size * 0.7, y - jump + size * 0.35, size * 1.4, size * 1.5);
    }
  }
}

/**
 * 上から下への 2 色のグラデーションを細い帯に 1 度だけ描き、引きのばして使う
 * （画面いっぱいのグラデーションを毎フレーム塗ると、CPU で描く端末では重い）
 */
const strips = new Map<string, HTMLCanvasElement>();
function strip(top: string, bottom: string): HTMLCanvasElement {
  const key = top + bottom;
  let c = strips.get(key);
  if (!c) {
    c = document.createElement('canvas');
    [c.width, c.height] = [1, 256];
    const x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    x.fillStyle = g;
    x.fillRect(0, 0, 1, 256);
    strips.set(key, c);
  }
  return c;
}

/** ペンライトの光。色ごとに 1 度だけ描いて使い回す */
const halo = (c: string) =>
  sprite(`idol-halo-${c}`, 64, (ctx) => {
    const g = ctx.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.5);
    g.addColorStop(0, hexA(c, 0.55));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1, 1);
  });

/** '#rrggbb' に透明度をつける */
export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}
