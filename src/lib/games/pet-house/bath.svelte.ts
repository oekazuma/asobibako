import { Vector3 } from 'three';
import type { Activity, ActivityHost } from './activity';
import type { Actor } from './behavior';
import { bathe, kindOf, wash } from './engine';
import { LOOKS } from './looks';
import { FOAM_SPOTS } from './models';
import { BATH, BATH_FOLLOW, TUB, buildBath, type Bathroom, type HandTool } from './scene-bath';
import { sounds } from './sounds';
import type { PetAction } from './types';

export type BathStep = 'shampoo' | 'rinse' | 'towel' | 'shake' | 'done';

const TOOL: Record<BathStep, HandTool | null> = {
  shampoo: 'sponge',
  rinse: 'shower',
  towel: 'towel',
  shake: null,
  done: null
};
/** 泡を付ける・流す指の届く範囲（画面の高さに対する割合）。指 1 本で背中から横腹まで届く広さ */
const REACH = 0.075;
/** ペットの向き。横腹と背中がカメラに見えるよう、右前を向かせる */
const FACE = 1.05;
/** ここまで泡立てたら残りは自動でふくらませる（向こう側の横腹まで指で届かなくても終われるように） */
const LATHERED = 0.72;
/** タオルでここまで乾かしたら、あとはぶるぶるで飛ばす */
const TOWELED = 0.3;
const SHAKE_TIME = 1.5;
const DONE_TIME = 3.2;
const DROP = ['#bfe6ff', '#e6f6ff', '#9fd6f5'];
const BUBBLE = ['#ffffff', '#eef7ff'];

/**
 * おふろ 1 回ぶんの進行（シャンプー → シャワー → タオル → ぶるぶる → さっぱり）。
 * ペットはたらいの中に立たせたままここで動かし（drives）、指はシャンプーとタオルなら体をこすった長さ、
 * シャワーなら当てていた時間だけ効く。猫はときどきいやがって、たらいのふちへ逃げかけてから戻る
 */
export class BathPlay implements Activity {
  readonly drives = true;
  step: BathStep = $state('shampoo');
  /** いまの手順の進み 0..1 */
  progress = $state(0);
  /** 猫がいやがって逃げかけているあいだ */
  fussing = $state(false);

  #host!: ActivityHost;
  #room: Bathroom | null = null;
  #foam = new Float32Array(FOAM_SPOTS);
  #wet = 0;
  #finger: { id: number; x: number; y: number; rub: number } | null = null;
  #t = 0;
  #beat = 0;
  #spray = 0;
  #fuss = 0;
  #flee = 0;
  #bark = 3;
  readonly #v = new Vector3();
  readonly #at = new Vector3();

  get cat(): boolean {
    return kindOf(this.#host.pet.breed) === 'cat';
  }

  get name(): string {
    return this.#host.pet.name;
  }

  /** 体の上の高さ（m）。道具とお湯はこの高さで指の下に出す */
  get #top(): number {
    return LOOKS[this.#host.pet.breed].S * 0.95;
  }

  enter(host: ActivityHost): void {
    this.#host = host;
    host.enter({
      id: 'bath',
      layout: BATH,
      follow: BATH_FOLLOW,
      outdoor: false,
      build: () => (this.#room = buildBath())
    });
    host.setTool('hand');
    this.#fuss = 4 + Math.random() * 3;
    host.say(
      this.cat ? `${this.name}は おふろが ちょっと にがて。やさしくね` : `${this.name}は おふろが だいすき！`,
      3.5
    );
  }

  quit(): void {
    this.#host.end();
  }

  frame(dt: number): void {
    this.#t += dt;
    this.#beat -= dt;
    this.#spray -= dt;
    const host = this.#host;
    const a = host.actor;
    const model = host.world.model(host.pet.id);
    if (!a || !model) return;
    this.#fussy(dt);
    this.#pose(a, dt);
    const f = this.#finger;
    const tool = TOOL[this.step];
    const at = f && tool ? this.#point(f.x, f.y) : null;
    this.#room?.hand(tool, at);
    const amount = f ? Math.min(f.rub / (host.size[1] * 0.3), dt * 2) : 0;
    if (f) f.rub = 0;
    const busy = this.#flee > 0;
    if (this.step === 'shampoo') this.#shampoo(busy ? 0 : amount);
    else if (this.step === 'rinse') this.#rinse(dt, f && !busy ? f : null);
    else if (this.step === 'towel') this.#towel(busy ? 0 : amount, f);
    else if (this.step === 'shake') this.#shake(a);
    else if (this.#t > DONE_TIME) return host.end();
    model.setFoam(this.#foam);
    model.setWet(this.#wet);
  }

  #next(step: BathStep) {
    this.step = step;
    this.progress = 0;
    this.#t = 0;
    // 指を離さずにこすりつづけていても、次の道具がそのまま指の下に出る
    if (this.#finger) this.#finger.rub = 0;
  }

  #point(px: number, py: number) {
    const p = this.#host.world.floor(px, py, this.#top);
    return p ? this.#at.set(p.x, this.#top, p.z) : null;
  }

  #onPet(px: number, py: number) {
    return this.#host.world.pick(px, py) === this.#host.pet.id;
  }

  /** 指のまわりの泡のかたまりを k だけ増やす（負なら流す）。画面で近いほどよく効く */
  #spread(px: number, py: number, k: number) {
    const host = this.#host;
    const model = host.world.model(host.pet.id);
    if (!model) return;
    const r = REACH * host.size[1];
    for (let i = 0; i < FOAM_SPOTS; i++) {
      const p = model.foamAt(i, this.#v);
      const [sx, sy] = host.world.project(p.x, p.y, p.z);
      const w = Math.exp(-((Math.hypot(sx - px, sy - py) / r) ** 2));
      const before = this.#foam[i];
      this.#foam[i] = Math.min(1, Math.max(0, before + k * w));
      // 流れた泡は、その場所から白いしずくになって落ちる
      if (k < 0 && before - this.#foam[i] > 0.02 && Math.random() < 0.3)
        host.fx.particles.burst(sx, sy, { count: 2, color: BUBBLE, speed: 60, size: 6, life: 0.7, gravity: 700 });
    }
  }

  #mean() {
    return this.#foam.reduce((s, v) => s + v, 0) / FOAM_SPOTS;
  }

  #shampoo(amount: number) {
    const f = this.#finger;
    if (f && amount > 0) {
      this.#spread(f.x, f.y, amount * 1.6);
      if (this.#spray <= 0) {
        this.#spray = 0.08;
        this.#host.fx.particles.burst(f.x, f.y - 10, {
          count: 3,
          color: BUBBLE,
          speed: 70,
          size: 7,
          life: 0.9,
          gravity: -80
        });
      }
      if (this.#beat <= 0) {
        this.#beat = 0.18;
        sounds.foam();
      }
    }
    const lather = this.#mean();
    this.progress = Math.min(1, lather / LATHERED);
    // 泡をなじませると毛も少ししめる
    this.#wet = Math.max(this.#wet, Math.min(0.25, lather * 0.4));
    if (lather < LATHERED) return;
    this.#foam.fill(1);
    this.#cheer('あわあわ！', '#1f9bff');
    this.#next('rinse');
  }

  #rinse(dt: number, f: { x: number; y: number } | null) {
    const host = this.#host;
    if (f) {
      const on = this.#onPet(f.x, f.y);
      this.#room?.pour(on ? this.#top * 0.85 : TUB.water);
      this.#spread(f.x, f.y, -dt * 1.5);
      if (on) this.#wet = Math.min(1, this.#wet + dt * 0.45);
      if (this.#spray <= 0) {
        this.#spray = 0.05;
        const angle = -Math.PI / 2;
        host.fx.particles.burst(f.x, f.y, {
          count: 3,
          color: DROP,
          speed: 240,
          size: 4,
          life: 0.45,
          gravity: 1400,
          angle,
          spread: 2.4
        });
      }
      if (this.#beat <= 0) {
        this.#beat = 0.1;
        sounds.shower();
      }
    }
    const left = this.#mean();
    this.progress = Math.min(1, (1 - left) / 0.92);
    wash(host.pet, this.progress);
    host.changed();
    if (left > 0.08) return;
    this.#foam.fill(0);
    this.#wet = 1;
    wash(host.pet, 1);
    this.#cheer('つるつる！', '#1f9bff');
    this.#next('towel');
  }

  #towel(amount: number, f: { x: number; y: number } | null) {
    if (f && amount > 0) {
      this.#wet = Math.max(0, this.#wet - amount * 0.28);
      if (this.#spray <= 0) {
        this.#spray = 0.12;
        this.#host.fx.particles.burst(f.x, f.y, { count: 2, color: DROP, speed: 90, size: 4, life: 0.5, gravity: 600 });
      }
      if (this.#beat <= 0) {
        this.#beat = 0.28;
        sounds.towel();
      }
    }
    this.progress = Math.min(1, (1 - this.#wet) / (1 - TOWELED));
    if (this.#wet > TOWELED) return;
    this.#next('shake');
    sounds.shake();
  }

  #shake(a: Actor) {
    const host = this.#host;
    this.progress = Math.min(1, this.#t / SHAKE_TIME);
    this.#wet = TOWELED * (1 - this.progress);
    if (this.#t < SHAKE_TIME && this.#spray <= 0) {
      this.#spray = 0.035;
      const [x, y] = host.above(a, this.#top * 0.75);
      // 体を振る向きに合わせて、左右の斜め上へ交互に大きく飛ばす（画面の y は下向き）
      const angle = Math.sin(this.#t * Math.PI * 2 * 4.6) > 0 ? -0.6 : Math.PI + 0.6;
      const w = host.size[1] * 0.05;
      host.fx.particles.burst(x + (Math.random() - 0.5) * w * 2, y + (Math.random() - 0.5) * w, {
        count: 9,
        color: DROP,
        speed: 620,
        size: 6,
        life: 0.8,
        gravity: 1200,
        angle,
        spread: 1.2
      });
    }
    if (this.#t < SHAKE_TIME + 0.2) return;
    this.#wet = 0;
    bathe(host.pet);
    host.changed();
    this.#next('done');
    const [x, y] = host.above(a, this.#top * 1.2);
    host.fx.hearts(x, y, 5);
    host.fx.sparkle(x, y, 6);
    host.fx.text('さっぱり！', x, y - 40, '#ff7a00', 46);
    host.voice('happy');
    sounds.sparkle();
  }

  #cheer(text: string, color: string) {
    const a = this.#host.actor;
    if (!a) return;
    const [x, y] = this.#host.above(a, this.#top * 1.2);
    this.#host.fx.text(text, x, y, color, 40);
    this.#host.fx.sparkle(x, y, 4);
    sounds.sparkle();
  }

  /** 猫はシャンプーとシャワーのあいだ、ときどきいやがる。犬はうれしくて、ときどき鳴く */
  #fussy(dt: number) {
    const host = this.#host;
    const washing = this.step === 'shampoo' || this.step === 'rinse';
    this.#flee = Math.max(0, this.#flee - dt);
    this.fussing = this.#flee > 0;
    if (!washing) return;
    if (!this.cat) {
      this.#bark -= dt;
      if (this.#bark > 0 || !this.#finger) return;
      this.#bark = 3.5 + Math.random() * 3;
      host.voice('bath');
      const a = host.actor;
      if (a) host.fx.note(...host.above(a, this.#top * 1.1));
      return;
    }
    this.#fuss -= dt;
    if (this.#fuss > 0 || this.#flee > 0) return;
    this.#fuss = 6 + Math.random() * 4;
    this.#flee = 1.8;
    host.voice('grumble');
  }

  /** たらいのまん中に立たせる。猫が逃げかけるときは左のふちへ寄ってから戻る */
  #pose(a: Actor, dt: number) {
    const out = this.#flee > 1;
    const goal = out ? { x: TUB.x - 0.2, z: TUB.z + 0.06 } : { x: TUB.x, z: TUB.z };
    const dx = goal.x - a.x;
    const dz = goal.z - a.z;
    const d = Math.hypot(dx, dz);
    const moving = d > 0.015;
    const want = moving ? Math.atan2(dx, dz) : FACE;
    const diff = Math.atan2(Math.sin(want - a.heading), Math.cos(want - a.heading));
    const turn = Math.max(-6 * dt, Math.min(6 * dt, diff));
    a.heading += turn;
    const stepLen = Math.min(d, 0.35 * dt) * Math.max(0, Math.cos(diff));
    if (moving) {
      a.x += (dx / d) * stepLen;
      a.z += (dz / d) * stepLen;
    }
    const walking = (moving && stepLen > 0) || Math.abs(turn) > 0.01;
    const still: PetAction =
      this.step === 'shake' && this.#t < SHAKE_TIME ? 'shake' : this.step === 'done' ? 'happy' : 'stand';
    a.action = walking && still !== 'shake' ? 'walk' : still;
    a.speed = walking ? 0.3 : 0;
    a.v = 0;
    a.wag = this.cat ? (this.#flee > 0 ? 0 : 0.2) : 1;
    a.look = this.#flee > 0 ? Math.sin(this.#t * 9) * 0.6 : 0;
  }

  down(id: number, px: number, py: number): boolean {
    if (!this.#finger && TOOL[this.step]) this.#finger = { id, x: px, y: py, rub: 0 };
    return true;
  }

  move(id: number, px: number, py: number): boolean {
    const f = this.#finger;
    if (f?.id !== id) return true;
    if (this.#onPet(px, py)) f.rub += Math.hypot(px - f.x, py - f.y);
    [f.x, f.y] = [px, py];
    return true;
  }

  up(id: number): boolean {
    if (this.#finger?.id === id) this.#finger = null;
    return true;
  }

  exit(): void {
    const model = this.#host.world.model(this.#host.pet.id);
    model?.setWet(0);
    model?.setFoam([]);
    this.#room = null;
  }
}
