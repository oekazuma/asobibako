/** レベルを 0（レベル 1）から 1（最後のレベル）の難しさに直す。各ゲームはこの値で面の難しさを決める */
export const difficulty = (level: number, levels: number) =>
  (Math.min(levels, Math.max(1, level)) - 1) / Math.max(1, levels - 1);

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

/** 到達レベルの保存先。ゲームごと。最後のレベルをクリアしたら levels + 1 を保存する */
export const levelKey = (id: string) => `asobibako:reached:${id}`;

/** 全ゲームが 100 面だったころの到達レベルの保存先 */
const legacyKey = (id: string) => `asobibako:level:${id}`;

/** 保存された到達レベル（1..levels + 1）。壊れていたり読めなければ 1 */
export function savedLevel(id: string, levels: number): number {
  try {
    const stored = localStorage.getItem(levelKey(id));
    const legacy = stored === null ? localStorage.getItem(legacyKey(id)) : null;
    // 100 面のうちどこまで進んだかを、今の面数で同じくらいのところへ読み替える
    const n = legacy === null ? Number(stored) : Math.ceil((Number(legacy) * levels) / 100);
    return Math.min(levels + 1, Math.max(1, Math.floor(n) || 1));
  } catch {
    return 1;
  }
}

export function saveLevel(id: string, level: number): void {
  try {
    localStorage.setItem(levelKey(id), String(level));
  } catch {
    // プライベートブラウズでは保存できない。その場では進めてよい
  }
}
