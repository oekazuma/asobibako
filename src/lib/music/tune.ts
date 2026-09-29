import { note, type Instrument } from './instruments';
import { bgmOut, play } from './synth';

/**
 * 楽譜（Song）を楽器の音で鳴らす部品。音声ファイルは使わず、AudioContext の時計で AHEAD 秒先までの音を予約する
 * （タイマーで 1 音ずつ鳴らすと、描画が重いフレームで拍がよれる）
 */

/**
 * 楽譜。melody は 8 分音符 1 つを 1 語にして小節を | で区切る（音名とオクターブ、`-` は前の音をのばす、`.` は休み）。
 * chords は 1 小節に 1 つのコード。伴奏の刻み方は style が決める
 */
export type Lead = 'box' | 'mallet' | 'bubble' | 'brass' | 'flute';
export type Style = 'waltz' | 'bounce' | 'march' | 'gentle' | 'pop';

export interface Song {
  beats: 3 | 4;
  lead: Lead;
  style: Style;
  melody: string;
  chords: string;
}

/** 先読みして予約する秒 */
export const AHEAD = 0.5;
export const FADE = 0.4;

export interface Score {
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

const scores = new WeakMap<Song, Score>();
export const scoreOf = (song: Song) => scores.get(song) ?? scores.set(song, score(song)).get(song)!;

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

// --- 音色 ---

type Play = (ctx: BaseAudioContext, out: AudioNode, t: number, f: number, dur: number, g: number) => void;

/** たたく・はじく楽器は自然に消えるまで鳴らし、のばす楽器は楽譜の長さで切る */
const hit =
  (name: Instrument, k = 1): Play =>
  (ctx, out, t, f, _dur, g) =>
    play(ctx, out, t, note(ctx, name, f), g * k);
const hold =
  (name: Instrument, k: number, release: number, cut = 1): Play =>
  (ctx, out, t, f, dur, g) =>
    play(ctx, out, t, note(ctx, name, f), g * k, { end: t + dur * cut, release });

const LEADS: Record<Lead | 'pluck' | 'bass' | 'pad', Play> = {
  box: hit('box', 0.45),
  mallet: hit('marimba', 0.75),
  bubble: hit('drop', 0.7),
  brass: hold('horn', 0.8, 0.08, 0.85),
  flute: hold('flute', 0.6, 0.2),
  pluck: hit('harp', 1.1),
  pad: hold('pad', 1.6, 0.4),
  bass: hold('bass', 1.3, 0.12)
};

/** 行進曲の小太鼓。ブラシで軽くたたいたシャッ */
function tick(ctx: BaseAudioContext, out: AudioNode, t: number, g: number) {
  play(ctx, out, t, note(ctx, 'snare', 0), g * 3);
}

/** コードの音を C4 のまわり（G3..F#4）に、根音を E2..D#3 に置く */
const near = (pc: number) => (pc + 60 >= 67 ? pc + 48 : pc + 60);
const low = (pc: number) => (pc + 36 < 40 ? pc + 48 : pc + 36);

const LEAD = 0.13;
const CHORD = 0.035;
const BASS = 0.11;

/** 8 分音符 1 つぶんを t から鳴らす。sd は 8 分音符の秒 */
export function playStep(ctx: BaseAudioContext, out: AudioNode, sc: Score, step: number, t: number, sd: number) {
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
    case 'pop':
      // 4 つ打ちのキックと 2・4 拍の小太鼓、裏のハイハット、8 分でオクターブを跳ねるベース（アイドルの曲の刻み）
      if (p % 2 === 0) play(ctx, out, t, note(ctx, 'kick', 0), 0.5);
      else play(ctx, out, t, note(ctx, 'hat', 0), 0.12);
      if (p === 2 || p === 6) tick(ctx, out, t, 0.09);
      LEADS.bass(ctx, out, t, hz(low(c[0]) + (p % 2 ? 12 : 0)), sd * 0.9, BASS * 0.9);
      if (p === 0) strum(LEADS.pad, sc.perBar, CHORD * 0.4);
      if (p === 3 || p === 7) strum(LEADS.pluck, 1, CHORD * 0.9);
      return;
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

  constructor(song: Song, bpm: number) {
    this.#sc = scoreOf(song);
    this.#sd = 30 / bpm;
  }

  tick(ctx: BaseAudioContext | undefined, t: number, latency: number): void {
    if (!ctx) return this.stop();
    if (this.#now?.ctx !== ctx) {
      this.stop();
      const b = ctx.createGain();
      b.gain.value = 0.9;
      b.connect(bgmOut(ctx));
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

export function ramp(p: AudioParam, t: number, to: number) {
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.linearRampToValueAtTime(to, t + FADE);
}
