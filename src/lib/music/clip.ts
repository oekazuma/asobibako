import { master } from './synth';

/** 音源ファイルの曲の大きさ。仕上がった曲は合成の曲よりずっと大きいので絞る */
const GAIN = 0.4;

/**
 * 音源ファイルの曲を、呼ぶ側の時計に合わせて流す（Tune と同じ口）。t は時計の秒、offset は時計の 0 秒が音源の何秒目か。
 * ミュート・画面が隠れているあいだは止め、戻ったらいまの位置から流し直す。読みこめなければ鳴らさずに続ける
 */
export class Clip {
  readonly #url: string;
  readonly #offset: number;
  #buffer: AudioBuffer | null = null;
  #loading = false;
  #now: { ctx: BaseAudioContext; src: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor(url: string, offset: number) {
    this.#url = url;
    this.#offset = offset;
  }

  /** 先に読みこんでおく。曲を選ぶタッチで呼べば、始まるまでに間に合う */
  load(ctx: BaseAudioContext | undefined): void {
    if (!ctx || this.#buffer || this.#loading) return;
    this.#loading = true;
    fetch(this.#url)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((b) => (this.#buffer = b))
      .catch(() => {
        // 鳴らせなくても輪で遊べるので、音なしで続ける
      });
  }

  tick(ctx: BaseAudioContext | undefined, t: number, latency: number): void {
    if (!ctx || (typeof document !== 'undefined' && document.hidden)) return this.stop();
    if (!this.#buffer) return this.load(ctx);
    if (this.#now?.ctx === ctx) return;
    this.stop();
    // いまから latency 秒後に耳に届く音が、時計の t + latency 秒ぶん
    const pos = t + latency + this.#offset;
    if (pos >= this.#buffer.duration) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = this.#buffer;
    gain.gain.value = GAIN;
    src.connect(gain).connect(master(ctx));
    if (pos < 0) src.start(ctx.currentTime - pos);
    else src.start(ctx.currentTime, pos);
    this.#now = { ctx, src, gain };
  }

  stop(): void {
    const n = this.#now;
    if (!n) return;
    this.#now = null;
    n.gain.gain.setTargetAtTime(0, n.ctx.currentTime, 0.05);
    n.src.stop(n.ctx.currentTime + 0.3);
  }
}
