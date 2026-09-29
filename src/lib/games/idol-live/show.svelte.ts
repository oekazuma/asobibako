import { bus } from '$lib/audio.svelte';
import { CONFETTI, Floaters, label, Particles } from '$lib/fx';
import { SongClock } from '$lib/music/clock';
import { Tune } from '$lib/music/tune';
import { APPROACH, SPECIAL_APPROACH, type Kind, type Note, type Track, type V3 } from './chart';
import type { Face, Pose } from './dance';
import { Judge, type Grade, type Judged, type Result } from './judge';
import { drawCrowd } from './crowd-draw';
import { drawNotes } from './notes-draw';
import type { Coord } from './outfits';
import { APPEAL, cameraAt, place, project, radiusOf, timeline } from './shots';
import { sounds } from './sounds';
import { LiveView } from './view3d';

/**
 * 1 曲のライブ。曲の時計・判定・3D のアイドルとステージ・画面にかぶせるノーツと演出をつなぐ。
 * 時計は音が鳴っていれば AudioContext、ミュート中は performance で進み、どちらでも最後まで遊べる
 */

/**
 * 端末が教える遅れ（outputLatency・baseLatency）に足す秒。実機で音とノーツがずれて聞こえたら、
 * ここを増やす（音が遅れて聞こえる）か減らす（音が早い）
 */
const EXTRA_LATENCY = 0;
/** 曲が始まるまでの秒 */
const LEAD = 1.2;
/** 陽向ミオのカラー */
export const COLOR = '#ff6fa5';
const LABEL: Record<Grade, [string, string]> = {
  perfect: ['PERFECT', '#ffae00'],
  great: ['GREAT', '#ff5c9a'],
  good: ['GOOD', '#3f9bff'],
  miss: ['MISS', '#9a8aa8']
};
const BURST: Record<Grade, string[]> = {
  perfect: ['#fff6b0', '#ffc233', '#ffffff'],
  great: ['#ffc2dc', '#ff6fa5', '#ffffff'],
  good: ['#bfe3ff', '#ffffff'],
  miss: []
};
const HINT: Record<Kind, string> = {
  tap: 'わっかが かさなったら タッチ！',
  hold: 'ながい うたの あいだ おしたまま！',
  slide: 'ひかりの たまを ゆびで おいかけて！',
  special: 'スペシャル！ どこでも タッチ！'
};
/** この数ごとのコンボで、大きな文字と紙吹雪 */
const MILESTONE = 20;

/** 1 曲ぶんの支度 */
export interface Setup {
  track: Track;
  coord: Coord;
  bonus: number;
  /** むずかしさで選んだ譜面 */
  notes: Note[];
  /** 知らせを出す（慣れるまで） */
  coach: boolean;
}

export class Show {
  score = $state(0);
  hype = $state(0.35);
  over = $state(false);
  readonly judge: Judge;
  readonly #view: LiveView;
  readonly #notes: Note[];
  readonly #keys: ReturnType<typeof timeline>;
  readonly #bonus: number;
  readonly #onend: (r: Result) => void;
  readonly #onhint: ((text: string) => void) | undefined;
  /** まだ知らせていないノーツの種類。慣れるまでのライブだけ、初めて出たときに画面の上で知らせる */
  #unhinted: Kind[];
  #hintUntil = Infinity;
  readonly #clock = new SongClock(-LEAD);
  readonly #track: Track;
  readonly #tune: Tune;
  readonly #particles = new Particles();
  readonly #floaters = new Floaters();
  #t = -LEAD;
  #latency = 0;
  #size: [number, number] = [820, 1180];
  #pose: Pose;
  /** きめたスペシャルの拍（描くたびに読むだけなので、画面の状態にはしない） */
  readonly #specials: number[] = [];
  #face: { face: Face; left: number } | null = null;
  #cutin = 0;
  #big: { text: string; age: number } | null = null;
  #sparkle = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(o: Setup & { onend: (r: Result) => void; onhint?: (text: string) => void }) {
    this.#track = o.track;
    this.#notes = o.notes;
    this.judge = new Judge(place(o.track, o.notes, ...this.#size), radiusOf(...this.#size));
    this.#tune = new Tune(o.track.def.music, o.track.def.bpm);
    this.#pose = o.track.figure(0);
    this.#view = new LiveView(o.coord);
    this.#keys = timeline(o.track);
    this.#bonus = o.bonus;
    this.#onend = o.onend;
    this.#onhint = o.onhint;
    this.#unhinted = o.coach ? (Object.keys(HINT) as Kind[]) : [];
    // 確かめる台本（headless Chrome のボット）が譜面と時計を読む口。本番のビルドには入らない
    if (import.meta.env.DEV) Object.assign(globalThis, { __live: this });
  }

  get combo(): number {
    return this.judge.combo;
  }

  /** いま聞こえている曲の秒。指の出来事のたびにも読み直す */
  time(): number {
    const ctx = bus();
    this.#latency = ctx ? Math.min(0.5, (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + EXTRA_LATENCY) : 0;
    return (this.#t = this.#clock.read(ctx ? ctx.currentTime - this.#latency : null, performance.now() / 1000));
  }

  frame(dt: number, w: number, h: number): void {
    if (w !== this.#size[0] || h !== this.#size[1]) {
      // ノーツは画面の大きさで置く位置が変わるので、置きなおす（判定はそのまま）
      this.#size = [w, h];
      this.judge.relayout(place(this.#track, this.#notes, w, h), radiusOf(w, h));
    }
    const t = this.time();
    if (!this.over) {
      this.#coach(t);
      this.#react(this.judge.advance(t));
      this.#tune.tick(bus(), t, this.#latency);
      if (t > this.#track.length * this.#track.beat + 0.6) this.#end();
    }
    const beat = t / this.#track.beat;
    const sec = this.#track.sectionAt(Math.max(0, beat));
    this.#pose = this.#track.figure(beat);
    cameraAt(this.#view.camera, this.#track, this.#keys, beat, w / h, this.#specials);
    this.#view.update(
      this.#pose,
      this.#mood(beat) ?? this.#pose.face,
      this.#track.voice(beat),
      {
        beat,
        scene: this.over ? 'finale' : sec.scene,
        hype: this.hype,
        lit: this.#specials.includes(sec.from),
        color: COLOR
      },
      dt
    );
    this.#particles.step(dt);
    this.#floaters.step(dt);
    this.#cutin = Math.max(0, this.#cutin - dt);
    if (this.#face && (this.#face.left -= dt) < 0) this.#face = null;
    if (this.#big && (this.#big.age += dt) > 1.6) this.#big = null;
    this.#glitter(dt, w);
  }

  down(id: number, sx: number, sy: number): void {
    if (this.over) return;
    this.#particles.burst(sx, sy, { count: 6, color: '#ffffff', speed: 160, size: 4, life: 0.3, glow: true });
    this.#react(this.judge.press(id, this.time(), sx, sy));
  }

  move(id: number, sx: number, sy: number): void {
    this.judge.move(id, sx, sy);
  }

  up(id: number): void {
    if (!this.over) this.#react(this.judge.release(id, this.time()));
  }

  stop(): void {
    this.#tune.stop();
    this.#view.dispose();
    clearTimeout(this.#timer);
    this.#onhint?.('');
    if (import.meta.env.DEV) Object.assign(globalThis, { __live: undefined });
  }

  /** 3D を描き、ctx（3D の上にかぶせた透明な canvas）にノーツと演出を描く */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.#view.render(w, h);
    ctx.clearRect(0, 0, w, h);
    // ミスが続いてもりあがりが落ちると、ステージが少し暗くなる
    if (this.hype < 0.3) {
      ctx.fillStyle = `rgba(10, 0, 30, ${(0.3 - this.hype) * 1.2})`;
      ctx.fillRect(0, 0, w, h);
    }
    const rig = this.#view.idol.rig;
    const hand = (s: 'L' | 'R') => this.#screen(rig.at(`hand${s}`));
    drawCrowd(ctx, w, h, this.#t / this.#track.beat, this.hype, COLOR);
    drawNotes(ctx, { t: this.#t, beat: this.#track.beat, hands: [hand('L'), hand('R')] }, this.judge);
    this.#particles.draw(ctx);
    this.#floaters.draw(ctx);
    this.#overlay(ctx, w, h, this.judge.radius / 0.075);
  }

  #screen(p: { x: number; y: number; z: number } | V3): [number, number] {
    const v: V3 = Array.isArray(p) ? p : [p.x, p.y, p.z];
    return project(this.#view.camera, v, ...this.#size);
  }

  /** その種類のノーツが初めて見えたら知らせ、そのノーツが終わったら消す */
  #coach(t: number) {
    if (t > this.#hintUntil) {
      this.#hintUntil = Infinity;
      this.#onhint?.('');
    }
    for (const kind of this.#unhinted) {
      const n = this.judge.notes.find((m) => m.kind === kind);
      if (!n || t < n.t - (kind === 'special' ? SPECIAL_APPROACH : APPROACH) * this.#track.beat) continue;
      this.#unhinted = this.#unhinted.filter((k) => k !== kind);
      this.#onhint?.(HINT[kind]);
      this.#hintUntil = n.end + 0.4;
    }
  }

  /** 表情。スペシャルをきめた直後は目がきらきら、ミスの直後はきりっと。もりあがらないと笑顔が控えめ */
  #mood(beat: number): Face | undefined {
    for (const s of this.#specials) if (beat - s >= 0 && beat - s < APPEAL) return 'star';
    if (this.#face) return this.#face.face;
    const f = this.#pose.face;
    return this.hype < 0.25 && f === 'happy' ? 'smile' : undefined;
  }

  #react(events: Judged[]) {
    const [w, h] = this.#size;
    const k = this.judge.radius / 0.075;
    for (const e of events) {
      const n = this.judge.notes[e.note];
      const [x, y] = [e.x, e.y];
      this.score = Math.round(this.judge.score);
      this.hype = this.judge.hype;
      if (n.kind === 'special') this.#special(Math.round(n.t / this.#track.beat), e.grade !== 'miss', x, y, k);
      const [text, color] = LABEL[e.grade];
      // 胸のノーツの判定は顔にかぶるので頭の上に出す。スペシャルはカットインが知らせる
      const top =
        n.shape === 'heart' ? Math.min(y, this.#screen(this.#view.idol.rig.at('head'))[1] - k * 0.12) : y - k * 0.1;
      if (n.kind !== 'special') this.#floaters.add(text, x, top, k * (e.grade === 'miss' ? 0.07 : 0.09), color);
      if (e.grade === 'miss') {
        this.#face = { face: 'focus', left: 0.8 };
        continue;
      }
      sounds.hit(e.grade);
      if (n.kind === 'hold' || n.kind === 'slide') sounds.sweep();
      this.#particles.burst(x, y, {
        count: e.grade === 'perfect' ? 18 : 10,
        color: BURST[e.grade],
        speed: k * 0.9,
        size: k * 0.014,
        life: 0.55,
        glow: true
      });
      const c = this.judge.combo;
      if (c && c % MILESTONE === 0) this.#milestone(c, w, h, k);
      else if (e.grade === 'perfect' && this.hype > 0.7 && !this.#face) this.#face = { face: 'happy', left: 0.5 };
    }
  }

  #special(beat: number, ok: boolean, x: number, y: number, k: number) {
    if (!ok) return;
    this.#specials.push(beat);
    sounds.special();
    this.#cutin = 1.5;
    const [w, h] = this.#size;
    for (let i = 0; i < 6; i++)
      this.#particles.burst(w * (0.15 + 0.14 * i), h * (0.18 + 0.12 * (i % 2)), {
        count: 26,
        color: CONFETTI,
        speed: k * 1.4,
        size: k * 0.012,
        life: 1.2,
        gravity: k * 1.2,
        glow: true
      });
    this.#particles.burst(x, y, {
      count: 40,
      color: ['#fff6b0', '#ffffff', '#ff6fa5'],
      speed: k * 2,
      size: k * 0.02,
      life: 0.9,
      glow: true
    });
  }

  #milestone(c: number, w: number, h: number, k: number) {
    this.#big = { text: `${c} COMBO!`, age: 0 };
    this.#face = { face: 'star', left: 1 };
    sounds.cheer(0.7);
    for (const s of [0, 1])
      this.#particles.burst(s ? w : 0, h * 0.5, {
        count: 40,
        color: CONFETTI,
        speed: k * 1.6,
        size: k * 0.012,
        life: 1.4,
        gravity: k * 1.3,
        angle: s ? Math.PI * 1.25 : -Math.PI * 0.25,
        spread: 0.9
      });
  }

  /** もりあがると降るきらきらと、ホールドを押さえているあいだの光の粒 */
  #glitter(dt: number, w: number) {
    this.#sparkle += dt * (this.hype > 0.6 ? (this.hype - 0.6) * 40 : 0);
    while (this.#sparkle > 1) {
      this.#sparkle -= 1;
      this.#particles.burst(Math.random() * w, -10, {
        count: 1,
        color: ['#fff6b0', '#ffffff', '#ffc2dc'],
        speed: 60,
        size: 4,
        life: 2.5,
        gravity: 120,
        glow: true,
        angle: Math.PI / 2,
        spread: 0.6
      });
    }
    const k = this.judge.radius / 0.075;
    this.judge.notes.forEach((n, i) => {
      if (!this.judge.holding(i) || Math.random() > dt * 30) return;
      const [x, y] = [n.x, n.y];
      this.#particles.burst(x, y, {
        count: 2,
        color: ['#fff6b0', '#ffffff'],
        speed: k * 0.5,
        size: k * 0.012,
        life: 0.5,
        glow: true,
        angle: -Math.PI / 2,
        spread: 1.4
      });
    });
  }

  /** 画面の上にかぶせる文字。コンボ・大きなコンボ・スペシャルのカットイン */
  #overlay(ctx: CanvasRenderingContext2D, w: number, h: number, k: number) {
    const c = this.judge.combo;
    if (c >= 5 && !this.over) {
      const [x, y] = this.#screen([this.#pose.x, 0.02, this.#pose.z + 0.45]);
      label(ctx, `${c}`, x, y, k * 0.075, COLOR);
      label(ctx, 'COMBO', x, y + k * 0.06, k * 0.035, '#ffffff');
    }
    if (this.#big) {
      const a = this.#big.age;
      const s = a < 0.2 ? a / 0.2 : 1;
      ctx.globalAlpha = Math.min(1, (1.6 - a) * 3);
      label(ctx, this.#big.text, w / 2, h * 0.2, Math.min(w * 0.13, h * 0.08) * (0.6 + 0.4 * s), '#ffae00');
      ctx.globalAlpha = 1;
    }
    if (this.#cutin > 0) cutIn(ctx, w, h, 1.5 - this.#cutin);
  }

  #end() {
    this.over = true;
    this.#tune.stop();
    sounds.finale();
    const r = this.judge.result(this.#bonus);
    // 実機で音と指のずれを測る手がかり。正なら遅れて叩いている（EXTRA_LATENCY を足す向き）
    console.debug('idol-live offset', r.offset.toFixed(3));
    this.#timer = setTimeout(() => this.#onend(r), 1600);
  }
}

/** スペシャルをきめたときの帯。斜めの帯が左から滑りこみ、右へ抜ける */
function cutIn(ctx: CanvasRenderingContext2D, w: number, h: number, a: number) {
  const x = a < 0.25 ? (1 - a / 0.25) * -w : a > 1.2 ? ((a - 1.2) / 0.3) * w : 0;
  const y = h * 0.24;
  const bh = Math.min(h * 0.1, w * 0.16);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.06);
  const g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
  g.addColorStop(0, '#ff9cc4');
  g.addColorStop(1, COLOR);
  ctx.fillStyle = g;
  ctx.fillRect(-w * 0.2, -bh / 2, w * 1.4, bh);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-w * 0.2, -bh / 2 - 6, w * 1.4, 4);
  ctx.fillRect(-w * 0.2, bh / 2 + 2, w * 1.4, 4);
  label(ctx, 'SPECIAL APPEAL!', w / 2, 0, bh * 0.5, '#ffae00');
  ctx.restore();
}
