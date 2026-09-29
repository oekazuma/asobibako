/**
 * 読むあいだがこれより空いたら、画面が隠れていたとみなしてそのぶん曲を止める。
 * 先読みした音（tune の AHEAD）より長く空いたときだけ止めるので、重いフレームで拍がずれることはない
 */
const GAP = 1;

/**
 * 曲の時計。音が鳴っているときは AudioContext の時計（聞こえる時刻に直したもの）、
 * 鳴っていないときは performance の時計で進める。源が替わった読みでは performance の進みを足すので、
 * 途中でミュートを切り替えても時刻が飛ばない。どちらも秒
 */
export class SongClock {
  #src: 'audio' | 'wall' | null = null;
  #at = 0;
  #wall = 0;
  t: number;

  constructor(start = 0) {
    this.t = start;
  }

  read(audio: number | null, wall: number): number {
    const src = audio === null ? 'wall' : 'audio';
    const at = audio ?? wall;
    if (this.#src) {
      const gap = wall - this.#wall;
      const d = src === this.#src ? at - this.#at : gap;
      if (gap <= GAP) this.t += Math.max(0, d);
    }
    [this.#src, this.#at, this.#wall] = [src, at, wall];
    return this.t;
  }
}
