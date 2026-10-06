import { has } from './arcana';
import { chestOdds } from './cauldron';
import { levelUp, rewardsFor } from './choices';
import { addCoins, CHEST_COINS } from './drops';
import { evolvable, evolve } from './evolutions';
import { maxOf } from './passives';
import { unitable, unite } from './unions';
import { MAX_LEVEL } from './weapons';
import type { World } from './world';

export type Reward =
  | { kind: 'weapon' | 'passive'; id: string; level: number }
  | { kind: 'meat' }
  | { kind: 'bag' }
  | { kind: 'power' | 'gold' }
  | { kind: 'vigor'; heal?: boolean }
  | { kind: 'evolve'; from: string; id: string }
  | { kind: 'union'; parts: [string, string]; id: string };

/** 上がる数。2.0 の釜では 8.5 割が 1、1.3 割が 3、0.2 割が 5 */
export function chestSize(r: number, odds = chestOdds(2)): 1 | 3 | 5 {
  return r < odds.one ? 1 : r < odds.three ? 3 : 5;
}

/** 宝箱を 1 つ開けて、持っている Lv5 未満のものを 1 Lv ずつ上げる。上げるものが無くなったら全部埋まったあとのごほうび */
export function openChest(w: World): Reward[] {
  w.chests = Math.max(0, w.chests - 1);
  w.opened += 1;
  addCoins(w, CHEST_COINS);
  const out: Reward[] = [];
  const o = chestOdds(w.heat.level);
  let n = chestSize(w.rand(), { one: Math.max(0, o.one - w.fx.chest), three: o.three });
  if (has(w, 'cursed')) n = Math.max(3, n) as 3 | 5;
  const e = evolvable(w);
  if (e) {
    evolve(w, e);
    out.push({ kind: 'evolve', from: e.from, id: e.to });
    n -= 1;
  }
  const u = n > 0 ? unitable(w) : undefined;
  if (u) {
    unite(w, u);
    out.push({ kind: 'union', parts: u.parts, id: u.to });
    n -= 1;
  }
  for (; n > 0; n--) {
    const open = [
      ...w.weapons
        .filter((o) => o.level < MAX_LEVEL)
        .map((o) => ({ kind: 'weapon' as const, id: o.id, level: o.level + 1 })),
      ...w.passives
        .filter((o) => o.level < maxOf(o.id))
        .map((o) => ({ kind: 'passive' as const, id: o.id, level: o.level + 1 }))
    ];
    const r: Reward = open.length ? open[Math.floor(w.rand() * open.length)] : rewardsFor(w)[Math.floor(w.rand() * 3)];
    levelUp(w, r);
    out.push(r);
  }
  return out;
}
