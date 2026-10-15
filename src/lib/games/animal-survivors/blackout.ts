import { CELL, hash, obstaclesNear, type Ground } from './obstacles';

export interface StreetLight {
  x: number;
  y: number;
}

/** 160 ドットの区画 6 個に 1 つほど */
export const LIGHT_CHANCE = 1 / 6;
const EDGE = 30;
const CLEAR = 120;

/** 祠と同じ作りで、ハッシュの種だけ別。街灯は夜の街の面にしか置かない */
export function streetLightAt(g: Ground, cx: number, cy: number): StreetLight | null {
  if (g !== 'city') return null;
  if (hash(cx * 19 + 23, cy * 37 + 5) >= LIGHT_CHANCE) return null;
  const x = cx * CELL + EDGE + hash(cx * 47 + 3, cy * 5 + 19) * (CELL - EDGE * 2);
  const y = cy * CELL + EDGE + hash(cx * 13 + 17, cy * 41 + 6) * (CELL - EDGE * 2);
  if (Math.hypot(x, y) < CLEAR || obstaclesNear(g, x, y, 12, []).length) return null;
  return { x, y };
}

export function streetLightsNear(g: Ground, x: number, y: number, r: number, out: StreetLight[]): StreetLight[] {
  out.length = 0;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
    for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
      const s = streetLightAt(g, cx, cy);
      if (s && Math.hypot(s.x - x, s.y - y) < r) out.push(s);
    }
  return out;
}
