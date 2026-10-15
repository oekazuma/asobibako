import { ENEMIES } from '../enemies';
import { bossRun, FOREST, type Stage } from './forest';

/** 森の時刻の流れのまま、敵を海岸の顔ぶれにして、火山より一段強くした面 */
const HARDER = 1.47;

const SWAP: Record<string, string> = {
  rat: 'crab',
  bat: 'gull',
  snake: 'seasnake',
  caterpillar: 'hermit',
  boar: 'walrus',
  spider: 'jelly',
  croc: 'landshark'
};

export const COAST: Stage = {
  id: 'coast',
  name: '海岸',
  art: 'coast',
  coin: 3,
  song: 'coast',
  unlock: '火山をクリアすると行ける',
  after: 'volcano',
  length: 600,
  events: FOREST.events.map((ev) => {
    const to = SWAP[ev.enemy];
    return to ? { ...ev, enemy: to, text: ev.text.replace(ENEMIES[ev.enemy].name, ENEMIES[to].name) } : ev;
  }),
  chiefs: FOREST.chiefs.map((c) => ({ ...c, enemy: SWAP[c.enemy] ?? c.enemy, hp: Math.round(c.hp * HARDER) })),
  bosses: bossRun('crabKing', 'octopus', '海岸の主'),
  storms: [],
  eruptions: [],
  tides: [
    { at: 95, len: 20 },
    { at: 215, len: 20 },
    { at: 335, len: 20 },
    { at: 455, len: 20 }
  ],
  blackouts: [],
  rings: [],
  waves: FOREST.waves.map((w) => ({ ...w, enemy: SWAP[w.enemy] ?? w.enemy })),
  cap: (t) => Math.min(400, Math.round(FOREST.cap(t) * 1.2)),
  toughness: (t) => FOREST.toughness(t) * HARDER,
  elite: FOREST.elite,
  fury: (t) => FOREST.fury(t) * HARDER
};
