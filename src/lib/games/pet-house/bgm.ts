import { bus } from '$lib/audio.svelte';
import { SONGS, type Lead, type Song, type SongId } from './songs';
import type { Scene } from './types';

/**
 * 場面ごとの BGM。音声ファイルは使わず、songs.ts の楽譜をオシレータで鳴らす。
 * Session が毎フレーム tick() を呼び、AudioContext の時計で AHEAD 秒先までの音を予約する
 * （タイマーで 1 音ずつ鳴らすと、描画が重いフレームで拍がよれる）
 */

export type Track = Scene | 'night' | 'rain' | 'contest-play';

/** 同じ曲を指す行き先へは、頭から流し直さずにテンポと大きさだけ変える（競技が始まる・夜になる・雨の日） */
const TRACKS: Record<Track, { song: SongId; bpm: number; gain: number }> = {
  room: { song: 'room', bpm: 100, gain: 1 },
  night: { song: 'room', bpm: 84, gain: 0.6 },
  rain: { song: 'room', bpm: 92, gain: 0.75 },
  park: { song: 'park', bpm: 124, gain: 1 },
  street: { song: 'park', bpm: 124, gain: 1 },
  bath: { song: 'bath', bpm: 108, gain: 0.8 },
  contest: { song: 'contest', bpm: 120, gain: 0.85 },
  'contest-play': { song: 'contest', bpm: 144, gain: 1 },
  plaza: { song: 'plaza', bpm: 88, gain: 0.75 },
  // リズムあそびの曲は Tune が譜面の時計に合わせて流す。場面に入った直後の 1 フレームだけここを通る
  lesson: { song: 'lesson', bpm: 100, gain: 0.9 }
};

/** 全体の大きさ。効果音や鳴き声より 1 段小さく、流れていても気にならない */
const MASTER = 0.3;
const AHEAD = 0.5;
const FADE = 0.4;

interface Score {
  /** 8 分音符ごとの旋律。音の出だしの語だけが音符で、のばす・休みは null */
  notes: ({ midi: number; steps: number } | null)[];
  perBar: number;
  /** 小節ごとのコードの音（ピッチクラス。根音・3 度・5 度） */
  chords: number[][];
  song: Song;
}

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function midi(name: string): number {
  const m = /^([a-g])(#?)(\d)$/.exec(name);
  if (!m) throw new Error(`音名が読めない: ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] ? 1 : 0);
}

function chord(sym: string): number[] {
  const m = /^([A-G])(#?)(m?)$/.exec(sym);
  if (!m) throw new Error(`コードが読めない: ${sym}`);
  const root = PC[m[1].toLowerCase()] + (m[2] ? 1 : 0);
  return [root, (root + (m[3] ? 3 : 4)) % 12, (root + 7) % 12];
}

export function score(song: Song): Score {
  const perBar = song.beats * 2;
  const bars = song.melody.split('|').map((b) => b.trim().split(/\s+/));
  const chords = song.chords.split(' ').map(chord);
  if (chords.length !== bars.length) throw new Error('コードと小節の数が合わない');
  for (const b of bars) if (b.length !== perBar) throw new Error(`小節の長さが合わない: ${b.join(' ')}`);
  const words = bars.flat();
  const notes = words.map((w, i) => {
    if (w === '-' || w === '.') return null;
    let steps = 1;
    while (words[i + steps] === '-') steps++;
    return { midi: midi(w), steps };
  });
  return { notes, perBar, chords, song };
}

const scores = new Map<SongId, Score>();
const scoreOf = (id: SongId) => scores.get(id) ?? scores.set(id, score(SONGS[id])).get(id)!;

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

// --- 音色 ---

function voice(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, end: number) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.connect(out);
  o.start(t);
  o.stop(end + 0.05);
  return o;
}

/** 立ち上がって hold 秒のばし、release 秒で消える大きさの形 */
function envelope(
  ctx: BaseAudioContext,
  out: AudioNode,
  t: number,
  g: number,
  attack: number,
  hold: number,
  release: number
) {
  const a = ctx.createGain();
  a.gain.setValueAtTime(0.0001, t);
  a.gain.exponentialRampToValueAtTime(g, t + attack);
  a.gain.setValueAtTime(g, t + attack + hold);
  a.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  a.connect(out);
  return { amp: a, end: t + attack + hold + release };
}

type Play = (ctx: BaseAudioContext, out: AudioNode, t: number, f: number, dur: number, g: number) => void;

const LEADS: Record<Lead | 'pluck' | 'bass' | 'pad', Play> = {
  /** オルゴール。基音に 2 倍の音をうっすら重ね、長く響かせる */
  box: (ctx, out, t, f, dur, g) => {
    const { amp, end } = envelope(ctx, out, t, g, 0.005, 0, Math.max(1, dur + 0.5));
    voice(ctx, amp, 'sine', f, t, end);
    const hi = ctx.createGain();
    hi.gain.value = 0.3;
    hi.connect(amp);
    voice(ctx, hi, 'sine', f * 2.01, t, end);
  },
  /** 木琴。高い倍音をすぐ消して、たたいた音にする */
  mallet: (ctx, out, t, f, dur, g) => {
    const { amp, end } = envelope(ctx, out, t, g, 0.004, 0, Math.min(0.6, dur + 0.25));
    voice(ctx, amp, 'sine', f, t, end);
    const k = envelope(ctx, out, t, g * 0.25, 0.002, 0, 0.06);
    voice(ctx, k.amp, 'sine', f * 4, t, k.end);
  },
  /** 泡。下からすっと上がる丸い音 */
  bubble: (ctx, out, t, f, dur, g) => {
    const { amp, end } = envelope(ctx, out, t, g, 0.01, Math.max(0, dur - 0.15), 0.2);
    const o = voice(ctx, amp, 'sine', f * 0.6, t, end);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
  },
  /** ラッパ。のこぎり波の高いところを削る */
  brass: (ctx, out, t, f, dur, g) => {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    lp.connect(out);
    const { amp, end } = envelope(ctx, lp, t, g * 0.55, 0.02, dur * 0.7, 0.1);
    voice(ctx, amp, 'sawtooth', f, t, end);
  },
  /** 笛。ゆっくり立ち上がり、かすかに揺らす */
  flute: (ctx, out, t, f, dur, g) => {
    const { amp, end } = envelope(ctx, out, t, g, 0.08, Math.max(0, dur - 0.1), 0.25);
    const o = voice(ctx, amp, 'triangle', f, t, end);
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5;
    depth.gain.value = f * 0.007;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(end + 0.05);
  },
  pluck: (ctx, out, t, f, dur, g) => {
    const { amp, end } = envelope(ctx, out, t, g, 0.004, 0, Math.min(0.35, dur + 0.1));
    voice(ctx, amp, 'triangle', f, t, end);
  },
  pad: (ctx, out, t, f, dur, g) => {
    const { amp, end } = envelope(ctx, out, t, g, 0.12, Math.max(0, dur - 0.2), 0.35);
    voice(ctx, amp, 'triangle', f, t, end);
  },
  bass: (ctx, out, t, f, dur, g) => {
    const { amp, end } = envelope(ctx, out, t, g, 0.01, dur * 0.5, dur * 0.5);
    voice(ctx, amp, 'triangle', f, t, end);
  }
};

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

/** 行進曲の小太鼓のかわりの、短いシャッという音 */
function tick(ctx: BaseAudioContext, out: AudioNode, t: number, g: number) {
  let b = noises.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    noises.set(ctx, b);
  }
  const s = ctx.createBufferSource();
  s.buffer = b;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  const a = ctx.createGain();
  a.gain.value = g;
  s.connect(hp).connect(a).connect(out);
  s.start(t);
}

/** コードの音を C4 のまわり（G3..F#4）に、根音を E2..D#3 に置く */
const near = (pc: number) => (pc + 60 >= 67 ? pc + 48 : pc + 60);
const low = (pc: number) => (pc + 36 < 40 ? pc + 48 : pc + 36);

const LEAD = 0.13;
const CHORD = 0.035;
const BASS = 0.11;

/** 8 分音符 1 つぶんを t から鳴らす。sd は 8 分音符の秒 */
function playStep(ctx: BaseAudioContext, out: AudioNode, sc: Score, step: number, t: number, sd: number) {
  const n = sc.notes[step];
  const { lead, style } = sc.song;
  if (n) LEADS[lead](ctx, out, t, hz(n.midi), n.steps * sd, LEAD);
  const p = step % sc.perBar;
  const c = sc.chords[Math.floor(step / sc.perBar)];
  const bass = (pc: number, steps: number) => LEADS.bass(ctx, out, t, hz(low(pc)), steps * sd, BASS);
  const strum = (play: Play, steps: number, g = CHORD) => {
    for (const pc of c) play(ctx, out, t, hz(near(pc)), steps * sd, g);
  };
  switch (style) {
    case 'waltz':
      if (p === 0) bass(c[0], 4);
      else if (p === 2 || p === 4) strum(LEADS.box, 1, CHORD * 0.6);
      return;
    case 'bounce':
      if (p === 0 || p === 4) bass(p ? c[2] : c[0], 2);
      else if (p === 2 || p === 6) strum(LEADS.pluck, 1);
      // 泡の曲は裏拍にときどき高い泡を散らす
      if (lead === 'bubble' && p % 2 && Math.random() < 0.3)
        LEADS.bubble(ctx, out, t, hz(near(c[Math.floor(Math.random() * 3)]) + 24), sd, LEAD * 0.35);
      return;
    case 'march':
      if (p === 0 || p === 4) bass(p ? c[2] : c[0], 2);
      else if (p === 2 || p === 6) strum(LEADS.pluck, 0.5, CHORD * 1.2);
      tick(ctx, out, t, p % 2 ? 0.025 : 0.05);
      return;
    case 'gentle':
      if (p === 0) strum(LEADS.pad, sc.perBar, CHORD * 0.45);
      if (p === 0 || p === 4) bass(p ? c[2] : c[0], 4);
      return;
  }
}

const outs = new WeakMap<BaseAudioContext, AudioNode>();

/** BGM の出口。こだま（DelayNode の折り返し）を少し混ぜて、狭い音を部屋に響かせる */
function output(ctx: BaseAudioContext): AudioNode {
  const had = outs.get(ctx);
  if (had) return had;
  const input = ctx.createGain();
  const master = ctx.createGain();
  master.gain.value = MASTER;
  master.connect(ctx.destination);
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.3;
  const dull = ctx.createBiquadFilter();
  dull.type = 'lowpass';
  dull.frequency.value = 2400;
  const back = ctx.createGain();
  back.gain.value = 0.3;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  input.connect(master);
  input.connect(echo).connect(dull);
  dull.connect(back).connect(echo);
  dull.connect(wet).connect(master);
  outs.set(ctx, input);
  return input;
}

/** OfflineAudioContext に 1 曲を seconds 秒ぶん書く（書き出して確かめる用） */
export function renderTrack(ctx: BaseAudioContext, track: Track, seconds: number): void {
  const t = TRACKS[track];
  const sc = scoreOf(t.song);
  const b = ctx.createGain();
  b.gain.value = t.gain;
  b.connect(output(ctx));
  const sd = 30 / t.bpm;
  for (let i = 0, at = 0.05; at < seconds; i++, at += sd) playStep(ctx, b, sc, i % sc.notes.length, at, sd);
}

/** 1 周の秒 */
export const loopSeconds = (track: Track) => (scoreOf(TRACKS[track].song).notes.length * 30) / TRACKS[track].bpm;

export class Bgm {
  #want: Track | null = null;
  #now: { track: Track; ctx: BaseAudioContext; bus: GainNode } | null = null;
  #step = 0;
  #next = 0;
  readonly #get: () => BaseAudioContext | undefined;

  constructor(get: () => BaseAudioContext | undefined = bus) {
    this.#get = get;
  }

  /** 鳴らしたい曲。null で無音。次の tick から効く */
  play(track: Track | null): void {
    this.#want = track;
  }

  stop(): void {
    this.#want = null;
    this.#release();
  }

  get playing(): Track | null {
    return this.#now?.track ?? null;
  }

  /** 毎フレーム呼ぶ。ミュート・音がまだ使えない・画面が隠れているあいだは消しておき、戻ったら頭から流す */
  tick(): void {
    const ctx = this.#get();
    const want = this.#want;
    if (!ctx || !want || (typeof document !== 'undefined' && document.hidden)) return this.#release();
    const t = TRACKS[want];
    const cur = this.#now;
    if (!cur || cur.ctx !== ctx || TRACKS[cur.track].song !== t.song) {
      this.#release();
      const b = ctx.createGain();
      b.gain.setValueAtTime(0, ctx.currentTime);
      b.gain.linearRampToValueAtTime(t.gain, ctx.currentTime + FADE);
      b.connect(output(ctx));
      this.#now = { track: want, ctx, bus: b };
      this.#step = 0;
      this.#next = ctx.currentTime + 0.05;
    } else if (cur.track !== want) {
      ramp(cur.bus.gain, ctx.currentTime, t.gain);
      cur.track = want;
    }
    const now = this.#now!;
    const sc = scoreOf(t.song);
    const sd = 30 / t.bpm;
    // 止まっていたあいだの拍は鳴らさない。まとめて予約すると一度にどっと鳴る
    if (this.#next < ctx.currentTime) this.#next = ctx.currentTime + 0.05;
    while (this.#next < ctx.currentTime + AHEAD) {
      playStep(ctx, now.bus, sc, this.#step, this.#next, sd);
      this.#next += sd;
      this.#step = (this.#step + 1) % sc.notes.length;
    }
  }

  #release() {
    const n = this.#now;
    if (!n) return;
    this.#now = null;
    ramp(n.bus.gain, n.ctx.currentTime, 0);
    // 予約ずみの音が鳴り終わるまで待ってから外す
    setTimeout(() => n.bus.disconnect(), (AHEAD + FADE + 2) * 1000);
  }
}

/**
 * 譜面の時計に合わせて 1 度だけ流す曲（しつけのリズムあそび）。時計は呼ぶ側が持ち、t はいま聞こえている曲の秒、
 * latency は予約してから耳に届くまでの秒。ミュートなどで鳴らせなかったあいだの音は飛ばし、戻ったらいまの位置から続ける
 */
export class Tune {
  readonly #sc: Score;
  readonly #sd: number;
  #step = 0;
  #now: { ctx: BaseAudioContext; bus: GainNode } | null = null;

  constructor(song: SongId, bpm: number) {
    this.#sc = scoreOf(song);
    this.#sd = 30 / bpm;
  }

  tick(ctx: BaseAudioContext | undefined, t: number, latency: number): void {
    if (!ctx) return this.stop();
    if (this.#now?.ctx !== ctx) {
      this.stop();
      const b = ctx.createGain();
      b.gain.value = 0.9;
      b.connect(output(ctx));
      this.#now = { ctx, bus: b };
    }
    const sd = this.#sd;
    // 過ぎた拍は鳴らさない
    this.#step = Math.max(this.#step, Math.ceil((t + latency) / sd - 0.01));
    while (this.#step < this.#sc.notes.length && this.#step * sd < t + AHEAD) {
      playStep(ctx, this.#now.bus, this.#sc, this.#step, ctx.currentTime + this.#step * sd - t - latency, sd);
      this.#step++;
    }
  }

  stop(): void {
    const n = this.#now;
    if (!n) return;
    this.#now = null;
    ramp(n.bus.gain, n.ctx.currentTime, 0);
    setTimeout(() => n.bus.disconnect(), (AHEAD + FADE + 2) * 1000);
  }
}

function ramp(p: AudioParam, t: number, to: number) {
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.linearRampToValueAtTime(to, t + FADE);
}
