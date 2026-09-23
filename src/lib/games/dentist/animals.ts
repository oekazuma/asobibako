export type AnimalId = 'rabbit' | 'cat' | 'dog' | 'pig' | 'bear' | 'lion' | 'hippo' | 'croc';
export type ToothShape = 'round' | 'incisor' | 'fang';
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
  head: { rx: number; ry: number };
  eyeY: number;
  fur: string;
  shade: string;
  muzzle: string;
  inner: string;
  ears: 'round' | 'long' | 'triangle' | 'floppy' | 'small' | 'bumps';
  extra: 'none' | 'whiskers' | 'snout' | 'mane' | 'nostrils';
}

/** 顔の中心。口や目の位置は動物ごとの値で決める */
export const FACE = { x: 0.5, y: 0.6 };

export const GERM_R: Record<GermKind, number> = { normal: 0.028, quick: 0.026, boss: 0.05 };

const mouth = (rx: number, ry: number, cy = 0.74) => ({ cx: 0.5, cy, rx, ry });

export const ANIMALS: Record<AnimalId, Animal> = {
  rabbit: {
    id: 'rabbit',
    per: 4,
    shape: 'incisor',
    mouth: mouth(0.24, 0.19),
    head: { rx: 0.4, ry: 0.44 },
    eyeY: 0.42,
    fur: '#f4efe6',
    shade: '#d9cfc0',
    muzzle: '#fffaf2',
    inner: '#f7b8c4',
    ears: 'long',
    extra: 'whiskers'
  },
  cat: {
    id: 'cat',
    per: 5,
    shape: 'round',
    mouth: mouth(0.27, 0.19),
    head: { rx: 0.43, ry: 0.44 },
    eyeY: 0.42,
    fur: '#f2b465',
    shade: '#d98f3f',
    muzzle: '#fff1dc',
    inner: '#f7b8c4',
    ears: 'triangle',
    extra: 'whiskers'
  },
  dog: {
    id: 'dog',
    per: 6,
    shape: 'round',
    mouth: mouth(0.3, 0.2),
    head: { rx: 0.44, ry: 0.46 },
    eyeY: 0.42,
    fur: '#e9c79a',
    shade: '#c99d68',
    muzzle: '#fff4e3',
    inner: '#b07a4a',
    ears: 'floppy',
    extra: 'none'
  },
  pig: {
    id: 'pig',
    per: 6,
    shape: 'round',
    mouth: mouth(0.3, 0.19, 0.76),
    head: { rx: 0.45, ry: 0.45 },
    eyeY: 0.4,
    fur: '#f9b9c6',
    shade: '#e58fa3',
    muzzle: '#ffd6de',
    inner: '#e58fa3',
    ears: 'triangle',
    extra: 'snout'
  },
  bear: {
    id: 'bear',
    per: 6,
    shape: 'round',
    mouth: mouth(0.3, 0.2),
    head: { rx: 0.45, ry: 0.46 },
    eyeY: 0.42,
    fur: '#d49460',
    shade: '#b0703f',
    muzzle: '#f0cfa8',
    inner: '#f7c1ad',
    ears: 'round',
    extra: 'none'
  },
  lion: {
    id: 'lion',
    per: 7,
    shape: 'fang',
    mouth: mouth(0.33, 0.2),
    head: { rx: 0.42, ry: 0.44 },
    eyeY: 0.42,
    fur: '#f5c35b',
    shade: '#dba03a',
    muzzle: '#fff0c9',
    inner: '#e8a04a',
    ears: 'round',
    extra: 'mane'
  },
  hippo: {
    id: 'hippo',
    per: 8,
    shape: 'round',
    mouth: mouth(0.38, 0.22, 0.75),
    head: { rx: 0.48, ry: 0.47 },
    eyeY: 0.36,
    fur: '#a8a3c9',
    shade: '#857fae',
    muzzle: '#c9c4e3',
    inner: '#f2b0c0',
    ears: 'small',
    extra: 'nostrils'
  },
  croc: {
    id: 'croc',
    per: 10,
    shape: 'fang',
    mouth: mouth(0.42, 0.16, 0.76),
    head: { rx: 0.48, ry: 0.42 },
    eyeY: 0.22,
    fur: '#6fbf5a',
    shade: '#4d9a3d',
    muzzle: '#9fd88a',
    inner: '#4d9a3d',
    ears: 'bumps',
    extra: 'nostrils'
  }
};

/**
 * 口の楕円の上下のふちに沿って歯を並べる。上の列を左から、続けて下の列を左から数える。
 * ふちの外にはみ出す上の部分は、描くときに口の形で切り取って歯ぐきに隠す
 */
export function teethFor(a: Animal): Tooth[] {
  const { cx, cy, rx, ry } = a.mouth;
  const span = rx * 1.56;
  const w = (span / a.per) * 0.94;
  const h = w * (a.shape === 'incisor' ? 1.6 : a.shape === 'fang' ? 1.25 : 1.2);
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
