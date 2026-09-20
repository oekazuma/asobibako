export type Player = 1 | 2;
export type OrbKind = 'tap' | 'hold' | 'contest';

export interface Orb {
	id: number;
	kind: OrbKind;
	/** null は境界線上の奪い合い玉 */
	owner: Player | null;
	x: number;
	y: number;
}

export interface GameState {
	/** 画面上端からの境界位置 (0..1)。上側がプレイヤー2、下側がプレイヤー1 */
	border: number;
	orbs: Orb[];
	winner: Player | null;
}

export const GAIN: Record<OrbKind, number> = { tap: 0.03, hold: 0.075, contest: 0.1 };
export const HOLD_MS = 700;
export const ORB_LIFE_MS = 2600;

const WIN_MARGIN = 0.06;
/** 画面端側の余白。玉の半径に加えて Safe Area ぶんを逃がす */
const OUTER = 0.08;
/** 境界線側の余白。玉の半径と同じにして、線ぎりぎりまで玉が出るようにする */
const INNER = 0.045;

let nextId = 1;

export function createState(): GameState {
	return { border: 0.5, orbs: [], winner: null };
}

export function zone(state: GameState, owner: Player): [number, number] {
	return owner === 2 ? [OUTER, state.border - INNER] : [state.border + INNER, 1 - OUTER];
}

export function spawnOrb(
	state: GameState,
	kind: OrbKind,
	owner: Player | null,
	rand: () => number = Math.random,
): Orb {
	let y = state.border;
	if (owner !== null) {
		const [lo, hi] = zone(state, owner);
		y = hi > lo ? lo + rand() * (hi - lo) : (lo + hi) / 2;
	}
	const orb: Orb = { id: nextId++, kind, owner, x: 0.12 + rand() * 0.76, y };
	state.orbs.push(orb);
	return orb;
}

export function removeOrb(state: GameState, id: number): void {
	const i = state.orbs.findIndex((o) => o.id === id);
	if (i >= 0) state.orbs.splice(i, 1);
}

export function pop(state: GameState, id: number, by: Player): boolean {
	if (state.winner !== null) return false;
	const orb = state.orbs.find((o) => o.id === id);
	if (!orb) return false;
	if (orb.owner !== null && orb.owner !== by) return false;

	removeOrb(state, id);
	const delta = GAIN[orb.kind] * (by === 2 ? 1 : -1);
	state.border = Math.min(1, Math.max(0, state.border + delta));
	state.orbs = state.orbs.filter((o) => o.owner === null || inOwnZone(state, o));

	if (state.border <= WIN_MARGIN) state.winner = 1;
	else if (state.border >= 1 - WIN_MARGIN) state.winner = 2;
	return true;
}

function inOwnZone(state: GameState, orb: Orb): boolean {
	return orb.owner === 2 ? orb.y < state.border : orb.y > state.border;
}
