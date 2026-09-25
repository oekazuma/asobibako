import type { Part } from './petting';
import type { TrickId } from './types';

/**
 * 体で教える（本家の、背中を押して座らせる教え方）。芸ごとに、体のどこを指でどう動かすかを持ち、
 * 指の動きがそのとおりかを見る。画面の座標（ピクセル）だけを使い、DOM も three も使わない
 */

export type Motion = 'down' | 'up' | 'side' | 'tap' | 'hold' | 'circle';

export interface Lesson {
  /** 指を置きはじめてよい体の場所。最初の場所は案内の印を出す所 */
  parts: Part[];
  motion: Motion;
  text: string;
}

export const LESSONS: Record<TrickId, Lesson> = {
  sit: { parts: ['rear', 'back', 'tail'], motion: 'down', text: 'おしりを したへ なでてね' },
  down: { parts: ['back', 'rear'], motion: 'down', text: 'せなかを したへ おしてね' },
  paw: { parts: ['paw'], motion: 'tap', text: 'まえあしを ちょんと さわってね' },
  roll: { parts: ['back', 'belly', 'rear'], motion: 'side', text: 'からだを よこへ なでてね' },
  jump: { parts: ['head', 'cheek'], motion: 'up', text: 'あたまから うえへ ゆびを はらってね' },
  beg: { parts: ['chin', 'cheek', 'head'], motion: 'up', text: 'あごを うえへ なであげてね' },
  spin: {
    parts: ['back', 'rear', 'belly', 'head'],
    motion: 'circle',
    text: 'からだの うえで ゆびを ぐるっと まわしてね'
  },
  high: { parts: ['paw'], motion: 'up', text: 'まえあしを うえへ もちあげてね' },
  bow: { parts: ['head', 'cheek', 'chin'], motion: 'down', text: 'あたまを したへ なでてね' },
  dead: {
    parts: ['back', 'belly', 'rear', 'head', 'cheek', 'chin'],
    motion: 'hold',
    text: 'せなかを ぎゅっと ながおししてね'
  }
};

/** 教えている指の動き。sx・sy は置いた点、turned は進む向きが回った角度の合計（ラジアン） */
export interface Stroke {
  sx: number;
  sy: number;
  x: number;
  y: number;
  t0: number;
  moved: number;
  turned: number;
  dir: number | null;
}

export const stroke = (x: number, y: number, t: number): Stroke => ({
  sx: x,
  sy: y,
  x,
  y,
  t0: t,
  moved: 0,
  turned: 0,
  dir: null
});

/** 指が動いた。細かい震えで向きが跳ねないよう、6px 以上動いたときだけ向きを取る */
export function track(s: Stroke, x: number, y: number): void {
  const d = Math.hypot(x - s.x, y - s.y);
  if (d < 6) return;
  const dir = Math.atan2(y - s.y, x - s.x);
  if (s.dir !== null) s.turned += Math.atan2(Math.sin(dir - s.dir), Math.cos(dir - s.dir));
  s.dir = dir;
  s.moved += d;
  s.x = x;
  s.y = y;
}

/** そのとおり動かせたか。unit は画面の中のペットの大きさの目安（ピクセル） */
export function done(l: Lesson, s: Stroke, now: number, unit: number): boolean {
  const dx = s.x - s.sx;
  const dy = s.y - s.sy;
  const far = Math.max(36, unit * 0.35);
  switch (l.motion) {
    case 'tap':
      return true;
    case 'hold':
      return now - s.t0 > 0.9 && s.moved < far * 0.6;
    case 'down':
      return dy > far && dy > Math.abs(dx);
    case 'up':
      return -dy > far && -dy > Math.abs(dx);
    case 'side':
      return Math.abs(dx) > far && Math.abs(dx) > Math.abs(dy);
    case 'circle':
      return Math.abs(s.turned) > Math.PI * 1.5 && s.moved > far * 2.5;
  }
}

/** 印の場所に、指をどう動かすかの案内を描く。t は秒で、1.4 秒ごとにくり返す */
export function drawHint(ctx: CanvasRenderingContext2D, l: Lesson, x: number, y: number, t: number, unit: number) {
  const u = (t % 1.4) / 1.4;
  const len = Math.max(48, unit * 0.5);
  const r = Math.max(22, unit * 0.16);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 置く場所の輪。脈を打たせて目を引く
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r * (1 + 0.15 * Math.sin(t * 6)), 0, Math.PI * 2);
  ctx.stroke();
  const path = hintPath(l.motion, len);
  if (path) {
    ctx.strokeStyle = '#ff7a00';
    ctx.lineWidth = 7;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    path.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py)));
    ctx.stroke();
    const [ax, ay] = path[path.length - 1];
    const [bx, by] = path[path.length - 2];
    const a = Math.atan2(ay - by, ax - bx);
    ctx.fillStyle = '#ff7a00';
    ctx.beginPath();
    ctx.moveTo(x + ax + Math.cos(a) * 12, y + ay + Math.sin(a) * 12);
    ctx.lineTo(x + ax + Math.cos(a + 2.4) * 14, y + ay + Math.sin(a + 2.4) * 14);
    ctx.lineTo(x + ax + Math.cos(a - 2.4) * 14, y + ay + Math.sin(a - 2.4) * 14);
    ctx.fill();
  }
  // 指のかわりの丸が、案内の線の上を動く
  const at = path ? path[Math.min(path.length - 1, Math.floor(u * path.length))] : [0, 0];
  const press = l.motion === 'tap' || l.motion === 'hold' ? 1 - 0.25 * Math.abs(Math.sin(u * Math.PI)) : 1;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + at[0], y + at[1], 13 * press, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function hintPath(m: Motion, len: number): [number, number][] | null {
  const line = (dx: number, dy: number) =>
    Array.from({ length: 12 }, (_, i) => [(dx * i) / 11, (dy * i) / 11] as [number, number]);
  switch (m) {
    case 'down':
      return line(0, len);
    case 'up':
      return line(0, -len);
    case 'side':
      return line(len, 0);
    case 'circle':
      return Array.from({ length: 24 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 23) * Math.PI * 1.8;
        return [Math.cos(a) * len * 0.45, Math.sin(a) * len * 0.45 + len * 0.45] as [number, number];
      });
    default:
      return null;
  }
}
