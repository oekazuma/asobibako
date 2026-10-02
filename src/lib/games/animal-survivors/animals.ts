export type AnimalId = 'dog' | 'cat' | 'wolf';

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
    hp: 70,
    speed: 1.25,
    might: 0.9,
    weapon: 'paw'
  },
  {
    id: 'wolf',
    name: '狼',
    style: 'パワー型',
    blurb: '力強くタフ。遠吠えで周りをまとめて吹き飛ばす',
    hp: 120,
    speed: 1,
    might: 1.3,
    weapon: 'howl'
  }
];

export function animal(id: AnimalId): Animal {
  return ANIMALS.find((a) => a.id === id)!;
}
