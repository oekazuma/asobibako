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

/** 解いた面の集合の保存先。ゲームごと */
export const solvedKey = (id: string) => `asobibako:solved:${id}`;

/** 保存された解いた面の集合（1..levels の整数のみ）。無ければ、到達レベル best から 1..best-1 を解いたことにする */
export function savedSolved(id: string, levels: number, best: number): Set<number> {
  try {
    const stored = localStorage.getItem(solvedKey(id));
    if (stored === null) {
      const solved = new Set<number>();
      for (let n = 1; n < best; n++) solved.add(n);
      return solved;
    }
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= levels));
  } catch {
    return new Set();
  }
}

export function saveSolved(id: string, solved: ReadonlySet<number>): void {
  try {
    localStorage.setItem(solvedKey(id), JSON.stringify([...solved].sort((a, b) => a - b)));
  } catch {
    // プライベートブラウズでは保存できない。その場では進めてよい
  }
}

/** from の次から 1..levels を一周して見つけた、最初のまだ解いていない面。全部解いていれば from（0 なら 1） */
export function nextOpen(from: number, solved: ReadonlySet<number>, levels: number): number {
  for (let i = 1; i <= levels; i++) {
    const n = ((from + i - 1) % levels) + 1;
    if (!solved.has(n)) return n;
  }
  return from || 1;
}
