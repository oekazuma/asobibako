import { ANIMALS } from './animals';
import { ENEMIES } from './enemies';

/** 図鑑に載せるもの。敵は面のふつうの敵とボスの手下、ボスはボスときらきらハリネズミ */
export const BOOK = {
  enemies: Object.values(ENEMIES)
    .filter((d) => !d.prop && !d.boss && !d.metal)
    .map((d) => d.id),
  bosses: [...Object.values(ENEMIES).flatMap((d) => (d.boss ? [d.boss as string] : [])), 'metal'],
  forms: ANIMALS.flatMap((a) => [0, 1, 2].map((f) => `${a.id}:${f}`)),
  items: ['meat', 'pouch', 'purse', 'magnet', 'goldMagnet', 'cross', 'clock', 'chest', 'bag']
};

/** その回に図鑑へ足すもの */
export interface RunBook {
  kills: Record<string, number>;
  elites: string[];
  chiefs: string[];
  bosses: { id: string; secs: number }[];
  forms: string[];
  items: string[];
}
