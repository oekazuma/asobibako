import type { IconName } from '$lib/icons';
import { score, type Song } from '$lib/music/tune';

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

/** 曲の音のもと。自前の楽譜は合成して鳴らし、音源ファイルは読みこんで流す */
export type Source =
  | { kind: 'synth'; song: Song }
  | {
      kind: 'file';
      url: string;
      /** 最初の小節の 1 拍目が、音源の何秒目か */
      offset: number;
      /** 最初の小節から 8 分音符ごとの音の立ち上がりの強さ（0〜9 の数字）。音源から前もって測っておく */
      strengths: string;
    };

export interface Level {
  id: string;
  name: string;
  bpm: number;
  source: Source;
  /** ジャケットの色（上・下）と絵 */
  jacket: { colors: [string, string]; icon: IconName };
  /** 作った人の表記。自前の曲は無し */
  credit?: string;
}

export const DIFFICULTIES = ['かんたん', 'ふつう', 'むずかしい'] as const;
export type Difficulty = 0 | 1 | 2;

/**
 * 難しさごとの拾い方。strength 以上の 8 分音符をノーツにし、前のノーツから gap（8 分音符の数）は空ける。
 * offbeat は裏拍を拾う強さ（かんたんは拾わない）。hold 以上のばす音は長押しにする。lead は輪が縮みはじめてから押すまでの秒
 */
const PICK = [
  { strength: 6, gap: 4, offbeat: 10, hold: 4, lead: 1.5 },
  { strength: 5, gap: 2, offbeat: 8, hold: 4, lead: 1.2 },
  { strength: 4, gap: 1, offbeat: 5, hold: 3, lead: 1.0 }
];

/** 8 分音符ごとの、音の立ち上がりの強さ（0〜9）と、そこから続く長さ（8 分音符の数） */
function beats(source: Source): { strength: number[]; hold: number[] } {
  if (source.kind === 'file') {
    const strength = [...source.strengths].map(Number);
    return { strength, hold: strength.map(() => 0) };
  }
  // 自前の曲は旋律の音の出だしを強く、旋律の休みは伴奏の拍として弱く数える。表拍と、2・4 拍目の裏（はねるリズム）ほど強い
  const notes = score(source.song).notes;
  return {
    strength: notes.map((n, i) => (n ? 9 : 5) - (i % 2 && i % 4 !== 3 ? 2 : 0)),
    hold: notes.map((n) => n?.steps ?? 0)
  };
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
 * 最初と最後の小節は空けて、あいだの 8 分音符から難しさに合わせてノーツを拾う。
 * ノーツは弧のとなりの場所へ順に移り、端で折り返す（次に押す場所を目で追いやすい）
 */
export function chart(level: Level, difficulty: Difficulty): Chart {
  const pick = PICK[difficulty];
  const step = 30 / level.bpm;
  const { strength, hold } = beats(level.source);
  const bars = Math.floor(strength.length / 8);
  const notes: Note[] = [];
  let spot = 0;
  let dir = 1;
  let free = 8;
  for (let i = 8; i < (bars - 1) * 8; i++) {
    const s = strength[i];
    if (i < free || s < (i % 2 ? pick.offbeat : pick.strength)) continue;
    const steps = hold[i] >= pick.hold ? Math.min(hold[i], 6) : 0;
    notes.push({ t: i * step, len: steps * step, spot, section: Math.floor((i / 8 - 1) / SECTION), last: false });
    free = i + (steps ? Math.max(pick.gap, steps + 2) : pick.gap);
    if (spot + dir < 0 || spot + dir >= SPOTS) dir = -dir;
    spot += dir;
  }
  notes.forEach((n, k) => (n.last = notes[k + 1]?.section !== n.section));
  return { notes, length: bars * 8 * step, lead: pick.lead, beat: step * 2 };
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
