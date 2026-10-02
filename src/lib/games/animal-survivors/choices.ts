import { gainXp } from './drops';
import { EVOLUTIONS, baseOf } from './evolutions';
import { PASSIVES, maxOf, stats } from './passives';
import { MAX_LEVEL, WEAPONS } from './weapons';
import type { World } from './world';

export type Choice =
  | { kind: 'weapon'; id: string; level: number; evo?: boolean }
  | { kind: 'passive'; id: string; level: number; evo?: boolean }
  | { kind: 'meat' }
  | { kind: 'bag' };

/** 武器とパッシブ、それぞれ持てる数 */
export const SLOTS = 6;
const BAG_XP = 25;

function candidates(w: World): Choice[] {
  const out: Choice[] = [];
  // 進化した武器の元の武器と、進化形そのものは新しい武器として出さない
  const had = new Set(w.weapons.map((o) => baseOf(o.id)));
  const fresh = (kind: 'weapon' | 'passive', id: string) =>
    kind === 'passive' || (!WEAPONS[id].evolved && !had.has(id));
  for (const [kind, owned, all] of [
    ['weapon', w.weapons, Object.keys(WEAPONS)],
    ['passive', w.passives, Object.keys(PASSIVES)]
  ] as const) {
    for (const o of owned)
      if (o.level < (kind === 'passive' ? maxOf(o.id) : MAX_LEVEL)) out.push({ kind, id: o.id, level: o.level + 1 });
    if (owned.length < SLOTS)
      for (const id of all) if (!owned.some((o) => o.id === id) && fresh(kind, id)) out.push({ kind, id, level: 1 });
  }
  return out.filter((c) => !w.banished.includes(`${c.kind}:${'id' in c ? c.id : ''}`));
}

/** n 枚まで重なりなく選ぶ（運の確率で 1 枚増える）。候補が足りなければ肉と経験値の袋で埋める（それぞれ 1 枚まで） */
export function choices(w: World, n = 3 + (w.stats.luck > 0 && w.rand() < w.stats.luck ? 1 : 0)): Choice[] {
  const list = candidates(w);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(w.rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const out = list.slice(0, n);
  for (const filler of [{ kind: 'meat' }, { kind: 'bag' }] as const) if (out.length < n) out.push(filler);
  for (const c of out) {
    if (c.kind === 'passive') c.evo = EVOLUTIONS.some((e) => e.with === c.id && w.weapons.some((o) => o.id === e.from));
    else if (c.kind === 'weapon')
      c.evo = EVOLUTIONS.some((e) => e.from === c.id && w.passives.some((p) => p.id === e.with));
  }
  return out;
}

export function apply(w: World, c: Choice): void {
  w.pending = Math.max(0, w.pending - 1);
  levelUp(w, c);
}

/** 3 択の 1 枚と同じものを当てる。宝箱も使う */
export function levelUp(w: World, c: Choice): void {
  const p = w.player;
  if (c.kind === 'weapon') {
    const own = w.weapons.find((o) => o.id === c.id);
    if (own) own.level = c.level;
    else w.weapons.push({ id: c.id, level: 1, cd: 0 });
  } else if (c.kind === 'passive') {
    const own = w.passives.find((o) => o.id === c.id);
    if (own) own.level = c.level;
    else w.passives.push({ id: c.id, level: 1 });
    const before = w.stats.maxHp;
    w.stats = stats(w.animal, w.passives, w.boost);
    p.hp += Math.max(0, w.stats.maxHp - before);
  } else if (c.kind === 'meat') {
    p.hp = Math.min(w.stats.maxHp, p.hp + w.stats.maxHp * 0.3);
  } else {
    gainXp(w, BAG_XP);
  }
}
