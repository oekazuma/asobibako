import { circle, hazard } from './bosses';
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

/** 不死鳥。大ワシと同じく空へ上がって急降下し、それと交互に自分のまわりへ火の羽根を降らせる */
export const PHOENIX = {
  keep: 120,
  every: 4,
  warn: 1.2,
  r: 40,
  dmg: 30,
  feathers: 5,
  featherWarn: 1,
  featherR: 16,
  featherDmg: 14,
  rebirth: 1.5
};
/** state 0 回り込む・4 空にいて急降下を待つ・5 よみがえっている */
const REBORN = 5;

export function phoenix(w: World, i: number, e: Enemy, ux: number, uy: number, d: number, dt: number) {
  if (e.state === REBORN) {
    e.wait -= dt;
    // よみがえっているあいだは当たらないことを、点滅させずに白く重ねたままで見せる
    e.flash = 0.1;
    if (e.wait <= 0) {
      e.state = 0;
      e.cd = PHOENIX.every / (e.def.rage ?? 1);
    }
    return STILL;
  }
  if (e.state === 4) {
    e.wait -= dt;
    if (e.wait > 0) return STILL;
    e.x = e.dx;
    e.y = e.dy;
    e.state = 0;
    e.cd = PHOENIX.every / (e.def.rage ?? 1);
    return STILL;
  }
  e.cd -= dt;
  if (e.cd > 0) return circle(e, ux, uy, d, PHOENIX.keep);
  const p = w.player;
  const dive = e.turn % 2 === 0;
  e.turn += 1;
  if (!dive) {
    for (let k = 0; k < PHOENIX.feathers; k++) {
      const a = (k / PHOENIX.feathers) * Math.PI * 2 + w.rand();
      const r = k === 0 ? 0 : 24 + w.rand() * 30;
      hazard(w, {
        kind: 'slam',
        owner: i,
        x: p.x + Math.cos(a) * r,
        y: p.y + Math.sin(a) * r,
        vx: 0,
        vy: 0,
        r: PHOENIX.featherR,
        delay: PHOENIX.featherWarn,
        life: 0.3,
        dmg: PHOENIX.featherDmg
      });
    }
    e.cd = PHOENIX.every / (e.def.rage ?? 1);
    return circle(e, ux, uy, d, PHOENIX.keep);
  }
  e.state = 4;
  e.wait = PHOENIX.warn;
  e.dx = p.x;
  e.dy = p.y;
  hazard(w, {
    kind: 'pounce',
    owner: i,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    r: PHOENIX.r,
    delay: PHOENIX.warn,
    life: 0.3,
    dmg: PHOENIX.dmg
  });
  return STILL;
}

/** 体力が尽きた不死鳥を一度だけ体力半分で戻す。戻したら true（倒れない） */
export function rebirth(w: World, e: Enemy): boolean {
  if (e.def.ai !== 'phoenix' || e.reborn) return false;
  e.reborn = true;
  e.hp = e.def.hp / 2;
  e.state = REBORN;
  e.wait = PHOENIX.rebirth;
  w.events.push({ type: 'swarm', text: '不死鳥がよみがえった！' });
  return true;
}
