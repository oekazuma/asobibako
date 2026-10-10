export type Strength = 'weak' | 'normal' | 'strong';

/** 強さの段ごとの CPU の動き。数字は通しの試合と headless の確かめで直し、iPad で遊んでさらに直す */
export interface Skill {
  /** 目立ちとして数える色の違い（0..1）。小さいほどわずかな違いや塗り残しにも気づく */
  diff: number;
  /** 撃つと決めてから撃つまでの秒 */
  wait: number;
  /** 狙いのずれ（度） */
  aim: number;
  /** 歩く速さ（1 で WALK）と、走るか */
  pace: number;
  run: boolean;
  /** 次の部屋の選び方。random は同じ所にも行き、loop は決まった順、fresh はまだ見ていない近い部屋から */
  order: 'random' | 'loop' | 'fresh';
  /** 見回しでしゃがんで、机や台の下ものぞく */
  crouch: boolean;
  /** 口笛の場所からずらす量（m）。base + far × 口笛までの距離 */
  stray: { base: number; far: number };
  /** 隠れ場所の段。0 は床に立つ・座る、1 は壁ぎわ・家具の陰、2 は壁や天井の張り付き */
  tiers: number[];
  /** 筆の半径（m）・色のずれ（0..1）・塗り残す割合・吹き付けの濃さ */
  brush: number;
  jitter: number;
  skip: number;
  alpha: number;
}

export const SKILLS: Record<Strength, Skill> = {
  weak: {
    diff: 0.25,
    wait: 1.5,
    aim: 3,
    pace: 0.6,
    run: false,
    order: 'random',
    crouch: false,
    stray: { base: 3, far: 0.3 },
    tiers: [0],
    brush: 0.12,
    jitter: 0.15,
    skip: 0.25,
    alpha: 0.6
  },
  normal: {
    diff: 0.12,
    wait: 0.8,
    aim: 1.5,
    pace: 1,
    run: false,
    order: 'loop',
    crouch: false,
    stray: { base: 2, far: 0.2 },
    tiers: [1],
    brush: 0.07,
    jitter: 0.04,
    skip: 0.05,
    alpha: 0.8
  },
  strong: {
    diff: 0.05,
    wait: 0.4,
    aim: 0.5,
    pace: 1,
    run: true,
    order: 'fresh',
    crouch: true,
    stray: { base: 1, far: 0.1 },
    tiers: [1, 2],
    brush: 0.035,
    jitter: 0.01,
    skip: 0,
    alpha: 0.95
  }
};

export const STRENGTHS: { id: Strength; name: string }[] = [
  { id: 'weak', name: '弱い' },
  { id: 'normal', name: '普通' },
  { id: 'strong', name: '強い' }
];

/** CPU の設定の画面で選ぶもの。side はプレイヤーの役（hide は CPU が探し、seek は CPU が隠れる） */
export interface CpuChoice {
  side: 'hide' | 'seek';
  count: 1 | 2;
  mode: 'normal' | 'infect';
  strength: Strength;
}

export const CPU_DEFAULT: CpuChoice = { side: 'hide', count: 1, mode: 'normal', strength: 'normal' };
