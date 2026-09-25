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
  kuroshiba: {
    id: 'kuroshiba',
    kind: 'dog',
    name: '黒柴',
    note: 'くろい せなかに まゆげの てんてん。しろい むねが チャームポイント',
    names: ['コテツ', 'ゴマ', 'アズキ', 'スミレ', 'ノリ', 'クウ'],
    color: '#3a302c'
  },
  corgi: {
    id: 'corgi',
    kind: 'dog',
    name: 'コーギー',
    note: 'みじかい あしと おおきな みみ。ふわふわの おしりを ふって あるく',
    names: ['ワッフル', 'ポテト', 'ビスケ', 'モカ', 'ラテ', 'テン'],
    color: '#d9843e'
  },
  dachshund: {
    id: 'dachshund',
    kind: 'dog',
    name: 'ミニチュアダックス',
    note: 'ながい どうに みじかい あし。たれた みみの けが さらさら',
    names: ['ショコラ', 'クルミ', 'ナッツ', 'ベリー', 'チャイ', 'レオ'],
    color: '#a95a2a'
  },
  labrador: {
    id: 'labrador',
    kind: 'dog',
    name: 'ラブラドール',
    note: 'クリームいろの がっしりした からだ。だれとでも すぐ なかよし',
    names: ['ハル', 'シロ', 'ダイ', 'バニラ', 'ミルキー', 'ルーク'],
    color: '#e3c48e'
  },
  chihuahua: {
    id: 'chihuahua',
    kind: 'dog',
    name: 'チワワ',
    note: 'ちいさな からだに おおきな みみと まんまるの め',
    names: ['チビ', 'ピコ', 'リボン', 'ココア', 'ミニ', 'ポッキー'],
    color: '#dcae78'
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
  },
  chatora: {
    id: 'chatora',
    kind: 'cat',
    name: '茶トラ',
    note: 'オレンジいろの しましま。ひとなつっこい あまえんぼう',
    names: ['チャチャ', 'ミカン', 'ユズ', 'コハク', 'ムサシ', 'ポン'],
    color: '#e39a4f'
  },
  russian: {
    id: 'russian',
    kind: 'cat',
    name: 'ロシアンブルー',
    note: 'あおみがかった はいいろの けと みどりの め。ひかえめで やさしい',
    names: ['アオ', 'ミント', 'シルバー', 'ネネ', 'ソフィ', 'リン'],
    color: '#8793a0'
  },
  fold: {
    id: 'fold',
    kind: 'cat',
    name: 'スコティッシュフォールド',
    note: 'おれた みみと まんまるの かお。のんびり おっとり',
    names: ['マル', 'モチ', 'ダンゴ', 'フク', 'オハギ', 'ポコ'],
    color: '#9a8466'
  },
  munchkin: {
    id: 'munchkin',
    kind: 'cat',
    name: 'マンチカン',
    note: 'みじかい あしで ちょこちょこ あるく。こうきしんが いっぱい',
    names: ['プチ', 'キャラメル', 'ポポ', 'ミュウ', 'コロ', 'シフォン'],
    color: '#e8d4b8'
  }
};

export const BREED_IDS = Object.keys(BREEDS) as BreedId[];
