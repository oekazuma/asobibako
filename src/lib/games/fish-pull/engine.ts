import type { Player } from '$lib/player';

/** 魚の y は盤面の高さに対する 0..1。上がプレイヤー 2、下がプレイヤー 1 */
export interface GameState {
  fish: { y: number; v: number };
  /** 糸の張り。1 に達すると切れる */
  tension: Record<Player, number>;
  /** 糸が切れてから、また引けるようになるまでの残り秒 */
  stunned: Record<Player, number>;
  /** 暴れている残り秒。0 のときは落ち着いている */
  thrash: number;
  thrashDir: -1 | 1;
  calmFor: number;
  winner: Player | null;
}

export type FishEvent = { type: 'thrash' } | { type: 'snap'; player: Player } | { type: 'catch'; player: Player };

/** 手前のこの線まで引き寄せたら釣り上げ */
export const CATCH_Y: Record<Player, number> = { 1: 0.88, 2: 0.12 };
export const STUN_S = 1.5;
export const THRASH_S = 1.2;

/** 引いた長さ（盤面の高さ単位）あたりに魚へ与える速さ */
const PULL_GAIN = 0.35;
/** 引いた長さあたりの張りの増え方。暴れているときは一気に張る */
const TENSION_CALM = 0.5;
const TENSION_THRASH = 2.2;
const TENSION_DECAY = 0.45;
const SNAP_KICK = 0.35;
const THRASH_FORCE = 0.35;
const CENTER_PULL = 0.3;
const DAMPING = 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createState(rand: () => number = Math.random): GameState {
  return {
    fish: { y: 0.5, v: 0 },
    tension: { 1: 0, 2: 0 },
    stunned: { 1: 0, 2: 0 },
    thrash: 0,
    thrashDir: 1,
    calmFor: 2 + rand() * 2,
    winner: null
  };
}

/**
 * pulls はこのフレームに各プレイヤーが手前へ引いた長さ（盤面の高さ単位、0 以上）。
 * 指を手前へ動かした分だけ糸をたぐる
 */
export function step(
  state: GameState,
  dt: number,
  pulls: Record<Player, number>,
  rand: () => number = Math.random
): FishEvent[] {
  const events: FishEvent[] = [];
  if (state.winner !== null) return events;
  const fish = state.fish;

  if (state.thrash > 0) {
    state.thrash = Math.max(0, state.thrash - dt);
    fish.v += state.thrashDir * THRASH_FORCE * dt;
  } else {
    state.calmFor -= dt;
    if (state.calmFor <= 0) {
      state.thrash = THRASH_S;
      state.thrashDir = rand() < 0.5 ? -1 : 1;
      state.calmFor = 2.5 + rand() * 2.5;
      events.push({ type: 'thrash' });
    }
  }

  for (const player of [1, 2] as const) {
    // 手前へ引くと魚が近づく向き。1 は下（y が増える）、2 は上
    const toward = player === 1 ? 1 : -1;
    state.tension[player] = Math.max(0, state.tension[player] - TENSION_DECAY * dt);
    if (state.stunned[player] > 0) {
      state.stunned[player] = Math.max(0, state.stunned[player] - dt);
      continue;
    }
    const pull = Math.max(0, pulls[player]);
    fish.v += toward * pull * PULL_GAIN;
    state.tension[player] += pull * (state.thrash > 0 ? TENSION_THRASH : TENSION_CALM);
    if (state.tension[player] >= 1) {
      state.tension[player] = 0;
      state.stunned[player] = STUN_S;
      fish.v -= toward * SNAP_KICK;
      events.push({ type: 'snap', player });
    }
  }

  fish.v += (0.5 - fish.y) * CENTER_PULL * dt;
  fish.v *= Math.exp(-DAMPING * dt);
  fish.y = clamp(fish.y + fish.v * dt, 0, 1);

  const caught: Player | null = fish.y >= CATCH_Y[1] ? 1 : fish.y <= CATCH_Y[2] ? 2 : null;
  if (caught !== null) {
    state.winner = caught;
    events.push({ type: 'catch', player: caught });
  }
  return events;
}
