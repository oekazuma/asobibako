import { CONFETTI, Floaters, label, Particles, type Projector } from '$lib/fx';
import type { Zone } from './course';
import { boost, BOSS_AHEAD, type Rank, type RunEvent, type RunState } from './engine';

export type Ending = { kind: 'rank'; rank: Rank; points: number } | { kind: 'timeout' };

const RANK_COLOR: Record<Rank, string> = { S: '#ffb300', A: '#ff4d8b', B: '#1f9bff', C: '#58c46b' };
const ZONE_NAME: Record<Zone, string> = { street: 'つうがくろ', arcade: 'しょうてんがい', hall: 'ろうか' };
/** この数を超えるたびに帯を出すコンボ */
const MILESTONES = [10, 25, 50, 100, 150, 200];

interface Line {
  a: number;
  r: number;
  len: number;
  v: number;
}

/**
 * 3D の上に重ねる演出。粒と浮かぶ文字は (横の位置, 走る子からの距離) で持つ。
 * 世界の距離で持つと、速く走っているあいだにカメラへ近づいて巨大になるため
 */
export class RunFx {
  readonly particles = new Particles();
  readonly floaters = new Floaters();
  #banner: { text: string; color: string; age: number; big: boolean } | null = null;
  #ending: (Ending & { age: number }) | null = null;
  #lines: Line[] = Array.from({ length: 36 }, () => ({ a: 0, r: 2, len: 0, v: 0 }));
  #milestone = 0;

  handle(e: RunEvent, s: RunState): void {
    if (e.type === 'hit') {
      const n = e.walkers.length;
      const w = e.walkers[0];
      const size = n >= 5 ? 1.3 : n >= 3 ? 1.0 : 0.75;
      this.floaters.add(`+${e.gain}`, w.x, w.z - s.z, size, n >= 5 ? '#ffb300' : '#ff3d8b');
      for (const k of e.walkers)
        this.particles.burst(k.x, k.z - s.z, {
          count: 6,
          color: ['#ff7eb6', '#ffe066', '#ffffff'],
          speed: 2,
          size: 0.1,
          life: 0.45
        });
      const m = MILESTONES.find((x) => this.#milestone < x && e.combo >= x);
      if (m) {
        this.#milestone = m;
        this.#banner = { text: `${m} コンボ！`, color: '#ff3d8b', age: 0, big: false };
      }
    } else if (e.type === 'drop') {
      this.#milestone = 0;
      if (e.combo >= 10) this.floaters.add('コンボ ストップ', s.x, 6, 0.5, '#7a7f8c');
    } else if (e.type === 'bump') this.floaters.add('ドン！', e.obstacle.x, 5, 0.6, '#ff4d5e');
    else if (e.type === 'gauge') this.#banner = { text: 'さけべる！', color: '#ffb300', age: 0, big: false };
    else if (e.type === 'shout') {
      this.#banner = { text: `わーーっ！ +${e.gain}`, color: '#ff3d8b', age: 0, big: true };
      for (let i = 0; i < 8; i++)
        this.particles.burst(s.x + (i - 3.5) * 0.7, 6 + i * 2, {
          count: 16,
          color: CONFETTI,
          speed: 4,
          size: 0.18,
          life: 0.9
        });
    } else if (e.type === 'boss-in') this.#banner = { text: '不満爆発！', color: '#ff2a3d', age: 0, big: true };
    else if (e.type === 'boss-hit' && s.boss) {
      const bx = s.boss.x;
      this.floaters.add(`-${Math.round(e.damage)}`, bx, BOSS_AHEAD, e.big ? 2.4 : 1.1, e.big ? '#ffb300' : '#ffffff');
      this.particles.burst(bx, BOSS_AHEAD, {
        count: e.big ? 30 : 5,
        color: ['#ff7eb6', '#ffe066', '#ffffff'],
        speed: e.big ? 6 : 3,
        size: 0.3,
        life: 0.5
      });
    } else if (e.type === 'boss-down') {
      this.#banner = { text: 'やっつけた！', color: '#ffb300', age: 0, big: true };
      for (let i = 0; i < 6; i++)
        this.particles.burst((s.boss?.x ?? 0) + (i - 2.5) * 0.6, BOSS_AHEAD, {
          count: 24,
          color: CONFETTI,
          speed: 6,
          size: 0.35,
          life: 1.4
        });
    } else if (e.type === 'zone') this.#banner = { text: ZONE_NAME[e.zone], color: '#1f9bff', age: 0, big: false };
    else if (e.type === 'goal')
      for (let i = 0; i < 6; i++)
        this.particles.burst(s.x + (i - 2.5), 5, { count: 24, color: CONFETTI, speed: 3, size: 0.18, life: 1.2 });
  }

  end(ending: Ending): void {
    this.#ending = { ...ending, age: 0 };
  }

  step(dt: number, s: RunState): void {
    this.particles.step(dt);
    this.floaters.step(dt);
    if (this.#banner) {
      this.#banner.age += dt;
      if (this.#banner.age > 1.4) this.#banner = null;
    }
    if (this.#ending) this.#ending.age += dt;
    const b = boost(s.combo);
    for (const l of this.#lines) {
      l.r += l.v * dt;
      if (l.r > 1.3 || l.v === 0) {
        l.a = Math.random() * Math.PI * 2;
        l.r = 0.35 + Math.random() * 0.4;
        l.len = 0.05 + Math.random() * 0.12;
        l.v = (0.9 + Math.random()) * (0.6 + b * 1.6);
      }
    }
  }

  #speedLines(ctx: CanvasRenderingContext2D, w: number, h: number, b: number) {
    if (b < 0.2) return;
    const cx = w / 2;
    const cy = h * 0.42;
    const size = Math.max(w, h);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgb(255 255 255 / ${Math.min(0.55, (b - 0.2) * 0.9)})`;
    ctx.lineWidth = Math.max(2, size * 0.004);
    ctx.beginPath();
    for (const l of this.#lines) {
      const c = Math.cos(l.a);
      const s = Math.sin(l.a);
      ctx.moveTo(cx + c * l.r * size * 0.6, cy + s * l.r * size * 0.6);
      ctx.lineTo(cx + c * (l.r + l.len) * size * 0.6, cy + s * (l.r + l.len) * size * 0.6);
    }
    ctx.stroke();
  }

  draw(ctx: CanvasRenderingContext2D, to: Projector, w: number, h: number, s: RunState): void {
    this.#speedLines(ctx, w, h, boost(s.combo));
    this.particles.draw(ctx, to);
    this.floaters.draw(ctx, to);
    const size = Math.min(w, h);
    const bn = this.#banner;
    if (bn) {
      const pop = bn.age < 0.15 ? 0.6 + (bn.age / 0.15) * 0.5 : 1.1 - Math.min(0.1, (bn.age - 0.15) * 0.3);
      ctx.globalAlpha = Math.min(1, (1.4 - bn.age) * 3);
      label(ctx, bn.text, w / 2, h * (bn.big ? 0.3 : 0.24), size * (bn.big ? 0.1 : 0.075) * pop, bn.color);
      ctx.globalAlpha = 1;
    }
    const end = this.#ending;
    if (!end) return;
    const pop = Math.min(1, end.age / 0.25);
    ctx.fillStyle = `rgb(255 255 255 / ${0.55 * pop})`;
    ctx.fillRect(0, 0, w, h);
    if (end.kind === 'timeout') {
      label(ctx, 'じかんぎれ…', w / 2, h * 0.45, size * 0.1 * pop, '#7a7f8c');
      return;
    }
    label(ctx, 'きょうしつに ついた！', w / 2, h * 0.3, size * 0.07, '#1f9bff');
    label(ctx, end.rank, w / 2, h * 0.47, size * 0.3 * (0.6 + pop * 0.4), RANK_COLOR[end.rank]);
    label(ctx, `てんすう ${end.points}`, w / 2, h * 0.64, size * 0.06, '#2b2d42');
  }
}
