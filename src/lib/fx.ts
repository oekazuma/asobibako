import { ICONS, type IconName, type Layer } from './icons';

/**
 * canvas のゲームで使う、見た目だけの演出。ゲームのルールには影響しない。
 * 座標の単位は描く側の ctx の変換に合わせる（ワールド座標でも画面のピクセルでもよい）
 */

/** 描く側の座標 (x, y) を画面の位置と倍率 k へ写す */
export type Projector = (x: number, y: number) => [number, number, number];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  color: string;
  gravity: number;
  glow: boolean;
}

export interface BurstOptions {
  count?: number;
  color?: string | string[];
  speed?: number;
  size?: number;
  life?: number;
  gravity?: number;
  /** 加算合成で光らせる（火花・マグマ・炎） */
  glow?: boolean;
  /** 飛び出す向き（ラジアン）と広がり。省くと全方向 */
  angle?: number;
  spread?: number;
}

export class Particles {
  readonly list: Particle[] = [];

  burst(x: number, y: number, o: BurstOptions = {}): void {
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? '#fff'];
    const count = o.count ?? 10;
    for (let i = 0; i < count; i++) {
      const a = o.angle === undefined ? Math.random() * Math.PI * 2 : o.angle + (Math.random() - 0.5) * (o.spread ?? 1);
      const v = (o.speed ?? 1) * (0.4 + Math.random() * 0.6);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.4),
        age: 0,
        size: (o.size ?? 1) * (0.6 + Math.random() * 0.4),
        color: colors[i % colors.length],
        gravity: o.gravity ?? 0,
        glow: o.glow ?? false
      });
    }
  }

  step(dt: number): void {
    for (const p of this.list) {
      p.age += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].age >= this.list[i].life) this.list.splice(i, 1);
  }

  /** to を渡すと、粒の位置を画面へ写してから描く（遠近のある画面用。k はその場所の倍率） */
  draw(ctx: CanvasRenderingContext2D, to?: Projector): void {
    for (const p of this.list) {
      const t = 1 - p.age / p.life;
      const [x, y, k] = to ? to(p.x, p.y) : [p.x, p.y, 1];
      ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size * k * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

interface Floater {
  text: string;
  x: number;
  y: number;
  age: number;
  size: number;
  color: string;
}

/** 「+4」のように、出たところから浮かび上がって消える文字 */
export class Floaters {
  readonly list: Floater[] = [];

  add(text: string, x: number, y: number, size: number, color = '#ffc233'): void {
    this.list.push({ text, x, y, age: 0, size, color });
  }

  step(dt: number): void {
    for (const f of this.list) f.age += dt;
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].age > 0.9) this.list.splice(i, 1);
  }

  draw(ctx: CanvasRenderingContext2D, to?: Projector): void {
    for (const f of this.list) {
      const pop = f.age < 0.12 ? 0.6 + (f.age / 0.12) * 0.6 : 1.2 - Math.min(0.2, (f.age - 0.12) * 0.5);
      const [x, y, k] = to ? to(f.x, f.y) : [f.x, f.y, 1];
      const size = f.size * k;
      ctx.globalAlpha = Math.min(1, (0.9 - f.age) * 3);
      label(ctx, f.text, x, y - f.age * size * 1.6, size * pop, f.color);
    }
    ctx.globalAlpha = 1;
  }
}

/** 白いふちの太い文字。1px 未満の座標系でも崩れないよう 100px で描いてから縮める */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.font = "800 100px 'Hiragino Maru Gothic ProN', system-ui";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#fff';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** 揺れの強さを足すと、時間とともに収まっていく画面の揺れ */
export class Shake {
  power = 0;

  add(power: number): void {
    this.power = Math.min(1, this.power + power);
  }

  /** 今フレームのずれ。max はいちばん強いときの揺れ幅 */
  offset(dt: number, max: number): [number, number] {
    this.power = Math.max(0, this.power - dt * 2.5);
    const p = this.power * this.power * max;
    return [(Math.random() - 0.5) * 2 * p, (Math.random() - 0.5) * 2 * p];
  }
}

const sprites = new Map<string, HTMLCanvasElement>();

/**
 * 影やグラデーションのある絵は毎フレーム描くと重いので、一度だけ size × size ピクセルに描いて使い回す。
 * draw には 0..1 の正方形に描ける ctx が渡る
 */
export function sprite(key: string, size: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const id = `${key}@${size}`;
  let canvas = sprites.get(id);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(size, size);
    draw(ctx);
    sprites.set(id, canvas);
  }
  return canvas;
}

/** sprite を中心 (x, y)、幅・高さ d で描く */
export function stamp(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, d: number) {
  ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
}

/** 地面に落ちる楕円の影 */
export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, alpha = 0.18) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(43 45 66 / ${alpha})`;
  ctx.fill();
}

/** icons.ts のアイコンを中心 (x, y)、大きさ size で描く。一度 96px の絵にしてから使い回す */
export function icon(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number, rotate = 0) {
  const img = sprite(`icon:${name}`, 96, (c) => {
    c.scale(1 / 24, 1 / 24);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const layer of ICONS[name] as Layer[]) {
      const path = new Path2D(layer.d);
      if (layer.fill) {
        c.fillStyle = layer.fill;
        c.fill(path);
      }
      if (layer.stroke) {
        c.strokeStyle = layer.stroke;
        c.lineWidth = layer.width ?? 1;
        c.stroke(path);
      }
    }
  });
  if (!rotate) return stamp(ctx, img, x, y, size);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  stamp(ctx, img, 0, 0, size);
  ctx.restore();
}

/** 空に浮かべる雲 */
export const cloud = () =>
  sprite('cloud', 128, (c) => {
    c.fillStyle = 'rgb(255 255 255 / 0.9)';
    for (const [x, y, r] of [
      [0.3, 0.58, 0.18],
      [0.5, 0.45, 0.24],
      [0.72, 0.58, 0.17],
      [0.5, 0.64, 0.16]
    ]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
