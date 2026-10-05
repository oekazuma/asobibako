import { pushOut } from './obstacles';
import { eachHero, nearestHero } from './heroes';
import { countKill, damageEnemy, type Enemy, type World } from './world';
import { has, healRate, hpScaleOf, MAX_ARCANA } from './arcana';
import { stats } from './passives';
import { trySpecial } from './specials';
import { rollTicket, TICKET_NAME, type Ticket } from './gacha';

export interface Gem {
  alive: boolean;
  x: number;
  y: number;
  value: number;
  pulled: boolean;
}

export interface Item {
  alive: boolean;
  kind: 'meat' | 'magnet' | 'goldMagnet' | 'chest' | 'coin' | 'purse' | 'pouch' | 'cross' | 'clock' | 'ticket';
  x: number;
  y: number;
  pulled: boolean;
  /** 宝の地図の宝箱だけが持つ、消えるまでの秒 */
  life?: number;
  /** ガチャ券の種類 */
  tier?: Ticket;
}

export const MAX_GEMS = 400;
const PICK = 8;
const PULL_SPEED = 220;
const MEAT_HEAL = 30;
/** 1 回で何千体も倒すので、肉が画面にあふれない割合にする */
const MEAT_CHANCE = 0.003;
export const CLEAR_COINS = 100;
export const CHEST_COINS = 10;
/** 拾うコインに掛ける倍率。1 回が 10 分と短いので、店を進められる量にする */
export const COIN_RATE = 1.5;
/** 延長戦のコインの倍率が 1 分ごとに上がる幅 */
export const OVERTIME_STEP = 0.5;
export const PURSE = 50;
const ELITE_COINS = 5;
const COIN_CHANCE = 0.03;
export const POUCH = 10;
/** 時計で敵が止まる秒 */
export const FREEZE = 6;
/** ランタンから出る品の重み。十字架と時計は運で増える */
const LOOT: [Item['kind'], number, boolean][] = [
  ['meat', 20, false],
  ['pouch', 35, false],
  ['magnet', 25, false],
  ['cross', 10, true],
  ['clock', 10, true],
  ['goldMagnet', 3, true]
];

/** 金の磁石のコインラッシュの秒と、そのあいだ倒した敵がコインを落とす確率 */
export const RUSH = 15;
const RUSH_COIN = 0.1;
/** 強化個体が金の磁石を落とす確率（強い相手ほどごほうびを大きくする） */
const ELITE_GOLD = 0.05;

/** 延長戦に入ってからの分ごとに上がるコインの倍率。延長戦でなければ 1 */
export function overtimeRate(w: World): number {
  return w.overtime ? 1 + OVERTIME_STEP * Math.floor((w.time - w.overtime.from) / 60) : 1;
}

/** コインはすべてここを通す。延長戦のあいだは倍率を掛けて延長戦のぶんに貯める */
export function addCoins(w: World, n: number): void {
  if (w.overtime) w.overtime.coins += n * overtimeRate(w);
  else w.coins += n;
}

/** 延長戦のぶんのコイン。倒れたら半分、自分で終えたら全部 */
export function overtimeCoins(w: World): number {
  const o = w.overtime;
  if (!o) return 0;
  const keep = w.over === 'dead' && !o.retreat ? 0.5 : 1;
  return Math.floor(o.coins * w.greed * w.stage.coin * COIN_RATE * keep + 1e-9);
}

/** ランタンが壊れたときの品を 1 つ置く */
export function dropLoot(w: World, x: number, y: number): void {
  const weight = (o: (typeof LOOT)[number]) =>
    o[1] *
    (o[2] ? 1 + w.stats.luck + w.fx.loot : 1) *
    (o[0] === 'goldMagnet' ? 1 + w.fx.gold : o[0] === 'magnet' ? 1 + w.fx.magnetLoot : 1);
  let r = w.rand() * LOOT.reduce((t, o) => t + weight(o), 0);
  for (const o of LOOT) {
    r -= weight(o);
    if (r < 0) {
      dropItem(w, o[0], x, y);
      return;
    }
  }
  dropItem(w, 'meat', x, y);
}

/** 十字架。画面の中のボスとランタン以外を倒す（経験値も落とす） */
function clearScreen(w: World) {
  const p = w.player;
  for (const e of w.enemies) {
    if (!e.alive || e.def.boss || e.def.prop || e.def.chief || e.def.part) continue;
    if (Math.abs(e.x - p.x) > w.view.w / 2 || Math.abs(e.y - p.y) > w.view.h / 2) continue;
    if (e.def.metal) {
      damageEnemy(w, w.enemies.indexOf(e), 1, 0, 0);
      continue;
    }
    e.alive = false;
    countKill(w, e);
    w.events.push({ type: 'kill', x: e.x, y: e.y, enemy: e.def.id });
    dropFrom(w, e);
  }
}

/** Lv から次の Lv へ要る経験値。5 から始めて Lv10・20・30・40 ごとに伸びを大きくする（後半に強くなりすぎないように） */
export function xpNeed(level: number): number {
  if (level < 10) return 5 + (level - 1) * 10;
  if (level < 20) return 95 + (level - 10) * 22;
  if (level < 30) return 315 + (level - 20) * 40;
  if (level < 40) return 720 + (level - 30) * 60;
  return 1320 + (level - 40) * 72;
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
    // レベルは 2 匹で共通。3 択は 2 匹ともに 1 つずつたまり、育つ Lv は動物ごとの装備で違う
    for (const h of w.heroes) if (!h.gone) h.pending += 1;
    w.events.push({ type: 'levelup' });
    eachHero(w, () => GROW_AT.some((l) => l - w.fx.grow === w.level) && grow(w));
  }
}

function grow(w: World): void {
  w.form = Math.min(2, w.form + 1) as World['form'];
  w.stats = stats(w.animal, w.passives, w.boost, w.form, hpScaleOf(w));
  w.player.hp = w.stats.maxHp;
  w.events.push({ type: 'grow', form: w.form as 1 | 2 });
  trySpecial(w);
}

/** 玉が MAX_GEMS 個あれば、新しく作らずに自分からいちばん遠い玉へ値を足す（経験値を消さずに数を抑える） */
export function dropGem(w: World, x: number, y: number, value: number): void {
  const at = { x, y };
  pushOut(w.stage.art, at, 4);
  ({ x, y } = at);
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

function dropItem(w: World, kind: Item['kind'], x: number, y: number, pulled = false): Item | undefined {
  if (kind === 'meat' && noMeat(w)) return;
  const at = { x, y };
  pushOut(w.stage.art, at, 6);
  ({ x, y } = at);
  const it =
    w.items.find((o) => !o.alive) ?? (w.items[w.items.length] = { alive: false, kind, x: 0, y: 0, pulled: false });
  Object.assign(it, { alive: true, kind, x, y, pulled });
  delete it.life;
  delete it.tier;
  return it;
}

/** ボスとヌシが券を落とす割合（ステージの主は毎回） */
export const TICKET_CHANCE = 0.25;

function dropTicket(w: World, x: number, y: number) {
  dropItem(w, 'ticket', x, y)!.tier = rollTicket(w.heat.level, w.loot());
}

/** 肉が出ないしばりの回 */
export const noMeat = (w: World) => w.mods.includes('noMeat') || has(w, 'cursed') || has(w, 'blood');

const BOSS_GEMS = 10;
/** 強化個体が宝箱を落とす確率 */
const ELITE_CHEST = 0.06;
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
    // ステージの主は 2 体で 1 組なので、確定の券は先に倒した 1 体だけ
    if ((e.def.finale && w.finaleKills <= 1) || w.loot() < TICKET_CHANCE) dropTicket(w, e.x - 12, e.y);
    if (e.def.arcana && w.arcanaPool.length && w.arcana.length + w.arcanaPending < MAX_ARCANA) w.arcanaPending += 1;
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
  if (e.def.chief && w.loot() < TICKET_CHANCE) dropTicket(w, e.x - 10, e.y);
  if (w.rand() < MEAT_CHANCE) dropItem(w, 'meat', e.x + 4, e.y);
  else if (w.rand() < 0.004) dropItem(w, 'magnet', e.x + 4, e.y);
  if (e.def.elite && w.rand() < ELITE_CHEST) dropItem(w, 'chest', e.x, e.y);
  if (e.def.elite && w.rand() < ELITE_GOLD * (1 + w.fx.gold)) dropItem(w, 'goldMagnet', e.x, e.y + 8);
  if (w.rush > 0 && w.rand() < RUSH_COIN) dropItem(w, 'coin', e.x, e.y - 4, true);
  if (e.def.elite)
    for (let i = 0; i < ELITE_COINS; i++) {
      const a = (i / ELITE_COINS) * Math.PI * 2;
      dropItem(w, 'coin', e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8, w.rush > 0);
    }
  else if (w.rand() < COIN_CHANCE * (1 + w.stats.luck)) dropItem(w, 'coin', e.x - 4, e.y, w.rush > 0);
}

/** 図鑑に載せる、その回に拾った品 */
export function pick(w: World, kind: string): void {
  if (!w.picked.includes(kind)) w.picked.push(kind);
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

/** 玉と品は 1 つずつ、近いほうの動物が吸い寄せて拾う（吸い寄せる範囲と回復はその動物のもの） */
export function collect(w: World, dt: number): void {
  for (const g of w.gems) {
    if (!g.alive) continue;
    w.cur = nearestHero(w, g.x, g.y);
    if (!pull(w, g, 32 * w.stats.magnet * (1 + w.fx.gemReach), dt)) continue;
    g.alive = false;
    const v = g.value * (w.festival > 0 ? 2 : 1);
    w.events.push({ type: 'pickup', value: v });
    gainXp(w, v);
  }
  for (const it of w.items) {
    if (!it.alive) continue;
    w.cur = nearestHero(w, it.x, it.y);
    const reach = 32 * w.stats.magnet;
    if (it.kind === 'chest') {
      if ((it.x - w.player.x) ** 2 + (it.y - w.player.y) ** 2 < CHEST_PICK ** 2) {
        it.alive = false;
        pick(w, 'chest');
        // 時計で止まっていると stepEvents が回らないので、宝の地図の宝箱はここで手放す
        if (it === w.treasure) w.treasure = null;
        w.chests += 1;
        w.events.push({ type: 'chest' });
      }
      continue;
    }
    if (it.kind === 'ticket') {
      if ((it.x - w.player.x) ** 2 + (it.y - w.player.y) ** 2 < CHEST_PICK ** 2) {
        it.alive = false;
        w.tickets[it.tier ?? 0] += 1;
        w.events.push({ type: 'swarm', text: `${TICKET_NAME[it.tier ?? 0]}を拾った！` });
      }
      continue;
    }
    if (!pull(w, it, reach, dt)) continue;
    it.alive = false;
    if (it.kind !== 'coin') pick(w, it.kind);
    if (it.kind === 'cross') {
      clearScreen(w);
      w.events.push({ type: 'cross' });
      continue;
    }
    if (it.kind === 'goldMagnet') {
      for (const o of w.items) if (o.kind === 'coin' || o.kind === 'pouch' || o.kind === 'purse') o.pulled ||= o.alive;
      w.rush = RUSH;
      w.events.push({ type: 'rush' });
      continue;
    }
    if (it.kind === 'clock') {
      w.freeze = FREEZE + w.fx.freeze;
      w.events.push({ type: 'freeze' });
      continue;
    }
    if (it.kind === 'coin' || it.kind === 'purse' || it.kind === 'pouch') {
      const value = it.kind === 'coin' ? (w.festival > 0 ? 2 : 1) : it.kind === 'pouch' ? POUCH : PURSE;
      addCoins(w, value);
      // 浮かぶ数字は倍率を掛けた、実際に入った枚数で見せる
      w.events.push({ type: 'coin', value: Math.floor(value * COIN_RATE * overtimeRate(w)) });
      continue;
    }
    if (it.kind === 'meat') {
      const p = w.player;
      const before = p.hp;
      p.hp = Math.min(w.stats.maxHp, p.hp + MEAT_HEAL * healRate(w) * (1 + w.fx.meat));
      w.events.push({ type: 'heal', amount: Math.round(p.hp - before) });
    } else {
      for (const g of w.gems) g.pulled ||= g.alive;
      w.events.push({ type: 'magnet' });
    }
  }
  w.cur = 0;
}
