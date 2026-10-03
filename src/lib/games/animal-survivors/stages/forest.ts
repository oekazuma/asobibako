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
export const FINALE = 810;
/** 2 回めのボスと面の主は、攻撃の間をこの値で割る */
export const RAGE = 1.5;

/** 3・6 分に 2 体を、9・12 分に同じ 2 体を攻撃を速めて出し、13:30 に面の主 */
export const bossRun = (a: BossId, b: BossId): Stage['bosses'] => [
  { at: 180, id: a, hp: 0.6 },
  { at: 360, id: b, hp: 0.8 },
  { at: 540, id: a, rage: RAGE },
  { at: 720, id: b, rage: RAGE },
  { at: FINALE, id: a, hp: 1.5, rage: RAGE, title: '面の主' },
  { at: FINALE, id: b, hp: 1.5, rage: RAGE, title: '面の主' }
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
  length: 900,
  storms: [],
  events: [
    { at: 45, kind: 'swarm', enemy: 'bat', count: 20, text: 'コウモリの大群！' },
    { at: 70, kind: 'meteor', enemy: '', count: 0, text: '流れ星が降ってくる！' },
    { at: 135, kind: 'lanterns', enemy: 'lantern', count: 8, text: 'ランタンが灯った！' },
    { at: 225, kind: 'ring', enemy: 'rat', count: 40, text: 'ネズミに囲まれた！' },
    { at: 250, kind: 'treasure', enemy: '', count: 0, text: '宝の地図を見つけた！' },
    { at: 315, kind: 'elites', enemy: 'snake', count: 3, text: 'ヘビの精鋭が来た！' },
    { at: 405, kind: 'swarm', enemy: 'boar', count: 12, text: 'イノシシの突進！' },
    { at: 430, kind: 'festival', enemy: '', count: 0, text: 'お祭りだ！ 経験値とコイン 2 倍' },
    { at: 495, kind: 'lanterns', enemy: 'lantern', count: 8, text: 'ランタンが灯った！' },
    { at: 520, kind: 'meteor', enemy: '', count: 0, text: '流れ星が降ってくる！' },
    { at: 585, kind: 'ring', enemy: 'caterpillar', count: 40, text: 'イモムシに囲まれた！' },
    { at: 610, kind: 'festival', enemy: '', count: 0, text: 'お祭りだ！ 経験値とコイン 2 倍' },
    { at: 675, kind: 'elites', enemy: 'boar', count: 4, text: 'イノシシの精鋭が来た！' },
    { at: 700, kind: 'treasure', enemy: '', count: 0, text: '宝の地図を見つけた！' },
    { at: 765, kind: 'swarm', enemy: 'bat', count: 80, text: 'コウモリの大群！' },
    { at: 855, kind: 'ring', enemy: 'snake', count: 60, text: 'ヘビに囲まれた！' }
  ],
  chiefs: [
    { at: 90, enemy: 'caterpillar', hp: 350 },
    { at: 270, enemy: 'boar', hp: 600 },
    { at: 450, enemy: 'croc', hp: 850 },
    { at: 630, enemy: 'boar', hp: 1100 }
  ],
  // 1 面だけは 6 体のボスが順に出る（墓地と雪山は 2 体が攻撃を速めてまた出る bossRun）
  bosses: [
    { at: 180, id: 'bear', hp: 0.6 },
    { at: 360, id: 'spiderQueen', hp: 0.8 },
    { at: 540, id: 'bigBoar' },
    { at: 720, id: 'bigEagle' },
    { at: FINALE, id: 'oldTree', hp: 1.5, rage: RAGE, title: '面の主' },
    { at: FINALE, id: 'bigSnake', hp: 1.5, rage: RAGE, title: '面の主' }
  ],
  waves: [
    { from: 0, to: 300, enemy: 'rat', rate: [0.8, 3] },
    { from: 60, to: 600, enemy: 'bat', rate: [0.5, 2.5] },
    { from: 180, to: 900, enemy: 'snake', rate: [0.5, 3] },
    { from: 300, to: 900, enemy: 'rat', rate: [3, 6] },
    { from: 360, to: 900, enemy: 'caterpillar', rate: [0.3, 2] },
    { from: 540, to: 900, enemy: 'boar', rate: [0.2, 1.2] },
    { from: 600, to: 900, enemy: 'bat', rate: [3, 6] },
    { from: 420, to: 900, enemy: 'spider', rate: [0.4, 2.5] },
    { from: 480, to: 900, enemy: 'croc', rate: [0.2, 1] },
    { from: 720, to: 900, enemy: 'rat', rate: [8, 14] }
  ],
  cap: (t) => Math.min(400, Math.round(30 + (t / 720) * 370)),
  toughness: (t) => 1 + (t / 900) * 6.5,
  elite: (t) => (t < 240 ? 0 : 0.02),
  fury: (t) => 0.6 + (t / 900) * 2
};
