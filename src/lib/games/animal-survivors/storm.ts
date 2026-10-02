import type { World } from './world';

/** 吹雪で自分が流される速さ（ふつうの速さに対する割合）と、風が敵の速さを変える幅 */
export const STORM_PUSH = 0.2;
export const STORM_WIND = 0.4;
export const STORM_WARN = 3;

export interface Storm {
  /** 次の stage.storms の番号 */
  next: number;
  /** 吹いている残り秒。0 なら止んでいる */
  left: number;
  wx: number;
  wy: number;
  warned: boolean;
}

export const calm = (): Storm => ({ next: 0, left: 0, wx: 1, wy: 0, warned: false });

/** 時刻になったら風の向きを決めて吹かせ、3 秒前に帯を出す */
export function stepStorm(w: World, dt: number): void {
  const s = w.storm;
  s.left = Math.max(0, s.left - dt);
  const next = w.stage.storms[s.next];
  if (!next) return;
  if (!s.warned && w.time >= next.at - STORM_WARN) {
    s.warned = true;
    w.events.push({ type: 'swarm', text: '吹雪が来る！' });
  }
  if (w.time < next.at) return;
  const a = w.rand() * Math.PI * 2;
  Object.assign(s, { next: s.next + 1, left: next.len, wx: Math.cos(a), wy: Math.sin(a), warned: false });
}

/** 動く向きが風と近いほど速く、逆なら遅くする倍率 */
export function windFactor(w: World, vx: number, vy: number): number {
  const sp = Math.hypot(vx, vy);
  if (w.storm.left <= 0 || sp === 0) return 1;
  return 1 + (STORM_WIND * (vx * w.storm.wx + vy * w.storm.wy)) / sp;
}
