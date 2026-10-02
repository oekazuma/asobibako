import type { Stats } from './passives';

export type AnimalId = 'dog' | 'cat' | 'wolf' | 'fox' | 'bear' | 'rabbit' | 'panda';

export interface Animal {
  id: AnimalId;
  name: string;
  /** キャラ選択に出す型の名前 */
  style: string;
  blurb: string;
  hp: number;
  /** 基本の速さ（60 px/秒）に掛ける */
  speed: number;
  /** 武器のダメージに掛ける */
  might: number;
  weapon: string;
  /** 特別な強み。stats() の基本値に足す */
  bonus?: Partial<Stats>;
  /** 特別な強みの文（キャラ選択の「とくい」） */
  perk?: string;
  /** 解放の条件の文。最初から選べる動物には無い */
  unlock?: string;
}

export const ANIMALS: Animal[] = [
  {
    id: 'dog',
    name: '犬',
    style: 'バランス型',
    blurb: 'なんでもこなす相棒。骨を投げて戦う',
    hp: 100,
    speed: 1,
    might: 1,
    weapon: 'woof'
  },
  {
    id: 'cat',
    name: '猫',
    style: 'スピード型',
    blurb: '足が速いが打たれ弱い。すばやい爪で引っかく',
    hp: 90,
    speed: 1.25,
    might: 0.9,
    weapon: 'paw'
  },
  {
    id: 'wolf',
    name: '狼',
    style: 'パワー型',
    blurb: '力強くタフ。遠吠えで周りをまとめて吹き飛ばす',
    hp: 110,
    speed: 1,
    might: 1.2,
    weapon: 'howl'
  },
  {
    id: 'fox',
    name: 'キツネ',
    style: 'テクニック型',
    blurb: '狐火を足もとに残し、会心の一撃をねらう',
    hp: 85,
    speed: 1.15,
    might: 1,
    weapon: 'flame',
    bonus: { crit: 0.1 },
    perk: '会心率 +10%',
    unlock: '5 分生き延びると仲間になる'
  },
  {
    id: 'bear',
    name: 'クマ',
    style: 'タンク型',
    blurb: '遅いが打たれ強い。大きな爪でなぎ払う',
    hp: 150,
    speed: 0.85,
    might: 1.15,
    weapon: 'claw',
    bonus: { armor: 2 },
    perk: '受けるダメージ -2',
    unlock: '巨大ベアを倒すと仲間になる'
  },
  {
    id: 'rabbit',
    name: 'ウサギ',
    style: '逃げ足型',
    blurb: 'とても速いが打たれ弱い。駆け抜けて吹き飛ばす',
    hp: 75,
    speed: 1.35,
    might: 0.85,
    weapon: 'dash',
    bonus: { magnet: 0.5 },
    perk: 'アイテムを拾う範囲 +50%',
    unlock: 'これまでに合計 3000 体倒すと仲間になる'
  },
  {
    id: 'panda',
    name: 'パンダ',
    style: '回復型',
    blurb: 'ゆっくりだがしぶとい。ツタで敵を足止めする',
    hp: 130,
    speed: 0.9,
    might: 1,
    weapon: 'vine',
    bonus: { regen: 0.5 },
    perk: '毎秒 HP +0.5 回復',
    unlock: '15 分生き延びてクリアすると仲間になる'
  }
];

export function animal(id: AnimalId): Animal {
  return ANIMALS.find((a) => a.id === id)!;
}
