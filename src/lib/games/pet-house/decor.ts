/**
 * 部屋の模様替え。部位ごとにテーマを 1 つ選ぶ。DOM も three も使わない。
 * 持ちものは「部位:テーマ」の文字列で持ち、ナチュラルははじめから全部持っている扱いで保存しない
 */

export const ROOM_PARTS = ['wall', 'floor', 'rug', 'sofa', 'bed', 'curtain', 'view'] as const;
export const ROOM_THEMES = ['natural', 'pink', 'wafu', 'nordic', 'castle'] as const;

export type RoomPart = (typeof ROOM_PARTS)[number];
export type RoomTheme = (typeof ROOM_THEMES)[number];
export type RoomLook = Record<RoomPart, RoomTheme>;
export type DecorId = `${RoomPart}:${RoomTheme}` | `set:${RoomTheme}`;

export const NATURAL_ROOM: RoomLook = Object.fromEntries(ROOM_PARTS.map((p) => [p, 'natural'])) as RoomLook;

export const THEME_NAME: Record<RoomTheme, string> = {
  natural: 'ナチュラル',
  pink: 'ゆめかわピンク',
  wafu: 'わしつ',
  nordic: 'ほくおう',
  castle: 'おしろ'
};

export const PART_NAME: Record<RoomPart, string> = {
  wall: 'かべがみ',
  floor: 'ゆか',
  rug: 'ラグ',
  sofa: 'ソファ',
  bed: 'ベッド',
  curtain: 'まどべ',
  view: 'まどの そと'
};

/** 窓の外の景色はテーマごとに 1 つ。名前で何が見えるかを伝える */
export const VIEW_NAME: Record<RoomTheme, string> = {
  natural: 'にわ',
  pink: 'にじの そら',
  wafu: 'ゆきげしき',
  nordic: 'うみ',
  castle: 'ほしぞら'
};

/**
 * 部位ごとの値段。部位を全部そろえると 1 万 4 千〜1 万 9 千で、セットはそれより 1 割ほど安い。
 * コンテストのチャンピオン 1 位（5000）を何度かとってやっと届く高さにして、長く遊ぶ目標にする
 */
const PART_PRICE: Record<Exclude<RoomTheme, 'natural'>, Record<RoomPart, number>> = {
  nordic: { wall: 2000, floor: 2000, rug: 2000, sofa: 2000, bed: 2000, curtain: 2000, view: 2000 },
  wafu: { wall: 2200, floor: 2400, rug: 2200, sofa: 2400, bed: 2000, curtain: 2000, view: 2400 },
  pink: { wall: 2600, floor: 2400, rug: 2600, sofa: 2800, bed: 2200, curtain: 2200, view: 2400 },
  castle: { wall: 2800, floor: 2800, rug: 2800, sofa: 3000, bed: 2400, curtain: 2400, view: 2600 }
};
const SET_PRICE: Record<Exclude<RoomTheme, 'natural'>, number> = {
  nordic: 12000,
  wafu: 13500,
  pink: 14500,
  castle: 15000
};

export interface DecorItem {
  id: DecorId;
  theme: RoomTheme;
  /** null はセット */
  part: RoomPart | null;
  name: string;
  price: number;
}

const partName = (part: RoomPart, theme: RoomTheme) =>
  `${THEME_NAME[theme]}の ${part === 'view' ? VIEW_NAME[theme] : PART_NAME[part]}`;

/** おみせに並ぶ順。テーマごとにセット、部位の順 */
export const DECOR: DecorItem[] = (['pink', 'wafu', 'nordic', 'castle'] as const).flatMap((theme) => [
  { id: `set:${theme}` as DecorId, theme, part: null, name: `${THEME_NAME[theme]}セット`, price: SET_PRICE[theme] },
  ...ROOM_PARTS.map((part) => ({
    id: `${part}:${theme}` as DecorId,
    theme,
    part,
    name: partName(part, theme),
    price: PART_PRICE[theme][part]
  }))
]);

export const hasDecor = (owned: readonly string[], part: RoomPart, theme: RoomTheme) =>
  theme === 'natural' || owned.includes(`${part}:${theme}`);

/** その品を買うと手に入る部位の持ちもの。すでに全部持っていれば空 */
export function decorGain(owned: readonly string[], item: DecorItem): string[] {
  const parts = item.part ? [item.part] : ROOM_PARTS;
  return parts.filter((p) => !hasDecor(owned, p, item.theme)).map((p) => `${p}:${item.theme}`);
}

/** 部位をいくつか持っているときのセットは、足りない部位の割合だけの値段にする（持っている部位に二重に払わせない） */
export function decorPrice(owned: readonly string[], item: DecorItem): number {
  if (item.part) return item.price;
  const parts = DECOR.filter((d) => d.theme === item.theme && d.part);
  const all = parts.reduce((s, d) => s + d.price, 0);
  const missing = parts.filter((d) => !owned.includes(d.id)).reduce((s, d) => s + d.price, 0);
  return Math.round((item.price * missing) / all / 100) * 100;
}

/** 保存から読んだ持ちものと見た目を直す。知らない名前は捨て、持っていない部位はナチュラルに戻す */
export function repairDecor(rawOwned: unknown, rawLook: unknown): { decor: string[]; room: RoomLook } {
  const valid = new Set(DECOR.filter((d) => d.part).map((d) => d.id as string));
  const owned = Array.isArray(rawOwned)
    ? [...new Set(rawOwned.filter((v): v is string => typeof v === 'string' && valid.has(v)))]
    : [];
  const src = typeof rawLook === 'object' && rawLook !== null ? (rawLook as Record<string, unknown>) : {};
  const look = Object.fromEntries(
    ROOM_PARTS.map((p) => {
      const t = src[p];
      return [p, ROOM_THEMES.includes(t as RoomTheme) && hasDecor(owned, p, t as RoomTheme) ? t : 'natural'];
    })
  ) as RoomLook;
  return { decor: owned, room: look };
}
