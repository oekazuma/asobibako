/** 1 人用のゲームはどれもレベル 100 まで。100 をクリアしたら全クリ */
export const MAX_LEVEL = 100;

/** レベルを 0（レベル 1）から 1（レベル 100）の難しさに直す。各ゲームはこの値で面の難しさを決める */
export const difficulty = (level: number) => (Math.min(MAX_LEVEL, Math.max(1, level)) - 1) / (MAX_LEVEL - 1);

/** a から b へ、難しさ d に合わせて進めた値 */
export const lerp = (a: number, b: number, d: number) => a + (b - a) * d;

/** 決まった乱数の列。同じ種からは毎回同じ面ができる */
export class Rng {
  #a: number;

  constructor(seed: number) {
    this.#a = (seed * 2654435761) | 0;
  }

  /** 0 以上 1 未満 */
  next = (): number => {
    this.#a = (this.#a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.#a ^ (this.#a >>> 15), 1 | this.#a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }
}
