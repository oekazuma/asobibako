import type { World } from './world';

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
