import type { AnimalId } from './animals';

/** 角度は技を向ける向き（いちばん近い敵の向き）からの差 */
export type HalfShape =
  | { kind: 'ring'; r: number }
  | { kind: 'beams'; angles: number[]; len: number; width: number }
  | { kind: 'cone'; spread: number; len: number };

export interface Half {
  name: string;
  shape: HalfShape;
}

const Q = Math.PI / 4;

/** 動物ごとの連携の技の半分。形は最初の武器に似せる */
export const HALVES: Record<AnimalId, Half> = {
  dog: {
    name: 'ホネの大嵐',
    shape: { kind: 'beams', angles: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => k * Q), len: 180, width: 20 }
  },
  cat: { name: '百裂ネコパンチ', shape: { kind: 'ring', r: 90 } },
  wolf: { name: '大遠吠え', shape: { kind: 'ring', r: 150 } },
  fox: { name: '狐火の十字', shape: { kind: 'beams', angles: [0, 2 * Q, 4 * Q, 6 * Q], len: 200, width: 28 } },
  bear: { name: '大熊の爪', shape: { kind: 'beams', angles: [0], len: 240, width: 64 } },
  rabbit: { name: '疾風ダッシュ', shape: { kind: 'beams', angles: [0, 4 * Q], len: 260, width: 40 } },
  panda: { name: '竹林の檻', shape: { kind: 'ring', r: 120 } },
  tiger: { name: '雷虎の十字斬り', shape: { kind: 'beams', angles: [Q, 3 * Q, 5 * Q, 7 * Q], len: 220, width: 32 } },
  drake: { name: '竜の大息吹', shape: { kind: 'cone', spread: (2 * Math.PI) / 3, len: 220 } },
  chick: { name: '火の鳥の羽ばたき', shape: { kind: 'ring', r: 130 } }
};

export function linkName(a: AnimalId, b: AnimalId): string {
  return a === b ? `ダブル${HALVES[a].name}` : `${HALVES[a].name} × ${HALVES[b].name}`;
}

/** (x, y) にいる半径 r の敵に、(ox, oy) から angle へ向けた形が当たるか */
export function inHalf(
  shape: HalfShape,
  ox: number,
  oy: number,
  angle: number,
  x: number,
  y: number,
  r: number
): boolean {
  const dx = x - ox;
  const dy = y - oy;
  const d = Math.hypot(dx, dy);
  if (shape.kind === 'ring') return d <= shape.r + r;
  if (shape.kind === 'cone') {
    if (d <= r) return true;
    if (d > shape.len + r) return false;
    const off = Math.abs(((Math.atan2(dy, dx) - angle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    return off <= shape.spread / 2 + r / d;
  }
  return shape.angles.some((a) => {
    const c = Math.cos(angle + a);
    const s = Math.sin(angle + a);
    const along = dx * c + dy * s;
    const across = -dx * s + dy * c;
    return along >= -r && along <= shape.len + r && Math.abs(across) <= shape.width / 2 + r;
  });
}
