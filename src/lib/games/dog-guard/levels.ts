import type { Level } from './engine';

const GROUND = 1.32;
const DOG_Y = GROUND - 0.075;

/** 座標は engine.ts の固定の箱（幅 1・高さ 1.4、y は下向き） */
const BASE: Level[] = [
  { dog: { x: 0.5, y: DOG_Y }, hives: [{ x: 0.5, y: 0.2 }], walls: [], ink: 1.6, bees: 8, speed: 0.45 },
  { dog: { x: 0.72, y: DOG_Y }, hives: [{ x: 0.15, y: 0.25 }], walls: [], ink: 1.3, bees: 12, speed: 0.5 },
  {
    dog: { x: 0.62, y: 0.8 },
    hives: [{ x: 0.14, y: 1.15 }],
    walls: [[0.42, 0.875, 0.82, 0.875]],
    ink: 1.3,
    bees: 14,
    speed: 0.5
  },
  {
    dog: { x: 0.28, y: DOG_Y },
    hives: [{ x: 0.85, y: 0.2 }],
    walls: [[0.55, 0.7, 0.95, 0.7]],
    ink: 1,
    bees: 16,
    speed: 0.6
  },
  {
    dog: { x: 0.5, y: DOG_Y },
    hives: [
      { x: 0.12, y: 0.2 },
      { x: 0.88, y: 0.2 }
    ],
    walls: [],
    ink: 1.1,
    bees: 20,
    speed: 0.6
  }
];

/** 一周するごとにハチを増やし、速くし、インクを減らす */
export function levelFor(n: number): Level {
  const base = BASE[(n - 1) % BASE.length];
  const lap = Math.floor((n - 1) / BASE.length);
  return {
    ...base,
    walls: [...base.walls, [0, GROUND, 1, GROUND]],
    bees: Math.round(base.bees * 1.25 ** lap),
    speed: base.speed * 1.1 ** lap,
    ink: base.ink * 0.9 ** lap
  };
}
