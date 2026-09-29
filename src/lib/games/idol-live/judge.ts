import type { Kind, Shape } from './chart';

/**
 * ライブの判定・スコア・もりあがり。DOM も音も使わない。時刻は曲の頭からの秒、位置は画面のピクセル
 */

/** 画面に置いたノーツ（shots.ts の place が作る） */
export interface Placed {
  kind: Kind;
  t: number;
  end: number;
  x: number;
  y: number;
  path: [number, number][];
  shape: Shape;
  /** ノーツを出した手（0 が左、1 が右）。胸・足もと・スペシャルは null */
  hand: 0 | 1 | null;
}

export type Grade = 'perfect' | 'great' | 'good' | 'miss';
export type Rank = 'S' | 'A' | 'B' | 'C';

/** 判定の幅（秒、前後とも）。小さい子の指に合わせて広めにとる */
export const WINDOW = { perfect: 0.075, great: 0.14, good: 0.22 };
const POINTS: Record<Grade, number> = { perfect: 1000, great: 700, good: 300, miss: 0 };
/** スペシャルは 1 つで通常の何倍か */
const SPECIAL = 5;
/** 押した位置がノーツの中心からこの距離まで（ノーツの半径の倍）なら当たり */
const REACH = 1.7;
/** スライドは指が光の玉からこの距離（半径の倍）までならなぞれている */
const TRACK = 2.6;
/** ホールドとスライドは、終わりのこの秒前まで押さえていればよい */
const SLACK = 0.2;
/** もりあがり（0..1）の増減 */
const HYPE: Record<Grade, number> = { perfect: 0.05, great: 0.035, good: 0.012, miss: -0.09 };

export interface Judged {
  note: number;
  grade: Grade;
  /** 当たった位置（世界）。ホールド・スライドは終わった所 */
  x: number;
  y: number;
}

/** ホールド・スライドを押さえている指 */
interface Hold {
  note: number;
  grade: Grade;
  x: number;
  y: number;
  /** 最後に数えた時刻と、なぞれていた秒 */
  last: number;
  on: number;
}

const down = (g: Grade): Grade => (g === 'perfect' ? 'great' : 'good');

/** スライドの道の、時刻 t での光の玉の位置 */
export function along(n: Placed, t: number): [number, number] {
  const u = Math.max(0, Math.min(1, (t - n.t) / (n.end - n.t || 1))) * (n.path.length - 1);
  const i = Math.min(n.path.length - 2, Math.floor(u));
  const [a, b] = [n.path[i], n.path[i + 1]];
  return [a[0] + (b[0] - a[0]) * (u - i), a[1] + (b[1] - a[1]) * (u - i)];
}

export class Judge {
  notes: Placed[];
  readonly grades: (Grade | null)[];
  /** ノーツの半径（ピクセル） */
  radius: number;
  combo = 0;
  maxCombo = 0;
  score = 0;
  hype = 0.35;
  /** 押した時刻のずれ（秒、遅いと正）。実機で音と指のずれを見積もる */
  readonly offsets: number[] = [];
  readonly #holds = new Map<number, Hold>();

  constructor(notes: Placed[], radius: number) {
    this.notes = notes;
    this.radius = radius;
    this.grades = notes.map(() => null);
  }

  /** 満点（全部 PERFECT でコンボもつなげきった点） */
  get max(): number {
    let s = 0;
    this.notes.forEach((n, i) => (s += this.#points(n, 'perfect', i + 1)));
    return s;
  }

  get done(): boolean {
    return this.grades.every((g) => g !== null);
  }

  /** 画面の大きさが変わったら、置きなおしたノーツに替える（判定はそのまま） */
  relayout(notes: Placed[], radius: number): void {
    this.notes = notes;
    this.radius = radius;
  }

  /** 押さえているホールド・スライド */
  holding(note: number): boolean {
    for (const h of this.#holds.values()) if (h.note === note) return true;
    return false;
  }

  press(id: number, t: number, x: number, y: number): Judged[] {
    const out = this.advance(t);
    const taken = new Set([...this.#holds.values()].map((h) => h.note));
    let best = -1;
    let bestD = Infinity;
    this.notes.forEach((n, i) => {
      if (this.grades[i] !== null || taken.has(i)) return;
      const d = Math.abs(t - n.t);
      if (d > WINDOW.good) return;
      if (n.kind !== 'special' && Math.hypot(x - n.x, y - n.y) > this.radius * REACH) return;
      if (d < bestD) [best, bestD] = [i, d];
    });
    if (best < 0) return out;
    const n = this.notes[best];
    this.offsets.push(t - n.t);
    const grade: Grade = bestD <= WINDOW.perfect ? 'perfect' : bestD <= WINDOW.great ? 'great' : 'good';
    if (n.kind === 'tap' || n.kind === 'special') this.#resolve(best, grade, n.x, n.y, out);
    else this.#holds.set(id, { note: best, grade, x, y, last: Math.max(t, n.t), on: 0 });
    return out;
  }

  move(id: number, x: number, y: number): void {
    const h = this.#holds.get(id);
    if (h) [h.x, h.y] = [x, y];
  }

  release(id: number, t: number): Judged[] {
    const out = this.advance(t);
    const h = this.#holds.get(id);
    if (!h) return out;
    this.#holds.delete(id);
    const n = this.notes[h.note];
    this.#resolve(h.note, this.#finish(n, h, t), h.x, h.y, out);
    return out;
  }

  /** 毎フレーム呼ぶ。スライドのなぞり具合を数え、終わったホールド・スライドと、叩かれずに過ぎたノーツを決める */
  advance(t: number): Judged[] {
    const out: Judged[] = [];
    for (const [id, h] of this.#holds) {
      const n = this.notes[h.note];
      this.#track(n, h, t);
      if (t < n.end) continue;
      this.#holds.delete(id);
      this.#resolve(h.note, this.#finish(n, h, t), h.x, h.y, out);
    }
    const taken = new Set([...this.#holds.values()].map((h) => h.note));
    this.notes.forEach((n, i) => {
      if (this.grades[i] === null && !taken.has(i) && t > n.t + WINDOW.good) this.#resolve(i, 'miss', n.x, n.y, out);
    });
    return out;
  }

  result(bonus = 0): Result {
    const count = (g: Grade) => this.grades.filter((x) => x === g).length;
    const specials = this.notes.flatMap((n, i) => (n.kind === 'special' ? [this.grades[i]] : []));
    const ratio = this.max ? this.score / this.max : 0;
    const score = Math.round(this.score * (1 + bonus));
    return {
      score,
      maxCombo: this.maxCombo,
      perfect: count('perfect'),
      great: count('great'),
      good: count('good'),
      miss: count('miss'),
      specials: specials.filter((g) => g && g !== 'miss').length,
      specialTotal: specials.length,
      bonus,
      rank: rankOf(ratio * (1 + bonus)),
      fullCombo: count('miss') === 0,
      offset: this.offsets.length ? this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length : 0
    };
  }

  #track(n: Placed, h: Hold, t: number) {
    if (t <= h.last) return;
    const from = Math.max(h.last, n.t);
    const to = Math.min(t, n.end);
    if (to > from) {
      const [cx, cy] = n.kind === 'slide' ? along(n, to) : [h.x, h.y];
      if (Math.hypot(h.x - cx, h.y - cy) <= this.radius * TRACK) h.on += to - from;
    }
    h.last = t;
  }

  /** ホールドは終わりまで押さえきれば、スライドは 8 割なぞれば押した時の判定のまま。足りなければ下げる */
  #finish(n: Placed, h: Hold, t: number): Grade {
    this.#track(n, h, t);
    const len = n.end - n.t;
    const kept = n.kind === 'hold' ? Math.min(t, n.end) - n.t : h.on;
    const u = len > 0 ? (kept + SLACK) / len : 1;
    return u >= (n.kind === 'hold' ? 1 : 0.8) ? h.grade : u >= 0.5 ? down(h.grade) : 'miss';
  }

  #points(n: Placed, g: Grade, combo: number): number {
    // コンボが続くほど少しずつ増える（100 コンボで 1.5 倍）
    return POINTS[g] * (n.kind === 'special' ? SPECIAL : 1) * (1 + Math.min(combo, 100) / 200);
  }

  #resolve(i: number, grade: Grade, x: number, y: number, out: Judged[]) {
    this.grades[i] = grade;
    if (grade === 'miss') this.combo = 0;
    else this.maxCombo = Math.max(this.maxCombo, ++this.combo);
    this.score += this.#points(this.notes[i], grade, this.combo);
    const boost = this.notes[i].kind === 'special' && grade !== 'miss' ? 0.15 : 0;
    this.hype = Math.max(0, Math.min(1, this.hype + HYPE[grade] + boost));
    out.push({ note: i, grade, x, y });
  }
}

export interface Result {
  score: number;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  specials: number;
  specialTotal: number;
  /** 衣装のボーナス（0.09 で 9%） */
  bonus: number;
  rank: Rank;
  fullCombo: boolean;
  /** 押した時刻のずれの平均（秒、遅いと正） */
  offset: number;
}

export const rankOf = (ratio: number): Rank => (ratio >= 0.88 ? 'S' : ratio >= 0.7 ? 'A' : ratio >= 0.5 ? 'B' : 'C');
