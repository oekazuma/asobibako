import type { Player } from '$lib/player';

/** 真ん中に出る指示。up などは各プレイヤーから見た向きのスワイプ、skull は「さわるな」 */
export type Command = 'tap' | 'hold' | 'two' | 'up' | 'down' | 'left' | 'right' | 'skull';
export type Answer = Exclude<Command, 'skull'>;

export interface GameState {
  /** wait: 合図待ち、go: 指示が出ている、show: 結果を見せている */
  phase: 'wait' | 'go' | 'show';
  timer: number;
  command: Command;
  /** この指示ではもう答えられない理由。early はお手つき（合図の前に触った） */
  locked: Record<Player, 'early' | 'miss' | null>;
  score: Record<Player, number>;
  /** 直前の指示で点を取った側。誰も取れなければ null */
  scorer: Player | null;
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
/** 指示が出てから答えられる秒数。ドクロはこの秒数だけ我慢すれば流れる */
const GO_S = 2.5;
const SKULL_S = 1.4;
const SHOW_S = 1.1;

const other = (p: Player): Player => (p === 1 ? 2 : 1);
const waitTime = (rand: () => number) => 1.2 + rand() * 2;

export function createState(rand: () => number = Math.random): GameState {
  return {
    phase: 'wait',
    timer: waitTime(rand),
    command: 'tap',
    locked: { 1: null, 2: null },
    score: { 1: 0, 2: 0 },
    scorer: null,
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
    state.command = pick(state.command, rand);
    state.timer = state.command === 'skull' ? SKULL_S : GO_S;
    return [{ type: 'go' }];
  }
  if (state.phase === 'go') return award(state, null);
  if (state.winner !== null) {
    state.timer = Infinity;
    return [{ type: 'win', player: state.winner }];
  }
  state.phase = 'wait';
  state.timer = waitTime(rand);
  state.locked = { 1: null, 2: null };
  state.scorer = null;
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
  if (given === state.command) return award(state, player);
  state.locked[player] = 'miss';
  const events: LightningEvent[] = [{ type: 'miss', player }];
  if (state.locked[other(player)]) events.push(...award(state, null));
  return events;
}
