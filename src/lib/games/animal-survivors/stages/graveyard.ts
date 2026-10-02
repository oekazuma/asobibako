import { FOREST, type Stage } from './forest';

/** 森の時刻の流れのまま、敵を墓地の顔ぶれにして 1 段強くした面 */
const HARDER = 1.3;

const SWAP: Record<string, string> = { rat: 'ghost', snake: 'skeleton', caterpillar: 'zombie' };

export const GRAVEYARD: Stage = {
  id: 'graveyard',
  name: '夜の墓地',
  art: 'graveyard',
  coin: 1.5,
  song: 'grave',
  unlock: '森をクリアすると行ける',
  length: 900,
  events: [
    { at: 90, kind: 'swarm', enemy: 'ghost', count: 30, text: 'おばけの大群！' },
    { at: 180, kind: 'ring', enemy: 'skeleton', count: 40, text: 'ガイコツに囲まれた！' },
    { at: 270, kind: 'swarm', enemy: 'bat', count: 50, text: 'コウモリの大群！' },
    { at: 390, kind: 'ring', enemy: 'zombie', count: 30, text: 'ゾンビに囲まれた！' },
    { at: 480, kind: 'swarm', enemy: 'ghost', count: 60, text: 'おばけの大群！' },
    { at: 660, kind: 'swarm', enemy: 'bat', count: 80, text: 'コウモリの大群！' },
    { at: 750, kind: 'ring', enemy: 'skeleton', count: 60, text: 'ガイコツに囲まれた！' },
    { at: 840, kind: 'ring', enemy: 'zombie', count: 40, text: 'ゾンビに囲まれた！' }
  ],
  bosses: [
    { at: 300, id: 'pumpkin' },
    { at: 600, id: 'knight' }
  ],
  waves: FOREST.waves.map((w) => ({ ...w, enemy: SWAP[w.enemy] ?? w.enemy })),
  cap: (t) => Math.min(400, Math.round(FOREST.cap(t) * 1.15)),
  toughness: (t) => FOREST.toughness(t) * HARDER,
  elite: FOREST.elite,
  fury: (t) => FOREST.fury(t) * HARDER
};
