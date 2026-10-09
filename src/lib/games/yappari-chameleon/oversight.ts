import type { V3 } from '$lib/sculpt';
import type { Level } from './move';
import type { Me } from './net';
import { poseById } from './poses';
import { capsules, placement, rayLevel } from './shots';

/** 一人称の縦の視野 72 度（world3d の EYE_FOV）の半分 */
export const HALF_V = (36 * Math.PI) / 180;
/** 本家の 16:9 の画面での横 105 度の半分 */
export const HALF_H = (52 * Math.PI) / 180;
/** ここより遠い隠れる人には点を入れない（m） */
export const REACH = 15;
/** 直前 STILL_MS ミリ秒の位置の変化がこれ未満なら止まっている（m） */
export const STILL = 0.05;
export const STILL_MS = 200;

export interface Viewer {
  eye: V3;
  /** [yaw, pitch]。yaw 0 が +z、pitch は下向きが正（world3d の eye と同じ） */
  look: [number, number];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function forward([yaw, pitch]: [number, number]): V3 {
  return [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}

/** p がハンターの視野（横は半角 HALF_H、縦は半角 HALF_V の四角すい）の中にある */
export function inView(v: Viewer, p: V3): boolean {
  const f = forward(v.look);
  const side = cross(f, [0, 1, 0]);
  const len = Math.hypot(...side);
  const r: V3 = len < 1e-6 ? [1, 0, 0] : [side[0] / len, side[1] / len, side[2] / len];
  const u = cross(r, f);
  const d = sub(p, v.eye);
  const z = dot(d, f);
  if (z <= 0) return false;
  return Math.abs(Math.atan2(dot(d, r), z)) <= HALF_H && Math.abs(Math.atan2(dot(d, u), z)) <= HALF_V;
}

/** 体の真ん中（胴の 2 つめの円すいの中ほど）と頭の中心。dollShapes の並びは頭・胴 3 つ・腕と脚 */
export function bodyPoints(b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'>): V3[] {
  const c = capsules(poseById(b.pose), placement(b));
  const mid = c[2];
  return [[(mid.a[0] + mid.b[0]) / 2, (mid.a[1] + mid.b[1]) / 2, (mid.a[2] + mid.b[2]) / 2], c[0].a];
}

/** 見えている点のうちいちばん近い点までの距離。どれも見えなければ null。遮るのは弾と同じ屋敷の箱と坂 */
export function sight(lv: Level, v: Viewer, points: V3[]): number | null {
  let best: number | null = null;
  for (const p of points) {
    const d = sub(p, v.eye);
    const len = Math.hypot(...d);
    if (len > REACH || len < 1e-6 || !inView(v, p)) continue;
    if (rayLevel(lv, v.eye, [d[0] / len, d[1] / len, d[2] / len], len)) continue;
    best = best === null ? len : Math.min(best, len);
  }
  return best;
}

/** 1 秒あたりの点。本家は式を出していないので、遊んで直す */
export const rate = (dist: number): number => 10 * Math.max(0, 1 - dist / REACH);

export const still = (now: V3, before: V3): boolean =>
  Math.hypot(now[0] - before[0], now[1] - before[1], now[2] - before[2]) < STILL;
