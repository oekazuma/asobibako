import { bgmOut } from './synth';
import { AHEAD, FADE, playStep, ramp, scoreOf, type Song } from './tune';

/**
 * 曲を繰り返し流す。毎フレーム（か 100ms ごとに）tick() を呼び、AudioContext の時計で AHEAD 秒先までを予約する。
 * get が音の口を返さない（ミュート・wake 前）か画面が隠れているあいだは消し、戻ったら今の曲を頭から流す
 */
export class Loop {
  #want: { song: Song; bpm: number; gain: number } | null = null;
  #now: { song: Song; ctx: BaseAudioContext; bus: GainNode; gain: number } | null = null;
  #step = 0;
  #next = 0;
  readonly #get: () => BaseAudioContext | undefined;

  constructor(get: () => BaseAudioContext | undefined) {
    this.#get = get;
  }

  play(song: Song | null, bpm: number, gain: number): void {
    this.#want = song ? { song, bpm, gain } : null;
  }

  stop(): void {
    this.#want = null;
    this.#release();
  }

  get song(): Song | null {
    return this.#now?.song ?? null;
  }

  get step(): number {
    return this.#step;
  }

  tick(): void {
    const ctx = this.#get();
    const want = this.#want;
    if (!ctx || !want || (typeof document !== 'undefined' && document.hidden)) return this.#release();
    const cur = this.#now;
    if (!cur || cur.ctx !== ctx || cur.song !== want.song) {
      this.#release();
      const b = ctx.createGain();
      b.gain.setValueAtTime(0, ctx.currentTime);
      b.gain.linearRampToValueAtTime(want.gain, ctx.currentTime + FADE);
      b.connect(bgmOut(ctx));
      this.#now = { song: want.song, ctx, bus: b, gain: want.gain };
      this.#step = 0;
      this.#next = ctx.currentTime + 0.05;
    } else if (cur.gain !== want.gain) {
      // ramp は呼ぶたびに今の値から下げ直すので、目標が変わったときだけ呼ぶ
      ramp(cur.bus.gain, ctx.currentTime, want.gain);
      cur.gain = want.gain;
    }
    const now = this.#now!;
    const sc = scoreOf(want.song);
    const sd = 30 / want.bpm;
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
