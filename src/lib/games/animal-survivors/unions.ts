import { baseOf } from './evolutions';
import { heroOf, HERO_SLOTS } from './heroes';
import { MAX_LEVEL, WEAPONS } from './weapons';
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
  w.weapons[keep] = { id: u.to, level: MAX_LEVEL, cd: 0, cd2: 0 };
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
