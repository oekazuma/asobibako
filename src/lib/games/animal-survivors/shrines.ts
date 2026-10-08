import { CELL, hash, obstaclesNear, type Ground } from './obstacles';
import { healRate } from './arcana';
import { dropChest, noMeat } from './drops';
import type { World } from './world';
import { hasRelic } from './relics';

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

export const BLESS_SECS = 30;
export const MIGHT = 1.3;
export const HASTE = 1.3;
export const WISDOM = 2;
const TOUCH = 12;
/** 氷の鏡でご利益の秒に掛ける */
const MIRROR = 1.5;

const found: Shrine[] = [];

/** 今の cur の動物で、触れている祠を使う。使った祠はその回は戻らない */
export function touchShrines(w: World): void {
  const p = w.player;
  for (const s of shrinesNear(w.stage.art, p.x, p.y, TOUCH, found)) {
    if (w.shrinesUsed.includes(s.key)) continue;
    w.shrinesUsed.push(s.key);
    w.shrineCount += 1;
    const secs = BLESS_SECS * (hasRelic(w, 'mirror') ? MIRROR : 1);
    if (s.kind === 'power') w.blessing.might = Math.max(w.blessing.might, 0) + secs;
    else if (s.kind === 'wind') w.blessing.speed = Math.max(w.blessing.speed, 0) + secs;
    else if (s.kind === 'wisdom') w.blessing.xp = Math.max(w.blessing.xp, 0) + secs;
    else if (s.kind === 'treasure') dropChest(w, s.x, s.y + 10);
    // 肉が出ないしばりと札の回は、ほかの全快と同じく回復しない
    else if (!noMeat(w)) p.hp = Math.min(w.stats.maxHp, p.hp + (w.stats.maxHp - p.hp) * healRate(w));
    w.events.push({ type: 'shrine', kind: s.kind });
  }
}

export function stepBlessing(w: World, dt: number): void {
  const b = w.blessing;
  b.might = Math.max(0, b.might - dt);
  b.speed = Math.max(0, b.speed - dt);
  b.xp = Math.max(0, b.xp - dt);
}

export const speedOf = (w: World) => (w.blessing.speed > 0 ? HASTE : 1);
