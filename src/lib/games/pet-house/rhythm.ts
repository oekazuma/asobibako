import type { TrickId } from './types';

/**
 * しつけのリズムあそびの決まりごと（譜面・判定・成績）。DOM も three も音も使わない。
 * 時刻は曲の頭からの秒、指の座標は盤面の中のピクセル
 */

/** ノーツの種類。芸ごとに、体で教えるときの指の動きを 1 つ持つ */
export type Motion = 'tap' | 'down' | 'up' | 'side' | 'circle' | 'hold';
export type Grade = 'great' | 'good' | 'near' | 'miss';

export const MOTION: Record<TrickId, Motion> = {
  sit: 'down',
  down: 'down',
  paw: 'tap',
  roll: 'side',
  jump: 'up',
  beg: 'up',
  spin: 'circle',
  high: 'up',
  bow: 'down',
  dead: 'hold'
};

/** 判定の幅（秒、前後とも）。小さい子の指に合わせて広めにとる */
export const WINDOW = { great: 0.075, good: 0.15, near: 0.25 };
export const POINTS: Record<Grade, number> = { great: 100, good: 70, near: 30, miss: 0 };
/** スワイプと見なす指の動き（ピクセル）。iPhone でも iPad でも、指先を少しはらえば届く長さ */
export const SWIPE = 40;
/** 長押しは終わりのこの秒前まで押さえていればよい */
const HOLD_SLACK = 0.25;
/** 押してからこの秒のうちに、スワイプ・ぐるっとを終える */
const SWIPE_TIME = 0.6;
const CIRCLE_TIME = 2;

export interface Note {
  /** 叩く時刻（秒） */
  t: number;
  motion: Motion;
  /** 長押しの長さ（秒）。ほかは 0 */
  len: number;
  phrase: number;
  /** 芸の動きのノーツ。基本のタップとは絵を変える */
  trick: boolean;
  /** フレーズの最後。ここまでつなげるとペットが芸をする */
  last: boolean;
}

export interface Chart {
  notes: Note[];
  /** 1 拍の秒 */
  beat: number;
  /** 曲の長さ（秒） */
  length: number;
}

/**
 * 2 小節（8 拍）で 1 フレーズ。x は基本のタップ、G は芸の動き、. は休み。だんだん数を増やす。
 * 芸の動きのあとは 2 拍あける（ぐるっとを描き終える間と、長押しの長さ）
 */
const PHRASES = ['x.x.x.G.', 'x.x.xxG.', 'xxx.x.G.', 'x.G.xxG.', 'xxxxx.G.', 'xxG.xxG.', 'xxxxxxG.'];
export const BARS = 16;
/** 長押しの長さ（拍） */
const HOLD_BEATS = 1.5;

/** 1 小節目は数えるだけ、2〜15 小節目にフレーズを並べ、16 小節目はペットの見せ場 */
export function chart(trick: TrickId, bpm: number): Chart {
  const beat = 60 / bpm;
  const motion = MOTION[trick];
  const notes: Note[] = [];
  PHRASES.forEach((p, phrase) => {
    const slots = [...p].flatMap((c, i) => (c === '.' ? [] : [{ c, i }]));
    slots.forEach(({ c, i }, k) => {
      const g = c === 'G';
      const m = g ? motion : 'tap';
      notes.push({
        t: (4 + phrase * 8 + i) * beat,
        motion: m,
        len: m === 'hold' ? HOLD_BEATS * beat : 0,
        phrase,
        trick: g,
        last: k === slots.length - 1
      });
    });
  });
  return { notes, beat, length: BARS * 4 * beat };
}

/** 1 回ぶんの成績 */
export interface Result {
  great: number;
  good: number;
  near: number;
  miss: number;
  maxCombo: number;
  score: number;
  /** 満点に対する割合 0..1 */
  ratio: number;
  rank: Rank;
  /** 叩いた時刻のずれの平均（秒、遅いと正）。実機で音と指のずれを見積もる */
  offset: number;
}
export type Rank = 'S' | 'A' | 'B' | 'C';

export const rankOf = (ratio: number): Rank => (ratio >= 0.9 ? 'S' : ratio >= 0.75 ? 'A' : ratio >= 0.5 ? 'B' : 'C');

/** 成績で進む「覚えた回数」。S は一気に覚えきる（engine の praise が上限で止める） */
export function lessons(r: Pick<Result, 'rank' | 'ratio'>): number {
  switch (r.rank) {
    case 'S':
      return 99;
    case 'A':
      return r.ratio >= 0.82 ? 3 : 2;
    case 'B':
      return r.ratio >= 0.62 ? 2 : 1;
    default:
      return 1;
  }
}

export type RhythmEvent =
  { type: 'hit'; note: number; grade: Grade; broke: boolean } | { type: 'phrase'; phrase: number; ok: boolean };

/** 芸の動きのノーツを押さえている指。dir は進む向き、turned はその向きが回った角度の合計（ラジアン） */
interface Finger {
  note: number;
  grade: Grade;
  t0: number;
  sx: number;
  sy: number;
  x: number;
  y: number;
  moved: number;
  turned: number;
  dir: number | null;
}

/**
 * 1 曲の判定。press / drag / release は指の出来事、advance は毎フレーム。どれも起きた判定を返す。
 * タップは押した瞬間に決まる。芸の動きは押した時刻で幅を決め、動きがちがえば「おしい」にしてコンボを切る。
 * 幅の外で押しても何も起きない（減点しない）。叩かずに幅を過ぎたノーツは miss
 */
export class Play {
  readonly notes: Note[];
  readonly grades: (Grade | null)[];
  /** 押した時刻のずれ（秒）。ノーツごと */
  readonly offsets: number[] = [];
  combo = 0;
  maxCombo = 0;
  readonly #fingers = new Map<number, Finger>();
  readonly #clean: boolean[];

  constructor(c: Chart) {
    this.notes = c.notes;
    this.grades = c.notes.map(() => null);
    this.#clean = PHRASES.map(() => true);
  }

  get done(): boolean {
    return this.grades.every((g) => g !== null);
  }

  /** 押さえている芸の動きのノーツ（画面が長押しの帯を縮めるのに使う） */
  held(note: number): boolean {
    for (const f of this.#fingers.values()) if (f.note === note) return true;
    return false;
  }

  press(id: number, t: number, x: number, y: number): RhythmEvent[] {
    const out = this.advance(t);
    const taken = new Set([...this.#fingers.values()].map((f) => f.note));
    const i = this.notes.findIndex(
      (n, k) => this.grades[k] === null && !taken.has(k) && Math.abs(t - n.t) <= WINDOW.near
    );
    if (i < 0) return out;
    this.offsets.push(t - this.notes[i].t);
    const d = Math.abs(t - this.notes[i].t);
    const grade: Grade = d <= WINDOW.great ? 'great' : d <= WINDOW.good ? 'good' : 'near';
    if (this.notes[i].motion === 'tap') this.#resolve(i, grade, false, out);
    else this.#fingers.set(id, { note: i, grade, t0: t, sx: x, sy: y, x, y, moved: 0, turned: 0, dir: null });
    return out;
  }

  drag(id: number, t: number, x: number, y: number): RhythmEvent[] {
    const out: RhythmEvent[] = [];
    const f = this.#fingers.get(id);
    if (!f) return out;
    track(f, x, y);
    const n = this.notes[f.note];
    if (n.motion === 'circle') {
      if (Math.abs(f.turned) > Math.PI * 1.5 && f.moved > SWIPE * 3) this.#finish(id, f, true, out);
    } else if (n.motion !== 'hold') {
      const dx = f.x - f.sx;
      const dy = f.y - f.sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE) this.#finish(id, f, swiped(dx, dy) === n.motion, out);
    }
    return out;
  }

  release(id: number, t: number, x: number, y: number): RhythmEvent[] {
    const out = this.drag(id, t, x, y);
    const f = this.#fingers.get(id);
    if (!f) return out;
    const n = this.notes[f.note];
    this.#finish(id, f, n.motion === 'hold' && t >= n.t + n.len - HOLD_SLACK, out);
    return out;
  }

  advance(t: number): RhythmEvent[] {
    const out: RhythmEvent[] = [];
    for (const [id, f] of this.#fingers) {
      const n = this.notes[f.note];
      if (n.motion === 'hold' && t >= n.t + n.len) this.#finish(id, f, true, out);
      else if (n.motion === 'circle' ? t > f.t0 + CIRCLE_TIME : n.motion !== 'hold' && t > f.t0 + SWIPE_TIME)
        this.#finish(id, f, false, out);
    }
    const taken = new Set([...this.#fingers.values()].map((f) => f.note));
    this.notes.forEach((n, i) => {
      if (this.grades[i] === null && !taken.has(i) && t > n.t + WINDOW.near) this.#resolve(i, 'miss', true, out);
    });
    return out;
  }

  result(): Result {
    const count = (g: Grade) => this.grades.filter((x) => x === g).length;
    const score = this.grades.reduce((s, g) => s + (g ? POINTS[g] : 0), 0);
    const ratio = this.notes.length ? score / (this.notes.length * POINTS.great) : 0;
    const [great, good, near] = [count('great'), count('good'), count('near')];
    return {
      great,
      good,
      near,
      miss: this.notes.length - great - good - near,
      maxCombo: this.maxCombo,
      score,
      ratio,
      rank: rankOf(ratio),
      offset: this.offsets.length ? this.offsets.reduce((s, v) => s + v, 0) / this.offsets.length : 0
    };
  }

  /** 動きどおりなら押した時刻の判定、ちがえば「おしい」でコンボを切る */
  #finish(id: number, f: Finger, ok: boolean, out: RhythmEvent[]) {
    this.#fingers.delete(id);
    this.#resolve(f.note, ok ? f.grade : 'near', !ok, out);
  }

  #resolve(i: number, grade: Grade, broke: boolean, out: RhythmEvent[]) {
    const n = this.notes[i];
    this.grades[i] = grade;
    if (broke) {
      this.combo = 0;
      this.#clean[n.phrase] = false;
    } else this.maxCombo = Math.max(this.maxCombo, ++this.combo);
    out.push({ type: 'hit', note: i, grade, broke });
    if (n.last) out.push({ type: 'phrase', phrase: n.phrase, ok: this.#clean[n.phrase] });
  }
}

/** はらった向き。縦と横の大きいほうで決める */
export function swiped(dx: number, dy: number): Motion {
  return Math.abs(dx) > Math.abs(dy) ? 'side' : dy > 0 ? 'down' : 'up';
}

/** 細かい震えで向きが跳ねないよう、6px 以上動いたときだけ向きを取る */
function track(f: Finger, x: number, y: number): void {
  const d = Math.hypot(x - f.x, y - f.y);
  if (d < 6) return;
  const dir = Math.atan2(y - f.y, x - f.x);
  if (f.dir !== null) f.turned += Math.atan2(Math.sin(dir - f.dir), Math.cos(dir - f.dir));
  f.dir = dir;
  f.moved += d;
  f.x = x;
  f.y = y;
}

/**
 * 読むあいだがこれより空いたら、画面が隠れていたとみなしてそのぶん曲を止める。
 * 先読みした音（bgm の AHEAD）より長く空いたときだけ止めるので、重いフレームで拍がずれることはない
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
