import type { StatKey, Stats } from './passives';
import type { Records } from './records';

export type UpgradeId =
  'might' | 'maxHp' | 'speed' | 'armor' | 'regen' | 'magnet' | 'growth' | 'crit' | 'greed' | 'reroll' | 'revive';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  blurb: string;
  max: number;
  /** 1 段めの値段。n 段めは base × n */
  base: number;
  /** 強さに足すもの。無い品（強欲・リロール・復活）は perks() が別に読む */
  stat?: StatKey;
  /** 1 段ごとの量 */
  per: number;
  /** ITEM_ART の名前 */
  icon: string;
}

export type Ranks = Partial<Record<UpgradeId, number>>;

const u = (
  id: UpgradeId,
  name: string,
  blurb: string,
  max: number,
  base: number,
  stat: StatKey | undefined,
  per: number,
  icon: string
): UpgradeDef => ({ id, name, blurb, max, base, stat, per, icon });

export const UPGRADES: UpgradeDef[] = [
  u('might', '攻撃', '攻撃力 +5%', 5, 90, 'might', 0.05, 'passive-fang'),
  u('maxHp', '最大 HP', '最大 HP +10', 5, 90, 'maxHp', 10, 'passive-heart'),
  u('speed', '速さ', '移動速度 +4%', 5, 90, 'speed', 0.04, 'passive-paws'),
  u('armor', '防御', '受けるダメージ -1', 3, 225, 'armor', 1, 'passive-fur'),
  u('regen', '回復', '毎秒 HP +0.1 回復', 5, 90, 'regen', 0.1, 'passive-leaf'),
  u('magnet', '拾う範囲', 'アイテムを拾う範囲 +10%', 5, 60, 'magnet', 0.1, 'passive-whisker'),
  u('growth', '経験値', '経験値 +5%', 5, 90, 'growth', 0.05, 'passive-nose'),
  u('crit', '会心', '会心率 +2%', 5, 90, 'crit', 0.02, 'passive-claw'),
  u('greed', '強欲', 'コイン +10%', 5, 75, undefined, 0.1, 'upgrade-greed'),
  u('reroll', 'リロール', '3 択の引き直し +1 回', 3, 300, undefined, 1, 'upgrade-reroll'),
  u('revive', '復活', '倒れたとき 1 回だけ HP 半分で起き上がる', 1, 1200, undefined, 1, 'upgrade-revive')
];

export function price(d: UpgradeDef, rank: number): number {
  return d.base * (rank + 1);
}

export interface Perks {
  boost: Partial<Stats>;
  /** コインに掛ける倍率 */
  greed: number;
  rerolls: number;
  revives: number;
}

export function perks(ranks: Ranks): Perks {
  const out: Perks = { boost: {}, greed: 1, rerolls: 0, revives: 0 };
  for (const d of UPGRADES) {
    const n = ranks[d.id] ?? 0;
    if (!n) continue;
    if (d.stat) out.boost[d.stat] = (out.boost[d.stat] ?? 0) + d.per * n;
    else if (d.id === 'greed') out.greed += d.per * n;
    else if (d.id === 'reroll') out.rerolls += n;
    else out.revives += n;
  }
  return out;
}

/** コインが足りて最大の段でなければ買う。買えたら true */
export function buy(r: Records, id: UpgradeId): boolean {
  const d = UPGRADES.find((o) => o.id === id);
  const rank = r.ranks[id] ?? 0;
  if (!d || rank >= d.max || r.coins < price(d, rank)) return false;
  r.coins -= price(d, rank);
  r.ranks[id] = rank + 1;
  return true;
}
