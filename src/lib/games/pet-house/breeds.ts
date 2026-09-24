import type { BreedId, Kind } from './types';

/** 種類の表。一覧の画面でも使うので three は読まない */
export interface Breed {
  id: BreedId;
  kind: Kind;
  name: string;
  note: string;
  names: string[];
  color: string;
}

export const BREEDS: Record<BreedId, Breed> = {
  shiba: {
    id: 'shiba',
    kind: 'dog',
    name: '柴犬',
    note: 'くるんと まいた しっぽが じまんの げんきもの',
    names: ['ポチ', 'コタロウ', 'モモ', 'ハチ', 'ココ', 'マメ'],
    color: '#d9773a'
  },
  beagle: {
    id: 'beagle',
    kind: 'dog',
    name: 'ビーグル',
    note: 'たれた みみと 3しょくの けなみ。においを かぐのが だいすき',
    names: ['チョコ', 'ラッキー', 'ソラ', 'マロン', 'ルル', 'ジョン'],
    color: '#b8743a'
  },
  poodle: {
    id: 'poodle',
    kind: 'dog',
    name: 'トイプードル',
    note: 'くるくる ふわふわの けが かわいい あまえんぼう',
    names: ['モコ', 'プリン', 'ミルク', 'ムギ', 'クッキー', 'ティアラ'],
    color: '#e9c48f'
  },
  mike: {
    id: 'mike',
    kind: 'cat',
    name: '三毛猫',
    note: 'しろ・ちゃ・くろの ぶちもよう。ちょっぴり きまぐれ',
    names: ['ミケ', 'タマ', 'ハナ', 'キナコ', 'ミィ', 'サクラ'],
    color: '#e08a3c'
  },
  kuro: {
    id: 'kuro',
    kind: 'cat',
    name: '黒猫',
    note: 'まっくろな けと きんいろの め。しずかで あまえじょうず',
    names: ['クロ', 'ヨル', 'ノワール', 'ジジ', 'スミ', 'ルナ'],
    color: '#3a3542'
  },
  saba: {
    id: 'saba',
    kind: 'cat',
    name: 'サバトラ',
    note: 'はいいろの しましま。あそぶのが だいすきな やんちゃもの',
    names: ['サバ', 'グレイ', 'シマ', 'ギン', 'ネズ', 'トラ'],
    color: '#8d949b'
  }
};

export const BREED_IDS: BreedId[] = ['shiba', 'beagle', 'poodle', 'mike', 'kuro', 'saba'];
