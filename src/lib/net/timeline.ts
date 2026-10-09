/** 送った時刻のついた値の並び。届く時刻のむらに左右されないよう、送った時刻をもとに少し遅らせた時刻の値を出す */
export class Timeline<T> {
  #items: { src: number; v: T }[] = [];
  /** 届いた時刻 - 送った時刻。いちばん小さいものを、むらの無いときの届くまでの間とみなす（2 台の時計のずれも込み） */
  #gaps: number[] = [];

  push(src: number, local: number, v: T): void {
    this.#items.push({ src, v });
    if (this.#items.length > 12) this.#items.shift();
    this.#gaps.push(local - src);
    if (this.#gaps.length > 40) this.#gaps.shift();
  }

  /** 届くまでの間と 2 台の時計のずれの和。まだ何も無ければ 0 */
  offset(): number {
    return this.#gaps.length ? Math.min(...this.#gaps) : 0;
  }

  /** local の時刻から delay ミリ秒遅らせた時刻の、前後の値と寄せる割合 */
  at(local: number, delay: number): { a: T; b: T; t: number } | null {
    const list = this.#items;
    if (!list.length) return null;
    const want = local - this.offset() - delay;
    let k = list.length - 1;
    while (k > 0 && list[k].src > want) k--;
    const a = list[k];
    const b = list[k + 1];
    if (!b || want <= a.src) return { a: a.v, b: a.v, t: 0 };
    return { a: a.v, b: b.v, t: Math.min(1, (want - a.src) / (b.src - a.src)) };
  }

  last(): T | null {
    return this.#items.at(-1)?.v ?? null;
  }

  clear(): void {
    this.#items = [];
    this.#gaps = [];
  }
}
