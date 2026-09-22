import { difficulty, lerp, MAX_LEVEL, Rng } from '$lib/levels';
import type { Level } from './engine';
import { SEEDS } from './seeds';

const HERO_Y = 1.335;

/**
 * solution はクリアできる抜き順（ピンの番号）。テストでこの順に抜いてクリアできることを確かめる。
 * trap は「全部を順番どおりに抜くだけでは失敗する」面。考えずに抜くと失敗することもテストで確かめる
 */
export interface Stage extends Level {
  solution: number[];
  trap: boolean;
}

type Base = Omit<Stage, 'need'>;

/** 座標は engine.ts の固定の箱（幅 1・高さ 1.4、y は下向き）。やさしい順に並べる */
const BASE: Base[] = [
  // 1. ピンを 1 本抜くだけ
  {
    walls: [
      [0.3, 0.08, 0.3, 0.5],
      [0.7, 0.08, 0.7, 0.5]
    ],
    pins: [{ seg: [0.26, 0.52, 0.86, 0.52], handle: 1 }],
    pools: [{ kind: 'gold', x0: 0.31, y0: 0.2, x1: 0.69, y1: 0.5 }],
    hero: { x: 0.5, y: HERO_Y },
    solution: [0],
    trap: false
  },
  // 2. 金とマグマ、抜くのは片方だけ
  {
    walls: [
      [0.06, 0.1, 0.06, 0.5],
      [0.5, 0.05, 0.5, 0.5],
      [0.94, 0.1, 0.94, 0.5],
      [0, 0.8, 0.36, 1],
      [1, 0.8, 0.64, 1]
    ],
    pins: [
      { seg: [0.04, 0.52, 0.5, 0.52], handle: 0 },
      { seg: [0.5, 0.52, 0.96, 0.52], handle: 1 }
    ],
    pools: [
      { kind: 'gold', x0: 0.07, y0: 0.24, x1: 0.49, y1: 0.5 },
      { kind: 'lava', x0: 0.51, y0: 0.3, x1: 0.93, y1: 0.5 }
    ],
    hero: { x: 0.5, y: HERO_Y },
    solution: [0],
    trap: true
  },
  // 3. ピンが 2 段。両方抜かないと届かない
  {
    walls: [
      [0.3, 0.08, 0.3, 0.74],
      [0.7, 0.08, 0.7, 0.74]
    ],
    pins: [
      { seg: [0.26, 0.4, 0.86, 0.4], handle: 1 },
      { seg: [0.14, 0.76, 0.74, 0.76], handle: 0 }
    ],
    pools: [{ kind: 'gold', x0: 0.31, y0: 0.14, x1: 0.69, y1: 0.38 }],
    hero: { x: 0.5, y: HERO_Y },
    solution: [0, 1],
    trap: false
  },
  // 4. 水をかけるとマグマは石になる
  {
    walls: [
      [0.04, 0.04, 0.04, 0.3],
      [0.4, 0.04, 0.4, 0.3],
      [0.6, 0.04, 0.6, 0.3],
      [0.96, 0.04, 0.96, 0.3],
      [0.02, 0.38, 0.32, 0.48],
      [0.98, 0.38, 0.68, 0.48],
      [0.3, 0.5, 0.3, 0.8],
      [0.7, 0.5, 0.7, 0.8]
    ],
    pins: [
      { seg: [0.04, 0.32, 0.44, 0.32], handle: 0 },
      { seg: [0.56, 0.32, 0.96, 0.32], handle: 1 },
      { seg: [0.26, 0.82, 0.86, 0.82], handle: 1 }
    ],
    pools: [
      { kind: 'water', x0: 0.05, y0: 0.1, x1: 0.39, y1: 0.3 },
      { kind: 'gold', x0: 0.61, y0: 0.12, x1: 0.95, y1: 0.3 },
      { kind: 'lava', x0: 0.31, y0: 0.66, x1: 0.69, y1: 0.8 }
    ],
    hero: { x: 0.5, y: HERO_Y },
    solution: [0, 2, 1],
    trap: true
  },
  // 5. マグマを先に落とし穴へ流してから、ななめのピンを抜き、最後に金
  {
    walls: [
      [0.3, 0.04, 0.3, 0.34],
      [0.7, 0.04, 0.7, 0.34],
      [0.3, 0.38, 0.3, 0.66],
      [0.7, 0.38, 0.7, 0.66],
      [0.76, 1.08, 0.76, 1.4]
    ],
    pins: [
      { seg: [0.26, 0.36, 0.86, 0.36], handle: 1 },
      { seg: [0.14, 0.68, 0.74, 0.68], handle: 0 },
      { seg: [0.2, 0.8, 0.9, 1.02], handle: 1 }
    ],
    pools: [
      { kind: 'gold', x0: 0.31, y0: 0.12, x1: 0.69, y1: 0.34 },
      { kind: 'lava', x0: 0.31, y0: 0.52, x1: 0.69, y1: 0.66 }
    ],
    hero: { x: 0.36, y: HERO_Y },
    solution: [1, 2, 0],
    trap: true
  },
  // 6. 金の真下にマグマ。横の水で固めてから、下・上の順に抜く
  {
    walls: [
      [0.38, 0.04, 0.38, 0.3],
      [0.76, 0.04, 0.76, 0.84],
      [0.38, 0.5, 0.38, 0.84],
      [0.04, 0.1, 0.04, 0.3],
      [0.04, 0.36, 0.38, 0.48]
    ],
    pins: [
      { seg: [0.34, 0.32, 0.86, 0.32], handle: 1 },
      { seg: [0.28, 0.86, 0.86, 0.86], handle: 1 },
      { seg: [0.02, 0.32, 0.36, 0.32], handle: 0 }
    ],
    pools: [
      { kind: 'gold', x0: 0.39, y0: 0.1, x1: 0.75, y1: 0.3 },
      { kind: 'lava', x0: 0.39, y0: 0.7, x1: 0.75, y1: 0.84 },
      { kind: 'water', x0: 0.05, y0: 0.12, x1: 0.37, y1: 0.3 }
    ],
    hero: { x: 0.57, y: HERO_Y },
    solution: [2, 1, 0],
    trap: true
  },
  // 7. 抜いてはいけないピンがある。金は左の 2 本を抜くが、真上のマグマの棚の床を抜くと降ってくる
  {
    walls: [
      [0.04, 0.1, 0.04, 0.7],
      [0.28, 0.1, 0.28, 0.7],
      [0.4, 0.5, 0.4, 0.75],
      [0.8, 0.5, 0.8, 0.75]
    ],
    pins: [
      { seg: [0.02, 0.4, 0.34, 0.4], handle: 0 },
      { seg: [0.02, 0.72, 0.34, 0.72], handle: 0 },
      { seg: [0.36, 0.77, 0.9, 0.77], handle: 1 }
    ],
    pools: [
      { kind: 'gold', x0: 0.05, y0: 0.12, x1: 0.27, y1: 0.38 },
      { kind: 'lava', x0: 0.41, y0: 0.58, x1: 0.79, y1: 0.75 }
    ],
    hero: { x: 0.45, y: HERO_Y },
    solution: [0, 1],
    trap: true
  },
  // 8. ぜんぶ入り。水でマグマを固め、横のマグマは落とし穴へ流し、金は最後
  {
    walls: [
      [0.36, 0.04, 0.36, 0.3],
      [0.66, 0.04, 0.66, 0.3],
      [0.36, 0.5, 0.36, 0.66],
      [0.66, 0.5, 0.66, 0.66],
      [0.04, 0.06, 0.04, 0.3],
      [0.04, 0.36, 0.36, 0.44],
      [0.75, 0.1, 0.75, 0.4],
      [0.97, 0.1, 0.97, 0.4],
      [0.8, 1.06, 0.8, 1.4]
    ],
    pins: [
      { seg: [0.32, 0.32, 0.7, 0.32], handle: 1 },
      { seg: [0.28, 0.68, 0.74, 0.68], handle: 0 },
      { seg: [0.02, 0.32, 0.34, 0.32], handle: 0 },
      { seg: [0.71, 0.42, 0.97, 0.42], handle: 1 },
      { seg: [0.62, 0.48, 0.99, 0.98], handle: 1 }
    ],
    pools: [
      { kind: 'gold', x0: 0.37, y0: 0.1, x1: 0.65, y1: 0.3 },
      { kind: 'lava', x0: 0.37, y0: 0.54, x1: 0.65, y1: 0.66 },
      { kind: 'water', x0: 0.05, y0: 0.1, x1: 0.35, y1: 0.3 },
      { kind: 'lava', x0: 0.76, y0: 0.24, x1: 0.96, y1: 0.4 }
    ],
    hero: { x: 0.4, y: HERO_Y },
    solution: [2, 3, 1, 0],
    trap: true
  }
];

/** 型を左右反転し、はみ出さない範囲で横にずらし、金やマグマの量と勇者の位置を少し変える */
function vary(base: Base, rng: Rng): Base {
  const flip = rng.chance(0.5);
  const xs = [
    ...base.walls.flatMap((w) => [w[0], w[2]]),
    ...base.pins.flatMap((p) => [p.seg[0], p.seg[2]]),
    ...base.pools.flatMap((p) => [p.x0, p.x1]),
    base.hero.x
  ].map((x) => (flip ? 1 - x : x));
  const dx = rng.range(0.02 - Math.min(...xs), 0.98 - Math.max(...xs));
  const X = (x: number) => (flip ? 1 - x : x) + dx;
  const seg = ([x1, y1, x2, y2]: readonly number[]) => [X(x1), y1, X(x2), y2] as const;
  return {
    ...base,
    walls: base.walls.map(seg),
    pins: base.pins.map((pin) => ({ ...pin, seg: seg(pin.seg) })),
    pools: base.pools.map((p) => {
      const [a, b] = [X(p.x0), X(p.x1)].sort((m, n) => m - n);
      // 下の縁（床やピン）は動かさず、上の縁だけ変えて量を増減する
      return { ...p, x0: a, x1: b, y0: Math.min(p.y1 - 0.08, p.y0 + rng.range(-0.03, 0.04)) };
    }),
    hero: { x: Math.min(0.9, Math.max(0.1, X(base.hero.x) + rng.range(-0.03, 0.03))), y: base.hero.y }
  };
}

/** 型ごとに出てくるレベル。あとの型ほど難しく、そこから次の型までは同じ型の形を変えて出す */
const UNLOCK = [1, 5, 11, 19, 29, 41, 56, 71];

/** そのレベルで出せるいちばん新しい型。レベルが下がった型に戻ることはない */
export const tierFor = (level: number) => UNLOCK.filter((at) => at <= level).length - 1;

/** 面を組み立てる。SEEDS はテストでクリアできると確かめた種（レベルごと） */
export function generate(level: number, seed: number): Stage {
  const rng = new Rng(level * 1000 + seed);
  const base = BASE[tierFor(level)];
  return { ...vary(base, rng), need: lerp(0.5, 0.75, difficulty(level)) };
}

export const LEVELS: Stage[] = Array.from({ length: MAX_LEVEL }, (_, i) => generate(i + 1, SEEDS[i] ?? 0));

export const levelFor = (n: number): Stage => LEVELS[Math.min(MAX_LEVEL, Math.max(1, n)) - 1];
