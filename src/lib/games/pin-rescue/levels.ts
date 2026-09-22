import type { Level } from './engine';

const HERO_Y = 1.335;

/** 座標は engine.ts の固定の箱（幅 1・高さ 1.4、y は下向き） */
const BASE: Level[] = [
  // ピンを 1 本抜くだけ
  {
    walls: [
      [0.3, 0.08, 0.3, 0.5],
      [0.7, 0.08, 0.7, 0.5]
    ],
    pins: [{ seg: [0.26, 0.52, 0.86, 0.52], handle: 1 }],
    pools: [{ kind: 'gold', x0: 0.31, y0: 0.2, x1: 0.69, y1: 0.5 }],
    hero: { x: 0.5, y: HERO_Y }
  },
  // 金とマグマ、抜くのは片方だけ
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
    hero: { x: 0.5, y: HERO_Y }
  },
  // マグマを先に落とし穴へ流してから、ななめのピンを抜き、最後に金
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
    hero: { x: 0.36, y: HERO_Y }
  },
  // 水をかけるとマグマは石になる
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
    hero: { x: 0.5, y: HERO_Y }
  }
];

function mirror(level: Level): Level {
  const flip = ([x1, y1, x2, y2]: readonly number[]) => [1 - x1, y1, 1 - x2, y2] as const;
  return {
    walls: level.walls.map(flip),
    pins: level.pins.map((pin) => ({ ...pin, seg: flip(pin.seg) })),
    pools: level.pools.map((p) => ({ ...p, x0: 1 - p.x1, x1: 1 - p.x0 })),
    hero: { x: 1 - level.hero.x, y: level.hero.y }
  };
}

/** 一周したら左右を反転した面を出す */
export const LEVELS: Level[] = [...BASE, ...BASE.map(mirror)];

export const levelFor = (n: number): Level => LEVELS[(n - 1) % LEVELS.length];
