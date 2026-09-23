import type { Puzzle } from '../types';
import set1 from './set1';
import set2 from './set2';
import set3 from './set3';
import set4 from './set4';
import set5 from './set5';
import words from './words';
import classicsLogic from './classics-logic';
import classicsMath from './classics-math';
import classicsTrick from './classics-trick';
import stories from './stories';

/** ナゾのジャンル。似たナゾが続かないよう、並びを決めるのに使う */
export type Genre =
  | 'trap'
  | 'look'
  | 'word'
  | 'match'
  | 'logic'
  | 'river'
  | 'count'
  | 'stroke'
  | 'plan'
  | 'slide'
  | 'space'
  | 'pour'
  | 'pattern'
  | 'place'
  | 'time'
  | 'ice'
  | 'story';

/**
 * 遊ぶ順。難しさの順にはせず、同じジャンルが隣り合わないように並べる（テストが確かめる）。
 * ナゾを足すときは、題と一緒にここへ差しこむ
 */
export const ORDER: [title: string, genre: Genre][] = [
  ['グラスのさくらんぼ', 'match'],
  ['重なった色紙', 'look'],
  ['頭痛の種', 'word'],
  ['抜きつ抜かれつ', 'trap'],
  ['花子のきょうだい', 'logic'],
  ['燃えさしのろうそく', 'trap'],
  ['敬礼する車', 'story'],
  ['マッチ棒の計算', 'match'],
  ['浮いたロープ', 'space'],
  ['イヌも乗せる川渡り', 'river'],
  ['正方形はいくつ？', 'count'],
  ['列車とトンネル', 'trap'],
  ['明るい挨拶', 'word'],
  ['交互のグラス', 'look'],
  ['9つの点', 'stroke'],
  ['ホットケーキ', 'plan'],
  ['正方形を3つに', 'match'],
  ['一筆書き', 'stroke'],
  ['凍った湖', 'ice'],
  ['草原の手紙', 'story'],
  ['カナの誕生日', 'logic'],
  ['鎖のネックレス', 'plan'],
  ['食堂の張り紙', 'word'],
  ['5人の証言', 'logic'],
  ['暗闇の引き出し', 'plan'],
  ['カタツムリの壁', 'trap'],
  ['5つの歯車', 'look'],
  ['誕生日の謎', 'logic'],
  ['コインの花', 'match'],
  ['トマト祭り', 'pattern'],
  ['柿の木のセミ', 'look'],
  ['骨董屋の値札', 'word'],
  ['地下からの階段', 'trap'],
  ['満ち潮とはしご', 'look'],
  ['白紙の便り', 'story'],
  ['引っ越しのピアノ', 'slide'],
  ['親子の川渡り', 'river'],
  ['拾った新聞', 'look'],
  ['4つの顔', 'word'],
  ['★の裏側', 'space'],
  ['柱のある床', 'count'],
  ['10リットルを二等分', 'pour'],
  ['駐車場の番号', 'look'],
  ['積まれたさいころ', 'space'],
  ['決まりを確かめる', 'logic'],
  ['4桁の暗号', 'pattern'],
  ['自分を語る文', 'word'],
  ['6組の夫婦', 'logic'],
  ['ミツバチの往復', 'trap'],
  ['なおしといて', 'story'],
  ['25個の卵', 'plan'],
  ['3人の見張り', 'place'],
  ['ハンデつき徒競走', 'trap'],
  ['等式の並び', 'pattern'],
  ['しりとりの輪', 'word'],
  ['23頭のウシ', 'trap'],
  ['番地と年齢', 'logic'],
  ['日付のない日記', 'time'],
  ['夜の吊り橋', 'river'],
  ['床の上の立方体', 'space'],
  ['反対を向く針', 'time'],
  ['奇妙な足し算', 'pattern'],
  ['舞台の端の人', 'story'],
  ['本の虫', 'space'],
  ['うそつきは2人', 'logic'],
  ['言葉の暗号表', 'word'],
  ['倉庫のクモ', 'space'],
  ['ジュースと水', 'trap'],
  ['10本の苗木', 'place'],
  ['帽子の列', 'logic'],
  ['オオカミとヒツジ', 'river'],
  ['回るコイン', 'space'],
  ['箱入りの姫', 'slide'],
  ['果物屋の張り紙', 'word'],
  ['ニセ金貨の袋', 'plan'],
  ['不思議な数の列', 'pattern'],
  ['左端の常連', 'story'],
  ['消えた300円', 'trap'],
  ['マッチの正三角形', 'space'],
  ['祖父のメモ', 'word'],
  ['近くて遠い出口', 'ice']
];

export const ALL_PUZZLES: Puzzle[] = [
  ...set1,
  ...set2,
  ...set3,
  ...set4,
  ...set5,
  ...words,
  ...classicsLogic,
  ...classicsMath,
  ...classicsTrick,
  ...stories
];

export const PUZZLES: Puzzle[] = ORDER.map(([title]) => {
  const p = ALL_PUZZLES.find((q) => q.title === title);
  if (!p) throw new Error(`ORDER にあるナゾが見つからない: ${title}`);
  return p;
});
