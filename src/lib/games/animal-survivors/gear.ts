import type { StatKey, Stats } from './passives';

export type Slot = 'head' | 'body' | 'charm';
export type Rarity = 0 | 1 | 2;
export type GearId =
  | 'hachimaki'
  | 'goggles'
  | 'straw'
  | 'wizard'
  | 'oni'
  | 'flower'
  | 'knight'
  | 'muffler'
  | 'cloak'
  | 'scarf'
  | 'leaf'
  | 'shell'
  | 'cat'
  | 'clover'
  | 'owl'
  | 'necklace'
  | 'hourglass'
  | 'feather';
export type GearKey = `${GearId}:${Rarity}`;
export type FxKey =
  | 'bossDmg'
  | 'critDmg'
  | 'gemReach'
  | 'fourth'
  | 'oni'
  | 'loot'
  | 'bossGuard'
  | 'wind'
  | 'lavaGuard'
  | 'invuln'
  | 'meat'
  | 'shell'
  | 'gold'
  | 'chest'
  | 'grow'
  | 'magnetLoot'
  | 'freeze'
  | 'feather';
export type GearFx = Record<FxKey, number>;

/** amount は伝説の能力の量（店のその品の最大の半分）。fxRare はレアの効き目の量で、伝説は 2 倍 */
export interface GearDef {
  id: GearId;
  name: string;
  slot: Slot;
  stat: StatKey | 'greed';
  amount: number;
  fx: FxKey;
  fxRare: number;
  fxText: (v: number) => string;
}

export const SLOTS: Slot[] = ['head', 'body', 'charm'];
export const SLOT_NAME: Record<Slot, string> = { head: 'あたま', body: 'からだ', charm: 'おまもり' };
export const RARITY_NAME = ['ふつう', 'レア', '伝説'] as const;
const SCALE = [0.4, 0.65, 1];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const g = (
  id: GearId,
  name: string,
  slot: Slot,
  stat: GearDef['stat'],
  amount: number,
  fx: FxKey,
  fxRare: number,
  fxText: (v: number) => string
): GearDef => ({ id, name, slot, stat, amount, fx, fxRare, fxText });

export const GEAR: GearDef[] = [
  g('hachimaki', '勇者のハチマキ', 'head', 'might', 0.125, 'bossDmg', 0.15, (v) => `ボスとヌシへの攻撃 +${pct(v)}`),
  g('goggles', '鷹のゴーグル', 'head', 'crit', 0.05, 'critDmg', 0.25, (v) => `会心のダメージ +${pct(v)}`),
  g('straw', '麦わら帽子', 'head', 'area', 0.12, 'gemReach', 0.2, (v) => `経験値の玉を拾う範囲 +${pct(v)}`),
  g('wizard', 'とんがり帽子', 'head', 'duration', 0.125, 'fourth', 0.1, (v) => `3 択が 4 択になる割合 +${pct(v)}`),
  g('oni', '鬼のツノ', 'head', 'might', 0.125, 'oni', 0.15, (v) => `HP が半分より下のあいだ攻撃 +${pct(v)}`),
  g('flower', '花の冠', 'head', 'luck', 0.125, 'loot', 0.5, (v) => `ランタンから十字架・時計・金の磁石 +${pct(v)}`),
  g(
    'knight',
    '騎士のよろい',
    'body',
    'armor',
    1.5,
    'bossGuard',
    0.15,
    (v) => `ボスとヌシから受けるダメージ −${pct(v)}`
  ),
  g('muffler', '毛糸のマフラー', 'body', 'maxHp', 25, 'wind', 0.5, (v) => `吹雪で流される量 −${pct(v)}`),
  g('cloak', '耐火のマント', 'body', 'maxHp', 25, 'lavaGuard', 0.5, (v) => `溶岩の池のダメージ −${pct(v)}`),
  g('scarf', '風のスカーフ', 'body', 'speed', 0.1, 'invuln', 0.3, (v) => `当たったあとの無敵 +${v} 秒`),
  g('leaf', '葉っぱの服', 'body', 'regen', 0.25, 'meat', 0.5, (v) => `肉で戻る HP +${pct(v)}`),
  g('shell', '甲羅', 'body', 'armor', 1.5, 'shell', 0.25, (v) => `飛んでくる攻撃のダメージ −${pct(v)}`),
  g('cat', '招き猫', 'charm', 'greed', 0.25, 'gold', 1, (v) => `金の磁石が出る割合 ${v + 1} 倍`),
  g(
    'clover',
    '四つ葉のお守り',
    'charm',
    'luck',
    0.125,
    'chest',
    0.1,
    (v) => `宝箱の中身が 3 つ以上になる割合 +${pct(v)}`
  ),
  g('owl', '知恵のふくろう', 'charm', 'growth', 0.125, 'grow', 1, (v) => `育つ Lv が ${v} 早い`),
  g(
    'necklace',
    '磁石の首飾り',
    'charm',
    'magnet',
    0.25,
    'magnetLoot',
    1,
    (v) => `ランタンから磁石が出る割合 ${v + 1} 倍`
  ),
  g('hourglass', '砂時計', 'charm', 'duration', 0.125, 'freeze', 3, (v) => `時計で止まる時間 +${v} 秒`),
  g(
    'feather',
    '不死鳥の羽根',
    'charm',
    'regen',
    0.25,
    'feather',
    0.25,
    (v) => `倒れたとき 1 回だけ HP ${pct(v)} で起き上がる`
  )
];

export const gearDef = (id: GearId) => GEAR.find((d) => d.id === id)!;
export const keyOf = (id: GearId, r: Rarity) => `${id}:${r}` as GearKey;

/** 保存を手で直した「owl:1.0」のような名前も読む。正しい名前は keyOf で作り直す */
export function parseKey(k: string): { def: GearDef; rarity: Rarity } | null {
  const parts = k.split(':');
  if (parts.length !== 2 || !/^\d+(\.0+)?$/.test(parts[1])) return null;
  const [id, r] = parts;
  const def = GEAR.find((d) => d.id === id);
  const rarity = Number(r);
  return def && (rarity === 0 || rarity === 1 || rarity === 2) ? { def, rarity } : null;
}

export function noFx(): GearFx {
  return Object.fromEntries(GEAR.map((d) => [d.fx, 0])) as GearFx;
}

export const statAmount = (d: GearDef, r: Rarity) => d.amount * SCALE[r];
export const fxAmount = (d: GearDef, r: Rarity) => (r === 0 ? 0 : d.fxRare * r);

const LABEL: Record<GearDef['stat'], string> = {
  might: '攻撃',
  crit: '会心',
  area: '攻撃の範囲',
  duration: '効く時間',
  luck: '運',
  maxHp: '最大 HP',
  armor: '防御',
  speed: '速さ',
  regen: '毎秒の回復',
  magnet: '拾う範囲',
  growth: '経験値',
  greed: 'コイン',
  haste: '攻撃の間',
  amount: '数'
};
const PLAIN = new Set<GearDef['stat']>(['maxHp', 'armor', 'regen', 'amount']);

export function statText(d: GearDef, r: Rarity): string {
  const v = statAmount(d, r);
  return `${LABEL[d.stat]} +${PLAIN.has(d.stat) ? Math.round(v * 100) / 100 : pct(v)}`;
}

export const fxText = (d: GearDef, r: Rarity) => (r === 0 ? null : d.fxText(fxAmount(d, r)));

export function addBoost(a: Partial<Stats>, b: Partial<Stats>): Partial<Stats> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Stats, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}

export function gearOf(keys: GearKey[]): { boost: Partial<Stats>; greed: number; fx: GearFx } {
  const out = { boost: {} as Partial<Stats>, greed: 0, fx: noFx() };
  for (const k of keys) {
    const p = parseKey(k);
    if (!p) continue;
    const v = statAmount(p.def, p.rarity);
    if (p.def.stat === 'greed') out.greed += v;
    else out.boost[p.def.stat] = (out.boost[p.def.stat] ?? 0) + v;
    out.fx[p.def.fx] += fxAmount(p.def, p.rarity);
  }
  return out;
}
