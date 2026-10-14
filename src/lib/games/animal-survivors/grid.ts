/** 歩いた先のセルを覚え続けると延長戦で増え続けるので、これを超えたらまとめて捨てる */
const KEEP_CELLS = 4096;

/** 当たり判定の格子。毎フレーム作り直すので、セルの配列は使い回して空にするだけにする */
export class Grid {
  readonly #cell: number;
  readonly #cells = new Map<number, number[]>();
  readonly #used: number[][] = [];

  constructor(cell = 32) {
    this.#cell = cell;
  }

  #key(cx: number, cy: number) {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  clear() {
    for (const list of this.#used) list.length = 0;
    this.#used.length = 0;
    if (this.#cells.size > KEEP_CELLS) this.#cells.clear();
  }

  add(i: number, x: number, y: number) {
    const k = this.#key(Math.floor(x / this.#cell), Math.floor(y / this.#cell));
    let list = this.#cells.get(k);
    if (!list) this.#cells.set(k, (list = []));
    if (list.length === 0) this.#used.push(list);
    list.push(i);
  }

  /** (x, y) から r 以内のセルにある番号を out に入れて返す。距離は呼ぶ側が測る */
  near(x: number, y: number, r: number, out: number[]) {
    out.length = 0;
    const c = this.#cell;
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++)
      for (let cy = Math.floor((y - r) / c); cy <= Math.floor((y + r) / c); cy++) {
        const list = this.#cells.get(this.#key(cx, cy));
        if (list) for (const i of list) out.push(i);
      }
    return out;
  }
}
