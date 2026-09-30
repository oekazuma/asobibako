import type { Seat } from '$lib/net/party.svelte';
import { judge, type Verdict } from './kana';
import { WORDS } from './words';

export type Mode = 'egokoro' | 'hayaoshi';

/** 描く時間。はやおし検定は早く押すほど点が高く、長く描かせる必要がない */
export const DRAW_S: Record<Mode, number> = { egokoro: 90, hayaoshi: 60 };
/** お題を描く人に見せてから描き始めるまで */
export const READY_S = 3;
export const REVEAL_S = 3;
/** はやおし検定で、押した人が候補を選ぶ時間 */
export const ANSWER_S = 5;
export const ROUNDS = 2;
/** 残り秒がこれを切ったら 1 文字ずつ見せる（エゴコロクイズだけ） */
export const HINTS = [45, 20] as const;
export const POINTS = { first: 3, second: 2, drawer: 2 } as const;
/** はやおし検定で、押したときの描く残り秒がこれ以上ならこの点 */
export const BUZZ_POINTS = [
  [40, 3],
  [20, 2],
  [0, 1]
] as const;

export type Phase = 'ready' | 'draw' | 'reveal' | 'done';

/** 親だけが持つ。子へは view() で人ごとに見せる分だけを渡す */
export interface Quiz {
  mode: Mode;
  players: Seat[];
  /** 抜けた人の点も結果に残すので、players とは別に持つ */
  scores: Record<number, number>;
  /** 描く人の並び。抜けた人のこれからの番は消す */
  order: Seat[];
  turn: number;
  phase: Phase;
  /** いまの段階の残り秒 */
  left: number;
  word: string;
  /** 見せた字の位置 */
  hints: number[];
  /** 当てた人を当てた順に */
  solved: Seat[];
  used: string[];
  /** はやおし検定で、いま答えている人 */
  buzzer: Seat | null;
  answerLeft: number;
  /** 押したときの描く残り秒。点はこれで決める */
  buzzedAt: number;
  options: string[];
  /** おてつきの人 */
  out: Seat[];
}

export function drawer(s: Quiz): Seat {
  return s.order[Math.min(s.turn, s.order.length - 1)];
}

const guessers = (s: Quiz) => s.players.filter((p) => p !== drawer(s));

function pickWord(s: Quiz, rand: () => number, words: readonly string[]): string {
  let pool = words.filter((w) => !s.used.includes(w));
  if (!pool.length) {
    s.used = [];
    pool = [...words];
  }
  const word = pool[Math.floor(rand() * pool.length)];
  s.used.push(word);
  return word;
}

function begin(s: Quiz, turn: number, rand: () => number, words: readonly string[]) {
  s.turn = turn;
  s.hints = [];
  s.solved = [];
  s.out = [];
  s.buzzer = null;
  s.options = [];
  if (turn >= s.order.length) {
    s.phase = 'done';
    s.word = '';
    return;
  }
  s.phase = 'ready';
  s.left = READY_S;
  s.word = pickWord(s, rand, words);
}

export function create(
  players: Seat[],
  rand = Math.random,
  words: readonly string[] = WORDS,
  mode: Mode = 'egokoro'
): Quiz {
  const s: Quiz = {
    mode,
    players: [...players],
    scores: Object.fromEntries(players.map((p) => [p, 0])),
    order: Array.from({ length: ROUNDS }, () => players).flat(),
    turn: 0,
    phase: 'ready',
    left: 0,
    word: '',
    hints: [],
    solved: [],
    used: [],
    buzzer: null,
    answerLeft: 0,
    buzzedAt: 0,
    options: [],
    out: []
  };
  begin(s, 0, rand, words);
  return s;
}

export function start(s: Quiz, by: Seat): boolean {
  if (s.phase !== 'ready' || by !== drawer(s)) return false;
  s.phase = 'draw';
  s.left = DRAW_S[s.mode];
  return true;
}

function reveal(s: Quiz) {
  s.phase = 'reveal';
  s.left = REVEAL_S;
  s.buzzer = null;
  s.options = [];
}

export function guess(s: Quiz, by: Seat, text: string): Verdict | null {
  if (s.mode !== 'egokoro' || s.phase !== 'draw') return null;
  if (by === drawer(s) || !s.players.includes(by) || s.solved.includes(by)) return null;
  const verdict = judge(s.word, text);
  if (verdict !== 'right') return verdict;
  s.solved.push(by);
  s.scores[by] += s.solved.length === 1 ? POINTS.first : POINTS.second;
  s.scores[drawer(s)] += POINTS.drawer;
  if (guessers(s).every((p) => s.solved.includes(p))) reveal(s);
  return verdict;
}

export function buzz(s: Quiz, by: Seat, rand = Math.random, words: readonly string[] = WORDS): boolean {
  if (s.mode !== 'hayaoshi' || s.phase !== 'draw' || s.buzzer !== null) return false;
  if (by === drawer(s) || !s.players.includes(by) || s.out.includes(by)) return false;
  s.buzzer = by;
  s.answerLeft = ANSWER_S;
  s.buzzedAt = s.left;
  const pool = words.filter((w) => w !== s.word);
  const options = [s.word];
  while (options.length < 4 && pool.length) options.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  // 正解の位置で見当がつかないよう、毎回並びを混ぜる
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  s.options = options;
  return true;
}

/** 答えている人をおてつきにする。当てる人が全員おてつきならターンを終える */
function miss(s: Quiz) {
  if (s.buzzer !== null) s.out.push(s.buzzer);
  s.buzzer = null;
  s.options = [];
  if (guessers(s).every((p) => s.out.includes(p))) reveal(s);
}

export function answer(s: Quiz, by: Seat, index: number): 'right' | 'wrong' | null {
  if (s.phase !== 'draw' || by !== s.buzzer || !s.options[index]) return null;
  if (s.options[index] !== s.word) {
    miss(s);
    return 'wrong';
  }
  s.solved = [by];
  s.scores[by] += BUZZ_POINTS.find(([at]) => s.buzzedAt >= at)![1];
  s.scores[drawer(s)] += POINTS.drawer;
  reveal(s);
  return 'right';
}

/** 答える時間が切れて、おてつきになった人がいればその人を返す（全員への知らせに使う） */
export function tick(s: Quiz, dt: number, rand = Math.random, words: readonly string[] = WORDS): Seat | null {
  if (s.phase === 'done') return null;
  s.left -= dt;
  if (s.phase === 'ready') {
    if (s.left <= 0) start(s, drawer(s));
    return null;
  }
  if (s.phase === 'reveal') {
    if (s.left <= 0) begin(s, s.turn + 1, rand, words);
    return null;
  }
  let late: Seat | null = null;
  if (s.mode === 'egokoro') {
    const n = [...s.word].length;
    if (s.hints.length === 0 && s.left <= HINTS[0]) s.hints.push(0);
    if (s.hints.length === 1 && s.left <= HINTS[1] && n > 2) s.hints.push(1 + Math.floor(rand() * (n - 1)));
  } else if (s.buzzer !== null) {
    s.answerLeft -= dt;
    if (s.answerLeft <= 0) {
      late = s.buzzer;
      miss(s);
    }
  }
  if (s.phase === 'draw' && s.left <= 0) reveal(s);
  return late;
}

export function leave(s: Quiz, seat: Seat, rand = Math.random, words: readonly string[] = WORDS): void {
  if (!s.players.includes(seat)) return;
  const wasDrawing = drawer(s) === seat && (s.phase === 'ready' || s.phase === 'draw');
  s.players = s.players.filter((p) => p !== seat);
  s.order = s.order.filter((p, i) => i <= s.turn || p !== seat);
  if (s.phase === 'done') return;
  if (s.players.length < 2) {
    s.phase = 'done';
    return;
  }
  if (wasDrawing) return begin(s, s.turn + 1, rand, words);
  if (s.phase !== 'draw') return;
  if (s.buzzer === seat) {
    s.buzzer = null;
    s.options = [];
  }
  const settled = s.mode === 'egokoro' ? s.solved : s.out;
  if (guessers(s).every((p) => settled.includes(p))) reveal(s);
}

export interface View {
  mode: Mode;
  phase: Phase;
  turn: number;
  turns: number;
  drawer: Seat;
  players: Seat[];
  scores: Record<number, number>;
  /** 切り上げた残り秒 */
  left: number;
  /** 描く人（準備と描く時間）・当てた人・答えを見せる時間の全員にだけ */
  word: string | null;
  /** エゴコロクイズで当てる人に見せる字数とヒント。見せていない字は「○」。はやおし検定は空 */
  mask: string;
  solved: Seat[];
  buzzer: Seat | null;
  answerLeft: number;
  /** 答えている本人にだけ */
  options: string[] | null;
  out: Seat[];
}

export function view(s: Quiz, seat: Seat): View {
  const mine = drawer(s) === seat;
  const playing = s.phase === 'ready' || s.phase === 'draw';
  const knows = s.phase === 'reveal' || (playing && (mine || s.solved.includes(seat)));
  return {
    mode: s.mode,
    phase: s.phase,
    turn: s.turn,
    turns: s.order.length,
    drawer: drawer(s),
    players: [...s.players],
    scores: { ...s.scores },
    left: Math.max(0, Math.ceil(s.left)),
    word: knows ? s.word : null,
    mask: s.mode === 'egokoro' ? [...s.word].map((ch, i) => (s.hints.includes(i) ? ch : '○')).join('') : '',
    solved: [...s.solved],
    buzzer: s.buzzer,
    answerLeft: Math.max(0, Math.ceil(s.answerLeft)),
    options: s.buzzer === seat ? [...s.options] : null,
    out: [...s.out]
  };
}
