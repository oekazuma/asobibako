import type { Player } from '$lib/player';
import { sideOf } from './engine';

export interface Sample {
  t: number;
  x: number;
  y: number;
}

export interface Finger {
  /** 置いた時点でどちらの陣地にあったか。指が境界線をまたいでも持ち主は変わらない */
  side: Player;
  x: number;
  y: number;
  trail: Sample[];
}

/** はじく速さは、離す直前のこの時間ぶんの動きから出す */
const TRAIL_MS = 90;

export class Fingers {
  readonly all = new Map<number, Finger>();

  down(id: number, x: number, y: number, t: number): void {
    this.all.set(id, { side: sideOf(y), x, y, trail: [{ t, x, y }] });
  }

  move(id: number, x: number, y: number, t: number): void {
    const finger = this.all.get(id);
    if (!finger) return;
    finger.x = x;
    finger.y = y;
    finger.trail.push({ t, x, y });
    while (finger.trail.length > 2 && t - finger.trail[0].t > TRAIL_MS) finger.trail.shift();
  }

  up(id: number, x: number, y: number, t: number): Finger | undefined {
    this.move(id, x, y, t);
    const finger = this.all.get(id);
    this.all.delete(id);
    return finger;
  }
}

/** 軌跡の最初と最後から速さ（盤面単位 / 秒）を出す */
export function velocity(trail: Sample[]): { vx: number; vy: number } {
  const first = trail[0];
  const last = trail[trail.length - 1];
  const dt = (last.t - first.t) / 1000;
  if (trail.length < 2 || dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}
