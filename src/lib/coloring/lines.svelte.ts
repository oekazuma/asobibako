import { aiMask, toTensor } from './ai';
import { drawWithAi, stopAi } from './ai-run';
import { inkArt, lineArt } from './lineart';
import { SIZE } from './regions';
import { colorWalls } from './walls';

/**
 * 写真の線の拾い方。ink は線のある絵（マンホールなど）のもとの黒い線、color はそれに色の境目を足したもの（線が重なって
 * 途切れる絵でも色が違えば塗りがもれない）、edge はふつうの写真の明るさの変わり目、ai は線画のモデルに描かせる
 */
export type Mode = 'ink' | 'color' | 'edge' | 'ai';

/** 切り取った写真から、選んだ拾い方と線の量で線画を作る */
export class Lines {
  mode = $state<Mode>('ink');
  amount = $state(0.5);
  mask = $state.raw<Uint8Array | null>(null);
  /** AI が描いているあいだ */
  busy = $state(false);
  note = $state('');
  #rgba: Uint8ClampedArray | null = null;
  /** 色の境目（1 回 0.4 秒ほど）と AI の出力（数秒〜十数秒）は線の量によらないので、切り取りごとに 1 回だけ作る */
  #walls: Uint8Array | null = null;
  #ai: Float32Array | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** AI で描けなかったときに戻す拾い方 */
  #before: Exclude<Mode, 'ai'> = 'ink';
  /** 描いているあいだに切り取りなおしたときに、古い写真の線画を受け取らないための番号 */
  #round = 0;

  start(rgba: Uint8ClampedArray) {
    this.clear();
    this.#rgba = rgba;
    this.build();
  }

  setMode(mode: Mode) {
    if (this.mode !== 'ai') this.#before = this.mode;
    this.mode = mode;
    this.build();
  }

  // 線の量を動かすたびに作りなおすと iPad でも 100ms ほどかかるので、動かし終わりを待つ
  later() {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.build(), 150);
  }

  /** 切り取る画面に戻る。描いている途中の線画も捨てる */
  recrop() {
    clearTimeout(this.#timer);
    this.#round++;
    this.mask = null;
    if (this.busy) stopAi();
    this.busy = false;
  }

  clear() {
    this.recrop();
    this.#rgba = null;
    this.#walls = null;
    this.#ai = null;
    this.note = '';
  }

  dispose() {
    this.clear();
    stopAi();
  }

  build() {
    const rgba = this.#rgba;
    if (!rgba) return;
    if (this.mode === 'ai') {
      if (this.#ai) this.mask = aiMask(this.#ai, this.amount);
      else if (!this.busy) void this.#draw(rgba);
      return;
    }
    if (this.mode === 'edge') return void (this.mask = lineArt(rgba, SIZE, SIZE, this.amount));
    const ink = inkArt(rgba, SIZE, SIZE, this.amount);
    if (this.mode === 'ink') return void (this.mask = ink);
    const walls = (this.#walls ??= colorWalls(rgba, SIZE, SIZE, 5));
    this.mask = ink.map((v, i) => v | walls[i]);
  }

  async #draw(rgba: Uint8ClampedArray) {
    const round = this.#round;
    this.busy = true;
    this.note = '';
    try {
      const out = await drawWithAi(toTensor(rgba));
      if (round !== this.#round) return;
      this.#ai = out;
      if (this.mode === 'ai') this.mask = aiMask(out, this.amount);
    } catch {
      if (round !== this.#round) return;
      this.busy = false;
      this.note = 'AI で かけませんでした。もういちど おすか、べつの せんの ひろいかたを えらんでね';
      if (this.mode === 'ai') this.setMode(this.#before);
    } finally {
      if (round === this.#round) this.busy = false;
    }
  }
}
