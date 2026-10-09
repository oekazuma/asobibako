import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';

export interface Brush {
  radius: number;
  color: RGB;
  opacity: number;
  metal: number;
  rough: number;
}

export interface Hit {
  p: V3;
  n: V3;
}

export interface Dab {
  p: V3;
  n: V3;
  r: number;
  c: RGB;
  a: number;
  m: number;
  ro: number;
}

/** 1 回の吹き付けの濃さ（不透明度に掛ける）。重ねて吹くほど濃くなるエアブラシにする */
export const FLOW = 0.3;
export const UNDO = 30;
export const RADIUS = [0.005, 0.25] as const;

export const spacing = (r: number) => Math.max(0.002, r * 0.3);

export function dab(h: Hit, b: Brush): Dab {
  return { p: h.p, n: h.n, r: b.radius, c: b.color, a: b.opacity * FLOW, m: b.metal, ro: b.rough };
}

/** 体の別のところ（腕から胴など）へ指が飛んだとみなす距離。あいだの空中を塗らない */
const JUMP = 0.3;

/** 1 本の筆の運び。前の吹き付けから一定の間隔で置くので、速くなぞっても遅くなぞっても同じ濃さになる */
export class Stroke {
  #last: Hit | null = null;
  #carry = 0;

  constructor(readonly brush: Brush) {}

  to(h: Hit): Dab[] {
    const last = this.#last;
    this.#last = h;
    const d = last ? Math.hypot(h.p[0] - last.p[0], h.p[1] - last.p[1], h.p[2] - last.p[2]) : 0;
    if (!last || d > JUMP) {
      this.#carry = 0;
      return [dab(h, this.brush)];
    }
    const step = spacing(this.brush.radius);
    const out: Dab[] = [];
    let s = step - this.#carry;
    for (; s <= d; s += step) {
      const t = s / d;
      const n = [0, 1, 2].map((i) => last.n[i] + (h.n[i] - last.n[i]) * t);
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      out.push(
        dab(
          {
            p: [0, 1, 2].map((i) => last.p[i] + (h.p[i] - last.p[i]) * t) as unknown as V3,
            n: [n[0] / len, n[1] / len, n[2] / len]
          },
          this.brush
        )
      );
    }
    this.#carry = d - (s - step);
    return out;
  }
}

export class PaintLog {
  dabs: Dab[] = [];
  /** 前に相手へ送ってから列がいちばん短くなった長さ。もどす・取り消しで縮んだところから送り直す */
  low = Infinity;
  #starts: number[] = [];
  /** あと何本もどせるか。描きかけを取り消したときに戻せるよう、筆を始める前の値も持つ */
  #budget = 0;
  #before = 0;

  begin(): void {
    this.#starts.push(this.dabs.length);
    this.#before = this.#budget;
    this.#budget = Math.min(UNDO, this.#budget + 1);
  }

  add(list: Dab[]): void {
    for (const d of list) this.dabs.push(d);
  }

  get canUndo(): boolean {
    return this.#budget > 0 && this.#starts.length > 0;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    this.dabs.length = this.#starts.pop()!;
    this.low = Math.min(this.low, this.dabs.length);
    this.#budget--;
    return true;
  }

  cancel(): boolean {
    if (!this.#starts.length) return false;
    this.dabs.length = this.#starts.pop()!;
    this.low = Math.min(this.low, this.dabs.length);
    this.#budget = this.#before;
    return true;
  }

  clear(): void {
    this.dabs = [];
    this.low = 0;
    this.#starts = [];
    this.#budget = this.#before = 0;
  }
}
