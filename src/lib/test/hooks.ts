import type { Player } from '$lib/player';

/** テストから、シェルが Game に渡した onfinish / onhint を呼ぶための受け皿 */
export const hooks: {
  level: number;
  solo?: (cleared: boolean) => void;
  duel?: (winner: Player) => void;
  hint?: (text: string) => void;
} = {
  level: 0
};
