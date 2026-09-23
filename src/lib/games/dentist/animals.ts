export type AnimalId = 'rabbit' | 'cat' | 'dog' | 'pig' | 'bear' | 'lion' | 'hippo' | 'frog';
export type ToothShape = 'round' | 'incisor';
export type GermKind = 'normal' | 'quick' | 'boss';
export type Expression = 'calm' | 'nervous' | 'hurt' | 'cry' | 'happy';

export interface Tooth {
  x: number;
  y: number;
  w: number;
  h: number;
  row: 'upper' | 'lower';
  shape: ToothShape;
  numb: boolean;
  gone: boolean;
}

export interface Animal {
  id: AnimalId;
  /** 片側の列の歯の本数 */
  per: number;
  shape: ToothShape;
  mouth: { cx: number; cy: number; rx: number; ry: number };
  fur: string;
  /** 耳の内側・たてがみ・鼻など、動物ごとの差し色 */
  acc: string;
}

/** 顔の中心。口や目の位置は動物ごとの値で決める */
export const FACE = { x: 0.5, y: 0.6 };

/** 顔の絵の 1 単位の大きさ。顔は幅がおよそ 160 単位のおもちの形 */
export const FACE_UNIT = 0.0055;

export const GERM_R: Record<GermKind, number> = { normal: 0.028, quick: 0.026, boss: 0.05 };

/**
 * 口は顔の単位で書く。上下は目と頭の下ふちにはさまれて広げられないので、歯の多い動物ほど横に広げる。
 * 上下の列が重ならない限界は rx / ry がおよそ 3 本 1.09（前歯）、4 本 1.84、5 本 2.22、6 本 2.59
 */
const mouth = (rx: number, ry: number) => ({
  cx: FACE.x,
  cy: FACE.y + 26 * FACE_UNIT,
  rx: rx * FACE_UNIT,
  ry: ry * FACE_UNIT
});

const animal = (id: AnimalId, per: number, m: [number, number], fur: string, acc: string): Animal => ({
  id,
  per,
  shape: id === 'rabbit' ? 'incisor' : 'round',
  mouth: mouth(...m),
  fur,
  acc
});

export const ANIMALS: Record<AnimalId, Animal> = {
  rabbit: animal('rabbit', 3, [31, 30], '#fffdfa', '#ffd3dc'),
  cat: animal('cat', 4, [48, 29], '#fde2b3', '#ffd3dc'),
  dog: animal('dog', 4, [50, 29], '#fff3e0', '#e8c7a3'),
  pig: animal('pig', 5, [52, 28], '#ffd9e0', '#ffb8c6'),
  bear: animal('bear', 5, [54, 29], '#f1cfa8', '#f4b5a3'),
  lion: animal('lion', 5, [54, 29], '#ffe7a8', '#f3b46a'),
  hippo: animal('hippo', 6, [60, 29], '#dcd8f2', '#c7c1ea'),
  frog: animal('frog', 6, [62, 28], '#c6ecb0', '#a6dc8c')
};

/**
 * 口の楕円の上下のふちに沿って歯を並べる。上の列を左から、続けて下の列を左から数える。
 * ふちの外にはみ出す上の部分は、描くときに口の形で切り取って歯ぐきに隠す
 */
export function teethFor(a: Animal): Tooth[] {
  const { cx, cy, rx, ry } = a.mouth;
  const span = rx * 1.56;
  const w = (span / a.per) * 0.94;
  const h = w * (a.shape === 'incisor' ? 1.6 : 1.2);
  const teeth: Tooth[] = [];
  for (const row of ['upper', 'lower'] as const) {
    for (let i = 0; i < a.per; i++) {
      const x = cx - span / 2 + (i + 0.5) * (span / a.per);
      const edge = ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
      const y = row === 'upper' ? cy - edge + h * 0.5 : cy + edge - h * 0.5;
      teeth.push({ x, y, w, h, row, shape: a.shape, numb: false, gone: false });
    }
  }
  return teeth;
}
