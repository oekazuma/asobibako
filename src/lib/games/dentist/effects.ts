import { CONFETTI, Floaters, Particles, Shake } from '$lib/fx';
import type { Tooth } from './animals';
import { TRASH, type DentistEvent, type GameState } from './engine';
import { drawToothBase } from './paint/teeth';
import { sounds } from './sounds';

interface Flying {
  tooth: Tooth;
  vx: number;
  vy: number;
  spin: number;
  age: number;
}

/** 見た目と音だけ。ルールには影響しない。こする音や粒は毎フレーム出すとうるさいので間引く */
export class Effects {
  readonly particles = new Particles();
  readonly floaters = new Floaters();
  readonly shake = new Shake();
  lid = 0;
  readonly #flying: Flying[] = [];
  readonly #next = new Map<string, number>();
  readonly #still: boolean;

  constructor(still: boolean) {
    this.#still = still;
  }

  #every(key: string, seconds: number, now: number): boolean {
    if ((this.#next.get(key) ?? 0) > now) return false;
    this.#next.set(key, now + seconds);
    return true;
  }

  handle(events: DentistEvent[], g: GameState): void {
    const now = g.time;
    for (const e of events) {
      if (e.type === 'progress') {
        if (e.tool === 'brush' && this.#every('brush', 0.09, now)) {
          sounds.brush();
          this.particles.burst(e.x, e.y, {
            count: 3,
            color: ['#fff', '#d8f1ff'],
            speed: 0.12,
            size: 0.008,
            life: 0.5,
            gravity: -0.1
          });
        } else if (e.tool === 'drill' && this.#every('drill', 0.07, now)) {
          sounds.drill();
          this.particles.burst(e.x, e.y, {
            count: 3,
            color: ['#fff', '#d9c7a8'],
            speed: 0.3,
            size: 0.005,
            life: 0.35,
            gravity: 1
          });
        } else if (e.tool === 'filling' && this.#every('fill', 0.1, now)) {
          this.particles.burst(e.x, e.y, { count: 2, color: '#f4f6fa', speed: 0.08, size: 0.006, life: 0.3 });
        }
      } else if (e.type === 'ouch') {
        if (this.#every('ouch', 0.5, now)) sounds.ouch();
      } else if (e.type === 'cleaned' || e.type === 'filled') {
        if (e.type === 'filled') sounds.filled();
        sounds.sparkle();
        this.particles.burst(e.x, e.y, {
          count: 14,
          color: ['#fff', '#ffe27a'],
          speed: 0.35,
          size: 0.008,
          life: 0.6,
          glow: true
        });
      } else if (e.type === 'drilled') {
        sounds.drilled();
        this.particles.burst(e.x, e.y, {
          count: 10,
          color: ['#d9c7a8', '#7a4b22'],
          speed: 0.4,
          size: 0.007,
          life: 0.5,
          gravity: 1.2
        });
      } else if (e.type === 'grab') sounds.grab();
      else if (e.type === 'escape') sounds.escape();
      else if (e.type === 'byebye') {
        sounds.byebye();
        this.lid = 1;
        this.floaters.add('バイバイキン！', TRASH.x - 0.12, TRASH.y - 0.16, 0.075, '#58c46b');
        this.particles.burst(TRASH.x, TRASH.y - 0.05, {
          count: 16,
          color: CONFETTI,
          speed: 0.5,
          size: 0.008,
          life: 0.8,
          gravity: 1
        });
      } else if (e.type === 'pulled') {
        sounds.pulled();
        const away = g.teeth[e.tooth].row === 'upper' ? 1 : -1;
        this.#flying.push({
          tooth: { ...g.teeth[e.tooth], gone: false },
          vx: 0.4,
          vy: away * 0.6 - 0.9,
          spin: 8,
          age: 0
        });
        if (!this.#still) this.shake.add(0.3);
      } else if (e.type === 'numb') {
        sounds.numb();
        this.particles.burst(e.x, e.y, {
          count: 14,
          color: ['#7fd0ff', '#fff'],
          speed: 0.25,
          size: 0.007,
          life: 0.7,
          glow: true
        });
      } else if (e.type === 'pat') {
        if (this.#every('pat', 0.15, now)) {
          sounds.pat();
          this.particles.burst(e.x, e.y, {
            count: 1,
            color: '#ff7f8f',
            speed: 0.1,
            size: 0.012,
            life: 0.8,
            gravity: -0.3
          });
        }
      } else if (e.type === 'wrong' || e.type === 'order' || e.type === 'slip') {
        if (this.#every('wrong', 0.6, now)) sounds.wrong();
      } else if (e.type === 'clear') {
        for (let k = 0; k < 4; k++)
          this.particles.burst(0.15 + k * 0.23, 0.35, {
            count: 26,
            color: CONFETTI,
            speed: 0.7,
            size: 0.01,
            life: 1.6,
            gravity: 0.9
          });
      } else if (e.type === 'cry') {
        sounds.cry();
        if (!this.#still) this.shake.add(0.5);
      }
    }
  }

  step(dt: number): void {
    this.particles.step(dt);
    this.floaters.step(dt);
    this.lid = Math.max(0, this.lid - dt * 2.5);
    for (const f of this.#flying) {
      f.age += dt;
      f.vy += 2.5 * dt;
      f.tooth.x += f.vx * dt;
      f.tooth.y += f.vy * dt;
    }
    for (let i = this.#flying.length - 1; i >= 0; i--) if (this.#flying[i].age > 1.5) this.#flying.splice(i, 1);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const f of this.#flying) {
      ctx.save();
      ctx.translate(f.tooth.x, f.tooth.y);
      ctx.rotate(f.age * f.spin);
      ctx.translate(-f.tooth.x, -f.tooth.y);
      drawToothBase(ctx, f.tooth);
      ctx.restore();
    }
    this.particles.draw(ctx);
    this.floaters.draw(ctx);
  }
}
