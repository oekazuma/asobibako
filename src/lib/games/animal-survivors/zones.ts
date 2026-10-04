import { airborne } from './bosses-snow';
import { MAX_R } from './enemies';
import { power, type Effect } from './arms';
import type { WeaponStats } from './weapons';
import { damageEnemy, ZONE_HIT, type World } from './world';

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

/** 決まった場所に炎を置く。scale は炎の大きさの倍率 */
export function flameAt(w: World, slot: number, x: number, y: number, scale: number, s: WeaponStats): void {
  zone(w, slot, 'flame', x, y, FLAME_R * scale, s);
}

/** 自分の足もとに炎を置く */
export function dropFlame(w: World, slot: number, s: WeaponStats, area: number): void {
  flameAt(w, slot, w.player.x, w.player.y + 4, area, s);
}

/** 竜王の業火の焼け跡。扇の中に、ダメージの 4 分の 1 で 2.5 秒焼く炎を置く */
export function scorch(w: World, slot: number, x: number, y: number, s: WeaponStats): void {
  zone(w, slot, 'flame', x, y, FLAME_R, { ...s, damage: s.damage / 4, duration: 2.5 });
}

/** 画面の中のでたらめな敵の足もとにツタを生やす。敵がいなければ false */
export function growVines(w: World, slot: number, s: WeaponStats, area: number): boolean {
  const p = w.player;
  const seen = w.enemies.filter(
    (e) =>
      e.alive && !e.def.prop && !airborne(e) && Math.abs(e.x - p.x) < w.view.w / 2 && Math.abs(e.y - p.y) < w.view.h / 2
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
    for (const j of w.grid.near(f.x, f.y, f.r + MAX_R, near)) {
      const s = w.enemies[j];
      const r = f.r + s.def.r;
      if (!s.alive || (s.x - f.x) ** 2 + (s.y - f.y) ** 2 >= r * r) continue;
      // 大ヘビの節が炎の中にあれば頭に当てる（当てる間は頭 1 体で見る）
      const i = s.def.part ? s.turn : j;
      const e = w.enemies[i];
      if (!e.alive || airborne(e)) continue;
      if (f.kind === 'vine') e.root = ROOT;
      if (w.time - e.hit[ZONE_HIT + f.slot] < ZONE_TICK) continue;
      e.hit[ZONE_HIT + f.slot] = w.time;
      const { dmg, crit } = power(w, f.dmg);
      damageEnemy(w, i, dmg, 0, 0, crit, w.weapons[f.slot]?.id);
    }
  }
}
