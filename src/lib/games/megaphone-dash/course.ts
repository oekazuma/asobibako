import { difficulty, lerp, Rng } from '$lib/levels';

export const LANES = 3;
export const LEVELS = 15;
/** コンボの倍率が ×1.0 のときの速さ（m/s） */
export const BASE_SPEED = 5;
/** 障害物の列どうしの最小の間（m）。×2.0 でも 1 秒あり、2 レーン先の空きへ移りきれる */
export const ROW_GAP = 10;
/** 走り出してから最初の障害物・通行人までの助走（m） */
export const RUNUP = 25;

export type Kind = 'low' | 'high';

export interface Block {
  lane: number;
  z: number;
  kind: Kind;
  /** 高い障害物の見た目。0 が柵、1 が電柱 */
  look: number;
}

/** 通行人の最初の位置 */
export interface Spot {
  lane: number;
  z: number;
}

export interface BossRule {
  hp: number;
  /** レーンを移る間隔（秒） */
  moveEvery: number;
  /** 障害物を投げる間隔（秒） */
  throwEvery: number;
  kinds: Kind[];
}

/**
 * 面ごとの制限時間（秒）。ボットに走らせて決めた。面の番号 - 1 で引く。
 * 1 面は、いちばん遅いボット（ゆっくり・はしるだけ）も着ける時間。ほかの面は、ふつうのボットに 8% の余裕を足した時間。
 * 値は course() の乱数の種と engine.ts の定数に結びついているので、どちらかを変えたらボットで測り直す
 */
const TIME = [44, 45, 41, 42, 73, 48, 60, 60, 68, 81, 74, 74, 79, 84, 103];
/** 面ごとのうまいボットの点。ランクの基準。面の番号 - 1 で引く */
const BEST = [510, 356, 502, 620, 1256, 840, 1162, 1206, 1590, 1946, 1990, 2282, 2480, 2746, 3280];

export interface LevelRule {
  /** 道のりの長さ（m）。ボスの面はここでボスが現れる */
  length: number;
  /** 制限時間（秒） */
  time: number;
  /** 100 m あたりの通行人 */
  walkers: number;
  /** 100 m あたりの障害物の列 */
  rows: number;
  /** 障害物が高いものになる割合 */
  high: number;
  /** 列が 2 レーンをふさぐ割合 */
  double: number;
  boss: BossRule | null;
  /** うまいボットの点。ランクはこれに対する割合で決める */
  best: number;
}

const BOSSES: Partial<Record<number, BossRule>> = {
  5: { hp: 20, moveEvery: 2.6, throwEvery: 2.4, kinds: ['low'] },
  10: { hp: 30, moveEvery: 2.2, throwEvery: 2, kinds: ['low', 'high'] },
  15: { hp: 40, moveEvery: 1.8, throwEvery: 1.5, kinds: ['low', 'high'] }
};

export function rule(level: number): LevelRule {
  const n = Math.min(LEVELS, Math.max(1, Math.round(level)));
  const d = difficulty(n, LEVELS);
  // はじめの 2 面は跳ぶことを覚える面なので、低いバリケードを 1 レーンずつだけ置く
  const easy = n <= 2;
  const length = Math.round(lerp(200, 450, d) / 10) * 10;
  const boss = BOSSES[n] ?? null;
  return {
    length,
    time: TIME[n - 1],
    walkers: lerp(5, 9, d),
    rows: lerp(3, 7, d),
    high: easy ? 0 : lerp(0.25, 0.6, d),
    double: easy ? 0 : lerp(0.15, 0.5, d),
    boss,
    best: BEST[n - 1]
  };
}

export function course(level: number): { length: number; walkers: Spot[]; blocks: Block[] } {
  const r = rule(level);
  const rng = new Rng(Math.round(level) * 101 + 13);
  const pick = (n: number) => Math.floor(rng.next() * n);
  const end = r.length - 10;

  const blocks: Block[] = [];
  const count = Math.max(1, Math.round((r.length / 100) * r.rows));
  const step = Math.max(ROW_GAP, (end - RUNUP) / count);
  // 各列は自分の枠 [z, z + step - ROW_GAP] の中でずらすので、隣の列とは必ず ROW_GAP 以上あく
  for (let z = RUNUP; z <= end; z += step) {
    const at = Math.min(end, Math.round(z + rng.next() * (step - ROW_GAP)));
    const lanes = [0, 1, 2];
    const n = rng.next() < r.double ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const lane = lanes.splice(pick(lanes.length), 1)[0];
      blocks.push({ lane, z: at, kind: rng.next() < r.high ? 'high' : 'low', look: pick(2) });
    }
  }

  const walkers: Spot[] = [];
  const people = Math.round((r.length / 100) * r.walkers);
  for (let i = 0; i < people; i++) {
    for (let tries = 0; tries < 8; tries++) {
      const spot = { lane: pick(3), z: Math.round(RUNUP + rng.next() * (end - RUNUP)) };
      if (blocks.some((b) => b.lane === spot.lane && Math.abs(b.z - spot.z) < 4)) continue;
      walkers.push(spot);
      break;
    }
  }
  walkers.sort((a, b) => a.z - b.z);
  return { length: r.length, walkers, blocks };
}
