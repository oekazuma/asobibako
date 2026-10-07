import { baseOf } from './evolutions';
import type { Limit, LimitStat } from './limit';
import { heroOf, HERO_SLOTS, PART_B, weaponAt } from './heroes';
import { MAX_LEVEL, partDef, WEAPONS } from './weapons';
import type { World } from './world';

export interface Union {
  parts: [string, string];
  to: string;
}

export const UNIONS: Union[] = Object.values(WEAPONS)
  .filter((d) => d.union)
  .map((d) => ({ parts: d.union!.parts, to: d.id }));

export const partsOf = (id: string) => WEAPONS[id]?.union?.parts ?? null;

/** 専用進化形はその子だけの強さなのでまとめない */
const ready = (o: { id: string; level: number }) =>
  !WEAPONS[o.id].special && !WEAPONS[o.id].union && (WEAPONS[o.id].evolved || o.level >= MAX_LEVEL);

/** 今の宝箱でまとめられる組。表の順の最初の 1 つ */
export function unitable(w: World): Union | undefined {
  return UNIONS.find((u) => u.parts.every((p) => w.weapons.some((o) => baseOf(o.id) === p && ready(o))));
}

export function unite(w: World, u: Union): void {
  const at = u.parts.map((p) => w.weapons.findIndex((o) => baseOf(o.id) === p && ready(o)));
  if (at.some((i) => i < 0)) return;
  const keep = Math.min(...at);
  const drop = Math.max(...at);
  // 限界突破で上げた回数は、2 つの武器のぶんを能力ごとに足して合体武器へ渡す
  const limit: Limit = {};
  for (const i of at)
    for (const [k, n] of Object.entries(w.weapons[i].limit ?? {}) as [LimitStat, number][])
      limit[k] = (limit[k] ?? 0) + n;
  w.weapons[keep] = { id: u.to, level: MAX_LEVEL, cd: 0, cd2: 0, ...(Object.keys(limit).length && { limit }) };
  w.weapons.splice(drop, 1);
  // まとめた 2 つの枠の弾と効果は、別の武器の絵や持ち主に化けないよう消し、うしろの枠のものは番号を詰める
  for (const list of [w.shots, w.effects])
    for (const o of list) {
      if (!o.alive || heroOf(o.slot) !== w.cur) continue;
      const local = o.slot % HERO_SLOTS;
      if (local === keep || local === drop) o.alive = false;
      else if (local > drop) o.slot -= 1;
    }
  w.evolvedNow.push(u.to);
  w.events.push({ type: 'evolve', id: u.to });
}

/** その番号の弾や効果が当たって戻す HP。合体武器は部品ごとの元の進化形の値（合体武器の定義は 1 つめの部品の値しか持たない） */
export function drainAt(w: World, slot: number): number {
  const own = weaponAt(w, slot);
  const def = own && WEAPONS[own.id];
  if (!def) return 0;
  return (def.union ? partDef(def, slot >= PART_B ? 1 : 0).drain : def.drain) ?? 0;
}
