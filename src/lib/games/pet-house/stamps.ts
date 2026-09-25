import { contestOf } from './contest';
import { ROOM_PARTS, ROOM_THEMES, hasDecor } from './decor';
import { CONTEST_IDS, CONTEST_RANKS, TRICKS, hearts, kindOf, type Save } from './engine';
import type { IconName } from '$lib/icons';
import type { ContestId } from './types';

/**
 * スタンプ帳（実績）。DOM も three も使わない。
 * 条件は save から数え直す（ハート・芸・コンテスト・持ちもの）か、save.counters の回数を見る。
 * 並びはやさしい順で、「つぎの おすすめ」は同じ進み具合なら先のものを選ぶ
 */

export interface Stamp {
  id: string;
  name: string;
  /** 条件の説明 */
  note: string;
  icon: IconName;
  color: string;
  need: number;
  have: (save: Save) => number;
  /** 押したときにもらえるコイン */
  reward?: number;
}

const PINK = '#ff8fb8';
const ORANGE = '#ffb057';
const GREEN = '#7ccf6b';
const BLUE = '#6bb8ff';
const GOLD = '#ffc233';
const PURPLE = '#b58cff';

const max = (list: number[]) => list.reduce((m, v) => Math.max(m, v), 0);
const learned = (save: Save) => save.pets.map((p) => TRICKS.filter((t) => (p.tricks[t.id] ?? 0) >= t.steps).length);
const wins = (save: Save) => CONTEST_IDS.filter((c) => save.contest[c] > 0).length;
const champs = (save: Save) => CONTEST_IDS.filter((c) => save.contest[c] >= CONTEST_RANKS).length;
const themes = (save: Save) =>
  ROOM_THEMES.filter((t) => t !== 'natural').map((t) => ROOM_PARTS.filter((p) => hasDecor(save.decor, p, t)).length);

const counter =
  (key: keyof Save['counters']) =>
  (save: Save): number =>
    save.counters[key];

const champion = (id: ContestId): Stamp => ({
  id: `champ-${id}`,
  name: `${contestOf(id).name}の チャンピオン`,
  note: `${contestOf(id).name}の チャンピオンクラスで 1いに なる`,
  icon: 'trophy',
  color: GOLD,
  need: CONTEST_RANKS,
  have: (s) => s.contest[id],
  reward: 2000
});

export const STAMPS: Stamp[] = [
  {
    id: 'stroke1',
    name: 'はじめての なでなで',
    note: 'ゆびで なでて あげよう',
    icon: 'heart',
    color: PINK,
    need: 1,
    have: counter('stroke')
  },
  {
    id: 'meal1',
    name: 'はじめての ごはん',
    note: 'ごはんを たべさせて あげよう',
    icon: 'bowl',
    color: ORANGE,
    need: 1,
    have: counter('meal')
  },
  {
    id: 'photo1',
    name: 'はじめての しゃしん',
    note: 'カメラで しゃしんを とろう',
    icon: 'camera',
    color: BLUE,
    need: 1,
    have: counter('photo')
  },
  {
    id: 'walk1',
    name: 'はじめての おさんぽ',
    note: 'こうえんへ いこう',
    icon: 'paw',
    color: GREEN,
    need: 1,
    have: counter('walk')
  },
  {
    id: 'bath1',
    name: 'はじめての おふろ',
    note: 'おふろに いれて あげよう',
    icon: 'drop',
    color: ORANGE,
    need: 1,
    have: counter('bath'),
    reward: 100
  },
  {
    id: 'found1',
    name: 'たからもの はっけん',
    note: 'こうえんや みちで プレゼントを みつけよう',
    icon: 'gift',
    color: GREEN,
    need: 1,
    have: counter('found')
  },
  {
    id: 'dress',
    name: 'おしゃれ デビュー',
    note: 'アクセサリーを つけて あげよう',
    icon: 'ribbon',
    color: PURPLE,
    need: 1,
    have: (s) => s.pets.filter((p) => p.accessory).length
  },
  {
    id: 'heart1',
    name: 'なかよしの しるし',
    note: 'ハートを 1つ ためよう',
    icon: 'heart',
    color: PINK,
    need: 1,
    have: (s) => max(s.pets.map(hearts))
  },
  {
    id: 'trick1',
    name: 'はじめての げい',
    note: 'げいを 1つ おぼえよう',
    icon: 'star',
    color: BLUE,
    need: 1,
    have: (s) => max(learned(s)),
    reward: 200
  },
  {
    id: 'nap',
    name: 'ソファで おひるね',
    note: 'ソファの うえで ねむる',
    icon: 'moon',
    color: PURPLE,
    need: 1,
    have: counter('nap')
  },
  {
    id: 'voice1',
    name: 'はじめての こえ',
    note: 'マイクを おして こえで おねがい しよう',
    icon: 'speaker',
    color: BLUE,
    need: 1,
    have: counter('voice')
  },
  {
    id: 'voiceSleep',
    name: 'こえで ねんね',
    note: '「ねんね」って いって ねかせて あげよう',
    icon: 'moon',
    color: PURPLE,
    need: 1,
    have: counter('voiceSleep')
  },
  {
    id: 'fetch20',
    name: 'もってこい！',
    note: 'なげた おもちゃを 20かい もってくる',
    icon: 'ball',
    color: GREEN,
    need: 20,
    have: counter('fetch'),
    reward: 300
  },
  {
    id: 'win1',
    name: 'はじめての 1い',
    note: 'コンテストで 1いに なる',
    icon: 'trophy',
    color: GOLD,
    need: 1,
    have: wins,
    reward: 300
  },
  {
    id: 'pets2',
    name: 'なかまが ふえた',
    note: '2ひきで いっしょに くらす',
    icon: 'dog-happy',
    color: PURPLE,
    need: 2,
    have: (s) => s.pets.length
  },
  {
    id: 'heart3',
    name: 'ハート みっつ',
    note: 'ハートを 3つ ためよう',
    icon: 'heart',
    color: PINK,
    need: 3,
    have: (s) => max(s.pets.map(hearts)),
    reward: 500
  },
  {
    id: 'days7',
    name: '1しゅうかん なかよし',
    note: '7にち あそぶ（つづけて じゃなくても いいよ）',
    icon: 'star',
    color: ORANGE,
    need: 7,
    have: counter('days'),
    reward: 700
  },
  {
    id: 'bath10',
    name: 'おふろ だいすき',
    note: 'おふろに 10かい はいる',
    icon: 'drop',
    color: ORANGE,
    need: 10,
    have: counter('bath'),
    reward: 500
  },
  {
    id: 'greet10',
    name: 'おともだち いっぱい',
    note: 'おさんぽで ほかの いぬと 10かい あいさつ',
    icon: 'dog',
    color: GREEN,
    need: 10,
    have: counter('greet'),
    reward: 500
  },
  {
    id: 'poop10',
    name: 'おそうじ じょうず',
    note: 'おさんぽで うんちを 10かい ひろう',
    icon: 'bag',
    color: GREEN,
    need: 10,
    have: counter('poop'),
    reward: 500
  },
  {
    id: 'leap50',
    name: 'ぴょんぴょん',
    note: 'ねこじゃらしに 50かい とびつく',
    icon: 'wand',
    color: PINK,
    need: 50,
    have: counter('leap'),
    reward: 500
  },
  {
    id: 'both',
    name: 'いぬも ねこも',
    note: 'いぬと ねこを どちらも かう',
    icon: 'cat-happy',
    color: PURPLE,
    need: 2,
    have: (s) => new Set(s.pets.map((p) => kindOf(p.breed))).size,
    reward: 500
  },
  {
    id: 'meal50',
    name: 'もりもり たべたね',
    note: 'ごはんを 50かい たべる',
    icon: 'meat',
    color: ORANGE,
    need: 50,
    have: counter('meal'),
    reward: 500
  },
  {
    id: 'photo30',
    name: 'カメラマン',
    note: 'しゃしんを 30まい とる',
    icon: 'camera',
    color: BLUE,
    need: 30,
    have: counter('photo'),
    reward: 500
  },
  {
    id: 'found30',
    name: 'たからさがし めいじん',
    note: 'プレゼントを 30こ みつける',
    icon: 'gift',
    color: GREEN,
    need: 30,
    have: counter('found'),
    reward: 800
  },
  {
    id: 'walk30',
    name: 'おさんぽ マスター',
    note: 'こうえんへ 30かい いく',
    icon: 'paw',
    color: GREEN,
    need: 30,
    have: counter('walk'),
    reward: 800
  },
  {
    id: 'stroke200',
    name: 'なでなで めいじん',
    note: '200かい なでる',
    icon: 'heart',
    color: PINK,
    need: 200,
    have: counter('stroke'),
    reward: 800
  },
  {
    id: 'napTogether',
    name: 'なかよく おひるね',
    note: '2ひきが おなじ ところで いっしょに ねむる',
    icon: 'moon',
    color: PURPLE,
    need: 1,
    have: counter('napTogether'),
    reward: 800
  },
  {
    id: 'pets3',
    name: 'にぎやかな おうち',
    note: '3びきで いっしょに くらす',
    icon: 'house',
    color: PURPLE,
    need: 3,
    have: (s) => s.pets.length,
    reward: 1000
  },
  {
    id: 'trick5',
    name: 'げい 5つ',
    note: '1ぴきが げいを 5つ おぼえる',
    icon: 'star',
    color: BLUE,
    need: 5,
    have: (s) => max(learned(s)),
    reward: 500
  },
  {
    id: 'trickAll',
    name: 'げいの めいじん',
    note: '1ぴきが げいを ぜんぶ おぼえる',
    icon: 'star',
    color: BLUE,
    need: TRICKS.length,
    have: (s) => max(learned(s)),
    reward: 1000
  },
  {
    id: 'win4',
    name: 'オールラウンダー',
    note: '4つの しゅもく ぜんぶで 1いに なる',
    icon: 'trophy',
    color: GOLD,
    need: 4,
    have: wins,
    reward: 1000
  },
  {
    id: 'accAll',
    name: 'おしゃれ めいじん',
    note: 'アクセサリーを ぜんぶ そろえる',
    icon: 'hat',
    color: PURPLE,
    need: 5,
    have: (s) => s.accessories.length,
    reward: 1000
  },
  {
    id: 'heart5',
    name: 'だいの なかよし',
    note: 'ハートを 5つ ためよう',
    icon: 'heart',
    color: PINK,
    need: 5,
    have: (s) => max(s.pets.map(hearts)),
    reward: 2000
  },
  {
    id: 'theme1',
    name: 'テーマ コンプリート',
    note: '1つの テーマの へやを ぜんぶ そろえる',
    icon: 'castle',
    color: PURPLE,
    need: ROOM_PARTS.length,
    have: (s) => max(themes(s)),
    reward: 1000
  },
  {
    id: 'days30',
    name: 'ずっと いっしょ',
    note: '30にち あそぶ（つづけて じゃなくても いいよ）',
    icon: 'star',
    color: ORANGE,
    need: 30,
    have: counter('days'),
    reward: 3000
  },
  ...CONTEST_IDS.map(champion),
  {
    id: 'champAll',
    name: 'でんせつの チャンピオン',
    note: 'ぜんぶの しゅもくで チャンピオンに なる',
    icon: 'trophy',
    color: GOLD,
    need: 4,
    have: champs,
    reward: 5000
  },
  {
    id: 'themeAll',
    name: 'おへや コレクター',
    note: 'ぜんぶの テーマの へやを そろえる',
    icon: 'castle',
    color: PURPLE,
    need: 4,
    have: (s) => themes(s).filter((n) => n === ROOM_PARTS.length).length,
    reward: 5000
  }
];

export const progress = (save: Save, s: Stamp): number => Math.min(1, s.have(save) / s.need);

/** 条件を満たしたのにまだ押していないスタンプを押し、ごほうびを足す。押したものを返す（2 度目からは空） */
export function check(save: Save): Stamp[] {
  const got = STAMPS.filter((s) => !save.stamps.includes(s.id) && s.have(save) >= s.need);
  for (const s of got) {
    save.stamps.push(s.id);
    save.money += s.reward ?? 0;
  }
  return got;
}

/** まだのうち、score がいちばん高いもの。同じなら先（やさしい）もの */
function best(save: Save, score: (s: Stamp) => number): Stamp | undefined {
  let top: Stamp | undefined;
  let high = -Infinity;
  for (const s of STAMPS) {
    if (save.stamps.includes(s.id)) continue;
    const v = score(s);
    if (v > high) [top, high] = [s, v];
  }
  return top;
}

/** つぎの おすすめ。1 回で押せるはじめてのものは、半分まで進んだものと同じくらいに勧める */
export const suggest = (save: Save) => best(save, (s) => progress(save, s) + (s.need === 1 ? 0.5 : 0));

/** ヒントで知らせる、あと少しのスタンプ。1 回で押せるものは「あと少し」にならないので数えない */
export function nearly(save: Save): Stamp | undefined {
  const s = best(save, (s) => (s.need > 1 ? progress(save, s) : -1));
  return s && s.need > 1 && progress(save, s) >= 0.7 ? s : undefined;
}
