import { CONFETTI, Floaters, Particles, icon, label } from '$lib/fx';
import type { IconName } from '$lib/icons';

/**
 * 3D の上に重ねる 2D の演出。位置はすべて盤面の中のピクセルで、出した瞬間の画面の位置に置く
 * （カメラがゆっくり動くので、短い命の演出はそのままでもずれが目立たない）
 */

interface Bit {
  kind: IconName | 'note';
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  spin: number;
  /** あれば、ここへ吸い込まれるように飛ぶ（コインがお金の表示へ） */
  to?: [number, number];
}

interface Badge {
  name: string;
  icon: IconName;
  color: string;
  x: number;
  y: number;
  r: number;
  age: number;
}

/** スタンプが上から押されるまで・押されたまま見せる・消える、の秒 */
const BADGE_HIT = 0.2;
const BADGE_HOLD = 2.4;
export const BADGE_LIFE = 2.8;

interface Ripple {
  x: number;
  y: number;
  age: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class PetFx {
  readonly particles = new Particles();
  readonly floaters = new Floaters();
  readonly bits: Bit[] = [];
  readonly ripples: Ripple[] = [];
  #flash = 0;
  #badge: Badge | null = null;

  hearts(x: number, y: number, n = 1): void {
    for (let i = 0; i < n; i++)
      this.bits.push({
        kind: 'heart',
        x: x + rand(-14, 14),
        y: y + rand(-8, 8),
        vx: rand(-20, 20),
        vy: rand(-110, -70),
        age: 0,
        life: rand(0.9, 1.3),
        size: rand(40, 56),
        spin: rand(-0.4, 0.4)
      });
  }

  sparkle(x: number, y: number, n = 2): void {
    for (let i = 0; i < n; i++)
      this.bits.push({
        kind: 'star',
        x: x + rand(-24, 24),
        y: y + rand(-18, 18),
        vx: rand(-30, 30),
        vy: rand(-60, -20),
        age: 0,
        life: rand(0.5, 0.8),
        size: rand(16, 26),
        spin: rand(-3, 3)
      });
    this.particles.burst(x, y, {
      count: 5,
      color: ['#fff6b0', '#ffffff', '#9fd8ff'],
      speed: 90,
      size: 3.5,
      glow: true
    });
  }

  note(x: number, y: number): void {
    this.bits.push({
      kind: 'note',
      x: x + rand(10, 30),
      y,
      vx: rand(10, 40),
      vy: -70,
      age: 0,
      life: 1.1,
      size: 30,
      spin: 0
    });
  }

  coins(x: number, y: number, to: [number, number], n = 5): void {
    for (let i = 0; i < n; i++)
      this.bits.push({
        kind: 'coin',
        x,
        y,
        vx: rand(-160, 160),
        vy: rand(-320, -200),
        age: -i * 0.06,
        life: 1.1,
        size: 30,
        spin: 0,
        to
      });
  }

  confetti(x: number, y: number): void {
    this.particles.burst(x, y, { count: 40, color: CONFETTI, speed: 420, size: 6, life: 1.2, gravity: 700 });
  }

  text(text: string, x: number, y: number, color = '#ff5fa2', size = 30): void {
    this.floaters.add(text, x, y, size, color);
  }

  ripple(x: number, y: number): void {
    this.ripples.push({ x, y, age: 0 });
  }

  flash(): void {
    this.#flash = 1;
  }

  /** スタンプ帳のスタンプを、(x, y) を中心に半径 r で押す。前のものが残っていれば置きかえる */
  stamp(name: string, kind: IconName, color: string, x: number, y: number, r: number): void {
    this.#badge = { name, icon: kind, color, x, y, r, age: 0 };
  }

  step(dt: number): void {
    this.particles.step(dt);
    this.floaters.step(dt);
    for (const b of this.bits) {
      b.age += dt;
      if (b.age < 0) continue;
      if (b.to) {
        // 最初は上へ散り、だんだん行き先へ引き寄せる
        const k = Math.min(1, b.age / b.life) ** 2;
        b.vx += (b.to[0] - b.x) * k * 30 * dt;
        b.vy += (b.to[1] - b.y) * k * 30 * dt + 500 * (1 - k) * dt;
        b.vx *= Math.exp(-3 * k * dt);
        b.vy *= Math.exp(-3 * k * dt);
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    for (let i = this.bits.length - 1; i >= 0; i--) if (this.bits[i].age >= this.bits[i].life) this.bits.splice(i, 1);
    for (const r of this.ripples) r.age += dt;
    for (let i = this.ripples.length - 1; i >= 0; i--) if (this.ripples[i].age > 0.6) this.ripples.splice(i, 1);
    this.#flash = Math.max(0, this.#flash - dt * 2.5);
    const b = this.#badge;
    if (!b) return;
    const was = b.age;
    b.age += dt;
    if (was < BADGE_HIT && b.age >= BADGE_HIT)
      this.particles.burst(b.x, b.y, { count: 28, color: CONFETTI, speed: 360, size: 5, life: 0.9, gravity: 500 });
    if (b.age > BADGE_LIFE) this.#badge = null;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const r of this.ripples) {
      ctx.globalAlpha = 1 - r.age / 0.6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 12 + r.age * 70, (12 + r.age * 70) * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.particles.draw(ctx);
    for (const b of this.bits) {
      if (b.age < 0) continue;
      const t = b.age / b.life;
      const pop = Math.min(1, b.age / 0.12);
      ctx.globalAlpha = b.to ? 1 : Math.min(1, (1 - t) * 2.5);
      const size = b.size * (0.5 + 0.5 * pop);
      if (b.kind === 'note') note(ctx, b.x + Math.sin(b.age * 8) * 6, b.y, size);
      else icon(ctx, b.kind, b.x, b.y, size, b.spin * b.age);
    }
    ctx.globalAlpha = 1;
    this.floaters.draw(ctx);
    if (this.#badge) badge(ctx, this.#badge);
    if (this.#flash > 0) {
      ctx.globalAlpha = this.#flash;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

/** 八分音符。アイコンの表にない形なので、ここで描く */
function note(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 30;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = ctx.lineCap = 'round';
  const head = new Path2D();
  head.ellipse(-4, 8, 7, 5.5, -0.4, 0, Math.PI * 2);
  const stem = new Path2D('M2 7V-14Q10-10 12-2');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.stroke(head);
  ctx.stroke(stem);
  ctx.fillStyle = ctx.strokeStyle = '#b27bff';
  ctx.fill(head);
  ctx.lineWidth = 3;
  ctx.stroke(stem);
  ctx.restore();
}

/** 上から大きく落ちてきて、ぽんと押されたスタンプ。少し傾けて、はんこらしく見せる */
function badge(ctx: CanvasRenderingContext2D, b: Badge) {
  const t = b.age;
  const fall = Math.min(1, t / BADGE_HIT);
  const bounce = t < BADGE_HIT ? 0 : Math.exp(-(t - BADGE_HIT) * 9) * Math.sin((t - BADGE_HIT) * 30) * 0.08;
  const scale = (2.4 - 1.4 * fall * fall) * (1 + bounce);
  ctx.save();
  ctx.globalAlpha = Math.min(1, fall * 1.5, (BADGE_LIFE - t) / (BADGE_LIFE - BADGE_HOLD));
  ctx.translate(b.x, b.y);
  ctx.rotate(-0.16);
  ctx.scale(scale, scale);
  const r = b.r;
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = b.color;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([r * 0.1, r * 0.09]);
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  icon(ctx, b.icon, 0, -r * 0.05, r * 1.05, 0, 192);
  ctx.restore();
  if (t < BADGE_HIT) return;
  ctx.globalAlpha = Math.min(1, (t - BADGE_HIT) * 5, (BADGE_LIFE - t) / (BADGE_LIFE - BADGE_HOLD));
  label(ctx, b.name, b.x, b.y + r * 1.4, Math.min(r * 0.42, (r * 5) / b.name.length), '#5b4a42');
  ctx.globalAlpha = 1;
}
