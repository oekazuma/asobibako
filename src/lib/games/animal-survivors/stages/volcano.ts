import { ENEMIES } from '../enemies';
import { bossRun, FOREST, type Stage } from './forest';

/** 森の時刻の流れのまま、敵を火山の顔ぶれにして、雪山より一段強くした面 */
const HARDER = 1.4;

const SWAP: Record<string, string> = {
  rat: 'lizard',
  bat: 'fireball',
  snake: 'lavasnake',
  caterpillar: 'rockworm',
  boar: 'fireboar',
  spider: 'flamespider',
  croc: 'rockcroc'
};

const CHIEFS = ['rockworm', 'fireboar', 'rockcroc', 'fireboar'];

export const VOLCANO: Stage = {
  id: 'volcano',
  name: '火山',
  art: 'volcano',
  coin: 2.5,
  song: 'volcano',
  unlock: '雪山をクリアすると行ける',
  after: 'snow',
  length: 600,
  events: FOREST.events.map((ev) => {
    const to = SWAP[ev.enemy];
    return to ? { ...ev, enemy: to, text: ev.text.replace(ENEMIES[ev.enemy].name, ENEMIES[to].name) } : ev;
  }),
  chiefs: FOREST.chiefs.map((c, i) => ({ ...c, enemy: CHIEFS[i], hp: Math.round(c.hp * HARDER) })),
  bosses: bossRun('lavaGiant', 'phoenix', '火山の主'),
  storms: [],
  eruptions: [
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
