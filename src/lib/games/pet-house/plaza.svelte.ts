import { graphics } from '$lib/graphics.svelte';
import type { SceneHost, Visit } from './activity';
import { command, createActor, think, throwToy, type Actor, type BehaviorEvent } from './behavior';
import { BREED_IDS, BREEDS } from './breeds';
import { speakAt, type Cry } from './cries';
import { day, kindOf, type Pet } from './engine';
import type { Layout, Spot } from './layout';
import { loadShapes } from './models';
import { buildPlaza, plazaLayout } from './scene-plaza';
import { sounds } from './sounds';
import type { BreedId, Kind, PetAction } from './types';

export type Step = 'look' | 'name';

const START: Spot[] = [
  { x: -0.9, z: -0.4 },
  { x: 0.9, z: -0.9 },
  { x: -0.2, z: -1.7 },
  { x: 1.2, z: -2.4 },
  { x: -1.2, z: -2.7 },
  { x: 0.3, z: -3.3 },
  { x: -0.7, z: -4.2 },
  { x: 1.0, z: -4.4 }
];
/** 寄ったときのカメラ。ペットの手前 back m、高さ y から見下ろす */
const CLOSE = { y: 0.95, back: 1.55 };
const idOf = (breed: BreedId) => `plaza:${breed}`;

/**
 * ひろばに出す子。全部の種類を一度に出すと重いので、犬と猫を START の数の半分ずつ選んで交互に並べる。
 * 飼っていない種類と、いま出ていない種類（「ほかの子たち」で入れ替えたとき）を先に選ぶ
 */
export function roster(owned: readonly BreedId[], shown: readonly BreedId[], rng: () => number): BreedId[] {
  const pick = (kind: Kind) =>
    BREED_IDS.filter((b) => BREEDS[b].kind === kind)
      .map((b) => ({ b, k: (owned.includes(b) ? 2 : 0) + (shown.includes(b) ? 1 : 0) + rng() }))
      .sort((x, y) => x.k - y.k)
      .slice(0, START.length / 2)
      .map((e) => e.b);
  const cats = pick('cat');
  return pick('dog').flatMap((dog, i) => [dog, cats[i]]);
}

/**
 * ふれあいひろば。柵の中で 8 匹の子犬・子猫（まだ誰のペットでもない。save には入れない）が遊び、
 * さわった子にカメラが寄る。なでる・ボールを投げる（犬）・ねこじゃらし（猫）で遊んでから、
 * 「この子に する」で名前の画面へ進む。むかえる手続き（お金と save）は画面が Session で行う
 */
export class Plaza implements Visit {
  readonly drives = true;
  /** 寄って見ている子 */
  focus: BreedId | null = $state(null);
  step: Step = $state('look');
  /** 「ほかの子たち」で入れ替えているあいだ。形を組み立てるあいだ止まるので、先に知らせを描かせる */
  swapping = $state(false);
  #swapIn = 0;

  #host!: SceneHost;
  #stage = plazaLayout();
  #cam = { ...this.#stage.camera };
  /** think に渡す置き場所。おもちゃを持ってくる front を寄った子の前にし、ペットが見上げる camera をいまのカメラにする */
  #brain: Layout = { ...this.#stage, front: { ...this.#stage.front }, camera: this.#cam };
  // 入れ替えるときも同じ配列の中身を替える（host.cast に渡した配列を Session がそのまま読む）
  #pets: Pet[] = [];
  #actors: Actor[] = [];
  #finger: { id: number; x: number; y: number; rub: number; mode: 'rub' | 'floor' } | null = null;
  #wand = { x: 0, z: 0, tx: 0, tz: 0, on: false };
  #timers = { heart: 0, purr: 0, bark: 2, visit: 5, frolic: 3 };
  #pair: { a: Actor; b: Actor; t: number; on: boolean } | null = null;
  #vy = 0;

  // 「ほかの子たち」でどの種類が出るか分からないので、全種類ぶんの形を読んでおく
  prepare(): Promise<unknown> {
    return loadShapes(BREED_IDS, graphics.quality);
  }

  enter(host: SceneHost): void {
    this.#host = host;
    host.enter({
      id: 'plaza',
      layout: this.#stage,
      follow: { camera: (dt) => this.#aim(dt), shadow: 4.8 },
      outdoor: true,
      build: buildPlaza
    });
    this.#fill(
      roster(
        host.save.pets.map((p) => p.breed),
        [],
        Math.random
      )
    );
    host.cast(this.#pets, this.#actors);
    host.setTool('hand');
  }

  #fill(breeds: BreedId[]) {
    const pets = breeds.map((breed) => ({
      id: idOf(breed),
      breed,
      name: '',
      stats: { food: 100, water: 100, clean: 100, energy: 100 },
      love: 1,
      tricks: {},
      accessory: null,
      since: day(Date.now())
    }));
    this.#pets.splice(0, Infinity, ...pets);
    this.#actors.splice(0, Infinity, ...pets.map((p, i) => createActor(p, START[i])));
    for (const a of this.#actors) a.heading = Math.random() * 6;
  }

  /** 「ほかの子たち」。いどうちゅうと同じく、知らせを 1 度描かせてから入れ替える */
  others(): void {
    if (this.swapping) return;
    this.back();
    this.#pair = null;
    this.swapping = true;
    this.#swapIn = 2;
  }

  get dog(): boolean {
    return !!this.focus && kindOf(this.focus) === 'dog';
  }

  #me(): Actor | undefined {
    return this.focus ? this.#actors.find((a) => a.petId === idOf(this.focus as BreedId)) : undefined;
  }

  #voice(a: Actor, cry: Cry) {
    speakAt(this.#host.fx, this.#pet(a).breed, cry, this.#host.above(a));
  }

  #pet(a: Actor): Pet {
    return this.#pets.find((p) => p.id === a.petId) ?? this.#pets[0];
  }

  #look(a: Actor) {
    const pet = this.#pet(a);
    this.focus = pet.breed;
    this.#stopPlay();
    this.#brain.front = { x: a.x, z: a.z };
    if (this.#pair && (this.#pair.a === a || this.#pair.b === a)) this.#pair = null;
    command(a, pet, { type: 'call', to: { x: a.x, z: a.z + 0.05 } });
  }

  /** 「ほかの子を 見る」 */
  back(): void {
    this.focus = null;
    this.step = 'look';
    this.#stopPlay();
  }

  /** 「この子に する」で名前、名前を決めたら呼んで覚えさせる。もどると 'look' */
  go(step: Step): void {
    if (this.focus) this.step = step;
  }

  end(): void {
    this.#host.end();
  }

  #stopPlay() {
    this.#host.view.toy = null;
    this.#wand.on = false;
    this.#finger = null;
  }

  frame(dt: number): void {
    if (this.swapping && --this.#swapIn <= 0) {
      if (this.#swapIn === 0)
        this.#fill(
          roster(
            this.#host.save.pets.map((p) => p.breed),
            this.#pets.map((p) => p.breed),
            Math.random
          )
        );
      else this.swapping = false;
    }
    const host = this.#host;
    const view = host.view;
    const me = this.#me();
    const camera = { x: this.#cam.x, z: this.#cam.z };
    // 投げたおもちゃとねこじゃらしは、寄って見ている子だけが追う
    for (const a of this.#actors) {
      if (a === me) continue;
      if (view.toy) a.seen = view.toy;
      a.wandPlay = false;
    }
    if (me && me.mode === 'idle' && !view.toy && !view.wand) {
      me.t = Math.max(me.t, 1);
      me.gaze = camera;
    }
    this.#stepWand(dt);
    this.#rub(dt);
    this.#social(dt);
    for (const e of think(this.#actors, this.#pets, { ...view, layout: this.#brain }, dt, Math.random)) this.#event(e);
    // 遊びのモードのあいだは toys.ts の弾む音が回らないので、ここで床に当たった瞬間（落ちる速さが上向きに変わった）に鳴らす
    const toy = view.toy;
    if (toy && !toy.holder && this.#vy < -0.5 && toy.vy >= 0 && toy.y < 0.2) sounds.bounce('grass', -this.#vy);
    this.#vy = toy && !toy.holder ? toy.vy : 0;
  }

  #event(e: BehaviorEvent) {
    const a = this.#actors.find((x) => x.petId === e.petId);
    if (!a) return;
    const fx = this.#host.fx;
    const [x, y] = this.#host.above(a);
    if (e.type === 'voice') {
      this.#voice(a, e.cry ?? 'happy');
      fx.note(x, y);
    } else if (e.type === 'fetched') {
      fx.hearts(x, y, 4);
      fx.text('よく できました！', x, y - 30);
    } else if (e.type === 'caught') {
      sounds.catch();
      fx.sparkle(x, y, 4);
    }
  }

  // --- カメラ ---

  #aim(dt: number): Layout['camera'] {
    const [w, h] = this.#host.size;
    const narrow = w / h < 0.6;
    const me = this.#me();
    const base = plazaLayout().camera;
    // 下の札が画面をふさぐぶん、ペットの少し手前を見て体を画面の上へ寄せる。細い画面ほど札が高い
    const ahead = narrow ? 0.6 : this.step === 'look' ? 0.15 : 0.45;
    const want = me
      ? {
          x: me.x,
          y: CLOSE.y + (narrow ? 0.1 : 0),
          z: me.z + CLOSE.back + (narrow ? 0.35 : 0),
          lookX: me.x,
          lookY: 0.2,
          lookZ: me.z + ahead,
          fov: narrow ? 48 : 40
        }
      : { ...base, y: base.y + (narrow ? 0.9 : 0), z: base.z + (narrow ? 1.6 : 0), fov: narrow ? 58 : 50 };
    // ねこじゃらしを振るあいだは止める。動くと、止めた指の下の床の点まで流れてしまう
    const k = this.#host.view.wand ? 0 : 1 - Math.exp(-3 * dt);
    const c = this.#cam;
    for (const key of ['x', 'y', 'z', 'lookX', 'lookY', 'lookZ', 'fov'] as const) c[key] += (want[key] - c[key]) * k;
    return c;
  }

  // --- 指 ---

  down(id: number, px: number, py: number): boolean {
    if (this.#finger || this.step !== 'look') return true;
    const hit = this.#host.world.pick(px, py);
    const a = this.#actors.find((x) => x.petId === hit);
    const me = this.#me();
    if (a && a !== me) {
      this.#look(a);
      return true;
    }
    if (!me) return true;
    this.#finger = { id, x: px, y: py, rub: 0, mode: a ? 'rub' : 'floor' };
    if (!a && !this.dog) this.#aimWand(px, py, true);
    return true;
  }

  move(id: number, px: number, py: number): boolean {
    const f = this.#finger;
    if (id !== f?.id) return true;
    const d = Math.hypot(px - f.x, py - f.y);
    [f.x, f.y] = [px, py];
    if (f.mode === 'rub' && this.#host.world.pick(px, py) === this.#me()?.petId) f.rub += d;
    if (f.mode === 'floor' && !this.dog) this.#aimWand(px, py, false);
    return true;
  }

  up(id: number, px: number, py: number, vx: number, vy: number): boolean {
    const f = this.#finger;
    if (id !== f?.id) return true;
    this.#finger = null;
    this.#wand.on = false;
    if (f.mode === 'floor' && this.dog) this.#throw(px, py, vx, vy);
    return true;
  }

  #rub(dt: number) {
    const t = this.#timers;
    for (const k of ['heart', 'purr', 'bark'] as const) t[k] -= dt;
    const f = this.#finger;
    const me = this.#me();
    if (f?.mode !== 'rub' || !me) return;
    const amount = Math.min(f.rub / (this.#host.size[1] * 0.3), dt * 2);
    f.rub = 0;
    if (amount <= 0) return;
    const pet = this.#pet(me);
    command(me, pet, { type: 'stroke' });
    const fx = this.#host.fx;
    if (t.heart <= 0) {
      t.heart = 0.22;
      fx.hearts(f.x, f.y - 20);
    }
    if (!this.dog && t.purr <= 0) {
      t.purr = 1.05;
      this.#voice(me, 'purr');
    }
    if (this.dog && t.bark <= 0) {
      t.bark = 2.5 + Math.random() * 2;
      this.#voice(me, 'happy');
      fx.note(...this.#host.above(me));
    }
  }

  /** はじいた向きへボールを投げる。遠くへ行きすぎないよう、公園より弱く飛ばす */
  #throw(px: number, py: number, vx: number, vy: number) {
    const me = this.#me();
    const world = this.#host.world;
    const h = this.#host.size[1];
    const speed = Math.hypot(vx, vy) / h;
    const at = world.floor(px, py);
    const ahead = world.floor(px + vx * 0.05, py + vy * 0.05);
    if (!me || speed < 0.35 || !at || !ahead) return;
    const len = Math.hypot(ahead.x - at.x, ahead.z - at.z) || 1;
    const v = Math.min(0.6 + speed * 1.2, 3.5);
    const up = Math.max(0, -vy / h);
    this.#host.view.toy = throwToy(
      'ball',
      { x: me.x, y: 0.55, z: me.z + 0.6 },
      { x: ((ahead.x - at.x) / len) * v, y: Math.min(1 + up * 0.35, 2.2), z: ((ahead.z - at.z) / len) * v }
    );
    sounds.throw('ball');
  }

  #aimWand(px: number, py: number, start: boolean) {
    const p = this.#host.world.floor(px, py);
    if (!p) return;
    const b = this.#stage.bounds;
    const w = this.#wand;
    w.tx = Math.min(b.x1, Math.max(b.x0, p.x));
    w.tz = Math.min(b.z1, Math.max(b.z0, p.z));
    if (start) [w.x, w.z] = [w.tx, w.tz];
    w.on = true;
  }

  #stepWand(dt: number) {
    const w = this.#wand;
    const view = this.#host.view;
    if (!w.on) {
      view.wand = null;
      return;
    }
    const k = 1 - Math.exp(-6 * dt);
    const dx = (w.tx - w.x) * k;
    const dz = (w.tz - w.z) * k;
    w.x += dx;
    w.z += dz;
    view.wand = { x: w.x, z: w.z, moving: Math.hypot(dx, dz) / dt > 0.12 };
  }

  // --- ほかの子どうし ---

  /** ときどき 1 匹がこちらへ寄ってきて、ときどき 2 匹がじゃれ合って追いかけっこする */
  #social(dt: number) {
    const t = this.#timers;
    const me = this.#me();
    const free = this.#actors.filter((a) => a !== me && a.mode === 'idle');
    t.visit -= dt;
    if (t.visit <= 0 && !me && free.length) {
      t.visit = 7 + Math.random() * 6;
      const a = free[Math.floor(Math.random() * free.length)];
      command(a, this.#pet(a), { type: 'call', to: { x: (Math.random() - 0.5) * 1.6, z: 0.5 } });
    }
    const p = this.#pair;
    if (!p) {
      t.frolic -= dt;
      if (t.frolic > 0 || free.length < 2) return;
      t.frolic = 6 + Math.random() * 5;
      const a = free[Math.floor(Math.random() * free.length)];
      const b = this.#actors
        .filter((o) => o !== a && o !== me && !o.carrying)
        .reduce((m, o) => (Math.hypot(o.x - a.x, o.z - a.z) < Math.hypot(m.x - a.x, m.z - a.z) ? o : m));
      this.#pair = { a, b, t: 8, on: false };
      command(a, this.#pet(a), { type: 'call', to: { x: b.x + 0.45, z: b.z } });
      return;
    }
    p.t -= dt;
    const d = Math.hypot(p.a.x - p.b.x, p.a.z - p.b.z);
    if (!p.on && p.a.mode === 'idle' && d < 0.9) {
      p.on = true;
      p.t = 2.4;
    }
    if (p.on) {
      const first = p.t > 1.2;
      this.#frolic(p.a, p.b, first ? 'pounce' : 'jump', dt);
      this.#frolic(p.b, p.a, first ? 'roll' : 'paw', dt);
    }
    if (p.t > 0) return;
    this.#pair = null;
    if (!p.on) return;
    // じゃれたあとは、片方が逃げてもう片方が追いかける
    const b = this.#stage.bounds;
    const run = { x: b.x0 + 0.3 + Math.random() * (b.x1 - b.x0 - 0.6), z: b.z0 + 0.5 + Math.random() * 4 };
    command(p.b, this.#pet(p.b), { type: 'call', to: run });
    command(p.a, this.#pet(p.a), { type: 'call', to: { x: run.x + 0.5, z: run.z + 0.2 } });
  }

  #frolic(a: Actor, other: Actor, pose: PetAction, dt: number) {
    if (a === this.#me()) return;
    Object.assign(a, { mode: 'act', pose, t: 0.2, next: 'idle', show: false, puzzled: false, wag: 1 });
    const want = Math.atan2(other.x - a.x, other.z - a.z);
    const diff = Math.atan2(Math.sin(want - a.heading), Math.cos(want - a.heading));
    a.heading += Math.max(-5 * dt, Math.min(5 * dt, diff));
  }
}
