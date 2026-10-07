import type { WeaponDef, WeaponKind, WeaponStats } from './weapons';
import { partDef, WEAPONS } from './weapons';
import type { Choice } from './choices';
import { noMeat } from './drops';
import type { World } from './world';

export type LimitStat = 'damage' | 'cooldown' | 'area' | 'speed' | 'duration' | 'amount';
/** snap に書く並びでもある */
export const LIMIT_STATS: LimitStat[] = ['damage', 'cooldown', 'area', 'speed', 'duration', 'amount'];
export type Limit = Partial<Record<LimitStat, number>>;

/** 1 回の上がり幅。ボットで、なくした「攻撃 +5%」の札と延長戦の伸びが並ぶ幅にした。待ち時間は掛け算で縮める（足し引きだと 0 を下回る） */
export const STEP = { damage: 0.2, cooldown: 0.07, area: 0.1, speed: 0.12, duration: 0.12, amount: 1 };

const pct = (v: number) => `${Math.round(v * 100)}%`;
export const LIMIT_TEXT: Record<LimitStat, string> = {
  damage: `ダメージ +${pct(STEP.damage)}`,
  cooldown: `待ち時間 −${pct(STEP.cooldown)}`,
  area: `大きさ +${pct(STEP.area)}`,
  speed: `速さ +${pct(STEP.speed)}`,
  duration: `時間 +${pct(STEP.duration)}`,
  amount: `数 +${STEP.amount}`
};

const MOVING: WeaponKind[] = ['shot', 'boomerang', 'homing', 'orbit', 'nova'];
// 輪は時間をのばすと広がるのが遅くなるだけなので、残る攻撃に入れない
const LASTING: WeaponKind[] = ['orbit', 'trail', 'snare'];

export function statsFor(def: WeaponDef): LimitStat[] {
  const kinds = def.union ? [partDef(def, 0).kind, partDef(def, 1).kind] : [def.kind];
  return LIMIT_STATS.filter(
    (k) =>
      (k !== 'speed' || kinds.some((x) => MOVING.includes(x))) &&
      (k !== 'duration' || kinds.some((x) => LASTING.includes(x)))
  );
}

export function limitStats(s: WeaponStats, limit: Limit | undefined): WeaponStats {
  if (!limit) return s;
  const n = (k: LimitStat) => limit[k] ?? 0;
  return {
    ...s,
    damage: s.damage * (1 + STEP.damage * n('damage')),
    cooldown: s.cooldown * (1 - STEP.cooldown) ** n('cooldown'),
    area: s.area * (1 + STEP.area * n('area')),
    speed: s.speed * (1 + STEP.speed * n('speed')),
    duration: s.duration * (1 + STEP.duration * n('duration')),
    amount: s.amount + STEP.amount * n('amount')
  };
}

export const limitTotal = (limit: Limit | undefined) => LIMIT_STATS.reduce((sum, k) => sum + (limit?.[k] ?? 0), 0);

/** 数は 1 回の伸びが大きいので出にくくする */
const WEIGHT: Record<LimitStat, number> = { damage: 1, cooldown: 1, area: 1, speed: 1, duration: 1, amount: 0.3 };

/** 全部埋まったあとの札。持っている武器 × 出る能力と、最大 HP の札から、重みで n 枚を重ならずに引く */
export function limitCards(w: World, n: number): Choice[] {
  const pool: { c: Choice; weight: number }[] = [{ c: { kind: 'vigor', heal: !noMeat(w) }, weight: 1 }];
  for (const o of w.weapons)
    for (const stat of statsFor(WEAPONS[o.id]))
      pool.push({ c: { kind: 'limit', id: o.id, stat, now: o.limit?.[stat] ?? 0 }, weight: WEIGHT[stat] });
  const out: Choice[] = [];
  while (out.length < n && pool.length) {
    let r = w.rand() * pool.reduce((s, p) => s + p.weight, 0);
    const i = pool.findIndex((p) => (r -= p.weight) < 0);
    out.push(pool.splice(i < 0 ? pool.length - 1 : i, 1)[0].c);
  }
  return out;
}
