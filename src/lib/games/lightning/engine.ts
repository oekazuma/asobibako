import type { Player } from '$lib/player';

/** 真ん中に出る指示。up などは各プレイヤーから見た向きのスワイプ、skull は「さわるな」 */
export type Command = 'tap' | 'hold' | 'two' | 'up' | 'down' | 'left' | 'right' | 'skull';
export type Answer = Exclude<Command, 'skull'>;

export interface GameState {
  /** wait: 合図待ち、go: 指示が出ている、show: 結果を見せている */
  phase: 'wait' | 'go' | 'show';
  timer: number;
  command: Command;
  /** 矢印を逆向きにスワイプさせる。どちらかが点を重ねてから混ざる */
  reverse: boolean;
  /** いまの指示に答えられる秒数。点が進むほど短くなる */
  limit: number;
  /** この指示ではもう答えられない理由。early はお手つき（合図の前に触った） */
  locked: Record<Player, 'early' | 'miss' | null>;
  score: Record<Player, number>;
  /** 直前の指示で点を取った側。誰も取れなければ null */
  scorer: Player | null;
  /** 点を取った側が指示から答えるまでにかかった秒数 */
  reaction: number | null;
  winner: Player | null;
}

export type LightningEvent =
  | { type: 'go' }
  | { type: 'score'; player: Player }
  | { type: 'miss'; player: Player }
  | { type: 'early'; player: Player }
  | { type: 'timeout' }
  | { type: 'win'; player: Player };

export const GOAL = 5;
const ANSWERS: Answer[] = ['tap', 'hold', 'two', 'up', 'down', 'left', 'right'];
const SKULL_CHANCE = 0.15;
/** 指示が出てから答えられる秒数。最初と、あと 1 点で勝つとき。ドクロはこの秒数だけ我慢すれば流れる */
const GO_S = [2.5, 1.5];
const SKULL_S = 1.4;
const SHOW_S = 1.3;
/** 矢印が逆向きになる割合と、それが混ざりはじめる勢い */
const REVERSE_CHANCE = 0.4;
const REVERSE_HEAT = 0.5;

const other = (p: Player): Player => (p === 1 ? 2 : 1);
const OPPOSITE: Partial<Record<Answer, Answer>> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** 勝ちに近い側の点で決まる 0..1 の勢い。あと 1 点で 1 */
export const heat = (state: GameState) => Math.min(1, Math.max(state.score[1], state.score[2]) / (GOAL - 1));
const waitTime = (h: number, rand: () => number) => 0.9 + rand() * (2.3 - h);

/** この指示で点になる答え。逆向きの矢印なら反対のスワイプ */
export const expected = (state: GameState): Answer | null =>
  state.command === 'skull' ? null : (state.reverse && OPPOSITE[state.command]) || state.command;

export function createState(rand: () => number = Math.random): GameState {
  return {
    phase: 'wait',
    timer: waitTime(0, rand),
    command: 'tap',
    reverse: false,
    limit: GO_S[0],
    locked: { 1: null, 2: null },
    score: { 1: 0, 2: 0 },
    scorer: null,
    reaction: null,
    winner: null
  };
}

function pick(prev: Command, rand: () => number): Command {
  if (prev !== 'skull' && rand() < SKULL_CHANCE) return 'skull';
  const choices = ANSWERS.filter((c) => c !== prev);
  return choices[Math.floor(rand() * choices.length)];
}

function award(state: GameState, player: Player | null): LightningEvent[] {
  state.phase = 'show';
  state.timer = SHOW_S;
  state.scorer = player;
  if (player === null) return [{ type: 'timeout' }];
  state.score[player] += 1;
  if (state.score[player] >= GOAL) state.winner = player;
  return [{ type: 'score', player }];
}

export function step(state: GameState, dt: number, rand: () => number = Math.random): LightningEvent[] {
  state.timer -= dt;
  if (state.timer > 0) return [];
  if (state.phase === 'wait') {
    state.phase = 'go';
    const h = heat(state);
    state.command = pick(state.command, rand);
    state.reverse = h >= REVERSE_HEAT && state.command in OPPOSITE && rand() < REVERSE_CHANCE;
    state.limit = state.command === 'skull' ? SKULL_S : GO_S[0] + (GO_S[1] - GO_S[0]) * h;
    state.timer = state.limit;
    return [{ type: 'go' }];
  }
  if (state.phase === 'go') return award(state, null);
  if (state.winner !== null) {
    state.timer = Infinity;
    return [{ type: 'win', player: state.winner }];
  }
  state.phase = 'wait';
  state.timer = waitTime(heat(state), rand);
  state.locked = { 1: null, 2: null };
  state.scorer = null;
  state.reaction = null;
  return [];
}

/** 指を置いた。合図の前ならお手つき、ドクロに触れたら相手の点 */
export function touch(state: GameState, player: Player): LightningEvent[] {
  if (state.locked[player]) return [];
  if (state.phase === 'wait') {
    state.locked[player] = 'early';
    return [{ type: 'early', player }];
  }
  if (state.phase === 'go' && state.command === 'skull') {
    state.locked[player] = 'miss';
    return [{ type: 'miss', player }, ...award(state, other(player))];
  }
  return [];
}

/** ジェスチャを出し終えた。指示どおりなら点、違えばこの指示の間は答えられない */
export function answer(state: GameState, player: Player, given: Answer): LightningEvent[] {
  if (state.phase !== 'go' || state.command === 'skull' || state.locked[player]) return [];
  if (given === expected(state)) {
    state.reaction = state.limit - state.timer;
    return award(state, player);
  }
  state.locked[player] = 'miss';
  const events: LightningEvent[] = [{ type: 'miss', player }];
  if (state.locked[other(player)]) events.push(...award(state, null));
  return events;
}
