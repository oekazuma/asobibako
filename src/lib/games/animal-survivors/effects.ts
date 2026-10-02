import { PALETTE } from './art/palette';
import { text } from './font';
import { sounds } from './sounds';
import type { World } from './world';

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  age: number;
  color: string;
  size: 1 | 2;
}

const MAX_BITS = 600;
const MAX_NUMBERS = 60;
const NUMBER_LIFE = 0.6;
/** 倒した敵の粒の色 */
const BODY: Record<string, string> = {
  rat: PALETTE.g,
  bat: PALETTE.v,
  snake: PALETTE.l,
  caterpillar: PALETTE.l,
  boar: PALETTE.T
};

/** 見た目と音だけの演出。World の出来事を読み、ルールには触らない */
export class Effects {
  readonly #bits: Bit[] = [];
  readonly #numbers: Floater[] = [];
  shake = 0;
  /** 磁石で画面の縁が光る残り時間 */
  edge = 0;
  #chain = 0;
  #lastPick = -1;
  #clock = 0;

  #bit(x: number, y: number, vx: number, vy: number, life: number, color: string, size = 2) {
    let b = this.#bits.find((o) => o.life <= 0);
    if (!b) {
      if (this.#bits.length >= MAX_BITS) return;
      this.#bits.push((b = { x, y, vx, vy, life, max: life, color, size }));
    }
    Object.assign(b, { x, y, vx, vy, life, max: life, color, size });
  }

  #number(t: string, x: number, y: number, color: string, size: 1 | 2) {
    if (this.#numbers.length >= MAX_NUMBERS) this.#numbers.shift();
    this.#numbers.push({ text: t, x, y, age: 0, color, size });
  }

  take(w: World): void {
    let hit = false;
    let kill = false;
    for (const e of w.events) {
      if (e.type === 'hit') {
        hit = true;
        this.#number(
          String(Math.max(1, Math.round(e.dmg))),
          e.x + (Math.random() - 0.5) * 6,
          e.y,
          e.crit ? PALETTE.y : PALETTE.w,
          e.crit ? 2 : 1
        );
      } else if (e.type === 'kill') {
        kill = true;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = 20 + Math.random() * 50;
          this.#bit(
            e.x,
            e.y,
            Math.cos(a) * v,
            Math.sin(a) * v - 20,
            0.35 + Math.random() * 0.2,
            i < 6 ? (BODY[e.enemy] ?? PALETTE.g) : PALETTE.w
          );
        }
      } else if (e.type === 'pickup') {
        this.#chain = this.#clock - this.#lastPick < 0.3 ? this.#chain + 1 : 0;
        if (this.#lastPick !== this.#clock) sounds.pickup(this.#chain);
        this.#lastPick = this.#clock;
      } else if (e.type === 'hurt') {
        this.shake = 2;
        sounds.hurt();
      } else if (e.type === 'levelup') {
        const p = w.player;
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2;
          this.#bit(p.x, p.y, Math.cos(a) * 90, Math.sin(a) * 90, 0.5, i % 2 ? PALETTE.y : PALETTE.w);
        }
        sounds.levelup();
      } else if (e.type === 'magnet') {
        this.edge = 0.3;
        sounds.magnet();
      } else if (e.type === 'heal') {
        this.#number(`+${e.amount}`, w.player.x, w.player.y - 14, PALETTE.l, 1);
        sounds.heal();
      } else if (e.type === 'clear') sounds.clear();
      else if (e.type === 'dead') sounds.dead();
    }
    // 大群を倒すと 1 フレームに何十回も鳴るので、1 フレームに 1 回にまとめる
    if (hit) sounds.hit();
    if (kill) sounds.kill();
  }

  update(dt: number): void {
    this.#clock += dt;
    this.shake = Math.max(0, this.shake - dt * 12);
    this.edge = Math.max(0, this.edge - dt);
    for (const b of this.#bits) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.9;
      b.vy = b.vy * 0.9 + 80 * dt;
    }
    for (const n of this.#numbers) {
      n.age += dt;
      n.y -= 18 * dt;
    }
    while (this.#numbers.length && this.#numbers[0].age > NUMBER_LIFE) this.#numbers.shift();
  }

  /** ワールド座標で描く（呼ぶ側がカメラを移してある） */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const b of this.#bits) {
      if (b.life <= 0) continue;
      ctx.globalAlpha = Math.min(1, (b.life / b.max) * 2);
      ctx.fillStyle = b.color;
      ctx.fillRect(Math.round(b.x), Math.round(b.y), b.size, b.size);
    }
    ctx.globalAlpha = 1;
    for (const n of this.#numbers) {
      ctx.globalAlpha = n.age > NUMBER_LIFE * 0.6 ? 1 - (n.age - NUMBER_LIFE * 0.6) / (NUMBER_LIFE * 0.4) : 1;
      text(ctx, n.text, n.x - n.text.length * 2 * n.size, n.y, n.color, n.size);
    }
    ctx.globalAlpha = 1;
  }
}
