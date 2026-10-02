import { brood, hazard } from './bosses';
import type { Enemy, World } from './world';

export const YETI = {
  every: 4,
  ballSpeed: 70,
  ballR: [6, 14],
  ballLife: 4,
  ballDmg: 24,
  pounceWarn: 1,
  pounceR: 48,
  pounceDmg: 30,
  brood: 3
};

const STILL = { vx: 0, vy: 0 };

/** 雪玉の半径。転がった時間に応じて大きくなる */
export const rolled = (life: number) =>
  YETI.ballR[0] + (YETI.ballR[1] - YETI.ballR[0]) * Math.min(1, 1 - life / YETI.ballLife);

/** 飛びかかって宙にいるあいだは、武器も体当たりも当たらない */
export const airborne = (e: Enemy) => e.def.ai === 'yeti' && e.state === 4;

/** 大雪男。state 0 追う・4 飛びかかって宙にいる。雪玉と飛びかかりを交互に使う */
export function yeti(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  if (e.state === 4) {
    e.wait -= dt;
    if (e.wait > 0) return STILL;
    e.x = e.dx;
    e.y = e.dy;
    e.state = 0;
    e.cd = YETI.every / (e.def.rage ?? 1);
    brood(w, e, YETI.brood);
    return STILL;
  }
  e.cd -= dt;
  if (e.cd > 0) return { vx: ux * e.def.speed, vy: uy * e.def.speed };
  const p = w.player;
  if (e.turn % 2 === 0) {
    hazard(w, {
      kind: 'ball',
      owner: -1,
      x: e.x,
      y: e.y,
      vx: ux * YETI.ballSpeed,
      vy: uy * YETI.ballSpeed,
      r: YETI.ballR[0],
      delay: 0,
      life: YETI.ballLife,
      dmg: YETI.ballDmg,
      art: e.def.shot
    });
    e.cd = YETI.every / (e.def.rage ?? 1);
  } else {
    // 落ちる先は飛び立ったときの自分の位置。予告は地面に置くので、あとで自分が動けばよけられる
    e.state = 4;
    e.wait = YETI.pounceWarn;
    e.dx = p.x;
    e.dy = p.y;
    hazard(w, {
      kind: 'pounce',
      owner: i,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      r: YETI.pounceR,
      delay: YETI.pounceWarn,
      life: 0.3,
      dmg: YETI.pounceDmg
    });
  }
  e.turn += 1;
  return STILL;
}
