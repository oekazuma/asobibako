import type { BossId } from '../enemies';

export interface Wave {
  /** 秒 */
  from: number;
  to: number;
  enemy: string;
  /** 毎秒の出現数。from から to へ線形に変わる */
  rate: [number, number];
}

export interface StageEvent {
  at: number;
  kind: 'swarm' | 'ring' | 'elites' | 'lanterns' | 'treasure' | 'meteor' | 'festival';
  enemy: string;
  count: number;
  text: string;
}

/** 面の主。その面の 2 体のボスが、体力を増やしていっしょに出る */
export const FINALE = 540;
/** 2 回めのボスと面の主は、攻撃の間をこの値で割る */
export const RAGE = 1.5;

/** 2・4 分に 2 体を、6・8 分に同じ 2 体を攻撃を速めて出し、9 分に面の主 */
export const bossRun = (a: BossId, b: BossId, title: string): Stage['bosses'] => [
  { at: 120, id: a, hp: 0.6 },
  { at: 240, id: b, hp: 0.6 },
  { at: 360, id: a, rage: RAGE },
  { at: 480, id: b, rage: RAGE },
  { at: FINALE, id: a, hp: 1.5, rage: RAGE, title },
  { at: FINALE, id: b, hp: 1.5, rage: RAGE, title }
];

export interface Stage {
  id: string;
  name: string;
  /** 地面と飾りの絵 */
  art: 'forest' | 'graveyard' | 'snow';
  /** コインに掛ける倍率 */
  coin: number;
  /** 遊んでいるあいだの曲（songs.ts） */
  song: 'field' | 'grave' | 'snow';
  /** まだ選べないときに出す、選べる条件 */
  unlock?: string;
  /** 先にクリアしておく面。無ければ最初から選べる */
  after?: string;
  /** 吹雪が来る秒と続く秒 */
  storms: { at: number; len: number }[];
  /** 秒。ここまで生き延びればクリア */
  length: number;
  waves: Wave[];
  /**
   * 秒と、そのときに出すボス。同じ時刻の行はいっしょに出し、WARNING は 1 回だけ出す。
   * 体力は表の値にその時刻の toughness と hp を掛け、rage は攻撃の間を割る
   */
  bosses: { at: number; id: BossId; hp?: number; rage?: number; title?: string }[];
  /** 秒と、そのときに出すヌシ（ふつうの敵を 3 倍にしたもの）の元の敵と体力 */
  chiefs: { at: number; enemy: string; hp: number }[];
  /** 同時に出ている敵の上限 */
  cap: (t: number) => number;
  /** 敵の HP に掛ける */
  toughness: (t: number) => number;
  /** 出した敵が強化個体になる確率 */
  elite: (t: number) => number;
  /** 敵の攻撃力に掛ける */
  fury: (t: number) => number;
  /**
   * 時刻ごとの出来事。swarm は群れが画面を横切り、ring は輪になって迫り、
   * elites は強化個体が片側からまとまって来て、lanterns は自分の周りにランタンが灯る
   */
  events: StageEvent[];
}

export function spawnRate(w: Wave, t: number): number {
  if (t < w.from || t >= w.to) return 0;
  return w.rate[0] + ((w.rate[1] - w.rate[0]) * (t - w.from)) / (w.to - w.from);
}

export const FOREST: Stage = {
  id: 'forest',
  name: '森',
  art: 'forest',
  coin: 1,
  song: 'field',
  length: 600,
  storms: [],
  events: [
    { at: 30, kind: 'swarm', enemy: 'bat', count: 20, text: 'コウモリの大群！' },
    { at: 47, kind: 'meteor', enemy: '', count: 0, text: '流れ星が降ってくる！' },
    { at: 90, kind: 'lanterns', enemy: 'lantern', count: 8, text: 'ランタンが灯った！' },
    { at: 150, kind: 'ring', enemy: 'rat', count: 40, text: 'ネズミに囲まれた！' },
    { at: 167, kind: 'treasure', enemy: '', count: 0, text: '宝の地図を見つけた！' },
    { at: 210, kind: 'elites', enemy: 'snake', count: 3, text: 'ヘビの精鋭が来た！' },
    { at: 270, kind: 'swarm', enemy: 'boar', count: 12, text: 'イノシシの突進！' },
    { at: 287, kind: 'festival', enemy: '', count: 0, text: 'お祭りだ！ 経験値とコイン 2 倍' },
    { at: 330, kind: 'lanterns', enemy: 'lantern', count: 8, text: 'ランタンが灯った！' },
    { at: 347, kind: 'meteor', enemy: '', count: 0, text: '流れ星が降ってくる！' },
    { at: 390, kind: 'ring', enemy: 'caterpillar', count: 40, text: 'イモムシに囲まれた！' },
    { at: 407, kind: 'festival', enemy: '', count: 0, text: 'お祭りだ！ 経験値とコイン 2 倍' },
    { at: 450, kind: 'elites', enemy: 'boar', count: 4, text: 'イノシシの精鋭が来た！' },
    { at: 467, kind: 'treasure', enemy: '', count: 0, text: '宝の地図を見つけた！' },
    { at: 510, kind: 'swarm', enemy: 'bat', count: 80, text: 'コウモリの大群！' },
    { at: 570, kind: 'ring', enemy: 'snake', count: 60, text: 'ヘビに囲まれた！' }
  ],
  chiefs: [
    { at: 60, enemy: 'caterpillar', hp: 350 },
    { at: 180, enemy: 'boar', hp: 600 },
    { at: 300, enemy: 'croc', hp: 850 },
    { at: 420, enemy: 'boar', hp: 1100 }
  ],
  // 1 面だけは 6 体のボスが順に出る（墓地と雪山は 2 体が攻撃を速めてまた出る bossRun）
  bosses: [
    { at: 120, id: 'bear', hp: 0.6 },
    { at: 240, id: 'spiderQueen', hp: 0.8 },
    { at: 360, id: 'bigBoar' },
    { at: 480, id: 'bigEagle' },
    { at: FINALE, id: 'oldTree', hp: 1, rage: RAGE, title: '森の主' },
    { at: FINALE, id: 'bigSnake', hp: 1, rage: RAGE, title: '森の主' }
  ],
  waves: [
    { from: 0, to: 200, enemy: 'rat', rate: [0.8, 3] },
    { from: 40, to: 400, enemy: 'bat', rate: [0.5, 2.5] },
    { from: 120, to: 600, enemy: 'snake', rate: [0.5, 3] },
    { from: 200, to: 600, enemy: 'rat', rate: [3, 6] },
    { from: 240, to: 600, enemy: 'caterpillar', rate: [0.3, 2] },
    { from: 360, to: 600, enemy: 'boar', rate: [0.2, 1.2] },
    { from: 400, to: 600, enemy: 'bat', rate: [3, 6] },
    { from: 280, to: 600, enemy: 'spider', rate: [0.4, 2.5] },
    { from: 320, to: 600, enemy: 'croc', rate: [0.2, 1] },
    { from: 480, to: 600, enemy: 'rat', rate: [8, 14] }
  ],
  cap: (t) => Math.min(400, Math.round(30 + (t / 480) * 370)),
  toughness: (t) => 1 + (t / 600) * 4.2,
  elite: (t) => (t < 160 ? 0 : 0.02),
  fury: (t) => 0.6 + (t / 600) * 1.3
};
