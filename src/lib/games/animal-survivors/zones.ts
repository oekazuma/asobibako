import { power, type Effect } from './arms';
import type { WeaponStats } from './weapons';
import { damageEnemy, type World } from './world';

/** 炎とツタが中の敵へ当てる間（秒） */
export const ZONE_TICK = 0.5;
const FLAME_R = 10;
const VINE_R = 12;
/** ツタの中にいるあいだ、毎フレームこの秒だけ足止めを延ばす */
const ROOT = 0.2;

function zone(w: World, slot: number, kind: 'flame' | 'vine', x: number, y: number, r: number, s: WeaponStats) {
  const z: Effect = {
    alive: true,
    slot,
    kind,
    x,
    y,
    age: 0,
    life: s.duration,
    r,
    angle: 0,
    born: w.time,
    dmg: s.damage,
    knock: 0
  };
  const free = w.effects.findIndex((f) => !f.alive);
  if (free >= 0) w.effects[free] = z;
  else w.effects.push(z);
}

/** 自分の足もとに炎を置く */
export function dropFlame(w: World, slot: number, s: WeaponStats, area: number): void {
  zone(w, slot, 'flame', w.player.x, w.player.y + 4, FLAME_R * area, s);
}

/** 画面の中のでたらめな敵の足もとにツタを生やす。敵がいなければ false */
export function growVines(w: World, slot: number, s: WeaponStats, area: number): boolean {
  const p = w.player;
  const seen = w.enemies.filter(
    (e) => e.alive && Math.abs(e.x - p.x) < w.view.w / 2 && Math.abs(e.y - p.y) < w.view.h / 2
  );
  if (seen.length === 0) return false;
  for (let i = 0; i < s.amount && seen.length > 0; i++) {
    const e = seen.splice(Math.floor(w.rand() * seen.length), 1)[0];
    zone(w, slot, 'vine', e.x, e.y, VINE_R * area, s);
  }
  return true;
}

const near: number[] = [];

/** 炎とツタの中の敵へ、武器の枠ごとに ZONE_TICK に 1 回当てる。ツタの中の敵は足止めする */
export function updateZones(w: World): void {
  for (const f of w.effects) {
    if (!f.alive || (f.kind !== 'flame' && f.kind !== 'vine')) continue;
    for (const i of w.grid.near(f.x, f.y, f.r + 12, near)) {
      const e = w.enemies[i];
      const r = f.r + e.def.r;
      if (!e.alive || (e.x - f.x) ** 2 + (e.y - f.y) ** 2 >= r * r) continue;
      if (f.kind === 'vine') e.root = ROOT;
      if (w.time - e.hit[f.slot] < ZONE_TICK) continue;
      e.hit[f.slot] = w.time;
      const { dmg, crit } = power(w, f.dmg);
      damageEnemy(w, i, dmg, 0, 0, crit, w.weapons[f.slot]?.id);
    }
  }
}
