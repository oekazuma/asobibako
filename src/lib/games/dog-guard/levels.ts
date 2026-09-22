import type { Level, Point } from './engine';

const GROUND = 1.32;
const DOG_Y = GROUND - 0.075;

/** solution はクリアできる線。テストでこの線を引けばクリアでき、引かなければ刺されることを確かめる */
export interface Stage extends Level {
  solution: Point[];
}

/** 床（y = floor）に立つ犬を、半径 r の半円で覆う線 */
function dome(x: number, floor: number, r: number): Point[] {
  return Array.from({ length: 21 }, (_, i) => {
    const a = (i / 20) * Math.PI;
    return { x: x - Math.cos(a) * r, y: floor - Math.sin(a) * r };
  });
}

const line = (...pts: [number, number][]): Point[] => pts.map(([x, y]) => ({ x, y }));

const base = { noDraw: [], spawn: 2, fast: 0, big: 0 };

/** 座標は engine.ts の固定の箱（幅 1・高さ 1.4、y は下向き）。やさしい順に並べる */
const BASE: Stage[] = [
  // 1. まずはドームで覆う
  {
    ...base,
    tip: '線で 犬を かこんで まもろう',
    dogs: [{ x: 0.5, y: DOG_Y }],
    hives: [{ x: 0.5, y: 0.2 }],
    walls: [],
    ink: 1.6,
    bees: 6,
    speed: 0.42,
    duration: 8,
    solution: dome(0.5, GROUND - 0.005, 0.18)
  },
  // 2. 横から来る
  {
    ...base,
    tip: '横から くるよ！',
    dogs: [{ x: 0.72, y: DOG_Y }],
    hives: [{ x: 0.15, y: 0.25 }],
    walls: [],
    ink: 1.3,
    bees: 10,
    speed: 0.48,
    duration: 8,
    solution: dome(0.72, GROUND - 0.005, 0.18)
  },
  // 3. 洞窟の犬。インクが少ないので、天井の穴だけふさぐ
  {
    ...base,
    tip: 'インクが少ない！ 天井の穴だけ ふさごう',
    dogs: [{ x: 0.5, y: DOG_Y }],
    hives: [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 }
    ],
    walls: [
      [0.3, 0.98, 0.3, GROUND],
      [0.7, 0.98, 0.7, GROUND],
      [0.3, 0.98, 0.43, 0.98],
      [0.57, 0.98, 0.7, 0.98]
    ],
    ink: 0.4,
    bees: 12,
    speed: 0.5,
    duration: 9,
    solution: line([0.38, 0.955], [0.62, 0.955])
  },
  // 4. 宙に浮いた足場の犬。下からも来る
  {
    ...base,
    tip: '下からも くるよ！ 足場ごと まもろう',
    dogs: [{ x: 0.575, y: 0.825 }],
    hives: [
      { x: 0.12, y: 1.2 },
      { x: 0.88, y: 0.2 }
    ],
    walls: [[0.35, 0.9, 0.8, 0.9]],
    ink: 1,
    bees: 12,
    speed: 0.52,
    duration: 9,
    solution: dome(0.575, 0.895, 0.18)
  },
  // 5. 犬が 2 ひき。1 本の線で両方まもる
  {
    ...base,
    tip: '2ひきとも 1本の線で まもろう',
    dogs: [
      { x: 0.25, y: DOG_Y },
      { x: 0.75, y: DOG_Y }
    ],
    hives: [{ x: 0.5, y: 0.2 }],
    walls: [],
    ink: 1.5,
    bees: 14,
    speed: 0.5,
    duration: 9,
    solution: [...dome(0.25, GROUND - 0.005, 0.17), ...dome(0.75, GROUND - 0.005, 0.17)]
  },
  // 6. 横穴の犬。上は雲で線が引けないので、入り口を縦にふさぐ
  {
    ...base,
    tip: '雲には 線が ひけない！ 入り口を ふさごう',
    dogs: [{ x: 0.35, y: DOG_Y }],
    hives: [
      { x: 0.9, y: 0.3 },
      { x: 0.9, y: 1.1 }
    ],
    walls: [
      [0.15, 0.95, 0.15, GROUND],
      [0.15, 0.95, 0.6, 0.95]
    ],
    noDraw: [{ x0: 0, y0: 0.45, x1: 0.78, y1: 0.93 }],
    ink: 0.45,
    bees: 14,
    speed: 0.52,
    duration: 9,
    solution: line([0.64, 0.96], [0.64, 1.31])
  },
  // 7. 速いハチがまざる。時間も長い
  {
    ...base,
    tip: '速いハチ（オレンジ）に 気をつけて',
    dogs: [{ x: 0.5, y: DOG_Y }],
    hives: [
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0.2 }
    ],
    walls: [],
    ink: 1.1,
    bees: 16,
    speed: 0.5,
    duration: 10,
    spawn: 4,
    fast: 0.4,
    solution: dome(0.5, GROUND - 0.005, 0.18)
  },
  // 8. 2 つの足場に犬が 1 ぴきずつ。大きなハチは下からも来る
  {
    ...base,
    tip: '大きいハチは 下からも くるよ',
    dogs: [
      { x: 0.25, y: 0.725 },
      { x: 0.75, y: 0.975 }
    ],
    hives: [
      { x: 0.5, y: 0.15 },
      { x: 0.5, y: 1.25 }
    ],
    walls: [
      [0.08, 0.8, 0.42, 0.8],
      [0.58, 1.05, 0.92, 1.05]
    ],
    ink: 1.5,
    bees: 16,
    speed: 0.5,
    duration: 10,
    spawn: 4,
    big: 0.3,
    solution: [...dome(0.25, 0.795, 0.17), ...dome(0.75, 1.045, 0.17)]
  },
  // 9. 3 つの巣から、速いのも大きいのも来る
  {
    ...base,
    tip: '3つの巣から くるよ！',
    dogs: [
      { x: 0.22, y: DOG_Y },
      { x: 0.78, y: DOG_Y }
    ],
    hives: [
      { x: 0.1, y: 0.2 },
      { x: 0.5, y: 0.1 },
      { x: 0.9, y: 0.2 }
    ],
    walls: [],
    ink: 1.4,
    bees: 20,
    speed: 0.52,
    duration: 11,
    spawn: 5,
    fast: 0.3,
    big: 0.2,
    solution: [...dome(0.22, GROUND - 0.005, 0.17), ...dome(0.78, GROUND - 0.005, 0.17)]
  },
  // 10. 洞窟が 2 つ。インクは穴をふさぐぶんしかない
  {
    ...base,
    tip: '穴を 2つとも ふさごう',
    dogs: [
      { x: 0.25, y: DOG_Y },
      { x: 0.75, y: DOG_Y }
    ],
    hives: [
      { x: 0.1, y: 0.2 },
      { x: 0.5, y: 0.15 },
      { x: 0.9, y: 0.2 }
    ],
    walls: [
      [0.05, 0.98, 0.05, GROUND],
      [0.45, 0.98, 0.45, GROUND],
      [0.05, 0.98, 0.18, 0.98],
      [0.32, 0.98, 0.45, 0.98],
      [0.55, 0.98, 0.55, GROUND],
      [0.95, 0.98, 0.95, GROUND],
      [0.55, 0.98, 0.68, 0.98],
      [0.82, 0.98, 0.95, 0.98]
    ],
    ink: 0.8,
    bees: 20,
    speed: 0.54,
    duration: 12,
    spawn: 5,
    fast: 0.3,
    big: 0.2,
    solution: line([0.14, 0.955], [0.86, 0.955])
  }
];

export const LEVELS = BASE;

/** 用意した面を一周するごとに、ハチを増やして速くし、守る時間をのばし、インクを減らす */
export function levelFor(n: number): Stage {
  const stage = BASE[(n - 1) % BASE.length];
  const lap = Math.floor((n - 1) / BASE.length);
  return {
    ...stage,
    walls: [...stage.walls, [0, GROUND, 1, GROUND]],
    bees: Math.round(stage.bees * 1.2 ** lap),
    speed: stage.speed * 1.08 ** lap,
    duration: stage.duration + lap,
    ink: stage.ink * 0.95 ** lap,
    fast: Math.min(0.5, stage.fast + lap * 0.1)
  };
}
