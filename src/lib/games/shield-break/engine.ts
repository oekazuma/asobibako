import type { Player } from '$lib/player';

/** 拍ごとに 2 人の行動を同時に比べる。attack はエネルギーを 1 使い、guard は盾で 1 回ぶん受け止める */
export type Action = 'charge' | 'attack' | 'guard' | 'none';

export interface Outcome {
  act: Record<Player, Action>;
  /** 攻撃を受けて体力が減った */
  hit: Record<Player, boolean>;
  /** 盾で受け止めた */
  blocked: Record<Player, boolean>;
}

export interface GameState {
  /** 今の拍の長さ（秒）。拍を重ねるほど短くなる */
  beat: number;
  timer: number;
  life: Record<Player, number>;
  energy: Record<Player, number>;
  shield: Record<Player, number>;
  /** この拍に出した行動。ガードは拍の瞬間に指を置いているかで決めるので、ここには入らない */
  pending: Record<Player, 'charge' | 'attack' | null>;
  last: Outcome | null;
  winner: Player | null;
}

export type ShieldEvent =
  | { type: 'beat'; outcome: Outcome }
  | { type: 'empty'; player: Player }
  | { type: 'win'; player: Player };

export const LIFE = 3;
export const MAX_ENERGY = 3;
export const SHIELD = 3;
const FIRST_BEAT = 1.8;
const FASTEST_BEAT = 1.1;
const SPEED_UP = 0.05;
/** 決着の拍の結果を見せてから勝敗画面へ移るまで */
const FINISH_S = 0.9;

const other = (p: Player): Player => (p === 1 ? 2 : 1);

export function createState(): GameState {
  return {
    beat: FIRST_BEAT,
    timer: FIRST_BEAT + 1,
    life: { 1: LIFE, 2: LIFE },
    energy: { 1: 0, 2: 0 },
    shield: { 1: SHIELD, 2: SHIELD },
    pending: { 1: null, 2: null },
    last: null,
    winner: null
  };
}

/** 拍の間に何度でも選び直せ、最後に選んだものが拍の瞬間に出る。エネルギーがなければ攻撃は選べない */
export function choose(state: GameState, player: Player, action: 'charge' | 'attack'): ShieldEvent[] {
  if (state.winner !== null) return [];
  if (action === 'attack' && state.energy[player] === 0) return [{ type: 'empty', player }];
  state.pending[player] = action;
  return [];
}

function resolve(state: GameState, guarding: Record<Player, boolean>): Outcome {
  const act = { 1: 'none', 2: 'none' } as Record<Player, Action>;
  for (const p of [1, 2] as const) {
    const chosen = state.pending[p];
    // スワイプした指をそのまま置いていても攻撃は出る。ためる（タップ）より、置いた指のガードを優先する
    act[p] = chosen === 'attack' ? 'attack' : guarding[p] ? 'guard' : (chosen ?? 'none');
  }
  const outcome: Outcome = { act, hit: { 1: false, 2: false }, blocked: { 1: false, 2: false } };
  for (const p of [1, 2] as const) {
    if (act[p] === 'charge') state.energy[p] = Math.min(MAX_ENERGY, state.energy[p] + 1);
    if (act[p] !== 'attack') continue;
    state.energy[p] -= 1;
    const o = other(p);
    // 両者の攻撃は相打ちで消える
    if (act[o] === 'attack') continue;
    if (act[o] === 'guard' && state.shield[o] > 0) {
      state.shield[o] -= 1;
      outcome.blocked[o] = true;
    } else {
      state.life[o] -= 1;
      outcome.hit[o] = true;
    }
  }
  return outcome;
}

export function step(state: GameState, dt: number, guarding: Record<Player, boolean>): ShieldEvent[] {
  state.timer -= dt;
  if (state.timer > 0) return [];
  if (state.winner !== null) {
    state.timer = Infinity;
    return [{ type: 'win', player: state.winner }];
  }
  const outcome = resolve(state, guarding);
  state.last = outcome;
  state.pending = { 1: null, 2: null };
  for (const p of [1, 2] as const) if (state.life[p] <= 0) state.winner = other(p);
  state.beat = Math.max(FASTEST_BEAT, state.beat - SPEED_UP);
  state.timer = state.winner !== null ? FINISH_S : state.beat;
  return [{ type: 'beat', outcome }];
}
