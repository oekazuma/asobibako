import type { Enemy, World } from './world';

export interface Gem {
  alive: boolean;
  x: number;
  y: number;
  value: number;
  pulled: boolean;
}

export interface Item {
  alive: boolean;
  kind: 'meat' | 'magnet' | 'chest';
  x: number;
  y: number;
  pulled: boolean;
}

export const MAX_GEMS = 400;
const PICK = 8;
const PULL_SPEED = 220;
const MEAT_HEAL = 30;

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

export function gainXp(w: World, value: number): void {
  const v = value * w.stats.growth;
  w.xp += v;
  w.xpTotal += v;
  while (w.xp >= xpNeed(w.level)) {
    w.xp -= xpNeed(w.level);
    w.level += 1;
    w.pending += 1;
    w.events.push({ type: 'levelup' });
  }
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
const BOSS_GEM_XP = 25;
/** 宝箱は吸い寄せず、ここまで近づいたら拾う */
const CHEST_PICK = 10;

export function dropFrom(w: World, e: Enemy): void {
  if (e.def.boss) {
    for (let i = 0; i < BOSS_GEMS; i++) {
      const a = (i / BOSS_GEMS) * Math.PI * 2;
      dropGem(w, e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, BOSS_GEM_XP);
    }
    dropItem(w, 'chest', e.x, e.y);
    return;
  }
  dropGem(w, e.x, e.y, e.def.xp);
  if (w.rand() < 0.012) dropItem(w, 'meat', e.x + 4, e.y);
  else if (w.rand() < 0.004) dropItem(w, 'magnet', e.x + 4, e.y);
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
