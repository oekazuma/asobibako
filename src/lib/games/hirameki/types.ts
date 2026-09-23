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

export type Puzzle = Base & (NumberQ | TapQ | SticksQ | RiverQ | PourQ | LinesQ | WordQ | SlideQ | PlaceQ | IceQ);
