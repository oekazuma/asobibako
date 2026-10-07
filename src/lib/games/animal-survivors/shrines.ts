import { CELL, hash, obstaclesNear, type Ground } from './obstacles';

export type ShrineKind = 'power' | 'wind' | 'wisdom' | 'treasure' | 'heal';
export interface Shrine {
  x: number;
  y: number;
  kind: ShrineKind;
  /** 区画ごとに違う番号。使った祠を覚えるのに使う */
  key: number;
}

const CHANCE = 0.1;
const EDGE = 30;
const CLEAR = 120;
const KINDS: ShrineKind[] = ['power', 'wind', 'wisdom', 'treasure', 'heal'];
export const SHRINE_NAME: Record<ShrineKind, string> = {
  power: '力の祠',
  wind: '風の祠',
  wisdom: '知恵の祠',
  treasure: '宝の祠',
  heal: '癒しの祠'
};

export function shrineAt(g: Ground, cx: number, cy: number): Shrine | null {
  // 障害物とも飾りとも別の値でハッシュを取る
  if (hash(cx * 29 + 11, cy * 31 + 3) >= CHANCE) return null;
  const x = cx * CELL + EDGE + hash(cx * 43 + 7, cy * 3 + 17) * (CELL - EDGE * 2);
  const y = cy * CELL + EDGE + hash(cx * 11 + 13, cy * 47 + 2) * (CELL - EDGE * 2);
  if (Math.hypot(x, y) < CLEAR || obstaclesNear(g, x, y, 12, []).length) return null;
  const kind = KINDS[Math.floor(hash(cx * 37 + 5, cy * 41 + 9) * KINDS.length)];
  return { x, y, kind, key: (cx + 32768) * 65536 + (cy + 32768) };
}

export function shrinesNear(g: Ground, x: number, y: number, r: number, out: Shrine[]): Shrine[] {
  out.length = 0;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
    for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
      const s = shrineAt(g, cx, cy);
      if (s && Math.hypot(s.x - x, s.y - y) < r) out.push(s);
    }
  return out;
}
