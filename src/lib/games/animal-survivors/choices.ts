import { healRate, hpScaleOf } from './arcana';
import { gainXp, noMeat, pick } from './drops';
import { trySpecial } from './specials';
import { EVOLUTIONS, baseOf } from './evolutions';
import { PASSIVES, maxOf, stats } from './passives';
import { partsOf } from './unions';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { limitCards, type LimitStat } from './limit';
import type { World } from './world';

export type Choice =
  | { kind: 'weapon'; id: string; level: number; evo?: boolean }
  | { kind: 'passive'; id: string; level: number; evo?: boolean }
  | { kind: 'meat' }
  | { kind: 'bag' }
  /** 全部埋まったあとの札。限界突破と、最大 HP +10 と全回復（heal が false なら回復なし） */
  | { kind: 'limit'; id: string; stat: LimitStat; now: number }
  | { kind: 'vigor'; heal?: boolean };

export const VIGOR = 10;

/** 武器・パッシブでない札（除外できない） */
export const isFiller = (c: Choice) => c.kind !== 'weapon' && c.kind !== 'passive';

/** 武器とパッシブ、それぞれ持てる数 */
export const SLOTS = 6;
const BAG_XP = 25;

function candidates(w: World): Choice[] {
  const out: Choice[] = [];
  // 進化した武器の元の武器・進化形そのもの・まとめた 2 つの武器は、新しい武器として出さない
  const had = new Set(w.weapons.flatMap((o) => [baseOf(o.id), ...(partsOf(o.id) ?? [])]));
  const fresh = (kind: 'weapon' | 'passive', id: string) =>
    kind === 'passive' ||
    (!WEAPONS[id].evolved && !WEAPONS[id].exclusive && !had.has(id) && !w.mods.includes('oneWeapon'));
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
/** 運ととんがり帽子の割合で 4 択にする。割合が 0 なら乱数を引かない（同じ種の回の流れを変えないため） */
function fourth(w: World): number {
  const c = w.stats.luck + w.fx.fourth;
  return c > 0 && w.rand() < c ? 1 : 0;
}

export function choices(w: World, n = 3 + fourth(w)): Choice[] {
  const list = candidates(w);
  if (list.length === 0) return limitCards(w, n);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(w.rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const out = list.slice(0, n);
  const fillers = noMeat(w) ? ([{ kind: 'bag' }] as const) : ([{ kind: 'meat' }, { kind: 'bag' }] as const);
  for (const filler of fillers) if (out.length < n) out.push(filler);
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
    w.stats = stats(w.animal, w.passives, w.boost, w.form, hpScaleOf(w));
    p.hp += Math.max(0, w.stats.maxHp - before);
  } else if (c.kind === 'meat') {
    p.hp = Math.min(w.stats.maxHp, p.hp + w.stats.maxHp * 0.3 * healRate(w));
  } else if (c.kind === 'limit') {
    const own = w.weapons.find((o) => o.id === c.id);
    if (own) own.limit = { ...own.limit, [c.stat]: (own.limit?.[c.stat] ?? 0) + 1 };
  } else if (c.kind === 'vigor') {
    // その回だけの強化は World.boost に足す（パッシブや育ちで stats を作り直しても残る）
    w.boost = { ...w.boost, maxHp: (w.boost.maxHp ?? 0) + VIGOR / hpScaleOf(w) };
    w.stats = stats(w.animal, w.passives, w.boost, w.form, hpScaleOf(w));
    if (c.heal !== false) p.hp = w.stats.maxHp;
  } else {
    pick(w, 'bag');
    gainXp(w, BAG_XP);
  }
  trySpecial(w);
}
