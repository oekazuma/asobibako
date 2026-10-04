import { hpScale, swarmStage } from './daily';
import { stats } from './passives';
import type { World } from './world';

export type ArcanaId =
  | 'fang'
  | 'swift'
  | 'wisdom'
  | 'clover'
  | 'shadow'
  | 'sand'
  | 'spring'
  | 'eye'
  | 'gamble'
  | 'armor'
  | 'cursed'
  | 'greedy'
  | 'glass'
  | 'last'
  | 'horde'
  | 'blood';

/** その回だけルールを変える札。trade は大きく効くかわりに悪いところ（bad）がある札。unlock は開く実績の id */
export interface ArcanaDef {
  id: ArcanaId;
  name: string;
  good: string;
  bad?: string;
  trade: boolean;
  unlock?: string;
}

export const ARCANA: ArcanaDef[] = [
  { id: 'fang', name: '大きな牙', good: '攻撃の範囲 +20%', trade: false },
  { id: 'swift', name: '早足のお守り', good: '速さ +15%、引き寄せ +40%', trade: false },
  { id: 'wisdom', name: '知恵の実', good: '経験値 +20%', trade: false },
  { id: 'clover', name: '四つ葉の冠', good: '運 +30%', trade: false },
  { id: 'shadow', name: 'ふたつめの影', good: '弾と攻撃の数 +1', trade: false, unlock: 'heat5' },
  { id: 'sand', name: '時の砂', good: '効く時間 +30%、攻撃の間 −10%', trade: false, unlock: 'overtime5' },
  { id: 'spring', name: '命の泉', good: '最大 HP +30、少しずつ回復', trade: false, unlock: 'snowClear' },
  { id: 'eye', name: '会心の目', good: '会心 +15%', trade: false, unlock: 'metal' },
  { id: 'gamble', name: 'いちかばちか', good: '攻撃 +50%', bad: '最大 HP 半分', trade: true },
  { id: 'armor', name: '重いよろい', good: '防御 +4', bad: '速さ −20%', trade: true },
  { id: 'cursed', name: '宝の呪い', good: '宝箱の中身がいつも 3 つ以上', bad: '肉が出ない', trade: true },
  { id: 'greedy', name: '欲ばりの壺', good: 'コイン 1.5 倍', bad: '敵の体力 1.15 倍', trade: true },
  { id: 'glass', name: 'ガラスの大砲', good: '攻撃の間 −40%', bad: '防御 −3', trade: true, unlock: 'weapons5' },
  {
    id: 'last',
    name: '背水の陣',
    good: 'HP が減るほど攻撃が上がる（最大 +80%）',
    bad: '回復が半分',
    trade: true,
    unlock: 'overtime10'
  },
  {
    id: 'horde',
    name: '群れの呼び声',
    good: '敵が多いぶん経験値とコインが増える',
    bad: '敵の出る数 1.6 倍、ふつうの敵の攻撃 1.3 倍',
    trade: true,
    unlock: 'run3000'
  },
  {
    id: 'blood',
    name: '血の契約',
    good: '敵を 10 体倒すたびに HP 1 回復',
    bad: '肉が出ない、少しずつの回復なし',
    trade: true,
    unlock: 'daily7'
  }
];

export const MAX_ARCANA = 3;
const BLOOD_EVERY = 10;
const SPRING_HP = 30;

export const arcanaDef = (id: ArcanaId) => ARCANA.find((a) => a.id === id)!;
export const arcanaOf = (achievement: string) => ARCANA.find((a) => a.unlock === achievement);
export const has = (w: World, id: ArcanaId) => w.arcana.includes(id);

export function openArcana(achieved: string[]): ArcanaId[] {
  return ARCANA.filter((a) => !a.unlock || achieved.includes(a.unlock)).map((a) => a.id);
}

/** 持っていない開いた札から 3 枚。引き換えの札が残っていれば 1 枚だけ入れる */
export function arcanaOffer(w: World): ArcanaId[] {
  if (w.arcana.length >= MAX_ARCANA) return [];
  const left = w.arcanaPool.filter((id) => !has(w, id));
  const pickFrom = (list: ArcanaId[], n: number) => {
    const bag = [...list];
    const out: ArcanaId[] = [];
    while (out.length < n && bag.length) out.push(bag.splice(Math.floor(w.rand() * bag.length), 1)[0]);
    return out;
  };
  const trades = left.filter((id) => arcanaDef(id).trade);
  const goods = left.filter((id) => !arcanaDef(id).trade);
  const one = pickFrom(trades, 1);
  return [...one, ...pickFrom(goods, 3 - one.length)];
}

export const hpScaleOf = (w: World) => hpScale(w.mods) * (has(w, 'gamble') ? 0.5 : 1);
/** 少しずつの回復に掛ける */
export const regenRate = (w: World) => (has(w, 'blood') ? 0 : has(w, 'last') ? 0.5 : 1);
/** 肉と吸収の回復に掛ける */
export const healRate = (w: World) => (has(w, 'last') ? 0.5 : 1);
/** 背水の陣。HP が減るほど攻撃に掛ける倍率が上がる */
export function desperate(w: World): number {
  if (!has(w, 'last')) return 1;
  return 1 + 0.8 * (1 - Math.max(0, w.player.hp) / w.stats.maxHp);
}

/** 血の契約。倒した数を数えたところで呼ぶ */
export function bloodPact(w: World): void {
  if (has(w, 'blood') && w.kills % BLOOD_EVERY === 0) w.player.hp = Math.min(w.stats.maxHp, w.player.hp + 1);
}

const ADD: Partial<Record<ArcanaId, (w: World) => Partial<Record<keyof World['stats'], number>>>> = {
  fang: () => ({ area: 0.2 }),
  swift: (w) => ({ speed: w.animal.speed * 0.15, magnet: 0.4 }),
  wisdom: () => ({ growth: 0.2 }),
  clover: () => ({ luck: 0.3 }),
  shadow: () => ({ amount: 1 }),
  sand: () => ({ duration: 0.3, haste: 0.1 }),
  // いちかばちかを先に持っていても +30 になるよう、最後に掛ける倍率で割っておく
  spring: (w) => ({ maxHp: SPRING_HP / hpScaleOf(w), regen: 1 }),
  eye: () => ({ crit: 0.15 }),
  gamble: (w) => ({ might: w.animal.might * 0.5 }),
  armor: (w) => ({ armor: 4, speed: -w.animal.speed * 0.2 }),
  glass: () => ({ armor: -3 })
};

export function takeArcana(w: World, id: ArcanaId): void {
  if (has(w, id) || w.arcana.length >= MAX_ARCANA) return;
  w.arcana.push(id);
  const add = ADD[id]?.(w) ?? {};
  const boost = { ...w.boost };
  for (const [k, v] of Object.entries(add) as [keyof World['stats'], number][]) boost[k] = (boost[k] ?? 0) + v;
  w.boost = boost;
  if (id === 'horde') {
    const s = swarmStage(w.stage, 1.6);
    w.stage = { ...s, fury: (t) => s.fury(t) * 1.3 };
  }
  if (id === 'greedy') {
    w.greed *= 1.5;
    const s = w.stage;
    w.stage = { ...s, toughness: (t) => s.toughness(t) * 1.15 };
  }
  w.stats = stats(w.animal, w.passives, w.boost, w.form, hpScaleOf(w));
  if (id === 'spring') w.player.hp += SPRING_HP;
  w.player.hp = Math.min(w.player.hp, w.stats.maxHp);
}
