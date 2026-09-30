import type { Seat } from '$lib/net/party.svelte';
import { judge, type Verdict } from './kana';
import { WORDS } from './words';

export const DRAW_S = 90;
/** 子どもが選べずに止まったままにならないよう、過ぎたら 1 つ目の候補にする */
export const PICK_S = 15;
export const REVEAL_S = 3;
export const ROUNDS = 2;
/** 残り秒がこれを切ったら 1 文字ずつ見せる */
export const HINTS = [45, 20] as const;
export const POINTS = { first: 3, second: 2, drawer: 2 } as const;

export type Phase = 'pick' | 'draw' | 'reveal' | 'done';

/** 親だけが持つ。子へは view() で人ごとに見せる分だけを渡す */
export interface Egokoro {
  players: Seat[];
  /** 抜けた人の点も結果に残すので、players とは別に持つ */
  scores: Record<number, number>;
  /** 描く人の並び。抜けた人のこれからの番は消す */
  order: Seat[];
  turn: number;
  phase: Phase;
  /** いまの段階の残り秒 */
  left: number;
  choices: string[];
  word: string;
  /** 見せた字の位置 */
  hints: number[];
  /** 当てた人を当てた順に */
  solved: Seat[];
  used: string[];
}

export function drawer(s: Egokoro): Seat {
  return s.order[Math.min(s.turn, s.order.length - 1)];
}

const guessers = (s: Egokoro) => s.players.filter((p) => p !== drawer(s));

function draw2(s: Egokoro, rand: () => number, words: readonly string[]): string[] {
  let pool = words.filter((w) => !s.used.includes(w));
  if (pool.length < 2) {
    s.used = [];
    pool = [...words];
  }
  const a = pool.splice(Math.floor(rand() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(rand() * pool.length), 1)[0];
  return [a, b];
}

function begin(s: Egokoro, turn: number, rand: () => number, words: readonly string[]) {
  s.turn = turn;
  s.word = '';
  s.hints = [];
  s.solved = [];
  if (turn >= s.order.length) {
    s.phase = 'done';
    s.choices = [];
    return;
  }
  s.phase = 'pick';
  s.left = PICK_S;
  s.choices = draw2(s, rand, words);
  s.used.push(...s.choices);
}

export function create(players: Seat[], rand = Math.random, words: readonly string[] = WORDS): Egokoro {
  const s: Egokoro = {
    players: [...players],
    scores: Object.fromEntries(players.map((p) => [p, 0])),
    order: Array.from({ length: ROUNDS }, () => players).flat(),
    turn: 0,
    phase: 'pick',
    left: 0,
    choices: [],
    word: '',
    hints: [],
    solved: [],
    used: []
  };
  begin(s, 0, rand, words);
  return s;
}

export function pick(s: Egokoro, by: Seat, index: number): boolean {
  if (s.phase !== 'pick' || by !== drawer(s) || !s.choices[index]) return false;
  s.word = s.choices[index];
  s.phase = 'draw';
  s.left = DRAW_S;
  return true;
}

function reveal(s: Egokoro) {
  s.phase = 'reveal';
  s.left = REVEAL_S;
}

export function guess(s: Egokoro, by: Seat, text: string): Verdict | null {
  if (s.phase !== 'draw' || by === drawer(s) || !s.players.includes(by) || s.solved.includes(by)) return null;
  const verdict = judge(s.word, text);
  if (verdict !== 'right') return verdict;
  s.solved.push(by);
  s.scores[by] += s.solved.length === 1 ? POINTS.first : POINTS.second;
  s.scores[drawer(s)] += POINTS.drawer;
  if (guessers(s).every((p) => s.solved.includes(p))) reveal(s);
  return verdict;
}

export function tick(s: Egokoro, dt: number, rand = Math.random, words: readonly string[] = WORDS): void {
  if (s.phase === 'done') return;
  s.left -= dt;
  if (s.phase === 'pick') {
    if (s.left <= 0) pick(s, drawer(s), 0);
    return;
  }
  if (s.phase === 'reveal') {
    if (s.left <= 0) begin(s, s.turn + 1, rand, words);
    return;
  }
  const n = [...s.word].length;
  if (s.hints.length === 0 && s.left <= HINTS[0]) s.hints.push(0);
  if (s.hints.length === 1 && s.left <= HINTS[1] && n > 2) s.hints.push(1 + Math.floor(rand() * (n - 1)));
  if (s.left <= 0) reveal(s);
}

export function leave(s: Egokoro, seat: Seat, rand = Math.random, words: readonly string[] = WORDS): void {
  if (!s.players.includes(seat)) return;
  const wasDrawing = drawer(s) === seat && (s.phase === 'pick' || s.phase === 'draw');
  s.players = s.players.filter((p) => p !== seat);
  s.order = s.order.filter((p, i) => i <= s.turn || p !== seat);
  if (s.phase === 'done') return;
  if (s.players.length < 2) {
    s.phase = 'done';
    return;
  }
  if (wasDrawing) begin(s, s.turn + 1, rand, words);
  else if (s.phase === 'draw' && guessers(s).every((p) => s.solved.includes(p))) reveal(s);
}

export interface View {
  phase: Phase;
  turn: number;
  turns: number;
  drawer: Seat;
  players: Seat[];
  scores: Record<number, number>;
  /** 切り上げた残り秒 */
  left: number;
  /** お題を選ぶあいだの描く人にだけ */
  choices: string[] | null;
  /** 描く人・当てた人・答えを見せる時間の全員にだけ */
  word: string | null;
  /** 当てる人に見せる字数とヒント。見せていない字は「○」 */
  mask: string;
  solved: Seat[];
}

export function view(s: Egokoro, seat: Seat): View {
  const mine = drawer(s) === seat;
  const knows = s.phase === 'reveal' || (s.phase === 'draw' && (mine || s.solved.includes(seat)));
  return {
    phase: s.phase,
    turn: s.turn,
    turns: s.order.length,
    drawer: drawer(s),
    players: [...s.players],
    scores: { ...s.scores },
    left: Math.max(0, Math.ceil(s.left)),
    choices: s.phase === 'pick' && mine ? [...s.choices] : null,
    word: knows ? s.word : null,
    mask: [...s.word].map((ch, i) => (s.hints.includes(i) ? ch : '○')).join(''),
    solved: [...s.solved]
  };
}
