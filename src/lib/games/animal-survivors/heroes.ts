import type { GameEvent, World } from './world';

/** 自分の動物にかかわる World の項目。2 匹で遊ぶときは 1 匹ずつ持つ */
export const HERO_KEYS = [
  'animal',
  'form',
  'stats',
  'boost',
  'fx',
  'worn',
  'greed',
  'rerolls',
  'revives',
  'rebirths',
  'skips',
  'banishes',
  'banished',
  'player',
  'weapons',
  'passives',
  'dealt',
  'evolvedNow',
  'drainLeft',
  'pending'
] as const;
export type HeroKey = (typeof HERO_KEYS)[number];
export type Hero = Pick<World, HeroKey> & { down: boolean };

/**
 * 今の読み口（w.player・w.weapons など 270 か所ほど）を書き換えずに 2 匹にするため、
 * 項目を w.heroes[w.cur] への読み書きにする。動物ごとの処理は cur を切り替えて回す
 */
export function bindHeroes(w: World): void {
  for (const k of HERO_KEYS)
    Object.defineProperty(w, k, {
      get: () => w.heroes[w.cur][k],
      set: (v) => ((w.heroes[w.cur] as Record<HeroKey, unknown>)[k] = v),
      enumerable: true,
      configurable: true
    });
}

/** 1 匹が持てる武器の枠。弾や効果の枠の番号は、動物をまたいで重ならない通しの番号（cur * HERO_SLOTS + 枠）にする */
export const HERO_SLOTS = 6;
export const MAX_HEROES = 2;
export const heroOf = (slot: number) => Math.floor(slot / HERO_SLOTS);
export const weaponAt = (w: World, slot: number) => w.heroes[heroOf(slot)]?.weapons[slot % HERO_SLOTS];
export const anyPending = (w: World) => w.heroes.some((h) => h.pending > 0);

/** 倒れていない中でいちばん近い動物。全員倒れていれば 0 */
export function nearestHero(w: World, x: number, y: number): number {
  let best = 0;
  let bd = Infinity;
  w.heroes.forEach((h, i) => {
    if (h.down) return;
    const d = (h.player.x - x) ** 2 + (h.player.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** 倒れていない動物ごとに cur を切り替えて呼び、最後に元の cur に戻す */
export function eachHero(w: World, fn: (i: number) => void): void {
  const was = w.cur;
  try {
    w.heroes.forEach((h, i) => {
      if (h.down) return;
      w.cur = i;
      fn(i);
    });
  } finally {
    w.cur = was;
  }
}

/** 動物ごとの出来事。持ち主の画面にだけ効果と演出を出す（相棒の被弾で自分の縁を光らせない） */
const OWN: ReadonlySet<GameEvent['type']> = new Set([
  'hurt',
  'heal',
  'pickup',
  'coin',
  'revive',
  'fire',
  'grow',
  'special'
]);

/** 出来事の並び。2 匹以上のときは、動物ごとの出来事に、積んだときの動物（cur）を持ち主として付ける */
export function tagged(w: World): GameEvent[] {
  const list: GameEvent[] = [];
  const push = list.push.bind(list);
  list.push = (...items: GameEvent[]) =>
    push(
      ...(w.heroes.length > 1
        ? items.map((e) => (OWN.has(e.type) && e.hero === undefined ? { ...e, hero: w.cur } : e))
        : items)
    );
  return list;
}

/** 自分（cur）の出来事か、持ち主の無い出来事 */
export const ownEvent = (w: World, e: GameEvent) => !OWN.has(e.type) || e.hero === undefined || e.hero === w.cur;
