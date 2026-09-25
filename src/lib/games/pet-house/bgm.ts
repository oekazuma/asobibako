import { bus } from '$lib/audio.svelte';
import { note, type Instrument } from './instruments';
import { bgmOut, play } from './synth';
import { SONGS, type Lead, type Song, type SongId } from './songs';
import type { Scene } from './types';

/**
 * 場面ごとの BGM。音声ファイルは使わず、songs.ts の楽譜を instruments.ts の楽器の音で鳴らす。
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

/** BGM の出口。部屋の響きは synth の出口がまとめてかける */
const output = bgmOut;

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
