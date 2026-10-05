import { brood, circle, hazard, SLOWED, type Hazard } from './bosses';
import { eachHero } from './heroes';
import { hurtPlayer } from './world';
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

/** 飛びかかって宙にいるあいだ（大雪男）と空にいるあいだ（大ワシ・不死鳥）、よみがえっている不死鳥は、武器も体当たりも当たらない */
export const airborne = (e: Enemy) =>
  ((e.def.ai === 'yeti' || e.def.ai === 'eagle' || e.def.ai === 'phoenix') && e.state === 4) ||
  (e.def.ai === 'phoenix' && e.state === 5);

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
      dmg: YETI.ballDmg
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

export const DRAGON = {
  keep: 120,
  every: 3.5,
  pillarWarn: 1,
  pillarR: 18,
  pillarSpread: 40,
  pillarDmg: 22,
  breathWarn: 0.8,
  breathTime: 1,
  breathAngle: Math.PI / 3,
  breathLength: 120,
  breathDmg: 8,
  breathTick: 0.25
};

/** 扇（中心 h.x, h.y、向き vx, vy、長さ r、角度 breathAngle）の中か */
export function inFan(h: Pick<Hazard, 'x' | 'y' | 'vx' | 'vy' | 'r'>, x: number, y: number): boolean {
  const dx = x - h.x;
  const dy = y - h.y;
  const d = Math.hypot(dx, dy);
  if (d > h.r) return false;
  if (d === 0) return true;
  return (dx * h.vx + dy * h.vy) / d >= Math.cos(DRAGON.breathAngle / 2);
}

/** 氷の竜。state 0 回り込む・1 息を吐くあいだ止まる。氷の柱と冷たい息を交互に使う */
export function dragon(w: World, i: number, e: Enemy, ux: number, uy: number, d: number, dt: number) {
  if (e.state === 1) {
    e.wait -= dt;
    if (e.wait <= 0) e.state = 0;
    return STILL;
  }
  e.cd -= dt;
  if (e.cd > 0) return circle(e, ux, uy, d, DRAGON.keep);
  const p = w.player;
  e.cd = DRAGON.every / (e.def.rage ?? 1);
  if (e.turn % 2 === 0) {
    const s = DRAGON.pillarSpread;
    for (const [ox, oy] of [
      [0, 0],
      [s, 0],
      [-s, 0],
      [0, s],
      [0, -s]
    ])
      hazard(w, {
        kind: 'pillar',
        owner: i,
        x: p.x + ox,
        y: p.y + oy,
        vx: 0,
        vy: 0,
        r: DRAGON.pillarR,
        delay: DRAGON.pillarWarn,
        life: 0.4,
        dmg: DRAGON.pillarDmg
      });
  } else {
    e.state = 1;
    e.wait = DRAGON.breathWarn + DRAGON.breathTime;
    hazard(w, {
      kind: 'breath',
      owner: i,
      x: e.x,
      y: e.y,
      vx: ux,
      vy: uy,
      r: DRAGON.breathLength,
      delay: DRAGON.breathWarn,
      life: DRAGON.breathTime,
      dmg: DRAGON.breathDmg,
      tick: 0
    });
  }
  e.turn += 1;
  return STILL;
}

/** 冷たい息。予告のあと吐いているあいだ、扇の中へ breathTick ごとに当てて遅くする */
export function breathe(w: World, h: Hazard, dt: number): void {
  const owner = w.enemies[h.owner];
  if (!(owner?.alive && owner.def.ai === 'dragon')) {
    h.alive = false;
    return;
  }
  if (h.delay > 0) {
    h.delay -= dt;
    return;
  }
  h.life -= dt;
  if (h.life <= 0) {
    h.alive = false;
    return;
  }
  h.tick = (h.tick ?? 0) - dt;
  if (h.tick > 0) return;
  h.tick = DRAGON.breathTick;
  eachHero(w, () => {
    const p = w.player;
    if (!inFan(h, p.x, p.y)) return;
    p.slow = SLOWED;
    if (p.invuln <= 0) hurtPlayer(w, h.dmg, 'boss');
  });
}
