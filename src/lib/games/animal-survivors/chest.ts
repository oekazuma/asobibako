import { levelUp } from './choices';
import { addCoins, CHEST_COINS } from './drops';
import { evolvable, evolve } from './evolutions';
import { maxOf } from './passives';
import { MAX_LEVEL } from './weapons';
import type { World } from './world';

export type Reward =
  | { kind: 'weapon' | 'passive'; id: string; level: number }
  | { kind: 'meat' }
  | { kind: 'bag' }
  | { kind: 'evolve'; from: string; id: string };

/** 上がる数。6 割が 1、3 割が 3、1 割が 5 */
export function chestSize(r: number): 1 | 3 | 5 {
  return r < 0.6 ? 1 : r < 0.9 ? 3 : 5;
}

/** 宝箱を 1 つ開けて、持っている Lv5 未満のものを 1 Lv ずつ上げる。上げるものが無くなったら肉、そのあとは経験値の袋 */
export function openChest(w: World): Reward[] {
  w.chests = Math.max(0, w.chests - 1);
  w.opened += 1;
  addCoins(w, CHEST_COINS);
  const out: Reward[] = [];
  let n = chestSize(w.rand());
  const e = evolvable(w);
  if (e) {
    evolve(w, e);
    out.push({ kind: 'evolve', from: e.from, id: e.to });
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
    const r: Reward = open.length
      ? open[Math.floor(w.rand() * open.length)]
      : out.some((o) => o.kind === 'meat')
        ? { kind: 'bag' }
        : { kind: 'meat' };
    levelUp(w, r);
    out.push(r);
  }
  return out;
}
