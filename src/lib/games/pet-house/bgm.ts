import { bus } from '$lib/audio.svelte';
import { AHEAD, FADE, playStep, ramp, scoreOf } from '$lib/music/tune';
import { bgmOut } from '$lib/music/synth';
import { SONGS, type SongId } from './songs';
import type { Scene } from './types';

/**
 * 場面ごとの BGM。音声ファイルは使わず、songs.ts の楽譜を $lib/music の楽器の音で鳴らす。
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

/** BGM の出口。部屋の響きは synth の出口がまとめてかける */
const output = bgmOut;

/** OfflineAudioContext に 1 曲を seconds 秒ぶん書く（書き出して確かめる用） */
export function renderTrack(ctx: BaseAudioContext, track: Track, seconds: number): void {
  const t = TRACKS[track];
  const sc = scoreOf(SONGS[t.song]);
  const b = ctx.createGain();
  b.gain.value = t.gain;
  b.connect(output(ctx));
  const sd = 30 / t.bpm;
  for (let i = 0, at = 0.05; at < seconds; i++, at += sd) playStep(ctx, b, sc, i % sc.notes.length, at, sd);
}

/** 1 周の秒 */
export const loopSeconds = (track: Track) => (scoreOf(SONGS[TRACKS[track].song]).notes.length * 30) / TRACKS[track].bpm;

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
    const sc = scoreOf(SONGS[t.song]);
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
