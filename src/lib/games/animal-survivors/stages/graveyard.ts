import { ENEMIES } from '../enemies';
import { bossRun, FOREST, type Stage } from './forest';

/** 森の時刻の流れのまま、敵を墓地の顔ぶれにして 1 段強くした面 */
/** 敵の顔ぶれ（おばけ・ガイコツ・ゾンビ）が森の敵より 1.3〜2 倍硬いので、表の倍率は森より下げる（1.1 だと雪山より難しく出た。ボットで測った） */
export const HARDER = 0.9;

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
  bosses: bossRun('knight', 'pumpkin', '墓地の主'),
  waves: FOREST.waves.map((w) => ({ ...w, enemy: SWAP[w.enemy] ?? w.enemy })),
  cap: (t) => Math.min(400, Math.round(FOREST.cap(t) * 1.15)),
  toughness: (t) => FOREST.toughness(t) * HARDER,
  elite: FOREST.elite,
  fury: (t) => FOREST.fury(t) * HARDER
};
