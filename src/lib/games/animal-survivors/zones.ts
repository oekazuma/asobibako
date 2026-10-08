import { airborne } from './bosses-snow';
import { MAX_R } from './enemies';
import { power, type Effect } from './arms';
import type { WeaponStats } from './weapons';
import { heroOf, weaponAt } from './heroes';
import { drainAt } from './unions';
import { damageEnemy, ZONE_HIT, type World } from './world';

/** 炎とツタが中の敵へ当てる間（秒） */
export const ZONE_TICK = 0.5;
const FLAME_R = 10;
const VINE_R = 12;
/** ツタの中にいるあいだ、毎フレームこの秒だけ足止めを延ばす */
const ROOT = 0.2;
/** 地面に残る炎とツタの、武器の枠 1 つあたりの上限。合体と限界突破で 1000 を超えて重くなったため */
export const ZONE_CAP = 48;

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
  let count = 0;
  let oldest: Effect | null = null;
  for (const f of w.effects) {
    if (!f.alive || f.slot !== slot || (f.kind !== 'flame' && f.kind !== 'vine')) continue;
    count++;
    if (!oldest || f.born < oldest.born) oldest = f;
  }
  if (count >= ZONE_CAP && oldest) oldest.alive = false;
  const free = w.effects.findIndex((f) => !f.alive);
  if (free >= 0) w.effects[free] = z;
  else w.effects.push(z);
}

/** 決まった場所に炎を置く。scale は炎の大きさの倍率 */
export function flameAt(w: World, slot: number, x: number, y: number, scale: number, s: WeaponStats): void {
  zone(w, slot, 'flame', x, y, FLAME_R * scale, s);
}

/** 自分の足もとに炎を置く */
/** 数のぶんの炎は、足もとのまわりに等しい間をあけて並べる */
export function dropFlame(w: World, slot: number, s: WeaponStats, area: number): void {
  const { x, y } = w.player;
  flameAt(w, slot, x, y + 4, area, s);
  for (let i = 1; i < s.amount; i++) {
    const a = ((i - 1) / (s.amount - 1)) * Math.PI * 2;
    flameAt(w, slot, x + Math.cos(a) * FLAME_R * area, y + 4 + Math.sin(a) * FLAME_R * area, area, s);
  }
}

/** 竜王の業火の焼け跡。扇の中に、ダメージの 4 分の 1 で 2.5 秒焼く炎を置く */
export function scorch(w: World, slot: number, x: number, y: number, s: WeaponStats): void {
  zone(w, slot, 'flame', x, y, FLAME_R, { ...s, damage: s.damage / 4, duration: 2.5 });
}

/** (x, y) にツタを 1 本生やす（芽吹きの森で、どんぐりが当たった場所） */
export function vineAt(w: World, slot: number, x: number, y: number, scale: number, s: WeaponStats): void {
  zone(w, slot, 'vine', x, y, VINE_R * scale, s);
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
    // 会心と攻撃の強さは持ち主の動物のもの
    w.cur = heroOf(f.slot);
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
      damageEnemy(w, i, dmg, 0, 0, crit, weaponAt(w, f.slot)?.id, drainAt(w, f.slot));
    }
  }
  w.cur = 0;
}
