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
  'pending',
  'chests',
  'big',
  'raises',
  'shrineCount',
  'blessing'
] as const;
export type HeroKey = (typeof HERO_KEYS)[number];
/** down は倒れている、revive は倒れているあいだに相棒がそばにいた秒、gone は抜けた（倒れたままで、描かない） */
export type Hero = Pick<World, HeroKey> & { down: boolean; revive: number; gone: boolean };

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
export const SLOT_COUNT = HERO_SLOTS * MAX_HEROES;
/** 合体武器の 2 つめの部品は、枠の番号にこれを足して出す（当たりの時計を 1 つめの部品と分ける） */
export const PART_B = SLOT_COUNT;
export const heroOf = (slot: number) => Math.floor((slot % SLOT_COUNT) / HERO_SLOTS);
export const weaponAt = (w: World, slot: number) => w.heroes[heroOf(slot)]?.weapons[slot % HERO_SLOTS];
export const anyPending = (w: World) => w.heroes.some((h) => h.pending > 0);
export const anyChest = (w: World) => w.heroes.some((h) => h.chests > 0);
/** 抜けていない相棒がいる（自分の端末から見て） */
export const hasMate = (w: World) => w.heroes.some((h, k) => k !== w.cur && !h.gone);

/** 倒れた動物のそばに相棒がこの秒いると起き上がる */
export const RAISE_SECS = 3;
export const RAISE_REACH = 24;

/** 起こした 2 匹に足す、力と風のご利益の秒 */
export const RAISE_BLESS = 10;
/** 相棒の HP がこの割合を切ると、自分の画面でピンチを知らせる */
export const PINCH = 0.3;

export const inPinch = (h: Hero) => !h.gone && (h.down || h.player.hp < h.stats.maxHp * PINCH);

/** 倒れた動物の起こす時計を進め、届いたら HP 半分で起こし、2 匹にご利益を足す */
export function raise(w: World, dt: number): void {
  w.heroes.forEach((h, i) => {
    if (!h.down || h.gone) return;
    const by = w.heroes.findIndex(
      (o) => !o.down && (o.player.x - h.player.x) ** 2 + (o.player.y - h.player.y) ** 2 < RAISE_REACH ** 2
    );
    const was = h.revive;
    h.revive = by >= 0 ? h.revive + dt : 0;
    if (h.revive < RAISE_SECS) {
      if (Math.floor(h.revive) > Math.floor(was))
        w.events.push({ type: 'raising', who: i, step: Math.floor(h.revive) });
      return;
    }
    h.down = false;
    h.revive = 0;
    h.player.hp = Math.round(h.stats.maxHp / 2);
    h.player.invuln = 2;
    for (const k of [i, by]) {
      const b = w.heroes[k].blessing;
      b.might = Math.max(0, b.might) + RAISE_BLESS;
      b.speed = Math.max(0, b.speed) + RAISE_BLESS;
    }
    w.heroes[by].raises += 1;
    w.events.push({ type: 'raised', who: i, by });
  });
}

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
  'special',
  'shrine'
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
