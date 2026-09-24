import type { Player } from '$lib/player';

export type OrbKind = 'tap' | 'hold' | 'contest';

export interface Orb {
  id: number;
  kind: OrbKind;
  /** null は境界線上の奪い合い玉 */
  owner: Player | null;
  x: number;
  y: number;
  bornAt: number;
}

export interface GameState {
  /** 画面上端からの境界位置 (0..1)。上側がプレイヤー2、下側がプレイヤー1 */
  border: number;
  orbs: Orb[];
  winner: Player | null;
  nextId: number;
  /** 次の出現までの秒 */
  spawnIn: number;
  /** 長押し中の玉の id → 押し始めてからの秒 */
  holds: Record<number, number>;
  /** 始まってからの秒 */
  elapsed: number;
}

export const GAIN: Record<OrbKind, number> = { tap: 0.03, hold: 0.075, contest: 0.1 };
export const HOLD_MS = 700;
export const ORB_LIFE_MS = 2600;
export const MAX_PER_PLAYER = 3;
export const SPAWN_S = 0.34;
/** 互角だと玉の効果が打ち消し合って長引くので、この秒を過ぎたら押す量を RUSH_RAMP_S かけて 2 倍まで増やす */
export const RUSH_S = 45;
const RUSH_RAMP_S = 30;
const CONTEST_CHANCE = 0.16;
const HOLD_CHANCE = 0.28;

/** 境界線が画面の端からこの距離まで押し込まれたら決着 */
export const WIN_MARGIN = 0.06;
/** 画面端側の余白。玉の半径に加えて Safe Area ぶんを逃がす */
const OUTER = 0.08;
/** 境界線側の余白。玉の半径と同じにして、線ぎりぎりまで玉が出るようにする */
const INNER = 0.045;

export function createState(): GameState {
  return { border: 0.5, orbs: [], winner: null, nextId: 1, spawnIn: 0, holds: {}, elapsed: 0 };
}

export function zone(state: GameState, owner: Player): [number, number] {
  return owner === 2 ? [OUTER, state.border - INNER] : [state.border + INNER, 1 - OUTER];
}

export function spawnOrb(
  state: GameState,
  kind: OrbKind,
  owner: Player | null,
  now: number,
  rand: () => number = Math.random
): Orb {
  let y = state.border;
  if (owner !== null) {
    const [lo, hi] = zone(state, owner);
    y = hi > lo ? lo + rand() * (hi - lo) : (lo + hi) / 2;
  }
  const orb: Orb = { id: state.nextId++, kind, owner, x: 0.12 + rand() * 0.76, y, bornAt: now };
  state.orbs.push(orb);
  return orb;
}

/** 寿命切れの玉を落とす。玉ごとにタイマーを持たず、スポーンの間隔で見る */
export function expire(state: GameState, now: number): void {
  state.orbs = state.orbs.filter((o) => now - o.bornAt < ORB_LIFE_MS);
}

export function pop(state: GameState, id: number, by: Player): boolean {
  if (state.winner !== null) return false;
  const orb = state.orbs.find((o) => o.id === id);
  if (!orb) return false;
  if (orb.owner !== null && orb.owner !== by) return false;

  state.orbs = state.orbs.filter((o) => o.id !== id);
  delete state.holds[id];
  const rush = 1 + Math.min(1, Math.max(0, state.elapsed - RUSH_S) / RUSH_RAMP_S);
  const delta = GAIN[orb.kind] * rush * (by === 2 ? 1 : -1);
  state.border = Math.min(1, Math.max(0, state.border + delta));
  state.orbs = state.orbs.filter((o) => o.owner === null || inOwnZone(state, o));

  if (state.border <= WIN_MARGIN) state.winner = 1;
  else if (state.border >= 1 - WIN_MARGIN) state.winner = 2;
  return true;
}

function inOwnZone(state: GameState, orb: Orb): boolean {
  return orb.owner === 2 ? orb.y < state.border : orb.y > state.border;
}

export type BorderEvent =
  { type: 'pop'; kind: OrbKind; x: number; y: number; by: Player } | { type: 'win'; player: Player };

/** 出現の周期ごとに、寿命切れを落とし、各陣地を上限まで埋め、境界の奪い合い玉をときどき出す */
function spawnWave(state: GameState, now: number, rand: () => number) {
  expire(state, now);
  for (const p of [1, 2] as const) {
    if (state.orbs.filter((o) => o.owner === p).length < MAX_PER_PLAYER)
      spawnOrb(state, rand() < HOLD_CHANCE ? 'hold' : 'tap', p, now, rand);
  }
  if (!state.orbs.some((o) => o.owner === null) && rand() < CONTEST_CHANCE) spawnOrb(state, 'contest', null, now, rand);
}

/** now は ms（CSS の寿命アニメーションと合わせる）、dt は秒 */
export function step(state: GameState, dt: number, now: number, rand: () => number = Math.random): BorderEvent[] {
  if (state.winner !== null) return [];
  const events: BorderEvent[] = [];
  state.elapsed += dt;
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    spawnWave(state, now, rand);
    state.spawnIn = SPAWN_S;
  }
  for (const key of Object.keys(state.holds)) {
    const id = Number(key);
    state.holds[id] += dt;
    if (state.holds[id] * 1000 < HOLD_MS) continue;
    const orb = state.orbs.find((o) => o.id === id);
    delete state.holds[id];
    if (orb && orb.owner !== null && pop(state, id, orb.owner))
      events.push({ type: 'pop', kind: orb.kind, x: orb.x, y: orb.y, by: orb.owner });
    if (state.winner !== null) {
      events.push({ type: 'win', player: state.winner });
      break;
    }
  }
  return events;
}

/** 長押しの玉を押し始めた・離した */
export function beginHold(state: GameState, id: number): void {
  const orb = state.orbs.find((o) => o.id === id);
  if (orb?.kind === 'hold' && !(id in state.holds)) state.holds[id] = 0;
}

export function endHold(state: GameState, id: number): void {
  delete state.holds[id];
}
