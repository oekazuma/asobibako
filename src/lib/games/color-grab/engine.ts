import type { Player } from '$lib/player';

/** 色だけに頼らないよう、色ごとに形も決めてある */
export const COLORS = ['red', 'blue', 'yellow', 'green'] as const;
export type Color = (typeof COLORS)[number];

/** 座標は盤面の幅・高さに対する 0..1 */
export interface Chip {
  id: number;
  color: Color;
  x: number;
  y: number;
  /** つかんでいる指の pointerId */
  heldBy: number | null;
  /** 一定間隔で色が変わり続ける玉 */
  chameleon: boolean;
  recolorAt: number;
}

export interface GameState {
  aspect: number;
  target: Color;
  targetChangeAt: number;
  chips: Chip[];
  scores: Record<Player, number>;
  winner: Player | null;
}

export type StepEvent = { type: 'target'; color: Color } | null;
export type DropResult =
  { type: 'claim'; player: Player; good: boolean; x: number; y: number } | { type: 'win'; player: Player } | null;

/** 2 人が手を伸ばして取り合う、境界線をまたぐ中央の帯 */
export const BAND: readonly [number, number] = [0.36, 0.64];
export const GOAL = 5;
export const CHIP_R = 0.045;
/** 左右の端はお題の表示に使うので、玉を出さない幅（盤面の幅に対する割合） */
export const EDGE_X = 0.16;

const CHIP_COUNT = 6;
const MIN_MATCH = 2;
const TARGET_MIN_MS = 4000;
const TARGET_MAX_MS = 7000;
const CHAMELEON_MS = 900;
const CHAMELEON_CHANCE = 0.2;

let nextId = 1;

const pick = <T>(items: readonly T[], rand: () => number) => items[Math.floor(rand() * items.length) % items.length];

export function createState(aspect: number, now: number, rand: () => number = Math.random): GameState {
  const state: GameState = {
    aspect,
    target: pick(COLORS, rand),
    targetChangeAt: now + TARGET_MIN_MS + rand() * (TARGET_MAX_MS - TARGET_MIN_MS),
    chips: [],
    scores: { 1: 0, 2: 0 },
    winner: null
  };
  refill(state, now, rand);
  return state;
}

/** 帯の中で、ほかの玉と重なりにくい位置を探す */
function place(state: GameState, rand: () => number): [number, number] {
  const rx = CHIP_R / state.aspect;
  let best: [number, number] = [0.5, 0.5];
  let bestGap = -1;
  for (let i = 0; i < 12; i++) {
    const x = EDGE_X + rx + rand() * (1 - (EDGE_X + rx) * 2);
    const y = BAND[0] + CHIP_R + rand() * (BAND[1] - BAND[0] - CHIP_R * 2);
    const gap = Math.min(...state.chips.map((c) => Math.hypot((c.x - x) * state.aspect, c.y - y)), Infinity);
    if (gap > bestGap) [best, bestGap] = [[x, y], gap];
    if (gap > CHIP_R * 3) break;
  }
  return best;
}

/** お題の色の玉が帯にいつも少なくとも何個かあるよう、空いている玉を塗り替える */
function ensureMatches(state: GameState) {
  const free = state.chips.filter((c) => c.heldBy === null && !c.chameleon);
  let matches = free.filter((c) => c.color === state.target).length;
  for (const chip of free) {
    if (matches >= MIN_MATCH) break;
    if (chip.color === state.target) continue;
    chip.color = state.target;
    matches++;
  }
}

/** 帯の玉を一定数に保ち、お題の色がいつも少なくとも何個かは取れるようにする */
function refill(state: GameState, now: number, rand: () => number) {
  while (state.chips.length < CHIP_COUNT) {
    const matches = state.chips.filter((c) => c.color === state.target && !c.chameleon).length;
    const chameleon = rand() < CHAMELEON_CHANCE;
    const color = matches < MIN_MATCH && !chameleon ? state.target : pick(COLORS, rand);
    const [x, y] = place(state, rand);
    state.chips.push({ id: nextId++, color, x, y, heldBy: null, chameleon, recolorAt: now + CHAMELEON_MS });
  }
}

export function step(state: GameState, now: number, rand: () => number = Math.random): StepEvent {
  if (state.winner !== null) return null;
  for (const chip of state.chips) {
    if (!chip.chameleon || now < chip.recolorAt) continue;
    chip.color = COLORS[(COLORS.indexOf(chip.color) + 1) % COLORS.length];
    chip.recolorAt = now + CHAMELEON_MS;
  }
  let event: StepEvent = null;
  if (now >= state.targetChangeAt) {
    // 同じ色が続くと「変わった」ことが伝わらないので、必ず別の色にする
    state.target = pick(
      COLORS.filter((c) => c !== state.target),
      rand
    );
    state.targetChangeAt = now + TARGET_MIN_MS + rand() * (TARGET_MAX_MS - TARGET_MIN_MS);
    event = { type: 'target', color: state.target };
    ensureMatches(state);
  }
  refill(state, now, rand);
  return event;
}

export function grab(state: GameState, chipId: number, pointerId: number): boolean {
  const chip = state.chips.find((c) => c.id === chipId);
  if (!chip || chip.heldBy !== null || state.winner !== null) return false;
  chip.heldBy = pointerId;
  return true;
}

export function moveChip(state: GameState, chipId: number, x: number, y: number): void {
  const chip = state.chips.find((c) => c.id === chipId);
  if (!chip) return;
  const rx = CHIP_R / state.aspect;
  chip.x = Math.min(1 - rx, Math.max(rx, x));
  chip.y = Math.min(1 - CHIP_R, Math.max(CHIP_R, y));
}

/**
 * 誰がつかんだかは問わず、どちらの陣地に置いたかで決まる。
 * 違う色を相手の陣地に押し込むと、相手の点が減る
 */
export function drop(state: GameState, chipId: number): DropResult {
  const chip = state.chips.find((c) => c.id === chipId);
  if (!chip) return null;
  chip.heldBy = null;
  const player: Player | null = chip.y > BAND[1] ? 1 : chip.y < BAND[0] ? 2 : null;
  if (player === null || state.winner !== null) {
    chip.y = Math.min(BAND[1] - CHIP_R, Math.max(BAND[0] + CHIP_R, chip.y));
    return null;
  }
  state.chips = state.chips.filter((c) => c !== chip);
  const good = chip.color === state.target;
  state.scores[player] = Math.max(0, state.scores[player] + (good ? 1 : -1));
  if (state.scores[player] >= GOAL) {
    state.winner = player;
    return { type: 'win', player };
  }
  return { type: 'claim', player, good, x: chip.x, y: chip.y };
}
