import { damageEnemy, type Enemy, type World } from './world';
import { stats } from './passives';

export interface Gem {
  alive: boolean;
  x: number;
  y: number;
  value: number;
  pulled: boolean;
}

export interface Item {
  alive: boolean;
  kind: 'meat' | 'magnet' | 'chest' | 'coin' | 'purse' | 'pouch' | 'cross' | 'clock';
  x: number;
  y: number;
  pulled: boolean;
}

export const MAX_GEMS = 400;
const PICK = 8;
const PULL_SPEED = 220;
const MEAT_HEAL = 30;
export const CLEAR_COINS = 100;
export const CHEST_COINS = 10;
const PURSE = 50;
const ELITE_COINS = 5;
const COIN_CHANCE = 0.03;
const POUCH = 10;
/** 時計で敵が止まる秒 */
export const FREEZE = 10;
/** ランタンから出る品の重み。十字架と時計は運で増える */
const LOOT: [Item['kind'], number, boolean][] = [
  ['meat', 40, false],
  ['pouch', 25, false],
  ['magnet', 15, false],
  ['cross', 10, true],
  ['clock', 10, true]
];

/** ランタンが壊れたときの品を 1 つ置く */
export function dropLoot(w: World, x: number, y: number): void {
  const weight = (o: (typeof LOOT)[number]) => o[1] * (o[2] ? 1 + w.stats.luck : 1);
  let r = w.rand() * LOOT.reduce((t, o) => t + weight(o), 0);
  for (const o of LOOT) {
    r -= weight(o);
    if (r < 0) return dropItem(w, o[0], x, y);
  }
  dropItem(w, 'meat', x, y);
}

/** 十字架。画面の中のボスとランタン以外を倒す（経験値も落とす） */
function clearScreen(w: World) {
  const p = w.player;
  for (const e of w.enemies) {
    if (!e.alive || e.def.boss || e.def.prop || e.def.chief) continue;
    if (Math.abs(e.x - p.x) > w.view.w / 2 || Math.abs(e.y - p.y) > w.view.h / 2) continue;
    if (e.def.metal) {
      damageEnemy(w, w.enemies.indexOf(e), 1, 0, 0);
      continue;
    }
    e.alive = false;
    w.kills += 1;
    w.events.push({ type: 'kill', x: e.x, y: e.y, enemy: e.def.id });
    dropFrom(w, e);
  }
}

/** Lv から次の Lv へ要る経験値。5 から始めて Lv20 まで 10 ずつ、Lv40 まで 13 ずつ、そこからは 16 ずつ増える */
export function xpNeed(level: number): number {
  if (level < 20) return 5 + (level - 1) * 10;
  if (level < 40) return 195 + (level - 20) * 13;
  return 455 + (level - 40) * 16;
}

/** 描く色。1〜4 は青、5〜19 は緑、20 以上は赤 */
export function gemTier(value: number): 0 | 1 | 2 {
  return value >= 20 ? 2 : value >= 5 ? 1 : 0;
}

/** この Lv に届いたら 1 段階育つ */
export const GROW_AT = [10, 25];

export function gainXp(w: World, value: number): void {
  const v = value * w.stats.growth;
  w.xp += v;
  w.xpTotal += v;
  while (w.xp >= xpNeed(w.level)) {
    w.xp -= xpNeed(w.level);
    w.level += 1;
    w.pending += 1;
    w.events.push({ type: 'levelup' });
    if (GROW_AT.includes(w.level)) grow(w);
  }
}

function grow(w: World): void {
  w.form = Math.min(2, w.form + 1) as World['form'];
  w.stats = stats(w.animal, w.passives, w.boost, w.form);
  w.player.hp = w.stats.maxHp;
  w.events.push({ type: 'grow', form: w.form as 1 | 2 });
}

/** 玉が MAX_GEMS 個あれば、新しく作らずに自分からいちばん遠い玉へ値を足す（経験値を消さずに数を抑える） */
export function dropGem(w: World, x: number, y: number, value: number): void {
  let count = 0;
  let far: Gem | undefined;
  let fd = -1;
  let free: Gem | undefined;
  const p = w.player;
  for (const g of w.gems) {
    if (!g.alive) {
      free ??= g;
      continue;
    }
    count++;
    const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d > fd) {
      fd = d;
      far = g;
    }
  }
  if (count >= MAX_GEMS && far) {
    far.value += value;
    return;
  }
  const g = free ?? (w.gems[w.gems.length] = { alive: false, x: 0, y: 0, value: 0, pulled: false });
  Object.assign(g, { alive: true, x, y, value, pulled: false });
}

function dropItem(w: World, kind: Item['kind'], x: number, y: number) {
  const it =
    w.items.find((o) => !o.alive) ?? (w.items[w.items.length] = { alive: false, kind, x: 0, y: 0, pulled: false });
  Object.assign(it, { alive: true, kind, x, y, pulled: false });
}

const BOSS_GEMS = 10;
/** 強化個体が宝箱を落とす確率 */
const ELITE_CHEST = 0.1;
const BOSS_GEM_XP = 25;
/** Lv10 前後で 3 つほど上がる */
const METAL_XP = 300;
/** 宝箱は吸い寄せず、ここまで近づいたら拾う */
const CHEST_PICK = 10;

export function dropFrom(w: World, e: Enemy): void {
  if (e.def.prop) return dropLoot(w, e.x, e.y);
  if (e.def.boss) {
    for (let i = 0; i < BOSS_GEMS; i++) {
      const a = (i / BOSS_GEMS) * Math.PI * 2;
      dropGem(w, e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, BOSS_GEM_XP);
    }
    dropItem(w, 'purse', e.x + 12, e.y);
    dropItem(w, 'chest', e.x, e.y);
    return;
  }
  if (e.def.metal) {
    dropGem(w, e.x, e.y, METAL_XP);
    dropItem(w, 'purse', e.x - 8, e.y);
    dropItem(w, 'purse', e.x + 8, e.y);
    return;
  }
  dropGem(w, e.x, e.y, e.def.xp);
  if (e.def.chief) dropItem(w, 'chest', e.x + 10, e.y);
  if (w.rand() < 0.012) dropItem(w, 'meat', e.x + 4, e.y);
  else if (w.rand() < 0.004) dropItem(w, 'magnet', e.x + 4, e.y);
  if (e.def.elite && w.rand() < ELITE_CHEST) dropItem(w, 'chest', e.x, e.y);
  if (e.def.elite)
    for (let i = 0; i < ELITE_COINS; i++) {
      const a = (i / ELITE_COINS) * Math.PI * 2;
      dropItem(w, 'coin', e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
    }
  else if (w.rand() < COIN_CHANCE * (1 + w.stats.luck)) dropItem(w, 'coin', e.x - 4, e.y);
}

/** 吸い寄せて、届いたら true */
function pull(w: World, o: { x: number; y: number; pulled: boolean }, reach: number, dt: number): boolean {
  const p = w.player;
  const dx = p.x - o.x;
  const dy = p.y - 4 - o.y;
  const d = Math.hypot(dx, dy);
  if (!o.pulled && d < reach) o.pulled = true;
  if (!o.pulled) return false;
  if (d < PICK) return true;
  const step = Math.min(d, PULL_SPEED * dt);
  o.x += (dx / d) * step;
  o.y += (dy / d) * step;
  return Math.hypot(p.x - o.x, p.y - 4 - o.y) < PICK;
}

export function collect(w: World, dt: number): void {
  const reach = 32 * w.stats.magnet;
  for (const g of w.gems) {
    if (!g.alive || !pull(w, g, reach, dt)) continue;
    g.alive = false;
    w.events.push({ type: 'pickup', value: g.value });
    gainXp(w, g.value);
  }
  for (const it of w.items) {
    if (!it.alive) continue;
    if (it.kind === 'chest') {
      if ((it.x - w.player.x) ** 2 + (it.y - w.player.y) ** 2 < CHEST_PICK ** 2) {
        it.alive = false;
        w.chests += 1;
        w.events.push({ type: 'chest' });
      }
      continue;
    }
    if (!pull(w, it, reach, dt)) continue;
    it.alive = false;
    if (it.kind === 'cross') {
      clearScreen(w);
      w.events.push({ type: 'cross' });
      continue;
    }
    if (it.kind === 'clock') {
      w.freeze = FREEZE;
      w.events.push({ type: 'freeze' });
      continue;
    }
    if (it.kind === 'coin' || it.kind === 'purse' || it.kind === 'pouch') {
      const value = it.kind === 'coin' ? 1 : it.kind === 'pouch' ? POUCH : PURSE;
      w.coins += value;
      w.events.push({ type: 'coin', value });
      continue;
    }
    if (it.kind === 'meat') {
      const p = w.player;
      const before = p.hp;
      p.hp = Math.min(w.stats.maxHp, p.hp + MEAT_HEAL);
      w.events.push({ type: 'heal', amount: Math.round(p.hp - before) });
    } else {
      for (const g of w.gems) g.pulled ||= g.alive;
      w.events.push({ type: 'magnet' });
    }
  }
}
