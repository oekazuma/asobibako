import type { BossId } from '../enemies';

export interface Wave {
  /** 秒 */
  from: number;
  to: number;
  enemy: string;
  /** 毎秒の出現数。from から to へ線形に変わる */
  rate: [number, number];
}

export interface Stage {
  id: string;
  name: string;
  /** 秒。ここまで生き延びればクリア */
  length: number;
  waves: Wave[];
  /** 秒と、そのときに出すボス */
  bosses: { at: number; id: BossId }[];
  /** 同時に出ている敵の上限 */
  cap: (t: number) => number;
  /** 敵の HP に掛ける */
  toughness: (t: number) => number;
  /** 出した敵が強化個体になる確率 */
  elite: (t: number) => number;
  /** 敵の攻撃力に掛ける */
  fury: (t: number) => number;
  /** 時刻ごとの出来事。swarm は群れが画面を横切り、ring は輪になって迫る */
  events: { at: number; kind: 'swarm' | 'ring'; enemy: string; count: number; text: string }[];
}

export function spawnRate(w: Wave, t: number): number {
  if (t < w.from || t >= w.to) return 0;
  return w.rate[0] + ((w.rate[1] - w.rate[0]) * (t - w.from)) / (w.to - w.from);
}

export const FOREST: Stage = {
  id: 'forest',
  name: '森',
  length: 900,
  events: [
    { at: 90, kind: 'swarm', enemy: 'bat', count: 30, text: 'コウモリの大群！' },
    { at: 180, kind: 'ring', enemy: 'rat', count: 40, text: 'ネズミに囲まれた！' },
    { at: 270, kind: 'swarm', enemy: 'bat', count: 50, text: 'コウモリの大群！' },
    { at: 390, kind: 'swarm', enemy: 'boar', count: 12, text: 'イノシシの突進！' },
    { at: 480, kind: 'ring', enemy: 'caterpillar', count: 40, text: 'イモムシに囲まれた！' },
    { at: 660, kind: 'swarm', enemy: 'bat', count: 80, text: 'コウモリの大群！' },
    { at: 750, kind: 'ring', enemy: 'snake', count: 60, text: 'ヘビに囲まれた！' },
    { at: 840, kind: 'swarm', enemy: 'boar', count: 20, text: 'イノシシの突進！' }
  ],
  bosses: [
    { at: 300, id: 'bear' },
    { at: 600, id: 'spiderQueen' }
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
  toughness: (t) => 1 + (t / 900) * 3,
  elite: (t) => (t < 240 ? 0 : 0.02),
  fury: (t) => 0.6 + (t / 900) * 1.4
};
