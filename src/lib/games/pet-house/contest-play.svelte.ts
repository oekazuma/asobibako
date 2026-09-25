import type { Activity, ActivityHost, ActivityScene } from './activity';
import { SPIN_RATE, type Actor, type BehaviorEvent, type Toy } from './behavior';
import {
  ARENA,
  COURSE,
  ENTRY_COST,
  OBEDIENCE_ROUNDS,
  agilityTime,
  award,
  contestOf,
  crossed,
  gateDistance,
  inTunnel,
  orders,
  rivals,
  standings,
  throwPoints,
  trickPoints,
  type Entry
} from './contest';
import { contestSounds as cs } from './contest-sounds';
import { TRICKS, kindOf, trickChance, trickName } from './engine';
import type { Spot } from './layout';
import { buildContest, type Venue } from './scene-contest';
import { sounds } from './sounds';
import type { ContestId, PetAction, TrickId } from './types';

export type Phase = 'intro' | 'count' | 'play' | 'end' | 'result';

/** 審判の立つ所。しつけ大会はペットの左うしろ（頭まで画面に入る遠さ）、ほかの種目はじゃまにならない左の手前 */
const JUDGE = { near: { x: -0.9, z: -3.4 }, side: { x: -2.7, z: 0.6 } };
const RESULT_WAIT = 1.2;
/** フリスビーが落ちぎわに浮いていられる秒 */
const HOVER = 1.5;
/** フリスビー大会で追いかけるときの速さ（m/s）。ふだんは 1.5。4〜5m 先へ投げたフリスビーに空中で追いつける速さ */
const SPRINT = 3;
const REVEAL_EVERY = 0.9;

/**
 * コンテスト 1 回ぶんの進行（説明 → カウントダウン → 競技 → 終わりの合図 → 結果発表）。
 * フリスビーとねこじゃらしはふだんの投げる・振る遊びをそのまま使い（drives が false）、
 * アジリティとしつけはペットの動きをここで書く
 */
export class ContestPlay implements Activity {
  readonly id: ContestId;
  readonly rank: number;
  phase: Phase = $state('intro');
  /** 残りの秒。アジリティは走った秒 */
  clock = $state(0);
  score = $state(0);
  count = $state(3);
  /** 画面のまん中に大きく出す文字 */
  banner = $state('');
  /** アジリティで通った門の数 */
  gate = $state(0);
  /** しつけ大会の何問目か（1 から）と審判の吹き出し */
  round = $state(0);
  judge = $state('');
  /** よい順の順位表と、下から見せた数 */
  board: Entry[] = $state([]);
  shown = $state(0);
  place = $state(0);
  prize: { money: number; trophy: boolean; next: number | null } | null = $state(null);

  #host!: ActivityHost;
  #venue: Venue | null = null;
  #rivals: Entry[] = [];
  #t = 0;
  #toy: Toy | null = null;
  #air = false;
  #scored = false;
  #hover = 0;
  #vy = 0;
  #target: Spot | null = null;
  /** アジリティで押さえている指と、その画面の位置 */
  #finger: { id: number; x: number; y: number } | null = null;
  #jump = 0;
  #last: Spot = { x: 0, z: 0 };
  #orders: TrickId[] = [];
  #step: 'wait' | 'ask' | 'show' = 'wait';
  #show: { action: PetAction; puzzled: boolean } = { action: 'sit', puzzled: false };

  constructor(id: ContestId, rank: number) {
    this.id = id;
    this.rank = rank;
  }

  get drives(): boolean {
    return this.phase !== 'play' || this.id === 'agility' || this.id === 'obedience';
  }

  get contest() {
    return contestOf(this.id);
  }

  get petName(): string {
    return this.#host.pet.name;
  }

  get dog(): boolean {
    return kindOf(this.#host.pet.breed) === 'dog';
  }

  /** しつけ大会でいま言われている芸 */
  get asked(): TrickId | null {
    return this.#step === 'ask' ? (this.#orders[this.round - 1] ?? null) : null;
  }

  enter(host: ActivityHost): void {
    this.#host = host;
    const scene: ActivityScene = {
      id: 'contest',
      layout: ARENA,
      follow: { x: 1.9, zMin: -8, zMax: 3.6, near: 1.9, rate: 1.8, shadow: 2.6 },
      outdoor: true,
      build: () => (this.#venue = buildContest())
    };
    host.enter(scene);
    const v = this.#venue;
    if (this.id === 'agility') v?.course();
    const j = this.id === 'obedience' ? JUDGE.near : JUDGE.side;
    v?.judge(j.x, j.z, ARENA.front.x, ARENA.front.z);
    this.#rivals = rivals(this.id, this.rank, kindOf(host.pet.breed), host.pet.name, Math.random);
    this.#orders = orders(Math.random, undefined, kindOf(host.pet.breed));
    const a = host.actor;
    if (a) [a.x, a.z, a.heading] = [ARENA.front.x, ARENA.front.z, Math.PI];
    host.setTool('hand');
  }

  /** 説明の「はじめる」。ここでげんきを使う */
  begin(): void {
    if (this.phase !== 'intro') return;
    const pet = this.#host.pet;
    pet.stats.energy = Math.max(0, pet.stats.energy - ENTRY_COST);
    this.#host.changed();
    this.phase = 'count';
    this.count = 3;
    this.#t = 0;
    cs.beep();
  }

  quit(): void {
    if (this.phase === 'intro' || this.phase === 'result') this.#host.end();
  }

  frame(dt: number): void {
    this.#t += dt;
    const a = this.#host.actor;
    if (!a) return;
    switch (this.phase) {
      case 'intro':
        return this.#pose(a, 'sit', dt);
      case 'count':
        this.#pose(a, 'stand', dt);
        if (this.#t < 1) return;
        this.#t = 0;
        this.count--;
        if (this.count > 0) return cs.beep();
        return this.#start();
      case 'play':
        if (this.banner && this.#t > 0.9) this.banner = '';
        return this.#play(a, dt);
      case 'end':
        this.#pose(a, 'stand', dt, false);
        if (this.#t > 1.8) this.#results(a);
        return;
      case 'result':
        this.#pose(a, this.place === 1 && this.shown === this.board.length ? 'happy' : 'sit', dt);
        return this.#reveal(a);
    }
  }

  #start() {
    const host = this.#host;
    this.phase = 'play';
    this.#t = 0;
    this.banner = 'スタート！';
    host.music('contest-play');
    cs.go();
    this.#venue?.cheer(0.6);
    cs.applause(0.4);
    if (this.id === 'frisbee') host.setTool('toy', 'frisbee');
    if (this.id === 'wand') host.setTool('toy', 'wand');
    this.clock = this.id === 'agility' ? 0 : this.contest.seconds;
    if (this.id === 'agility') {
      this.#target = null;
      this.#venue?.mark(COURSE[0]);
    }
    if (this.id === 'obedience') {
      this.round = 1;
      this.#step = 'wait';
    }
    // ふだんの頭（think）に戻る種目は、止まったところから動きはじめる
    const a = host.actor;
    if (a) [a.mode, a.t, a.v] = ['idle', 0.5, 0];
  }

  #play(a: Actor, dt: number) {
    if (this.id === 'agility') return this.#agility(a, dt);
    if (this.id === 'obedience') return this.#obedience(a, dt);
    if (this.id === 'frisbee') this.#frisbee(dt);
    // 猫はねこじゃらしに 20 回に 1 回そっぽを向き、指を離すまで遊ばない。大会ではいつも遊ぶ
    if (this.id === 'wand') a.wandPlay = true;
    this.clock = Math.max(0, this.clock - dt);
    if (this.clock <= 0) this.#finish('そこまで！');
  }

  #finish(text: string) {
    const host = this.#host;
    this.phase = 'end';
    this.#t = 0;
    this.banner = text;
    this.judge = '';
    this.#venue?.call(false);
    this.#venue?.mark(null);
    host.view.toy = null;
    host.view.wand = null;
    this.#finger = null;
    if (this.id === 'agility') this.score = agilityTime(this.clock, COURSE.length - this.gate);
    cs.whistle();
    host.music('contest');
    this.#venue?.cheer(0.8);
    cs.applause(0.7);
  }

  #results(a: Actor) {
    const host = this.#host;
    const you: Entry = { name: host.pet.name, score: this.score, you: true };
    this.board = standings([...this.#rivals, you], this.contest.lower);
    // board は $state で包まれて別の物になるので、you そのものでは探せない
    this.place = this.board.findIndex((e) => e.you) + 1;
    this.prize = award(host.save, this.id, this.rank, this.place);
    host.changed();
    this.phase = 'result';
    this.banner = '';
    this.shown = 0;
    this.#t = 0;
    // 結果の札のうしろで、会場のまん中へ呼び戻しておく
    [a.x, a.z, a.heading] = [ARENA.front.x, ARENA.front.z, 0];
    host.music(null);
    cs.drum(RESULT_WAIT * 1000);
  }

  #reveal(a: Actor) {
    const n = this.board.length;
    // ドラムロールとファンファーレのあいだは BGM を止めておき、鳴り終わってから戻す
    if (this.shown >= n && this.#t > RESULT_WAIT + (n - 1) * REVEAL_EVERY + 2.5) this.#host.music('contest');
    if (this.shown >= n || this.#t < RESULT_WAIT + this.shown * REVEAL_EVERY) return;
    this.shown++;
    if (this.shown < n) {
      cs.reveal();
      if (this.shown < n - 1) cs.drum(REVEAL_EVERY * 1000 - 100);
      return;
    }
    const [x, y] = this.#host.above(a);
    if (this.place === 1) {
      cs.fanfare();
      this.#host.fx.confetti(x, y - 40);
      this.#venue?.cheer(1);
      cs.applause(1);
      this.#host.voice('happy');
    } else {
      cs.reveal();
      cs.applause(0.4);
    }
  }

  // --- フリスビー・ねこじゃらし（ふだんの遊びの出来事を数える） ---

  #frisbee(dt: number) {
    const host = this.#host;
    const toy = host.view.toy;
    if (toy !== this.#toy) [this.#toy, this.#air, this.#scored, this.#hover, this.#vy] = [toy, false, false, HOVER, 0];
    // 遊びのモードのあいだは toys.ts の着地の音が回らない。浮いてすべったあとはゆっくり降りるので、弾まない着地も拾う
    if (toy && !toy.holder && this.#vy < -0.02 && toy.vy >= 0 && toy.y < 0.2)
      sounds.bounce('grass', -this.#vy, 'frisbee');
    // ふつうの投げ方では犬がフリスビーに追いつけず、空中でとれない。大会のフリスビーは地面の近くで
    // しばらく浮いてすべるので、ほどよく投げれば犬が空中でとれ、遠くへ投げすぎると地面に落ちる
    if (toy && !toy.holder && !toy.still && toy.y > 0.05 && toy.y < 0.35 && toy.vy < 0 && this.#hover > 0) {
      this.#hover -= dt;
      toy.vy = Math.max(toy.vy, -0.05);
      const k = Math.exp(-1.5 * dt);
      toy.vx *= k;
      toy.vz *= k;
    }
    this.#vy = toy && !toy.holder ? toy.vy : 0;
    // 大会では本気で走る。think は目標の速さへ少しずつしか落とさないので、先に上げておけばその速さで走る
    const me = host.actor;
    if (me?.mode === 'chase' && !this.#scored) me.v = Math.max(me.v, SPRINT);
    if (!toy || toy.holder !== host.pet.id || this.#scored) return;
    this.#scored = true;
    const meters = Math.hypot(toy.x - ARENA.front.x, toy.z - ARENA.front.z);
    const pts = throwPoints(meters, this.#air);
    this.score += pts;
    const a = host.actor;
    if (!a) return;
    const [x, y] = host.above(a);
    host.fx.text(`${meters.toFixed(1)}m  +${pts}`, x, y - 20, '#ff7a00', 40);
    if (this.#air) host.fx.text('くうちゅう キャッチ！', x, y - 70, '#1f9bff', 34);
    this.#venue?.cheer(this.#air ? 1 : 0.5);
    cs.applause(this.#air ? 0.9 : 0.45);
    sounds.coin();
  }

  event(e: BehaviorEvent): boolean {
    if (this.phase !== 'play' || e.petId !== this.#host.pet.id) return false;
    if (e.type === 'caught' && this.id === 'frisbee') {
      this.#air = true;
      sounds.catch();
      return true;
    }
    if (e.type === 'caught' && this.id === 'wand') {
      this.score++;
      const a = this.#host.actor;
      if (a) this.#host.fx.text('+1', ...this.#host.above(a), '#ff7a00', 44);
      this.#venue?.cheer(0.45);
      cs.applause(0.3);
      sounds.catch();
      return true;
    }
    return e.type === 'fetched';
  }

  down(id: number, px: number, py: number): boolean {
    if (this.phase !== 'play') return true;
    if (this.id === 'agility') {
      this.#finger = { id, x: px, y: py };
      this.#aim(px, py);
      this.#host.fx.ripple(px, py);
      return true;
    }
    if (this.id !== 'frisbee') return false;
    const toy = this.#host.view.toy;
    const a = this.#host.actor;
    const fetching = a?.mode === 'chase' || a?.mode === 'carry';
    const near = toy && Math.hypot(toy.x - ARENA.front.x, toy.z - ARENA.front.z) < 1.3;
    if (!toy || (toy.still && !toy.holder && (near || !fetching))) return false;
    this.#host.say('もどって くるまで まってね', 1.5);
    return true;
  }

  move(id: number, px: number, py: number): boolean {
    if (id !== this.#finger?.id) return false;
    [this.#finger.x, this.#finger.y] = [px, py];
    this.#aim(px, py);
    return true;
  }

  up(id: number): boolean {
    if (id !== this.#finger?.id) return false;
    this.#finger = null;
    return true;
  }

  // --- アジリティ（指でさした所へ走らせ、門を順に通す） ---

  #aim(px: number, py: number) {
    const p = this.#host.world.floor(px, py);
    if (!p) return;
    const b = ARENA.bounds;
    this.#target = { x: Math.min(b.x1, Math.max(b.x0, p.x)), z: Math.min(b.z1, Math.max(b.z0, p.z)) };
  }

  #agility(a: Actor, dt: number) {
    this.clock += dt;
    // 指を止めたままでも、カメラが進むぶん指の下の点も先へ動く。押さえているあいだは走りつづける
    if (this.#finger) this.#aim(this.#finger.x, this.#finger.y);
    const gate = COURSE[this.gate];
    const tunnel = inTunnel(a);
    const run = (this.dog ? 2 : 1.8) * (this.#host.pet.stats.energy < 40 ? 0.75 : 1);
    this.#jump = Math.max(0, this.#jump - dt);
    let spin = 0;
    const t = this.#target;
    const d = t ? Math.hypot(t.x - a.x, t.z - a.z) : 0;
    if (t && d > 0.08) {
      const diff = wrap(Math.atan2(t.x - a.x, t.z - a.z) - a.heading);
      const step = Math.max(-7 * dt, Math.min(7 * dt, diff));
      a.heading = wrap(a.heading + step);
      spin = Math.abs(step) / dt;
      const goal = Math.min(tunnel ? 1 : run, d * 3 + 0.4) * Math.max(0.15, Math.cos(diff));
      a.v += Math.max(-6 * dt, Math.min(4 * dt, goal - a.v));
    } else a.v = Math.max(0, a.v - 6 * dt);
    this.#last = { x: a.x, z: a.z };
    const b = ARENA.bounds;
    a.x = Math.min(b.x1, Math.max(b.x0, a.x + Math.sin(a.heading) * a.v * dt));
    a.z = Math.min(b.z1, Math.max(b.z0, a.z + Math.cos(a.heading) * a.v * dt));

    // ハードルの手前で跳ぶ。跳びはじめから体が浮くまで少しかかるので、門の半歩手前で切りかえる
    if (gate?.kind === 'hurdle' && this.#jump <= 0 && a.v > 0.5 && gateDistance(a, gate) < 0.5) {
      const mid = { x: (gate.a.x + gate.b.x) / 2, z: (gate.a.z + gate.b.z) / 2 };
      const toward = Math.sin(a.heading) * (mid.x - a.x) + Math.cos(a.heading) * (mid.z - a.z);
      if (toward > 0) this.#jump = 0.75;
    }
    // トンネルは横から斜めに入っても、中を通って奥の半分まで来たら通ったことにする
    const through = gate?.kind === 'tunnel' ? tunnel && a.z < gate.a.z : gate && crossed(this.#last, a, gate);
    if (through) this.#pass(a);

    const moving = a.v > 0.05 || spin > 1;
    a.action = this.#jump > 0 ? 'jump' : tunnel ? 'down' : !moving ? 'stand' : a.v > 0.9 ? 'run' : 'walk';
    a.speed = moving ? Math.min(1, Math.max(0.3, a.v / 1.5)) : 0;
    a.wag = 0.9;
    a.look = 0;
    if (this.phase === 'play' && this.clock >= this.contest.seconds) this.#finish('タイム アップ');
  }

  #pass(a: Actor) {
    const host = this.#host;
    this.gate++;
    const [x, y] = host.above(a);
    const done = this.gate >= COURSE.length;
    host.fx.sparkle(x, y, 6);
    host.fx.text(done ? 'ゴール！' : 'ナイス！', x, y - 30, '#ff7a00', 38);
    sounds.sparkle();
    this.#venue?.cheer(done ? 1 : 0.5);
    cs.applause(done ? 0.9 : 0.35);
    if (done) return this.#finish('ゴール！');
    this.#venue?.mark(COURSE[this.gate]);
  }

  // --- しつけ大会（審判が言う芸をすぐに出す） ---

  #obedience(a: Actor, dt: number) {
    const puzzled = this.#step === 'show' && this.#show.puzzled;
    this.#pose(a, this.#step === 'show' ? this.#show.action : 'sit', dt);
    if (puzzled) a.look = Math.sin(this.#t * 10) * 0.8;
    if (this.#step === 'wait' && this.#t > 1.2) {
      this.#step = 'ask';
      this.#t = 0;
      const trick = TRICKS.find((k) => k.id === this.#orders[this.round - 1]);
      this.judge = `「${trick ? trickName(trick, this.dog ? 'dog' : 'cat') : ''}」！`;
      this.#venue?.call(true);
      cs.beep();
    } else if (this.#step === 'ask' && this.#t > 5) {
      this.#judged('じかん ぎれ…', 'sit', true);
      cs.miss();
    } else if (this.#step === 'show' && this.#t > 1.8) {
      if (this.round >= OBEDIENCE_ROUNDS) return this.#finish('そこまで！');
      this.round++;
      this.#step = 'wait';
      this.#t = 0;
      this.judge = '';
    }
  }

  #judged(text: string, action: PetAction, puzzled: boolean) {
    this.judge = text;
    this.#venue?.call(false);
    this.#step = 'show';
    this.#t = 0;
    this.#show = { action, puzzled };
  }

  trick(trick: TrickId): void {
    const asked = this.asked;
    const host = this.#host;
    const a = host.actor;
    if (this.phase !== 'play' || !asked || !a) return;
    const took = this.#t;
    const ok = Math.random() < trickChance(host.pet, trick);
    const action = TRICKS.find((k) => k.id === trick)?.action ?? 'sit';
    const [x, y] = host.above(a);
    if (ok && trick === asked) {
      const pts = trickPoints(true, took);
      this.score += pts;
      this.#judged(pts >= 18 ? 'すばらしい！' : 'よく できました', action, false);
      host.fx.text(`+${pts}`, x, y - 20, '#ff7a00', 44);
      host.fx.sparkle(x, y, 4);
      this.#venue?.cheer(0.6);
      cs.applause(0.5);
      sounds.sparkle();
      return;
    }
    this.#judged(ok ? 'ちがう げいだよ' : 'ざんねん…', ok ? action : 'stand', !ok);
    host.fx.text('？', x, y, '#1f9bff', 44);
    cs.miss();
  }

  /** その場で止まり、カメラの方を向いてかっこうをとる */
  #pose(a: Actor, action: PetAction, dt: number, face = true) {
    a.v = 0;
    a.speed = 0;
    a.action = action;
    a.wag = action === 'happy' ? 1 : 0.5;
    a.look = 0;
    if (action === 'spin') return void (a.heading = wrap(a.heading + SPIN_RATE * dt));
    if (!face) return;
    const cam = ARENA.camera;
    const diff = wrap(Math.atan2(cam.x - a.x, cam.z - a.z) - a.heading);
    const step = Math.max(-4 * dt, Math.min(4 * dt, diff));
    a.heading = wrap(a.heading + step);
    if (Math.abs(step) > 0.02 && action !== 'happy') [a.action, a.speed] = ['walk', 0.3];
  }

  exit(): void {
    this.#venue = null;
  }
}

const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
