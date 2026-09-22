import { sfx } from '$lib/audio.svelte';
import { Floaters, Particles, Shake } from '$lib/fx';
import type { GameState, Kind } from './engine';
import { sounds } from './sounds';

const CONFETTI = ['#ffc233', '#1f9bff', '#ff4d5e', '#58c46b'];

/** 見た目と音だけの反応。ルールの判定は engine が済ませている */
export class PinFx {
  readonly particles = new Particles();
  readonly floaters = new Floaters();
  readonly shake = new Shake();
  #collected = 0;
  #kinds: Kind[] = [];

  reset(): void {
    this.#collected = 0;
    this.#kinds = [];
  }

  pulled(game: GameState, i: number): void {
    const pin = game.level.pins[i];
    const [x, y] = pin.handle === 1 ? [pin.seg[2], pin.seg[3]] : [pin.seg[0], pin.seg[1]];
    this.particles.burst(x, y, {
      count: 14,
      color: ['#fff', '#ffc233'],
      speed: 0.5,
      size: 0.008,
      life: 0.4,
      glow: true
    });
  }

  /** 毎フレーム呼ぶ。戻り値は、クリアに要る金貨をどれだけ集めたか（0..1） */
  update(game: GameState, dt: number): number {
    const { x, y } = game.level.hero;
    if (game.collected > this.#collected) {
      sounds.coin();
      this.particles.burst(x, y - 0.05, {
        count: 3,
        color: ['#fff6b0', '#ffc233'],
        speed: 0.4,
        size: 0.007,
        glow: true
      });
    }
    this.#collected = game.collected;
    // 石になった粒から湯気を出す
    let formed = false;
    game.particles.forEach((p, i) => {
      if (p.kind !== 'rock' || !this.#kinds[i] || this.#kinds[i] === 'rock') return;
      formed = true;
      this.particles.burst(p.x, p.y, {
        count: 2,
        color: 'rgb(255 255 255 / 0.8)',
        speed: 0.12,
        size: 0.018,
        life: 0.8,
        gravity: -0.3
      });
    });
    if (formed) sounds.hiss();
    this.#kinds = game.particles.map((p) => p.kind);
    this.particles.step(dt);
    this.floaters.step(dt);
    return Math.min(1, game.collected / Math.ceil(game.gold * 0.6));
  }

  finished(game: GameState): void {
    const { x, y } = game.level.hero;
    if (game.result === 'burned') {
      sounds.burn();
      this.shake.add(0.8);
      this.particles.burst(x, y, {
        count: 40,
        color: ['#fff1a8', '#ff6a1f', '#c21d05'],
        speed: 0.6,
        size: 0.014,
        life: 0.9,
        glow: true,
        gravity: -0.4
      });
      return;
    }
    if (game.result === 'clear') sfx.finish();
    this.floaters.add(game.result === 'clear' ? 'やった！' : 'あれれ…', x, y - 0.18, 0.1, '#ffc233');
    if (game.result !== 'clear') return;
    for (let k = 0; k < 4; k++)
      this.particles.burst(0.15 + k * 0.23, 0.3, {
        count: 26,
        color: CONFETTI,
        speed: 0.7,
        size: 0.01,
        life: 1.6,
        gravity: 0.9
      });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.particles.draw(ctx);
    this.floaters.draw(ctx);
  }
}
