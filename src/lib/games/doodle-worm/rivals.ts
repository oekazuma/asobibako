import type { Point, Stroke } from './engine';

/** トーナメントの相手。絵は子どもが描いたような線で組み、手足の付き方で動き方と持ち味が決まる（battle の stats） */
export interface Rival {
  name: string;
  strokes: Stroke[];
}

const oval = (color: string, cx: number, cy: number, rx: number, ry = rx): Stroke => ({
  color,
  pts: Array.from({ length: 25 }, (_, i): Point => {
    const t = (i / 24) * Math.PI * 2;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
  })
});

const line = (color: string, ...pts: Point[]): Stroke => ({ color, pts });

/** 左右に波打って伸びる線（しっぽ・はね） */
const wave = (color: string, x0: number, y0: number, dx: number, amp: number): Stroke => ({
  color,
  pts: Array.from({ length: 13 }, (_, i): Point => [x0 + (dx * i) / 12, y0 + Math.sin(i / 2) * amp])
});

const ROUND1: Rival[] = [
  { name: 'ぷるるん', strokes: [oval('#b3ec3a', 0, 0, 0.09, 0.07)] },
  { name: 'ニョロ', strokes: [oval('#a974f2', 0, 0, 0.06), wave('#a974f2', 0.06, 0.01, 0.2, 0.02)] },
  {
    name: 'パタパタ',
    strokes: [
      oval('#ffd84d', 0, 0, 0.065),
      line('#f5913e', [-0.06, -0.01], [-0.12, -0.06], [-0.15, 0.0]),
      line('#f5913e', [0.06, -0.01], [0.12, -0.06], [0.15, 0.0])
    ]
  },
  {
    name: 'ピョンタ',
    strokes: [
      oval('#ffb3d1', 0, 0, 0.075),
      oval('#ffb3d1', -0.03, -0.12, 0.018, 0.05),
      oval('#ffb3d1', 0.03, -0.12, 0.018, 0.05)
    ]
  },
  {
    name: 'ふわクラゲ',
    strokes: [
      oval('#5ee0c8', 0, 0, 0.08, 0.06),
      line('#5ee0c8', [-0.04, 0.055], [-0.05, 0.08], [-0.04, 0.11]),
      line('#5ee0c8', [0.04, 0.055], [0.05, 0.08], [0.04, 0.11])
    ]
  }
];

const ROUND2: Rival[] = [
  {
    name: 'ポコ',
    strokes: [
      oval('#8a5a3c', 0, 0, 0.08),
      oval('#8a5a3c', -0.055, -0.075, 0.025),
      oval('#8a5a3c', 0.055, -0.075, 0.025),
      line('#8a5a3c', [-0.04, 0.075], [-0.045, 0.13]),
      line('#8a5a3c', [0.04, 0.075], [0.045, 0.13])
    ]
  },
  {
    name: 'カニカニ',
    strokes: [
      oval('#f04438', 0, 0, 0.09, 0.06),
      oval('#f04438', -0.13, -0.04, 0.03),
      oval('#f04438', 0.13, -0.04, 0.03),
      line('#f04438', [-0.05, 0.05], [-0.07, 0.11]),
      line('#f04438', [0, 0.06], [0, 0.12]),
      line('#f04438', [0.05, 0.05], [0.07, 0.11])
    ]
  },
  {
    name: 'トゲトゲ',
    strokes: [
      oval('#63a8f7', 0, 0, 0.075),
      line('#3bb54a', [-0.04, -0.06], [-0.05, -0.12], [-0.02, -0.07]),
      line('#3bb54a', [0.02, -0.07], [0.05, -0.12], [0.04, -0.06]),
      wave('#63a8f7', -0.075, 0.02, -0.17, 0.015)
    ]
  },
  {
    name: 'ハリー',
    strokes: [
      oval('#8a5a3c', 0, 0, 0.085, 0.07),
      line('#2b2d42', [-0.05, -0.06], [-0.06, -0.12], [-0.02, -0.07]),
      line('#2b2d42', [-0.01, -0.07], [0.01, -0.13], [0.03, -0.07]),
      line('#2b2d42', [0.03, -0.065], [0.06, -0.12], [0.06, -0.05]),
      line('#8a5a3c', [-0.04, 0.065], [-0.045, 0.11]),
      line('#8a5a3c', [0.04, 0.065], [0.045, 0.11])
    ]
  },
  {
    name: 'タコすけ',
    strokes: [
      oval('#f04438', 0, 0, 0.08),
      line('#f04438', [-0.05, 0.06], [-0.07, 0.09], [-0.06, 0.12]),
      line('#f04438', [-0.015, 0.075], [-0.02, 0.12]),
      line('#f04438', [0.015, 0.075], [0.02, 0.12]),
      line('#f04438', [0.05, 0.06], [0.07, 0.09], [0.06, 0.12])
    ]
  }
];

const FINALS: Rival[] = [
  {
    name: 'ドラゴン',
    strokes: [
      oval('#3bb54a', 0, 0, 0.11, 0.1),
      oval('#ffd84d', 0.01, 0.02, 0.06, 0.05),
      line('#2b2d42', [-0.035, -0.045]),
      line('#2b2d42', [0.035, -0.045]),
      line('#f5913e', [0, -0.1], [0.01, -0.16]),
      line('#3bb54a', [-0.1, -0.03], [-0.17, -0.1], [-0.2, -0.02]),
      line('#3bb54a', [0.1, -0.03], [0.17, -0.1], [0.2, -0.02]),
      line('#3bb54a', [-0.05, 0.09], [-0.06, 0.15]),
      line('#3bb54a', [0.05, 0.09], [0.06, 0.15])
    ]
  },
  {
    name: 'キングぷるるん',
    strokes: [
      oval('#b3ec3a', 0, 0, 0.13, 0.1),
      line(
        '#ffd84d',
        [-0.05, -0.09],
        [-0.05, -0.15],
        [-0.025, -0.12],
        [0, -0.16],
        [0.025, -0.12],
        [0.05, -0.15],
        [0.05, -0.09]
      )
    ]
  },
  {
    name: 'おばけ',
    strokes: [
      oval('#ffffff', 0, 0, 0.1, 0.11),
      line('#ffffff', [-0.1, 0], [-0.16, -0.04], [-0.19, 0.01]),
      line('#ffffff', [0.1, 0], [0.16, -0.04], [0.19, 0.01])
    ]
  }
];

/** 相手の応援の速さ（1 秒に押す回数）。回戦が進むほど速い */
export const RIVAL_CHEER = [2, 3.2, 3.9];
/** 相手が攻撃を受けるたびにガードする確率。回戦が進むほど守りがうまい */
export const RIVAL_GUARD = [0.1, 0.2, 0.25];

/** 回戦ごとの相手の組 */
export const POOLS = [ROUND1, ROUND2, FINALS];

/** 回戦ごとの組から 1 体ずつ */
export function lineup(rand = Math.random): Rival[] {
  const pick = (list: Rival[]) => list[Math.floor(rand() * list.length)];
  return POOLS.map(pick);
}

export const ROUND_NAMES = ['1かいせん', 'じゅんけっしょう', 'けっしょう'];
