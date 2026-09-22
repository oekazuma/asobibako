import type { Player } from '$lib/player';

/** テストから、シェルが Game に渡した onfinish を呼ぶための受け皿 */
export const hooks: { level: number; solo?: (cleared: boolean) => void; duel?: (winner: Player) => void } = {
  level: 0
};
