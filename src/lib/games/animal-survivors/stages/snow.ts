import { ENEMIES } from '../enemies';
import { bossRun, FOREST, type Stage } from './forest';

/** 森の時刻の流れのまま、敵を雪の顔ぶれにして、墓地より一段強くした面 */
const HARDER = 1.2;

const SWAP: Record<string, string> = {
  rat: 'penguin',
  bat: 'snowsprite',
  snake: 'seal',
  caterpillar: 'snowman',
  boar: 'reindeer',
  spider: 'hare',
  croc: 'polar'
};

const CHIEFS = ['snowman', 'reindeer', 'polar', 'reindeer'];

export const SNOW: Stage = {
  id: 'snow',
  name: '雪山',
  art: 'snow',
  coin: 2,
  song: 'snow',
  unlock: '夜の墓地をクリアすると行ける',
  after: 'graveyard',
  length: 600,
  events: FOREST.events.map((ev) => {
    const to = SWAP[ev.enemy];
    return to ? { ...ev, enemy: to, text: ev.text.replace(ENEMIES[ev.enemy].name, ENEMIES[to].name) } : ev;
  }),
  chiefs: FOREST.chiefs.map((c, i) => ({ ...c, enemy: CHIEFS[i], hp: Math.round(c.hp * HARDER) })),
  bosses: bossRun('yeti', 'dragon', '雪山の主'),
  storms: [
    { at: 95, len: 20 },
    { at: 215, len: 20 },
    { at: 335, len: 20 },
    { at: 455, len: 20 }
  ],
  waves: FOREST.waves.map((w) => ({ ...w, enemy: SWAP[w.enemy] ?? w.enemy })),
  cap: (t) => Math.min(400, Math.round(FOREST.cap(t) * 1.15)),
  toughness: (t) => FOREST.toughness(t) * HARDER,
  elite: FOREST.elite,
  fury: (t) => FOREST.fury(t) * HARDER
};
