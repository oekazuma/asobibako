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
