import { desperate, has } from './arcana';
import { airborne } from './bosses-snow';
import { MAX_R } from './enemies';
import { WEAPONS, weaponStats, type WeaponDef, type WeaponStats } from './weapons';
import { damageEnemy, type Enemy, type World } from './world';
import { dropFlame, flameAt, growVines, scorch, updateZones } from './zones';

export interface Shot {
  alive: boolean;
  slot: number;
  kind: 'shot' | 'boomerang' | 'homing' | 'orbit';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  r: number;
  dmg: number;
  pierce: number;
  knock: number;
  /** shot が当てた敵の番号（同じ敵に 2 度当てない） */
  hits: number[];
  /** orbit は自分の周りの角度、ほかは描くときの向き */
  angle: number;
  speed: number;
  /** ブーメランが折り返した（火の羽根はそこで炎を 1 回置く） */
  turned: boolean;
}

export interface Effect {
  alive: boolean;
  slot: number;
  kind: 'swipe' | 'ring' | 'bolt' | 'burst' | 'flame' | 'vine' | 'cone';
  x: number;
  y: number;
  age: number;
  life: number;
  r: number;
  angle: number;
  born: number;
  dmg: number;
  knock: number;
}

/** 武器の種類ごとの基本の大きさ（px）。WeaponStats.area を掛ける */
const SIZE = {
  shot: 4,
  acorn: 3,
  swipe: 26,
  cone: 80,
  ring: 56,
  boomerang: 6,
  orbit: 30,
  strike: 14,
  homing: 4,
  burst: 16,
  feather: 5
};
const SWIPE_HALF = (55 * Math.PI) / 180;
/** 竜の息の扇の半分の角度と、2 つめからの扇をずらす角度 */
const CONE_HALF = (30 * Math.PI) / 180;
const CONE_STEP = (40 * Math.PI) / 180;
const SPREAD = (12 * Math.PI) / 180;
const FAN = (25 * Math.PI) / 180;
/** 同じ敵へ続けて当てるまでの間（秒） */
const REHIT = { boomerang: 0.35, orbit: 0.4 };

export function power(w: World, base: number): { dmg: number; crit: boolean } {
  const crit = w.rand() < w.stats.crit;
  const oni = w.player.hp < w.stats.maxHp / 2 ? 1 + w.fx.oni : 1;
  return { dmg: base * w.stats.might * desperate(w) * oni * (crit ? 2 * (1 + w.fx.critDmg) : 1), crit };
}

function revive<T extends { alive: boolean }>(list: T[], make: () => T): T {
  const free = list.find((o) => !o.alive);
  if (free) return free;
  const o = make();
  list.push(o);
  return o;
}

const newShot = (): Shot => ({
  alive: false,
  slot: 0,
  kind: 'shot',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  age: 0,
  r: 0,
  dmg: 0,
  pierce: 0,
  knock: 0,
  hits: [],
  angle: 0,
  speed: 0,
  turned: false
});

const newEffect = (): Effect => ({
  alive: false,
  slot: 0,
  kind: 'swipe',
  x: 0,
  y: 0,
  age: 0,
  life: 0,
  r: 0,
  angle: 0,
  born: 0,
  dmg: 0,
  knock: 0
});

function shoot(w: World, slot: number, kind: Shot['kind'], s: WeaponStats, angle: number, r: number) {
  const o = revive(w.shots, newShot);
  const p = w.player;
  Object.assign(o, {
    alive: true,
    turned: false,
    slot,
    kind,
    x: p.x,
    y: p.y - 6,
    vx: Math.cos(angle) * s.speed,
    vy: Math.sin(angle) * s.speed,
    life: s.duration,
    age: 0,
    r,
    dmg: s.damage,
    pierce: s.pierce,
    knock: s.knockback,
    angle,
    speed: s.speed
  });
  o.hits.length = 0;
  return o;
}

function effect(
  w: World,
  slot: number,
  kind: Effect['kind'],
  x: number,
  y: number,
  r: number,
  life: number,
  angle: number,
  dmg: number,
  knock: number
) {
  const o = revive(w.effects, newEffect);
  Object.assign(o, { alive: true, slot, kind, x, y, age: 0, life, r, angle, born: w.time, dmg, knock });
  return o;
}

function nearest(w: World, x: number, y: number): Enemy | undefined {
  let best: Enemy | undefined;
  let bd = Infinity;
  for (const e of w.enemies) {
    if (!e.alive || e.def.prop || airborne(e)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** 当てる。向きは (fx, fy) から敵へ */
function strike(w: World, i: number, base: number, fx: number, fy: number, knock: number, slot: number) {
  const e = w.enemies[i];
  const d = Math.hypot(e.x - fx, e.y - fy) || 1;
  const { dmg, crit } = power(w, base);
  damageEnemy(w, i, dmg, ((e.x - fx) / d) * knock, ((e.y - fy) / d) * knock, crit, w.weapons[slot]?.id);
}

const near: number[] = [];

/** (x, y) から r 以内の生きている敵の番号を out に入れる */
function within(w: World, x: number, y: number, r: number, out: number[]) {
  const found = w.grid.near(x, y, r + MAX_R, near);
  out.length = 0;
  for (const i of found) {
    const e = w.enemies[i];
    const rr = r + e.def.r;
    if (!e.alive || airborne(e) || (e.x - x) ** 2 + (e.y - y) ** 2 >= rr * rr) continue;
    // 大ヘビの節は頭として 1 回だけ数える（武器ごとの当たり直しの間を頭 1 体で見る）
    const k = e.def.part ? e.turn : i;
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

const targets: number[] = [];

/** 撃てたら true。雷のように的がいないと撃たない武器は false を返して待ち時間を使わない */
function launch(w: World, def: WeaponDef, s: WeaponStats, slot: number): boolean {
  const kind = def.kind;
  const p = w.player;
  // 逃げながらでも当たるよう、向きは進む向きではなくいちばん近い敵へ向ける
  const t = nearest(w, p.x, p.y);
  const aim = t ? Math.atan2(t.y - (p.y - 6), t.x - p.x) : Math.atan2(p.aimY, p.aimX);
  const area = s.area * w.stats.area;
  switch (kind) {
    case 'shot':
      for (let i = 0; i < s.amount; i++)
        shoot(w, slot, 'shot', s, aim + (i - (s.amount - 1) / 2) * SPREAD, (def.size ?? SIZE.shot) * area);
      return true;
    case 'nova':
      for (let i = 0; i < s.amount; i++)
        shoot(w, slot, 'shot', s, aim + (i / s.amount) * Math.PI * 2, SIZE.acorn * area);
      return true;
    case 'trail':
      dropFlame(w, slot, s, area);
      return true;
    case 'snare':
      return growVines(w, slot, s, area);
    case 'boomerang':
      for (let i = 0; i < s.amount; i++)
        shoot(w, slot, 'boomerang', s, aim + (i - (s.amount - 1) / 2) * FAN, SIZE.boomerang * area).life =
          s.duration + 1;
      return true;
    case 'homing':
      for (let i = 0; i < s.amount; i++)
        shoot(w, slot, 'homing', s, aim + (i - (s.amount - 1) / 2) * FAN, SIZE.homing * area);
      return true;
    case 'orbit':
      for (let i = 0; i < s.amount; i++) {
        const o = shoot(w, slot, 'orbit', s, (i / s.amount) * Math.PI * 2, SIZE.feather * area);
        o.vx = SIZE.orbit * area;
      }
      return true;
    case 'swipe':
      for (let i = 0; i < s.amount; i++) {
        // 4 つ以上は全方向へ等しく散らし、それより少なければ前と後ろを交互に裂く
        const a = s.amount > 3 ? aim + (i / s.amount) * Math.PI * 2 : aim + (i % 2) * Math.PI;
        const r = SIZE.swipe * area;
        effect(w, slot, 'swipe', p.x, p.y - 6, r, s.duration, a, 0, 0);
        for (const j of within(w, p.x, p.y - 6, r, targets)) {
          const e = w.enemies[j];
          let da = Math.atan2(e.y - (p.y - 6), e.x - p.x) - a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) < SWIPE_HALF) strike(w, j, s.damage, p.x, p.y, s.knockback, slot);
        }
      }
      return true;
    case 'cone':
      for (let i = 0; i < s.amount; i++) {
        // 2 つめからは左右へ交互にずらして重ねる
        const a = aim + Math.ceil(i / 2) * (i % 2 ? 1 : -1) * CONE_STEP;
        const r = SIZE.cone * area;
        effect(w, slot, 'cone', p.x, p.y - 6, r, s.duration, a, 0, 0);
        for (const j of within(w, p.x, p.y - 6, r, targets)) {
          const e = w.enemies[j];
          const dx = e.x - p.x;
          const dy = e.y - (p.y - 6);
          let da = Math.atan2(dy, dx) - a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.hypot(dx, dy) <= e.def.r || Math.abs(da) < CONE_HALF)
            strike(w, j, s.damage, p.x, p.y, s.knockback, slot);
        }
        if (def.special)
          for (const k of [0.5, 0.85]) scorch(w, slot, p.x + Math.cos(a) * r * k, p.y - 6 + Math.sin(a) * r * k, s);
      }
      return true;
    case 'ring':
      // 数のぶんの輪は、前の輪が広がり終えてから続けて出す（当たりは輪の生まれた時刻で見るので、同時だと 2 つめが当たらない）
      for (let i = 0; i < s.amount; i++) {
        const o = effect(w, slot, 'ring', p.x, p.y - 6, SIZE.ring * area, s.duration, 0, s.damage, s.knockback);
        o.age = -i * s.duration;
        o.born = w.time + i * s.duration;
      }
      return true;
    case 'strike': {
      const hw = w.view.w / 2;
      const hh = w.view.h / 2;
      const seen = w.enemies.filter(
        (e) => e.alive && !e.def.prop && !airborne(e) && Math.abs(e.x - p.x) < hw && Math.abs(e.y - p.y) < hh
      );
      if (seen.length === 0) return false;
      for (let i = 0; i < s.amount && seen.length > 0; i++) {
        const t = seen.splice(Math.floor(w.rand() * seen.length), 1)[0];
        const r = SIZE.strike * area;
        effect(w, slot, 'bolt', t.x, t.y, r, s.duration, 0, 0, 0);
        for (const j of within(w, t.x, t.y, r, targets)) strike(w, j, s.damage, t.x, t.y - 1, s.knockback, slot);
      }
      return true;
    }
  }
}

/** ガラスの大砲は下限で止めたあとに掛ける（足し合わせると、鼓動と時の砂を持っているとき表示ほど縮まない） */
export function attackWait(w: World, cooldown: number): number {
  return cooldown * Math.max(0.35, 1 - w.stats.haste) * (has(w, 'glass') ? 0.6 : 1);
}

export function fire(w: World, dt: number): void {
  w.weapons.forEach((own, slot) => {
    own.cd -= dt;
    if (own.cd > 0) return;
    const def = WEAPONS[own.id];
    const s = weaponStats(def, own.level);
    s.amount += Math.floor(w.stats.amount);
    s.duration *= w.stats.duration;
    if (!launch(w, def, s, slot)) {
      own.cd = 0.25;
      return;
    }
    const wait = attackWait(w, s.cooldown);
    // 羽根は回り終えてから待ち時間を数える
    own.cd = def.kind === 'orbit' ? s.duration + wait : wait;
    // 炎は足もとに置くだけで、しかも間が短いので、攻撃の格好にすると歩く動きが見えなくなる
    if (def.kind === 'trail') return;
    w.player.attack = 0.15;
    w.events.push({ type: 'fire', weapon: own.id });
  });
}

function moveShot(w: World, o: Shot, dt: number) {
  const p = w.player;
  if (o.kind === 'orbit') {
    o.angle += o.speed * dt;
    o.x = p.x + Math.cos(o.angle) * o.vx;
    o.y = p.y - 6 + Math.sin(o.angle) * o.vx;
    return;
  }
  if (o.kind === 'boomerang') {
    // 毎秒 speed × 1.6 で減速するので、1 / 1.6 秒で止まって折り返す
    const back = o.age > 1 / 1.6;
    if (back && !o.turned) {
      o.turned = true;
      flameTurn(w, o);
    }
    if (!back) {
      const k = Math.max(0, 1 - (1.6 * dt * o.speed) / Math.hypot(o.vx, o.vy));
      o.vx *= k;
      o.vy *= k;
    } else {
      const dx = p.x - o.x;
      const dy = p.y - 6 - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 8) o.alive = false;
      const v = Math.min(o.speed * 1.3, Math.hypot(o.vx, o.vy) + o.speed * 2 * dt);
      o.vx = (dx / d) * v;
      o.vy = (dy / d) * v;
    }
  } else if (o.kind === 'homing') {
    const t = nearest(w, o.x, o.y);
    if (t) {
      const want = Math.atan2(t.y - o.y, t.x - o.x);
      const now = Math.atan2(o.vy, o.vx);
      let d = want - now;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const a = now + Math.max(-4 * dt, Math.min(4 * dt, d));
      o.vx = Math.cos(a) * o.speed;
      o.vy = Math.sin(a) * o.speed;
    }
  }
  o.x += o.vx * dt;
  o.y += o.vy * dt;
  o.angle = Math.atan2(o.vy, o.vx);
  const far = Math.hypot(w.view.w, w.view.h);
  if ((o.x - p.x) ** 2 + (o.y - p.y) ** 2 > far * far) o.alive = false;
}

function hitShot(w: World, o: Shot) {
  for (const j of within(w, o.x, o.y, o.r, targets)) {
    const e = w.enemies[j];
    if (o.kind === 'shot') {
      if (o.hits.includes(j)) continue;
      o.hits.push(j);
      strike(w, j, o.dmg, o.x - o.vx, o.y - o.vy, o.knock, o.slot);
      if (--o.pierce <= 0) {
        o.alive = false;
        return;
      }
    } else if (o.kind === 'homing') {
      const r = SIZE.burst * (o.r / SIZE.homing);
      effect(w, o.slot, 'burst', o.x, o.y, r, 0.25, 0, 0, 0);
      for (const k of within(w, o.x, o.y, r, [])) strike(w, k, o.dmg, o.x, o.y, o.knock, o.slot);
      o.alive = false;
      return;
    } else {
      if (w.time - e.hit[o.slot] < REHIT[o.kind]) continue;
      e.hit[o.slot] = w.time;
      strike(w, j, o.dmg, w.player.x, w.player.y, o.knock, o.slot);
    }
  }
}

export function hits(w: World, dt: number): void {
  for (const o of w.shots) {
    if (!o.alive) continue;
    o.age += dt;
    if (o.age > o.life) {
      o.alive = false;
      continue;
    }
    moveShot(w, o, dt);
    if (o.alive) hitShot(w, o);
  }
  for (const f of w.effects) {
    if (!f.alive) continue;
    f.age += dt;
    if (f.age > f.life) {
      f.alive = false;
      continue;
    }
    if (f.kind !== 'ring' || f.age < 0) continue;
    const r = (f.age / f.life) * f.r;
    for (const j of within(w, f.x, f.y, r + 6, targets)) {
      const e = w.enemies[j];
      if (e.hit[f.slot] >= f.born) continue;
      if (Math.hypot(e.x - f.x, e.y - f.y) < r - 6 - e.def.r) continue;
      e.hit[f.slot] = w.time;
      strike(w, j, f.dmg, f.x, f.y, f.knock, f.slot);
    }
  }
  updateZones(w);
}

/** 火の羽根は折り返すところに炎を置く。炎は投げた羽根の 4 割の強さで、範囲と効く時間の強化も受ける（専用進化形は大きく長く焼く） */
function flameTurn(w: World, o: Shot): void {
  const own = w.weapons[o.slot];
  const def = own && WEAPONS[own.id];
  if (!def?.flameTurn) return;
  const s = weaponStats(def, own.level);
  const scale = (def.special ? 1.4 : 0.8) * s.area * w.stats.area;
  const duration = (def.special ? 2 : 1.4) * w.stats.duration;
  flameAt(w, o.slot, o.x, o.y + 4, scale, { ...s, damage: o.dmg * 0.4, duration });
}
