import type { GameState, OrbKind } from './engine';

/** 弾けた玉の見た目。子は親から受け取って同じ演出を出す */
export interface Popped {
  kind: OrbKind;
  x: number;
  y: number;
  color: string;
}

/** 子が映すのに要る盤面。次の出現までの秒などルールを進めるためだけの値は送らない */
export type Snap = Pick<GameState, 'border' | 'orbs' | 'holds' | 'elapsed' | 'winner'> & { pops: Popped[] };

export const snapshot = ({ border, orbs, holds, elapsed, winner }: GameState) => ({
  border,
  orbs,
  holds,
  elapsed,
  winner
});

export function apply(game: GameState, snap: Snap): void {
  game.border = snap.border;
  game.orbs = snap.orbs;
  game.holds = snap.holds;
  game.elapsed = snap.elapsed;
  game.winner = snap.winner;
}
