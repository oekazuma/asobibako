import { ENEMIES } from '../enemies';
import { FOREST, finale, type Stage } from './forest';

/** 森の時刻の流れのまま、敵を墓地の顔ぶれにして 1 段強くした面 */
const HARDER = 1.15;

const SWAP: Record<string, string> = { rat: 'ghost', snake: 'skeleton', caterpillar: 'zombie' };

export const GRAVEYARD: Stage = {
  id: 'graveyard',
  name: '夜の墓地',
  art: 'graveyard',
  coin: 1.5,
  song: 'grave',
  unlock: '森をクリアすると行ける',
  length: 900,
  events: FOREST.events.map((ev) => {
    const to = SWAP[ev.enemy];
    return to ? { ...ev, enemy: to, text: ev.text.replace(ENEMIES[ev.enemy].name, ENEMIES[to].name) } : ev;
  }),
  chiefs: [
    { at: 120, enemy: 'skeleton', hp: 460 },
    { at: 240, enemy: 'zombie', hp: 630 },
    { at: 420, enemy: 'ghost', hp: 920 },
    { at: 540, enemy: 'skeleton', hp: 1090 },
    { at: 720, enemy: 'zombie', hp: 1380 }
  ],
  bosses: finale([
    { at: 300, id: 'pumpkin' },
    { at: 600, id: 'knight' }
  ]),
  waves: FOREST.waves.map((w) => ({ ...w, enemy: SWAP[w.enemy] ?? w.enemy })),
  cap: (t) => Math.min(400, Math.round(FOREST.cap(t) * 1.15)),
  toughness: (t) => FOREST.toughness(t) * HARDER,
  elite: FOREST.elite,
  fury: (t) => FOREST.fury(t) * HARDER
};
