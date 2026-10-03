import type { Stats } from './passives';

export type AnimalId = 'dog' | 'cat' | 'wolf' | 'fox' | 'bear' | 'rabbit' | 'panda' | 'tiger' | 'drake';

export interface Animal {
  id: AnimalId;
  name: string;
  /** キャラ選択に出す型の名前 */
  style: string;
  /** 強さの段。1 基本・2 中・3 強・4 最強。段が上ほど解放が重く、強い */
  tier: 1 | 2 | 3 | 4;
  blurb: string;
  hp: number;
  /** 基本の速さ（60 px/秒）に掛ける */
  speed: number;
  /** 武器のダメージに掛ける */
  might: number;
  weapon: string;
  /** 専用進化形の武器 id（3 段階めに育ち、最初の武器が Lv5 になると入れ替わる） */
  special: string;
  /** 特別な強み。stats() の基本値に足す */
  bonus?: Partial<Stats>;
  /** 特別な強みの文（キャラ選択の「とくい」） */
  perk?: string;
  /** 育つ 3 段階の名前 */
  forms: [string, string, string];
  /** 解放の条件の文。最初から選べる動物には無い */
  unlock?: string;
}

export const ANIMALS: Animal[] = [
  {
    id: 'dog',
    forms: ['子犬', 'わんぱく犬', '勇者の犬'],
    name: '犬',
    style: 'バランス型',
    blurb: 'なんでもこなす相棒。骨を投げて戦う',
    hp: 100,
    speed: 1,
    might: 1,
    weapon: 'woof',
    special: 'woofSp',
    tier: 1
  },
  {
    id: 'cat',
    forms: ['子猫', '忍び猫', 'ねこまた'],
    name: '猫',
    style: 'スピード型',
    blurb: '足が速いが打たれ弱い。すばやい爪で引っかく',
    hp: 90,
    speed: 1.25,
    might: 0.9,
    weapon: 'paw',
    special: 'pawSp',
    tier: 1
  },
  {
    id: 'wolf',
    forms: ['子狼', '銀狼', '月の大狼'],
    name: '狼',
    style: 'パワー型',
    blurb: '力強くタフ。遠吠えで周りをまとめて吹き飛ばす',
    hp: 110,
    speed: 1,
    might: 1.2,
    weapon: 'howl',
    special: 'howlSp',
    tier: 1
  },
  {
    id: 'fox',
    forms: ['子ギツネ', '三尾の狐', '九尾の狐'],
    name: 'キツネ',
    style: 'テクニック型',
    blurb: '狐火を足もとに残し、会心の一撃をねらう',
    hp: 90,
    speed: 1.15,
    might: 1.05,
    weapon: 'flame',
    special: 'flameSp',
    bonus: { crit: 0.1 },
    perk: '会心率 +10%',
    unlock: '森をクリアすると仲間になる',
    tier: 2
  },
  {
    id: 'bear',
    forms: ['子グマ', '金太郎グマ', '横綱グマ'],
    name: 'クマ',
    style: 'タンク型',
    blurb: '遅いが打たれ強い。大きな爪でなぎ払う',
    hp: 155,
    speed: 0.85,
    might: 1.2,
    weapon: 'claw',
    special: 'clawSp',
    bonus: { armor: 2 },
    perk: '受けるダメージ -2',
    unlock: '森の主を倒すと仲間になる',
    tier: 2
  },
  {
    id: 'rabbit',
    forms: ['子ウサギ', '跳び兎', '月の兎'],
    name: 'ウサギ',
    style: '逃げ足型',
    blurb: 'とても速いが打たれ弱い。駆け抜けて吹き飛ばす',
    hp: 80,
    speed: 1.35,
    might: 0.9,
    weapon: 'dash',
    special: 'dashSp',
    bonus: { magnet: 0.5 },
    perk: 'アイテムを拾う範囲 +50%',
    unlock: 'これまでに合計 20000 体倒すと仲間になる',
    tier: 2
  },
  {
    id: 'panda',
    forms: ['子パンダ', '拳法パンダ', '達人パンダ'],
    name: 'パンダ',
    style: '回復型',
    blurb: 'ゆっくりだがしぶとい。ツタで敵を足止めする',
    hp: 150,
    speed: 0.9,
    might: 1.15,
    weapon: 'vine',
    special: 'vineSp',
    bonus: { regen: 1 },
    perk: '毎秒 HP +1 回復',
    unlock: '夜の墓地をクリアすると仲間になる',
    tier: 3
  },
  {
    id: 'tiger',
    forms: ['子トラ', '白虎', '雷虎'],
    name: 'トラ',
    style: '強打型',
    tier: 3,
    blurb: '速くて一撃が重い。前と後ろを大きく引き裂く',
    hp: 135,
    speed: 1.2,
    might: 1.35,
    weapon: 'tigerClaw',
    special: 'tigerClawSp',
    bonus: { crit: 0.1 },
    perk: '会心率 +10%',
    unlock: '雪山の大雪男を倒すと仲間になる'
  },
  {
    id: 'drake',
    forms: ['竜の子', '若竜', '竜王'],
    name: '竜の子',
    style: '最強',
    tier: 4,
    blurb: '炎の息で前の敵をまとめて焼く。育つと翼が生える',
    hp: 140,
    speed: 1.1,
    might: 1.35,
    weapon: 'breath',
    special: 'breathSp',
    bonus: { armor: 1, regen: 0.3 },
    perk: '受けるダメージ -1・毎秒 HP +0.3',
    unlock: '雪山をクリアすると仲間になる'
  }
];

export function animal(id: AnimalId): Animal {
  return ANIMALS.find((a) => a.id === id)!;
}
