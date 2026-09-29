import type { Song } from '$lib/music/tune';

/**
 * ダンスの決まりごと（譜面・判定・成績）。DOM も canvas も音も使わない。
 * ノーツは舞台の下の弧に並んだ場所に出て、外から縮んでくる輪がノーツに重なったときに押す。
 * 輪で時刻が見えるので、音を消していても遊べる。時刻は曲の頭からの秒、場所は盤面の高さを 1 とした単位
 */

export type Grade = 'great' | 'good' | 'near' | 'miss';
/** 判定の幅（秒、前後とも）。小さい子の指に合わせて広めにとる */
export const WINDOW = { great: 0.08, good: 0.15, near: 0.25 };
const POINTS: Record<Grade, number> = { great: 100, good: 70, near: 30, miss: 0 };
/** 長押しは終わりのこの秒前まで押さえていればよい */
const HOLD_SLACK = 0.2;
/** 1 区切りの小節の数。区切りをきれいにつなげるとスペシャルアピール */
const SECTION = 4;

export interface Note {
  t: number;
  /** 長押しの長さ（秒）。タップは 0 */
  len: number;
  /** 舞台の下の弧の何番目に出るか */
  spot: number;
  section: number;
  /** 区切りの最後のノーツ */
  last: boolean;
}

export interface Level {
  id: string;
  name: string;
  /** 難しさの星の数 */
  stars: number;
  song: Song;
  bpm: number;
  /** 1 小節ぶんの叩き方（8 分音符 8 つ）。x はタップ、H から続く - は長押し、. は休み。小節ごとに順にくり返す */
  bars: string[];
  /** 輪が縮みはじめてから押すまでの秒 */
  lead: number;
}

export interface Chart {
  notes: Note[];
  length: number;
  lead: number;
  /** 1 拍の秒 */
  beat: number;
}

/** 弧に並ぶ場所の数 */
export const SPOTS = 7;

/**
 * 最初と最後の小節は空けて、あいだの小節に叩き方を並べる。
 * ノーツは弧のとなりの場所へ順に移り、端で折り返す（次に押す場所を目で追いやすい）
 */
export function chart(level: Level, songBars: number): Chart {
  const step = 30 / level.bpm;
  const notes: Note[] = [];
  let spot = 0;
  let dir = 1;
  for (let bar = 1; bar < songBars - 1; bar++) {
    const slots = level.bars[(bar - 1) % level.bars.length];
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] !== 'x' && slots[i] !== 'H') continue;
      let len = 0;
      if (slots[i] === 'H') while (slots[i + len + 1] === '-') len++;
      notes.push({
        t: (bar * 8 + i) * step,
        len: len ? (len + 1) * step : 0,
        spot,
        section: Math.floor((bar - 1) / SECTION),
        last: false
      });
      if (spot + dir < 0 || spot + dir >= SPOTS) dir = -dir;
      spot += dir;
    }
  }
  notes.forEach((n, i) => (n.last = notes[i + 1]?.section !== n.section));
  return { notes, length: songBars * 8 * step, lead: level.lead, beat: step * 2 };
}

/** 弧の場所。u は盤面の幅に対する 0..1、v は高さに対する 0..1。舞台で踊る子の下に、下向きの弧で並ぶ */
export function spotAt(i: number): [number, number] {
  const a = Math.PI - (i / (SPOTS - 1)) * Math.PI;
  return [0.5 + Math.cos(a) * 0.38, 0.64 + Math.sin(a) * 0.18];
}

export type DanceEvent =
  { type: 'hit'; note: number; grade: Grade } | { type: 'hold'; note: number } | { type: 'appeal'; section: number };

export interface Result {
  great: number;
  good: number;
  near: number;
  miss: number;
  maxCombo: number;
  score: number;
  appeals: number;
  rank: 'S' | 'A' | 'B' | 'C';
}

/**
 * 1 曲の判定。press / release は指、advance は毎フレーム。どれも起きた出来事を返す。
 * 押した場所の近くで、幅の中にあるいちばん早いノーツを取る。幅の外や何もない所を押しても減点しない
 */
export class Judge {
  readonly notes: Note[];
  readonly grades: (Grade | null)[];
  combo = 0;
  maxCombo = 0;
  appeals = 0;
  /** 長押しを押さえている指と、そのノーツ */
  readonly holding = new Map<number, number>();
  /** 長押しの押しはじめの判定。離すか、押さえきったときに決まる */
  readonly #held = new Map<number, Grade>();
  readonly #clean: boolean[] = [];
  readonly #where: (spot: number) => [number, number];
  readonly #reach: number;

  /** where は場所の番号を盤面の座標に直す。reach はノーツの中心からどこまでを押したとみなすか */
  constructor(notes: Note[], where: (spot: number) => [number, number], reach: number) {
    this.notes = notes;
    this.grades = notes.map(() => null);
    this.#where = where;
    this.#reach = reach;
  }

  press(id: number, t: number, x: number, y: number): DanceEvent[] {
    const busy = new Set(this.holding.values());
    let best = -1;
    this.notes.forEach((n, i) => {
      if (best >= 0 || this.grades[i] !== null || busy.has(i) || Math.abs(t - n.t) > WINDOW.near) return;
      const [nx, ny] = this.#where(n.spot);
      if (Math.hypot(x - nx, y - ny) <= this.#reach) best = i;
    });
    if (best < 0) return [];
    const d = Math.abs(t - this.notes[best].t);
    const grade: Grade = d <= WINDOW.great ? 'great' : d <= WINDOW.good ? 'good' : 'near';
    if (!this.notes[best].len) return this.#resolve(best, grade);
    this.holding.set(id, best);
    this.#held.set(best, grade);
    return [{ type: 'hold', note: best }];
  }

  release(id: number, t: number): DanceEvent[] {
    const i = this.holding.get(id);
    if (i === undefined) return [];
    this.holding.delete(id);
    const n = this.notes[i];
    const ok = t >= n.t + n.len - HOLD_SLACK;
    return this.#resolve(i, ok ? this.#held.get(i)! : 'near');
  }

  advance(t: number): DanceEvent[] {
    const out: DanceEvent[] = [];
    for (const [id, i] of this.holding) {
      const n = this.notes[i];
      if (t < n.t + n.len) continue;
      this.holding.delete(id);
      out.push(...this.#resolve(i, this.#held.get(i)!));
    }
    const busy = new Set(this.holding.values());
    this.notes.forEach((n, i) => {
      if (this.grades[i] === null && !busy.has(i) && t > n.t + WINDOW.near) out.push(...this.#resolve(i, 'miss'));
    });
    return out;
  }

  get done(): boolean {
    return this.grades.every((g) => g !== null);
  }

  result(): Result {
    const count = (g: Grade) => this.grades.filter((x) => x === g).length;
    const score = this.grades.reduce((s, g) => s + (g ? POINTS[g] : 0), 0) + this.appeals * 500;
    const ratio = this.notes.length ? score / (this.notes.length * POINTS.great) : 0;
    return {
      great: count('great'),
      good: count('good'),
      near: count('near'),
      miss: count('miss'),
      maxCombo: this.maxCombo,
      score,
      appeals: this.appeals,
      rank: ratio >= 0.9 ? 'S' : ratio >= 0.75 ? 'A' : ratio >= 0.5 ? 'B' : 'C'
    };
  }

  #resolve(i: number, grade: Grade): DanceEvent[] {
    const n = this.notes[i];
    this.grades[i] = grade;
    const out: DanceEvent[] = [{ type: 'hit', note: i, grade }];
    if (grade === 'great' || grade === 'good') this.maxCombo = Math.max(this.maxCombo, ++this.combo);
    else {
      this.combo = 0;
      this.#clean[n.section] = false;
    }
    if (n.last && this.#clean[n.section] !== false) {
      this.appeals++;
      out.push({ type: 'appeal', section: n.section });
    }
    return out;
  }
}
