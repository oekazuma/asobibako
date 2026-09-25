// 動かした絵のずかん。プライベートブラウズなど localStorage が使えない環境では覚えずに動く
import { bounds, type Point, type Stroke } from './engine';

export const STOCK_KEY = 'asobibako:doodle-worm:stock';
const MAX = 48;

export interface Doodle {
  id: string;
  /** 絵のまんなかが原点 */
  strokes: Stroke[];
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

/** 入りきらなければ古い絵から落とす。実際に残せたぶんを返す */
export function saveStock(list: Doodle[]): Doodle[] {
  for (let n = Math.min(list.length, MAX); n >= 0; n--) {
    try {
      if (n === 0) localStorage.removeItem(STOCK_KEY);
      else localStorage.setItem(STOCK_KEY, JSON.stringify(list.slice(0, n)));
      return list.slice(0, n);
    } catch {
      // 容量が足りない。1 枚減らして試す
    }
  }
  return list.slice(0, MAX);
}
