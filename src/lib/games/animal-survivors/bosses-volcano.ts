import { hazard } from './bosses';
import type { Enemy, World } from './world';

/** 溶岩の巨人。地ならしの輪と、自分のまわりへ投げる岩。どちらも当たったところに溶岩の池を残す */
export const GIANT = {
  every: 3.5,
  slamWarn: 1.2,
  slamR: 60,
  slamDmg: 30,
  slamLava: 50,
  rocks: 3,
  rockWarn: 0.9,
  rockGap: 0.25,
  rockR: 18,
  rockDmg: 18,
  rockLava: 20
};
const STILL = { vx: 0, vy: 0 };

/** state 0 歩いて近づく・3 地ならしの予告（腕を上げる） */
export function giant(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  if (e.state === 3) {
    e.wait -= dt;
    if (e.wait <= 0) {
      e.state = 0;
      e.cd = GIANT.every / (e.def.rage ?? 1);
    }
    return STILL;
  }
  e.cd -= dt;
  const walk = { vx: ux * e.def.speed, vy: uy * e.def.speed };
  if (e.cd > 0) return walk;
  const slam = e.turn % 2 === 0;
  e.turn += 1;
  if (slam) {
    e.state = 3;
    e.wait = GIANT.slamWarn;
    hazard(w, {
      kind: 'slam',
      owner: i,
      x: e.x,
      y: e.y,
      vx: 0,
      vy: 0,
      r: GIANT.slamR,
      delay: GIANT.slamWarn,
      life: 0.3,
      dmg: GIANT.slamDmg,
      lava: GIANT.slamLava
    });
    return STILL;
  }
  const p = w.player;
  for (let k = 0; k < GIANT.rocks; k++) {
    const a = w.rand() * Math.PI * 2;
    const d = k === 0 ? 0 : 20 + w.rand() * 30;
    hazard(w, {
      kind: 'slam',
      owner: i,
      x: p.x + Math.cos(a) * d,
      y: p.y + Math.sin(a) * d,
      vx: 0,
      vy: 0,
      r: GIANT.rockR,
      delay: GIANT.rockWarn + k * GIANT.rockGap,
      life: 0.3,
      dmg: GIANT.rockDmg,
      lava: GIANT.rockLava
    });
  }
  e.cd = GIANT.every / (e.def.rage ?? 1);
  return walk;
}
