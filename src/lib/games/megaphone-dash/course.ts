import { difficulty, lerp, Rng } from '$lib/levels';

export const LEVELS = 15;
/** 走る子が動ける道の半分の幅（m）。道の中心が 0 */
export const HALF = 2.6;
/** 場所 1 つぶんの長さ（m）。走っていると 20〜30 秒ごとに景色が変わる */
export const ZONE_LEN = 170;
/** 走り出してから最初の群れまでの助走（m） */
export const RUNUP = 18;

/** 通学路 → 商店街 → 校舎の廊下。廊下は狭く、人が詰まって流れてくる */
export const ZONES = ['street', 'arcade', 'hall'] as const;
export type Zone = (typeof ZONES)[number];

export type Kind = 'cone' | 'bike' | 'board';

export interface Block {
  x: number;
  z: number;
  /** 横の幅（m） */
  w: number;
  kind: Kind;
}

export interface Person {
  x: number;
  z: number;
  /** 見た目の番号 */
  look: number;
}

export interface LevelRule {
  length: number;
  time: number;
  /** 群れの間隔（m） */
  gap: number;
  /** 1 つの群れの人数の上限 */
  crowd: number;
  /** 群れと群れのあいだに障害物を置く割合 */
  blocks: number;
}

export function rule(level: number): LevelRule {
  const n = Math.min(LEVELS, Math.max(1, Math.round(level)));
  const d = difficulty(n, LEVELS);
  const length = ZONES.length * ZONE_LEN;
  return {
    length,
    // コンボなしの速さ（6 m/s）でも着ける時間。当てて速く走るほど残りが増えて点になる
    time: Math.round((length / 6) * lerp(1.15, 1.0, d)),
    gap: lerp(16, 11, d),
    crowd: Math.round(lerp(8, 16, d)),
    blocks: lerp(0.35, 0.85, d)
  };
}

export const zoneAt = (z: number): Zone => ZONES[Math.min(ZONES.length - 1, Math.max(0, Math.floor(z / ZONE_LEN)))];

/** 場所ごとの道の広さ。廊下は壁が迫るので狭い */
export const halfAt = (z: number): number => (zoneAt(z) === 'hall' ? 1.9 : HALF);

export function course(level: number): { length: number; people: Person[]; blocks: Block[] } {
  const r = rule(level);
  const rng = new Rng(Math.round(level) * 101 + 13);
  const pick = (a: number, b: number) => a + rng.next() * (b - a);
  const people: Person[] = [];
  const blocks: Block[] = [];
  let look = 0;
  for (let z = RUNUP; z < r.length - 12; z += pick(r.gap * 0.8, r.gap * 1.2)) {
    const half = halfAt(z);
    // 群れは道の片側に寄せて置き、突っこむ先を選ばせる
    const cx = pick(-half + 0.8, half - 0.8);
    const big = rng.next() < 0.18;
    const count = Math.round(big ? r.crowd * 1.6 : pick(3, r.crowd));
    const spread = big ? 1.4 : 0.9;
    for (let i = 0; i < count; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = Math.sqrt(rng.next()) * spread;
      const pz = z + Math.sin(a) * d * 1.6;
      // 群れが場所の境目をまたぐと、廊下側の人は狭い道幅に収める
      const ph = halfAt(pz);
      people.push({ x: Math.max(-ph + 0.3, Math.min(ph - 0.3, cx + Math.cos(a) * d)), z: pz, look: look++ });
    }
    if (rng.next() < r.blocks) {
      // 障害物は群れのすぐ先に、群れとは反対側を少し残して置く（抜け道が必ずある）
      const bz = z + r.gap * 0.55;
      const side = cx > 0 ? -1 : 1;
      const kind: Kind = zoneAt(bz) === 'hall' ? 'board' : rng.next() < 0.5 ? 'cone' : 'bike';
      const w = kind === 'bike' ? 1.6 : kind === 'board' ? 1.4 : 1.1;
      const bx = Math.max(-half + w / 2, Math.min(half - w / 2, cx + side * pick(0, 0.6)));
      blocks.push({ x: bx, z: bz, w, kind });
    }
  }
  return { length: r.length, people, blocks };
}
