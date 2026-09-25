import { bus, wake } from '$lib/audio.svelte';
import type { Activity, ActivityHost } from './activity';
import { SPIN_RATE, type Actor } from './behavior';
import { Tune } from './bgm';
import { kindOf, trickName, TRICKS, type Pet } from './engine';
import { ROOM } from './layout';
import { chart, lessons, Play, SongClock, type Chart, type Grade, type Result, type RhythmEvent } from './rhythm';
import { drawLane, lane } from './rhythm-draw';
import { buildRoom } from './scene-room';
import { sounds } from './sounds';
import type { SongId } from './songs';
import type { PetAction, TrickId } from './types';

/** ペットは部屋のまん中に座り、カメラは寄って見下ろす。足もとの床の下を見るので、ペットは画面の上半分に入る */
const SPOT = { x: 0, z: 0.2 };
const CAMERA = { x: 0, y: 0.75, z: 1.6, lookX: 0, lookY: -0.05, lookZ: 0.2, fov: 40 };

/** 細長い画面（iPhone）は横が狭いので、同じ向きのまま離れてペットの横幅を収める */
function camera([w, h]: readonly [number, number]) {
  const k = Math.max(1, (0.62 * h) / w);
  const c = CAMERA;
  return { ...c, y: c.lookY + (c.y - c.lookY) * k, z: c.lookZ + (c.z - c.lookZ) * k };
}
/**
 * 端末が教える遅れ（outputLatency・baseLatency）に足す秒。実機で音とノーツがずれて聞こえたら、
 * ここを増やす（音が遅れて聞こえる）か減らす（音が早い）。Bluetooth のイヤホンは 0.15〜0.25 ほど遅れる
 */
const EXTRA_LATENCY = 0;
/** 芸は 1 曲ごとに交互の曲で練習する */
const SONGS: [SongId, number][] = [
  ['lesson', 100],
  ['lesson2', 96]
];
const LABEL: Record<Grade, string> = { great: 'すごい！', good: 'いいね！', near: 'おしい', miss: '' };
const COLOR: Record<Grade, string> = { great: '#ff7a00', good: '#1f9bff', near: '#8a7768', miss: '' };
const COUNT = ['3', '2', '1', 'スタート！'];

export type RhythmPhase = 'ready' | 'play' | 'result';

/**
 * しつけのリズムあそび（しつけのシートの「おしえる」）。曲に合わせて流れてくるノーツを叩き、
 * フレーズをつなげきるとペットがその芸をする。1 曲の成績で覚えた回数が進む。
 * 譜面と判定は rhythm.ts、レーンの絵は rhythm-draw.ts。時計は音があれば AudioContext、無ければ performance
 */
export class RhythmPlay implements Activity {
  readonly drives = true;
  readonly lesson: TrickId;
  phase: RhythmPhase = $state('ready');
  combo = $state(0);
  banner = $state('');
  result: Result | null = $state(null);
  best = $state(0);
  /** ハイスコアを更新した */
  record = $state(false);
  /** この 1 曲で進んだ覚えた回数 */
  gained = $state(0);

  readonly #chart: Chart;
  readonly #song: [SongId, number];
  #host!: ActivityHost;
  #play: Play | null = null;
  #clock: SongClock | null = null;
  #tune: Tune | null = null;
  #t = 0;
  #latency = 0;
  #act: { action: PetAction; t: number } = { action: 'sit', t: 0 };
  #puzzled = 0;

  constructor(trick: TrickId) {
    this.lesson = trick;
    this.#song = SONGS[TRICKS.findIndex((t) => t.id === trick) % 2] ?? SONGS[0];
    this.#chart = chart(trick, this.#song[1]);
    // 確かめる台本（headless Chrome のボット）が譜面と時計を読む口。本番のビルドには入らない
    if (import.meta.env.DEV) Object.assign(globalThis, { __rhythm: this });
  }

  /** 描く回数を 60 に保つのは曲のあいだだけ。遊び方と成績の札のあいだは減らしてよい */
  get smooth(): boolean {
    return this.phase === 'play';
  }

  get pet(): Pet {
    return this.#host.pet;
  }

  get trickName(): string {
    const t = TRICKS.find((k) => k.id === this.lesson);
    return t ? trickName(t, kindOf(this.#host.pet.breed)) : '';
  }

  get chart(): Chart {
    return this.#chart;
  }

  enter(host: ActivityHost): void {
    this.#host = host;
    host.enter({
      id: 'lesson',
      layout: { ...ROOM, front: SPOT, camera: CAMERA },
      follow: { camera: () => camera(host.size), shadow: 1.6 },
      outdoor: false,
      build: (sun) => buildRoom(sun, host.save.contest, host.save.room)
    });
    host.music(null);
    host.setTool('hand');
    this.best = host.pet.best?.[this.lesson] ?? 0;
  }

  begin(): void {
    if (this.phase === 'play') return;
    // はじめるのボタンは盤面の外なので、ここで音を起こす（盤面の指は BoardInput が起こす）
    wake();
    this.#play = new Play(this.#chart);
    this.#clock = new SongClock(-0.6);
    this.#tune = new Tune(...this.#song);
    this.#t = -0.6;
    [this.combo, this.result, this.record, this.gained, this.banner] = [0, null, false, 0, ''];
    this.phase = 'play';
  }

  quit(): void {
    this.#host.end();
  }

  /** いま聞こえている曲の秒。指の出来事のたびにも読み直す（前のフレームの値は最大 1 コマ古い） */
  time(): number {
    const ctx = bus();
    this.#latency = ctx ? Math.min(0.5, (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + EXTRA_LATENCY) : 0;
    const t = this.#clock?.read(ctx ? ctx.currentTime - this.#latency : null, performance.now() / 1000);
    return (this.#t = t ?? this.#t);
  }

  frame(dt: number): void {
    const play = this.#play;
    if (this.phase === 'play' && play) {
      const t = this.time();
      this.#handle(play.advance(t));
      this.#tune?.tick(bus(), t, this.#latency);
      this.#count(t);
      if (t > this.#chart.length + 0.3) this.#finish(play);
    }
    const a = this.#host.actor;
    if (a) this.#pose(a, dt);
  }

  down(id: number, px: number, py: number): boolean {
    if (this.phase === 'play' && this.#play) {
      this.#host.fx.ripple(px, py);
      this.#handle(this.#play.press(id, this.time(), px, py));
    }
    return true;
  }

  move(id: number, px: number, py: number): boolean {
    if (this.phase === 'play' && this.#play) this.#handle(this.#play.drag(id, this.time(), px, py));
    return true;
  }

  up(id: number, px: number, py: number): boolean {
    if (this.phase === 'play' && this.#play) this.#handle(this.#play.release(id, this.time(), px, py));
    return true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.phase === 'play' && this.#play) drawLane(ctx, ...this.#host.size, this.#chart, this.#play, this.#t);
  }

  exit(): void {
    this.#tune?.stop();
    if (import.meta.env.DEV) Object.assign(globalThis, { __rhythm: undefined });
  }

  #handle(events: RhythmEvent[]) {
    const host = this.#host;
    const play = this.#play;
    if (!events.length || !play) return;
    const L = lane(...host.size);
    for (const e of events) {
      if (e.type === 'phrase') {
        if (e.ok) this.#cheer();
        continue;
      }
      if (e.broke && this.combo > 0) this.#puzzled = 1;
      this.combo = play.combo;
      if (e.grade === 'miss') continue;
      host.fx.text(LABEL[e.grade], L.x, L.y - L.r * 1.5, COLOR[e.grade], e.grade === 'near' ? 30 : 40);
      if (e.broke) continue;
      host.fx.particles.burst(L.x, L.y, {
        count: e.grade === 'great' ? 14 : 8,
        color: e.grade === 'great' ? ['#fff6b0', '#ffc233', '#ffffff'] : ['#bfe3ff', '#ffffff'],
        speed: 260,
        size: 5,
        glow: true
      });
      sounds.beat(e.grade === 'great');
    }
  }

  /** フレーズをつなげきった。その芸をして、ハートと鳴き声 */
  #cheer() {
    const host = this.#host;
    const a = host.actor;
    const action = TRICKS.find((t) => t.id === this.lesson)?.action ?? 'happy';
    this.#act = { action, t: action === 'spin' ? 1.6 : 1.8 };
    host.voice('happy');
    sounds.sparkle();
    if (a) host.fx.hearts(...host.above(a), 4);
  }

  /** 1 小節目は 3・2・1 を数え、最後の小節で「おしまい」 */
  #count(t: number) {
    const b = Math.floor(t / this.#chart.beat);
    const text = b < 0 ? '' : b < 4 ? COUNT[b] : b >= 60 ? 'おしまい！' : '';
    if (text !== this.banner) this.banner = text;
  }

  #finish(play: Play) {
    const host = this.#host;
    const pet = host.pet;
    this.#tune?.stop();
    const r = play.result();
    // 実機で音と指のずれを測る手がかり。正なら遅れて叩いている（EXTRA_LATENCY を足す向き）
    console.debug('rhythm offset', r.offset.toFixed(3));
    const before = this.best;
    this.record = r.score > before;
    if (this.record) pet.best = { ...pet.best, [this.lesson]: r.score };
    this.best = Math.max(before, r.score);
    const had = pet.tricks[this.lesson] ?? 0;
    host.praise(this.lesson, lessons(r));
    this.gained = (pet.tricks[this.lesson] ?? 0) - had;
    host.changed();
    this.result = r;
    this.banner = '';
    this.phase = 'result';
    if (r.rank === 'S' || r.rank === 'A') this.#act = { action: 'happy', t: 3 };
  }

  /** 座ってこちらを向き、拍に合わせて体を弾ませ首を振る。コンボが切れたら首をかしげる */
  #pose(a: Actor, dt: number) {
    const beat = this.#t / this.#chart.beat;
    const pulse = this.phase === 'play' && beat >= 0 ? Math.exp(-(beat % 1) * 6) : 0;
    this.#act.t -= dt;
    this.#puzzled -= dt;
    const acting = this.#act.t > 0;
    [a.x, a.z, a.v, a.speed] = [SPOT.x, SPOT.z, 0, 0];
    // おすわりを練習するあいだは立って待つ（座って待つと、芸をしても変わらない）
    a.action = acting ? this.#act.action : this.lesson === 'sit' ? 'stand' : 'sit';
    a.heading = acting && a.action === 'spin' ? a.heading + SPIN_RATE * dt : 0;
    a.y = acting ? 0 : 0.015 * pulse;
    a.wag = acting ? 1 : 0.4 + 0.6 * pulse;
    a.look =
      this.#puzzled > 0
        ? Math.sin(this.#puzzled * 10) * 0.8
        : this.phase === 'play' && beat >= 0
          ? 0.25 * Math.sin(beat * Math.PI)
          : 0;
  }
}
