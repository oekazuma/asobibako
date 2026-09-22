import { Floaters, Particles } from '$lib/fx';
import { FIRE, MONEY, type CampEvent, type GameState } from './engine';

const CONFETTI = ['#ffc233', '#1f9bff', '#ff4d5e', '#58c46b'];
const UPGRADE_TEXT = {
  bag: 'もてる数 アップ！',
  power: 'つよさ アップ！',
  fire: 'やく早さ アップ！',
  home: 'いえが できた！'
};

interface Flake {
  x: number;
  y: number;
  r: number;
  v: number;
}

/** 見た目だけの反応。粒と文字は雪原の座標、降る雪は画面の割合で持つ */
export class CampFx {
  readonly particles = new Particles();
  readonly floaters = new Floaters();
  readonly flakes: Flake[] = Array.from({ length: 50 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1.5 + Math.random() * 2.5,
    v: 0.03 + Math.random() * 0.05
  }));

  handle(event: CampEvent, state: GameState): void {
    const { x, y } = state.hero;
    const p = this.particles;
    if (event.type === 'hit')
      p.burst(event.x, event.y, { count: 8, color: ['#fff', '#ff8a95'], speed: 0.5, size: 0.008, life: 0.35 });
    else if (event.type === 'kill') {
      p.burst(x, y - 0.1, { count: 16, color: ['#fff', '#ffe0b3'], speed: 0.5, size: 0.012, life: 0.5 });
      this.floaters.add(event.kind === 'bear' ? '🍖×3' : '🍖', x, y - 0.14, 0.05, '#d02c3e');
    } else if (event.type === 'deposit')
      p.burst(FIRE.x, FIRE.y - 0.03, {
        count: 4,
        color: ['#ffd166', '#ff7a1a'],
        speed: 0.3,
        size: 0.008,
        glow: true,
        life: 0.4
      });
    else if (event.type === 'pay') this.floaters.add('+4', MONEY.x, MONEY.y - 0.04, 0.05, '#e39a00');
    else if (event.type === 'collect') {
      this.floaters.add(`+${event.n}`, x, y - 0.14, 0.06, '#e39a00');
      p.burst(x, y - 0.05, { count: 14, color: ['#fff3a0', '#ffc233'], speed: 0.4, size: 0.008, glow: true });
    } else if (event.type === 'spend')
      p.burst(x, y - 0.02, { count: 1, color: '#ffc233', speed: 0.2, size: 0.008, glow: true, life: 0.3 });
    else if (event.type === 'upgrade') {
      this.floaters.add(UPGRADE_TEXT[event.id], x, y - 0.16, 0.055, '#1f9bff');
      p.burst(x, y, { count: 30, color: CONFETTI, speed: 0.6, size: 0.01, life: 0.9, gravity: 0.6 });
    } else if (event.type === 'clear')
      for (let k = 0; k < 5; k++)
        p.burst(x - 0.4 + k * 0.2, y - 0.3, {
          count: 24,
          color: CONFETTI,
          speed: 0.7,
          size: 0.012,
          life: 1.6,
          gravity: 0.9
        });
  }

  step(dt: number, state: GameState): void {
    // たき火の火の粉。焼いているときは多めに
    if (Math.random() < dt * (state.cooking > 0 ? 18 : 6))
      this.particles.burst(FIRE.x + (Math.random() - 0.5) * 0.04, FIRE.y - 0.05, {
        count: 1,
        color: ['#ffd166', '#ff7a1a'],
        speed: 0.12,
        angle: -Math.PI / 2,
        spread: 0.8,
        size: 0.006,
        life: 0.9,
        glow: true
      });
    this.particles.step(dt);
    this.floaters.step(dt);
    for (const f of this.flakes) {
      f.y += f.v * dt;
      f.x += Math.sin(f.y * 12 + f.r) * dt * 0.01;
      if (f.y > 1) [f.y, f.x] = [-0.02, Math.random()];
    }
  }

  /** ctx は雪原の座標で描ける変換にしておく */
  drawWorld(ctx: CanvasRenderingContext2D): void {
    this.particles.draw(ctx);
    this.floaters.draw(ctx);
  }

  /** ctx は画面のピクセル */
  drawSnow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgb(255 255 255 / 0.85)';
    for (const f of this.flakes) {
      ctx.beginPath();
      ctx.arc(f.x * w, f.y * h, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
