import type { IconName } from '$lib/icons';

/** 図の部品。{@html} を使わずに描けるよう、SVG の要素名と属性をそのまま持つ */
export interface Shape {
  el: 'g' | 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'polygon' | 'polyline' | 'text';
  a: Record<string, string | number>;
  /** text の中身 */
  t?: string;
  c?: Shape[];
}

/** viewBox は 0 0 w h。盤面に収まるよう縮めて描く */
export interface Figure {
  w: number;
  h: number;
  s: Shape[];
}

interface Base {
  title: string;
  /** 問題文。分かち書きのひらがなで、こどもが読める長さにする */
  text: string;
  fig?: Figure;
  /** 順に 1 つずつ見せる。3 つめで ほぼ答えが分かるくらいまで近づける */
  hints: [string, string, string];
  /** せいかいのあとに出す、とき方 */
  why: string;
  /**
   * ウミガメのスープのように、はい・いいえで答える質問を用意したナゾ。押すと答えが見える。
   * 何度聞いてもよく、真相に関係のない質問もまぜる
   */
  questions?: Question[];
}

export interface Question {
  q: string;
  a: 'はい' | 'いいえ' | '関係ない';
}

export interface NumberQ {
  kind: 'number';
  answer: number;
  /** 入力した数のあとに付ける「こ」「ばん」など */
  unit: string;
}

/** 図の上の丸い場所を answer.length こ選ぶ */
export interface TapQ {
  kind: 'tap';
  spots: { x: number; y: number; r: number }[];
  /** spots の添え字 */
  answer: number[];
}

export type Slot = { x1: number; y1: number; x2: number; y2: number } | { x: number; y: number };

/** マッチ棒（線の slot）やコイン（点の slot）を、moves 回までうごかす */
export interface SticksQ {
  kind: 'sticks';
  slots: Slot[];
  /** はじめに置いてある slot */
  on: number[];
  moves: number;
  goal: (on: ReadonlySet<number>) => boolean;
}

export interface Crosser {
  id: string;
  name: string;
  icon?: IconName;
  color: string;
  /** ボートに乗れる重さの合計は cap まで。なければ 1 */
  weight?: number;
  /** ボートをこげる。だれにも付いていなければ、みんなこげる */
  rows?: boolean;
  /** 橋をわたるのにかかる分。2 人でわたると遅いほうに合わせる */
  time?: number;
}

/** 川わたり。bridge なら橋とランタンの絵にして、limit 分までにわたりきる */
export interface RiverQ {
  kind: 'river';
  crossers: Crosser[];
  cap: number;
  /** その岸にいるものの組み合わせがだめなら、そのわけ（しっぱいになる）。ボートの中は着いた岸に数える */
  danger?: (bank: ReadonlySet<string>) => string | null;
  limit?: number;
  bridge?: boolean;
}

/** 入れものから入れものへ、どちらかが空か満タンになるまで注ぐ */
export interface PourQ {
  kind: 'pour';
  caps: number[];
  start: number[];
  goal: (amounts: readonly number[]) => boolean;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * ペンを離さずに segments 本の直線を引き、dots をすべて通す。線を曲げられるのは pegs の上だけ。
 * pegs を dots の外まで広げておくと、「枠の外へはみ出す」ひらめきが使える
 */
export interface LinesQ {
  kind: 'lines';
  dots: Point[];
  pegs: Point[];
  segments: number;
}

/** かなのタイルを順に押して言葉で答える。tiles には答えの文字とおとりの文字を混ぜ、1 枚は 1 回だけ使える */
export interface WordQ {
  kind: 'word';
  /** 1 枚に 1 文字。同じ文字が 2 回要るなら 2 枚入れる */
  tiles: string[];
  /** 正解の言葉。言い方が 2 通りあるときだけ複数にする */
  answer: string[];
}

export interface Block {
  /** 左上のます目 */
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  label?: string;
}

/** スライドパズル。ブロックを 1 ますずつ縦横にすべらせ、blocks[target] の左上を goal へ運ぶ */
export interface SlideQ {
  kind: 'slide';
  cols: number;
  rows: number;
  blocks: Block[];
  target: number;
  goal: { x: number; y: number };
}

/**
 * cols × rows の盤のます目に count 個の駒を置く。ます目の番号は y * cols + x。
 * goal を満たす置き方ならどれでも正解（答えが 1 通りでなくてよい）
 */
export interface PlaceQ {
  kind: 'place';
  cols: number;
  rows: number;
  count: number;
  /** 駒を置けないます目 */
  blocked?: number[];
  goal: (cells: ReadonlySet<number>) => boolean;
}

/**
 * 氷の上を滑るナゾ。上下左右のどれかへ押すと、岩か盤の端に当たるまで止まらずに滑る。
 * 滑っている途中で goal のます目に入ったら、そこで抜け出してクリア
 */
export interface IceQ {
  kind: 'ice';
  cols: number;
  rows: number;
  rocks: Point[];
  start: Point;
  goal: Point;
}

/**
 * 同じ色の 2 点を、縦横にます目をたどる線でつなぐ。線どうしは交わらず、ほかの点や blocked も通らない。
 * fill なら、blocked 以外のます目をすべて線で埋める。ます目の番号は y * cols + x
 */
export interface ConnectQ {
  kind: 'connect';
  cols: number;
  rows: number;
  pairs: { a: Point; b: Point; color: string }[];
  blocked?: number[];
  fill?: boolean;
}

/**
 * ます目を parts 個の組に分ける。どの組もつながっていて、同じ形（回転・裏返しは同じとみなす）。
 * marks があれば、どの組にもちょうど 1 つずつ入る。example は正解の分け方の 1 つ（テストが確かめる）
 */
export interface DivideQ {
  kind: 'divide';
  cols: number;
  rows: number;
  parts: number;
  blocked?: number[];
  marks?: number[];
  example: number[];
}

/** 回転タイルの形。開いている辺は turn が 0 のときのもので、上・右・下・左の順 */
export type TileShape = 'empty' | 'end' | 'straight' | 'corner' | 'tee' | 'cross' | 'mirror';

/**
 * タイルを押すと時計回りに 90 度ずつ回る。水（パイプ）や光（鏡）を source から target へ届ける。
 * mirror は turn が偶数で「/」、奇数で「\」。fixed のタイルは回らない。ます目の番号は y * cols + x
 */
export interface RotateQ {
  kind: 'rotate';
  cols: number;
  rows: number;
  tiles: { shape: TileShape; turn: number; fixed?: boolean }[];
  /** 水か光が出てくるところ。盤の外（x か y が -1 や cols / rows）に置き、dir（0 上・1 右・2 下・3 左）へ向かって盤に入る */
  source: { x: number; y: number; dir: 0 | 1 | 2 | 3 };
  /** 届けたいます目。水ならそのます目にパイプがつながり、光ならそのます目を通れば正解 */
  target: number;
  mode: 'pipe' | 'light';
  /** 正解の向きの 1 つ（テストが確かめる） */
  example: number[];
}

/**
 * fig の上の cells に numbers の数を 1 つずつ入れる（given のます目は最初から決まっている）。
 * goal を満たせば正解。答えは cells の順の数の並び（空きは -1）
 */
export interface FillQ {
  kind: 'fill';
  cells: (Point & { given?: number })[];
  numbers: number[];
  goal: (values: readonly number[]) => boolean;
}

export type Puzzle = Base &
  (
    | NumberQ
    | TapQ
    | SticksQ
    | RiverQ
    | PourQ
    | LinesQ
    | WordQ
    | SlideQ
    | PlaceQ
    | IceQ
    | ConnectQ
    | DivideQ
    | RotateQ
    | FillQ
  );
