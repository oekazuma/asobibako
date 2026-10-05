/** 地形の障害物。位置のハッシュで決まるので、毎回同じ場所に出て、協力プレイの 2 台でもそろう */

export type Ground = 'forest' | 'graveyard' | 'snow' | 'volcano';
export type ObstacleId = 'boulder' | 'log' | 'bigTomb' | 'fence' | 'icy' | 'snowTree' | 'lavaRock' | 'steamRock';
export interface Obstacle {
  x: number;
  y: number;
  kind: ObstacleId;
}

export const CELL = 160;
const CHANCE = 0.25;
/** 区画の中で置く範囲。隣の区画の障害物とのあいだを自分が通れる広さに保つ */
const EDGE = 40;
const CLEAR = 80;
export const PLAYER_R = 6;

/** 当たりの丸（足もとの真ん中から）と、絵の下の端の位置。横に長い絵は丸を並べて形に合わせる */
export const SHAPES: Record<ObstacleId, { circles: readonly (readonly [number, number, number])[]; foot: number }> = {
  boulder: {
    circles: [
      [-8, 0, 10],
      [5, -1, 14]
    ],
    foot: 8
  },
  log: {
    circles: [
      [-12, 0, 9],
      [0, 0, 9],
      [12, 0, 9]
    ],
    foot: 7
  },
  bigTomb: { circles: [[0, 0, 13]], foot: 6 },
  fence: {
    circles: [
      [-17, 0, 7],
      [-6, 0, 7],
      [6, 0, 7],
      [17, 0, 7]
    ],
    foot: 5
  },
  icy: {
    circles: [
      [-6, 0, 12],
      [7, 0, 11]
    ],
    foot: 6
  },
  snowTree: { circles: [[0, 0, 13]], foot: 6 },
  lavaRock: {
    circles: [
      [-8, 0, 11],
      [8, 0, 11],
      [0, -3, 13]
    ],
    foot: 6
  },
  steamRock: { circles: [[0, 0, 15]], foot: 6 }
};

const KINDS: Record<Ground, readonly [ObstacleId, ObstacleId]> = {
  forest: ['boulder', 'log'],
  graveyard: ['bigTomb', 'fence'],
  snow: ['icy', 'snowTree'],
  volcano: ['lavaRock', 'steamRock']
};

const REACH = Math.max(...Object.values(SHAPES).flatMap((s) => s.circles.map(([dx, dy, r]) => Math.hypot(dx, dy) + r)));

/** 座標から決まる 0..1 */
export function hash(x: number, y: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function obstacleAt(g: Ground, cx: number, cy: number): Obstacle | null {
  // 飾りの並びと重ならないよう、地面と飾りとは別の値でハッシュを取る
  if (hash(cx * 13 + 5, cy * 11 + 7) >= CHANCE) return null;
  const x = cx * CELL + EDGE + hash(cx * 17 + 1, cy * 3 + 9) * (CELL - EDGE * 2);
  const y = cy * CELL + EDGE + hash(cx * 5 + 2, cy * 19 + 4) * (CELL - EDGE * 2);
  if (Math.hypot(x, y) < CLEAR + REACH) return null;
  return { x, y, kind: KINDS[g][hash(cx * 7 + 3, cy * 23 + 1) < 0.5 ? 0 : 1] };
}

export function obstaclesNear(g: Ground, x: number, y: number, r: number, out: Obstacle[]): Obstacle[] {
  out.length = 0;
  for (let cx = Math.floor((x - r - REACH) / CELL); cx <= Math.floor((x + r + REACH) / CELL); cx++)
    for (let cy = Math.floor((y - r - REACH) / CELL); cy <= Math.floor((y + r + REACH) / CELL); cy++) {
      const o = obstacleAt(g, cx, cy);
      if (o && SHAPES[o.kind].circles.some(([dx, dy, cr]) => Math.hypot(x - o.x - dx, y - o.y - dy) < r + cr))
        out.push(o);
    }
  return out;
}

const found: Obstacle[] = [];

/** 丸を障害物の外へ出す。向かう速さだけが消えて沿う速さは残るので、動きながら呼ぶと回り込む */
export function pushOut(g: Ground, o: { x: number; y: number }, r: number): void {
  // 1 つの障害物の丸どうしが重なっているので、1 回では隣の丸の中に残ることがある
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const ob of obstaclesNear(g, o.x, o.y, r, found))
      for (const [dx, dy, cr] of SHAPES[ob.kind].circles) {
        const ex = o.x - ob.x - dx;
        const ey = o.y - ob.y - dy;
        const d = Math.hypot(ex, ey);
        const min = r + cr;
        if (d >= min) continue;
        // 真ん中に重なったときは下へ出す（向きが決まらないので）
        const k = d === 0 ? 0 : min / d;
        o.x = ob.x + dx + (d === 0 ? 0 : ex * k);
        o.y = ob.y + dy + (d === 0 ? min : ey * k);
        moved = true;
      }
    if (!moved) return;
  }
}
