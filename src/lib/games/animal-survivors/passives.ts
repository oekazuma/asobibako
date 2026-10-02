import { MAX_LEVEL } from './weapons';
import type { Animal } from './animals';

export type StatKey =
  | 'maxHp'
  | 'might'
  | 'haste'
  | 'speed'
  | 'armor'
  | 'growth'
  | 'area'
  | 'crit'
  | 'regen'
  | 'magnet'
  | 'amount'
  | 'duration'
  | 'luck';
export type Stats = Record<StatKey, number>;

export interface PassiveDef {
  id: string;
  name: string;
  blurb: string;
  stat: StatKey;
  /** 1 Lv ごとに stat へ足す量 */
  per: number;
  /** 最大の Lv。無ければ MAX_LEVEL */
  max?: number;
}

const p = (id: string, name: string, blurb: string, stat: StatKey, per: number, max?: number): PassiveDef => ({
  id,
  name,
  blurb,
  stat,
  per,
  ...(max && { max })
});

export const PASSIVES: Record<string, PassiveDef> = Object.fromEntries(
  [
    p('heart', '大きな心臓', '最大 HP +20', 'maxHp', 20),
    p('fang', 'するどい牙', '攻撃力 +10%', 'might', 0.1),
    p('drum', 'はやい鼓動', '攻撃の待ち時間 -8%', 'haste', 0.08),
    p('paws', 'かるい足', '移動速度 +10%', 'speed', 0.1),
    p('fur', 'ぶあつい毛皮', '受けるダメージ -1', 'armor', 1),
    p('nose', '鼻ききの勘', '経験値 +10%', 'growth', 0.1),
    p('roar', '大きな声', '攻撃範囲 +10%', 'area', 0.1),
    p('claw', '野生の勘', '会心率 +5%（会心は 2 倍）', 'crit', 0.05),
    p('leaf', '薬草', '毎秒 HP +0.3 回復', 'regen', 0.3),
    p('whisker', 'ひげアンテナ', 'アイテムを拾う範囲 +25%', 'magnet', 0.25),
    // 弾の数は 1 つ増えるだけで強いので、本家と同じく 2 段まで
    p('twin', 'ふたごの毛玉', '武器の弾・攻撃の数 +1', 'amount', 1, 2),
    p('tail', 'ながいしっぽ', '炎・ツタ・羽根などの効く時間 +10%', 'duration', 0.1),
    p('clover', '四つ葉', '運 +20%（4 択になりやすく、コインが落ちやすい）', 'luck', 0.2)
  ].map((d) => [d.id, d])
);

/** 育った段階ごとに足す強さ */
export const GROW_MIGHT = 0.1;
export const GROW_HP = 20;

export function stats(
  a: Animal,
  passives: { id: string; level: number }[],
  boost: Partial<Stats> = {},
  form = 0
): Stats {
  const s: Stats = {
    maxHp: a.hp,
    might: a.might,
    haste: 0,
    speed: a.speed,
    armor: 0,
    growth: 1,
    area: 1,
    crit: 0.05,
    regen: 0,
    magnet: 1,
    amount: 0,
    duration: 1,
    luck: 0
  };
  for (const [k, v] of Object.entries(boost) as [StatKey, number][]) s[k] += v;
  for (const [k, v] of Object.entries(a.bonus ?? {}) as [StatKey, number][]) s[k] += v;
  for (const { id, level } of passives) s[PASSIVES[id].stat] += PASSIVES[id].per * level;
  s.might += GROW_MIGHT * form;
  s.maxHp += GROW_HP * form;
  return s;
}

export const maxOf = (id: string): number => PASSIVES[id]?.max ?? MAX_LEVEL;
