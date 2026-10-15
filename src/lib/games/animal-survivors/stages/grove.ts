import { ENEMIES } from '../enemies';
import { bossRun, FOREST, type Stage } from './forest';

/** 森の時刻の流れのまま、敵を魔法の森の顔ぶれにして、夜の街より一段強くした面 */
const HARDER = 1.5;

const SWAP: Record<string, string> = {
  rat: 'shroomling',
  bat: 'pixie',
  snake: 'vineSnake',
  caterpillar: 'gemSnail',
  boar: 'thornBoar',
  spider: 'hopFrog',
  croc: 'stumpGhost'
};

export const GROVE: Stage = {
  id: 'grove',
  name: '魔法の森',
  art: 'grove',
  coin: 4,
  song: 'grove',
  unlock: '夜の街をクリアすると行ける',
  after: 'city',
  length: 600,
  events: FOREST.events.map((ev) => {
    const to = SWAP[ev.enemy];
    return to ? { ...ev, enemy: to, text: ev.text.replace(ENEMIES[ev.enemy].name, ENEMIES[to].name) } : ev;
  }),
  chiefs: FOREST.chiefs.map((c) => ({ ...c, enemy: SWAP[c.enemy] ?? c.enemy, hp: Math.round(c.hp * HARDER) })),
  bosses: bossRun('stag', 'witch', '魔法の森の主'),
  storms: [],
  eruptions: [],
  tides: [],
  blackouts: [],
  rings: [
    { at: 95, len: 20 },
    { at: 215, len: 20 },
    { at: 335, len: 20 },
    { at: 455, len: 20 }
  ],
  waves: FOREST.waves.map((w) => ({ ...w, enemy: SWAP[w.enemy] ?? w.enemy })),
  cap: (t) => Math.min(400, Math.round(FOREST.cap(t) * 1.2)),
  toughness: (t) => FOREST.toughness(t) * HARDER,
  elite: FOREST.elite,
  fury: (t) => FOREST.fury(t) * HARDER
};
