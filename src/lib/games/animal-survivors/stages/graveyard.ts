import { ENEMIES } from '../enemies';
import { bossRun, FOREST, type Stage } from './forest';

/** 森の時刻の流れのまま、敵を墓地の顔ぶれにして 1 段強くした面 */
const HARDER = 1.1;

const CHIEFS = ['skeleton', 'zombie', 'ghost', 'skeleton'];

const SWAP: Record<string, string> = { rat: 'ghost', snake: 'skeleton', caterpillar: 'zombie' };

export const GRAVEYARD: Stage = {
  id: 'graveyard',
  name: '夜の墓地',
  art: 'graveyard',
  coin: 1.5,
  song: 'grave',
  unlock: '森をクリアすると行ける',
  after: 'forest',
  storms: [],
  eruptions: [],
  length: 600,
  events: FOREST.events.map((ev) => {
    const to = SWAP[ev.enemy];
    return to ? { ...ev, enemy: to, text: ev.text.replace(ENEMIES[ev.enemy].name, ENEMIES[to].name) } : ev;
  }),
  chiefs: FOREST.chiefs.map((c, i) => ({ ...c, enemy: CHIEFS[i], hp: Math.round(c.hp * HARDER) })),
  // 4:00 のかぼちゃ大王で倒れる回が多く、雪山や火山より難しく出ていた（ボットで測った）
  bosses: bossRun('knight', 'pumpkin', '墓地の主', 0.4),
  waves: FOREST.waves.map((w) => ({ ...w, enemy: SWAP[w.enemy] ?? w.enemy })),
  cap: (t) => Math.min(400, Math.round(FOREST.cap(t) * 1.15)),
  toughness: (t) => FOREST.toughness(t) * HARDER,
  elite: FOREST.elite,
  fury: (t) => FOREST.fury(t) * HARDER
};
