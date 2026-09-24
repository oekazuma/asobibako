import { sfx } from '$lib/audio.svelte';
import { CONFETTI, Floaters, Particles, Shake } from '$lib/fx';
import { needed, type GameState, type Kind } from './engine';
import { sounds } from './sounds';

/** 届いた金の粒 1 つぶんの金額 */
const COIN = 10;

/** 見た目と音だけの反応。ルールの判定は engine が済ませている */
export class PinFx {
  readonly particles = new Particles();
  readonly floaters = new Floaters();
  readonly shake = new Shake();
  #collected = 0;
  #kinds: Kind[] = [];
  /** まだ「+10」として出していない、届いた金の粒の数と、最後に出してからの秒 */
  #pending = 0;
  #since = 0;
  #t = 0;
  #hissAt = -1;
  #alive: boolean[] = [];
  #blasts = 0;

  reset(): void {
    this.#collected = 0;
    this.#kinds = [];
    this.#pending = 0;
    this.#t = 0;
    this.#hissAt = -1;
    this.#alive = [];
    this.#blasts = 0;
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

  /**
   * 毎フレーム呼ぶ。戻り値の progress はクリアまでの進み具合（0..1）で、金貨と怪物の両方がいればその平均。
   * 姫の面は歩いてたどり着けば終わりなので -1 を返し、メーターを出さない
   */
  update(game: GameState, dt: number): { progress: number; score: number } {
    this.#t += dt;
    const { x, y } = game.hero;
    if (game.collected > this.#collected) {
      sounds.coin();
      this.#pending += game.collected - this.#collected;
      this.particles.burst(x, y - 0.05, {
        count: 3,
        color: ['#fff6b0', '#ffc233'],
        speed: 0.4,
        size: 0.007,
        glow: true
      });
    }
    this.#collected = game.collected;
    // 粒が届くたびに出すと重なって読めないので、少しまとめて出す
    this.#since += dt;
    if (this.#pending > 0 && this.#since > 0.35) {
      this.floaters.add(`+${this.#pending * COIN}`, x + (Math.random() - 0.5) * 0.1, y - 0.12, 0.05, '#e39a00');
      this.#pending = 0;
      this.#since = 0;
    }
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
    // 石になる粒が続くあいだ毎フレーム鳴らすと、ノイズのバッファ生成だけで重い
    if (formed && this.#t - this.#hissAt > 0.2) {
      this.#hissAt = this.#t;
      sounds.hiss();
    }
    this.#kinds = game.particles.map((p) => p.kind);
    game.monsters.forEach((m, i) => {
      if (m.alive || this.#alive[i] === false) return;
      sounds.defeat();
      this.particles.burst(m.x, m.y, {
        count: 24,
        color: ['#8ee07a', '#3f9a36', 'rgb(255 255 255 / 0.8)'],
        speed: 0.45,
        size: 0.016,
        life: 0.8,
        gravity: -0.3
      });
      this.floaters.add('たおした！', m.x, m.y - 0.18, 0.06, '#3f9a36');
    });
    this.#alive = game.monsters.map((m) => m.alive);
    for (const b of game.blasts.slice(this.#blasts)) {
      sounds.burn();
      this.shake.add(0.7);
      this.particles.burst(b.x, b.y, {
        count: 40,
        color: ['#fff1a8', '#ffc233', '#ff6a1f', '#6b6f86'],
        speed: 0.9,
        size: 0.018,
        life: 0.7,
        glow: true
      });
    }
    this.#blasts = game.blasts.length;
    this.particles.step(dt);
    this.floaters.step(dt);
    const gold = needed(game) > 0 ? Math.min(1, game.collected / needed(game)) : 1;
    const beaten = game.monsters.length ? game.monsters.filter((m) => !m.alive).length / game.monsters.length : 1;
    const progress = game.princess ? -1 : game.monsters.length ? (gold + beaten) / 2 : gold;
    return { progress, score: game.collected * COIN };
  }

  finished(game: GameState): void {
    const { x, y } = game.hero;
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
    if (game.result === 'eaten' || game.result === 'gassed' || game.result === 'drowned') {
      sounds.burn();
      this.shake.add(0.6);
    }
    if (game.result === 'clear') sfx.finish();
    const words = {
      clear: 'やった！',
      eaten: 'やられた…',
      gassed: 'くるしい…',
      drowned: 'ぶくぶく…',
      stuck: 'あれれ…'
    } as const;
    this.floaters.add(words[game.result ?? 'stuck'], x, y - 0.26, 0.1, '#ffc233');
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
