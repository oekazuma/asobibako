import { CONFETTI, Floaters, label, Particles, Shake, type Projector } from '$lib/fx';
import { BOSS_AHEAD, type Rank, type RunEvent, type RunState } from './engine';

export type Ending = { kind: 'rank'; rank: Rank; points: number } | { kind: 'timeout' };

const RANK_COLOR: Record<Rank, string> = { S: '#ffb300', A: '#ff4d8b', B: '#1f9bff', C: '#58c46b' };

/**
 * 3D の上に重ねる演出。粒と浮かぶ文字は (レーン, 走る子からの距離) で持ち、描くときに画面へ写す。
 * 絶対の距離で持つと、速い走りでは寿命のあいだに走る子が追い越し、カメラのそばで巨大に写ったり
 * 背後に回って画面の上へ反転したりするため、走る子に付けたまま動かす。
 * 帯の文字と終わりのカードは画面のピクセルで描く
 */
export class RunFx {
  readonly particles = new Particles();
  readonly floaters = new Floaters();
  readonly shake = new Shake();
  #banner: { text: string; age: number } | null = null;
  #ending: (Ending & { age: number }) | null = null;

  handle(e: RunEvent, s: RunState): void {
    const p = this.particles;
    if (e.type === 'hit') {
      this.floaters.add(`+${e.gain}`, e.walker.lane, e.walker.z - s.z, 0.8, '#ff3d8b');
      p.burst(e.walker.lane, e.walker.z - s.z, {
        count: 14,
        color: ['#ff7eb6', '#7fe3ff', '#ffffff'],
        speed: 1.2,
        size: 0.12,
        life: 0.5
      });
    } else if (e.type === 'miss') this.floaters.add('にげられた', e.walker.lane, 7, 0.35, '#7a7f8c');
    else if (e.type === 'bump') {
      this.floaters.add('ドン！', s.lane, 6, 0.5, '#ff4d5e');
      this.shake.add(0.6);
    } else if (e.type === 'boss-in') this.#banner = { text: 'ボスが あらわれた！', age: 0 };
    else if (e.type === 'boss-hit' && s.boss) {
      this.floaters.add(`-${e.damage}`, s.boss.lane, BOSS_AHEAD, 1.2, '#ffffff');
      p.burst(s.boss.lane, BOSS_AHEAD, {
        count: 10,
        color: ['#ff7eb6', '#ffffff'],
        speed: 1.5,
        size: 0.25,
        life: 0.4,
        glow: true
      });
    } else if (e.type === 'boss-down') {
      this.#banner = { text: 'やっつけた！', age: 0 };
      p.burst(1, BOSS_AHEAD, { count: 40, color: CONFETTI, speed: 2.5, size: 0.3, life: 1 });
    } else if (e.type === 'goal')
      for (let lane = 0; lane < 3; lane++)
        p.burst(lane, 6, { count: 24, color: CONFETTI, speed: 1.5, size: 0.2, life: 1.2 });
  }

  end(ending: Ending): void {
    this.#ending = { ...ending, age: 0 };
  }

  step(dt: number): void {
    this.particles.step(dt);
    this.floaters.step(dt);
    if (this.#banner) {
      this.#banner.age += dt;
      if (this.#banner.age > 1.6) this.#banner = null;
    }
    if (this.#ending) this.#ending.age += dt;
  }

  draw(ctx: CanvasRenderingContext2D, to: Projector, w: number, h: number): void {
    this.particles.draw(ctx, to);
    this.floaters.draw(ctx, to);
    const size = Math.min(w, h);
    if (this.#banner) {
      ctx.globalAlpha = Math.min(1, (1.6 - this.#banner.age) * 3);
      label(ctx, this.#banner.text, w / 2, h * 0.3, size * 0.08, '#ff4d5e');
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
    label(ctx, 'がっこうに ついた！', w / 2, h * 0.3, size * 0.07, '#1f9bff');
    label(ctx, end.rank, w / 2, h * 0.47, size * 0.3 * (0.6 + pop * 0.4), RANK_COLOR[end.rank]);
    label(ctx, `てんすう ${end.points}`, w / 2, h * 0.64, size * 0.06, '#2b2d42');
  }
}
