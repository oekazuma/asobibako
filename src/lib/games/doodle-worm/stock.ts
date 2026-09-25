// 動かした絵のずかん。プライベートブラウズなど localStorage が使えない環境では覚えずに動く
import { remember } from '$lib/last-error';
import { bounds, type Point, type Stroke } from './engine';

export const STOCK_KEY = 'asobibako:doodle-worm:stock';
const MAX = 48;

export interface Doodle {
  id: string;
  /** 絵のまんなかが原点 */
  strokes: Stroke[];
  /** ★を付けた絵は、あふれても ★のない絵より長く残る */
  star?: boolean;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** 座標を 1000 分の 1 に丸めて、保存の大きさを抑える */
export function pack(
  strokes: Stroke[],
  id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
): Doodle {
  const [l, t, r, b] = bounds(strokes.flatMap((s) => s.pts));
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  return {
    id,
    strokes: strokes.map((s) => ({ color: s.color, pts: s.pts.map(([x, y]): Point => [round(x - cx), round(y - cy)]) }))
  };
}

export const place = (d: Doodle, x: number, y: number): Stroke[] =>
  d.strokes.map((s) => ({ color: s.color, pts: s.pts.map(([px, py]): Point => [px + x, py + y]) }));

const isPoint = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number');
const isStroke = (s: unknown) =>
  typeof s === 'object' &&
  s !== null &&
  typeof (s as Stroke).color === 'string' &&
  Array.isArray((s as Stroke).pts) &&
  (s as Stroke).pts.length > 0 &&
  (s as Stroke).pts.every(isPoint);

/** 新しい順。壊れた絵は飛ばす */
export function loadStock(): Doodle[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(STOCK_KEY) ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.filter(
      (d): d is Doodle =>
        typeof d?.id === 'string' && Array.isArray(d.strokes) && d.strokes.length > 0 && d.strokes.every(isStroke)
    );
  } catch {
    return [];
  }
}

/**
 * n 枚に減らす。★のない古い絵から落とし、それでも多ければ ★の古い絵を落とす。
 * fresh は先頭に足したばかりの絵の数。★の絵より先に落とさない
 */
function keep(list: Doodle[], n: number, fresh = 0): Doodle[] {
  const out = [...list];
  for (let i = out.length - 1; out.length > n && i >= fresh; i--) if (!out[i].star) out.splice(i, 1);
  return out.slice(0, n);
}

/** 入りきらなければ古い絵から落とす（★の絵はあとまで残す）。容量が足りず 1 枚も書けなければ保存済みのまま知らせる */
export function saveStock(list: Doodle[], fresh = 0): Doodle[] {
  if (list.length === 0) {
    localStorage.removeItem(STOCK_KEY);
    return [];
  }
  for (let n = Math.min(list.length, MAX); n >= 1; n--) {
    const kept = keep(list, n, fresh);
    try {
      localStorage.setItem(STOCK_KEY, JSON.stringify(kept));
      return kept;
    } catch {
      // 容量が足りない。1 枚減らして試す
    }
  }
  remember('らくがきパレードのずかんを保存できませんでした（容量）');
  return loadStock();
}
