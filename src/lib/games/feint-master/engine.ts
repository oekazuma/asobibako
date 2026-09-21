import type { Player } from '$lib/player';

export const COLORS = ['green', 'purple', 'orange'] as const;
export const SHAPES = ['circle', 'triangle', 'star'] as const;
export type Color = (typeof COLORS)[number];
export type Shape = (typeof SHAPES)[number];

export interface Token {
  color: Color;
  shape: Shape;
}

export interface GameState {
  /** memo: 自分のヒントを覚える、signal: 合図が切り替わっていく、show: その回の結果 */
  phase: 'memo' | 'signal' | 'show';
  timer: number;
  /** 押してよい合図。色と形の両方が合ったときだけ */
  target: Token;
  /** 各プレイヤーが教えてもらえる半分。相手はもう半分だけを知っている */
  know: Record<Player, 'color' | 'shape'>;
  token: Token;
  /** 合図が切り替わった回数。表示の演出をやり直すきっかけに使う */
  flips: number;
  /** 最後に正解の合図が出てから切り替わった回数 */
  sinceGo: number;
  round: number;
  score: Record<Player, number>;
  result: { player: Player; kind: 'score' | 'fault' } | null;
  winner: Player | null;
}

export type FeintEvent =
  | { type: 'flip' }
  | { type: 'score'; player: Player }
  | { type: 'fault'; player: Player }
  | { type: 'win'; player: Player };

export const GOAL = 3;
export const MEMO_S = 2.5;
const FLIP_S = 1.1;
const SHOW_S = 2;
/** これだけ切り替わっても正解が出なければ、次は必ず正解を出す */
const FORCE_GO = 5;

const other = (p: Player): Player => (p === 1 ? 2 : 1);
const pick = <T>(list: readonly T[], rand: () => number): T => list[Math.floor(rand() * list.length)];
const pickOther = <T>(list: readonly T[], not: T, rand: () => number): T =>
  pick(
    list.filter((v) => v !== not),
    rand
  );

export const isGo = (state: GameState) =>
  state.token.color === state.target.color && state.token.shape === state.target.shape;

function newRound(state: GameState, rand: () => number) {
  state.phase = 'memo';
  state.timer = MEMO_S;
  state.target = { color: pick(COLORS, rand), shape: pick(SHAPES, rand) };
  state.know = state.round % 2 === 0 ? { 1: 'color', 2: 'shape' } : { 1: 'shape', 2: 'color' };
  state.sinceGo = 0;
  state.result = null;
}

export function createState(rand: () => number = Math.random): GameState {
  const state: GameState = {
    phase: 'memo',
    timer: 0,
    target: { color: 'green', shape: 'circle' },
    know: { 1: 'color', 2: 'shape' },
    token: { color: 'green', shape: 'circle' },
    flips: 0,
    sinceGo: 0,
    round: 0,
    score: { 1: 0, 2: 0 },
    result: null,
    winner: null
  };
  newRound(state, rand);
  return state;
}

/**
 * 片方だけ合う合図を多めに混ぜる。自分の半分が合っても、相手の半分が合っているとは限らないので、
 * 相手の手の動きを読むか、相手を釣るかの駆け引きになる
 */
function nextToken(state: GameState, rand: () => number): Token {
  const { color, shape } = state.target;
  const r = state.sinceGo >= FORCE_GO ? 0 : rand();
  if (r < 0.28) return { color, shape };
  if (r < 0.52) return { color, shape: pickOther(SHAPES, shape, rand) };
  if (r < 0.76) return { color: pickOther(COLORS, color, rand), shape };
  return { color: pickOther(COLORS, color, rand), shape: pickOther(SHAPES, shape, rand) };
}

export function step(state: GameState, dt: number, rand: () => number = Math.random): FeintEvent[] {
  state.timer -= dt;
  if (state.timer > 0) return [];
  if (state.phase === 'show') {
    if (state.winner !== null) {
      state.timer = Infinity;
      return [{ type: 'win', player: state.winner }];
    }
    state.round += 1;
    newRound(state, rand);
    return [];
  }
  state.phase = 'signal';
  state.timer = FLIP_S;
  state.token = nextToken(state, rand);
  state.flips += 1;
  state.sinceGo = isGo(state) ? 0 : state.sinceGo + 1;
  return [{ type: 'flip' }];
}

/** 正解の合図で押せば自分の点、それ以外で押せばおてつきで相手の点。ヒントを覚えている間は数えない */
export function press(state: GameState, player: Player): FeintEvent[] {
  if (state.phase !== 'signal') return [];
  const go = isGo(state);
  const scorer = go ? player : other(player);
  state.score[scorer] += 1;
  state.result = { player, kind: go ? 'score' : 'fault' };
  state.phase = 'show';
  state.timer = SHOW_S;
  if (state.score[scorer] >= GOAL) state.winner = scorer;
  return [go ? { type: 'score', player } : { type: 'fault', player }];
}
