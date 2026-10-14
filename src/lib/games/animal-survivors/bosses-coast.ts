import { hazard, queen } from './bosses';
import type { Enemy, World } from './world';

/** 巨大ガニ。突進とはさみの地ならしを交互に使う */
export const CRAB = {
  every: 3.5,
  dashWarn: 0.7,
  dashTime: 0.9,
  dashSpeed: 210,
  dashLength: 120,
  clawWarn: 1.2,
  clawGap: 40,
  clawR: 36,
  clawDmg: 24
};
const STILL = { vx: 0, vy: 0 };

/** state 0 横歩きで近づく・1 突進の予告・2 突進・3 はさみの予告（はさみを上げる） */
export function crab(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  // 突進だけは横に走る。斜めだと矢印の先を避けにくく、横歩きの絵とも合わない
  const side = ux < 0 ? -1 : 1;
  if (e.state === 0) {
    e.cd -= dt;
    if (e.cd > 0) return { vx: ux * e.def.speed, vy: uy * e.def.speed };
    if (e.turn % 2 === 0) {
      e.state = 1;
      e.wait = CRAB.dashWarn;
      e.dx = side;
      e.dy = 0;
      hazard(w, {
        kind: 'dash',
        owner: i,
        x: e.x,
        y: e.y,
        vx: side,
        vy: 0,
        r: CRAB.dashLength,
        delay: CRAB.dashWarn,
        life: 0,
        dmg: 0
      });
    } else {
      e.state = 3;
      e.wait = CRAB.clawWarn;
      for (const s of [-1, 1])
        hazard(w, {
          kind: 'slam',
          owner: i,
          x: e.x + s * CRAB.clawGap,
          y: e.y,
          vx: 0,
          vy: 0,
          r: CRAB.clawR,
          delay: CRAB.clawWarn,
          life: 0.3,
          dmg: CRAB.clawDmg
        });
    }
    e.turn += 1;
    return STILL;
  }
  e.wait -= dt;
  if (e.state === 1) {
    if (e.wait <= 0) {
      e.state = 2;
      e.wait = CRAB.dashTime;
    }
    return STILL;
  }
  if (e.wait <= 0) {
    e.state = 0;
    e.cd = CRAB.every / (e.def.rage ?? 1);
  }
  return e.state === 2 ? { vx: e.dx * CRAB.dashSpeed, vy: 0 } : STILL;
}

/** 大ダコ。女王グモと同じ飛び道具と手下の合間に、自分の足もとへ墨だまりを置く */
export const OCTOPUS = { every: 6, inkWarn: 1, inkR: 40, inkLife: 5 };

/** state 0 女王グモの動き（wait は墨までの経過秒）・1 墨の予告（立ち止まる） */
export function octopus(w: World, i: number, e: Enemy, ux: number, uy: number, d: number, dt: number) {
  if (e.state === 0) {
    e.wait += dt;
    if (e.wait < OCTOPUS.every / (e.def.rage ?? 1)) return queen(w, e, ux, uy, d, dt);
    e.state = 1;
    e.wait = OCTOPUS.inkWarn;
    hazard(w, {
      kind: 'slam',
      owner: i,
      x: e.x,
      y: e.y,
      vx: 0,
      vy: 0,
      r: OCTOPUS.inkR,
      delay: OCTOPUS.inkWarn,
      life: 0,
      dmg: 0,
      ink: true
    });
    return STILL;
  }
  e.wait -= dt;
  if (e.wait <= 0) {
    e.state = 0;
    e.wait = 0;
  }
  return STILL;
}
