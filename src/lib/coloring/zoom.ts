/** 見ている範囲。x, y は左上が絵のどこか（絵の幅を 1 とする）、scale は倍率 */
export interface View {
  x: number;
  y: number;
  scale: number;
}

export const MAX_SCALE = 4;
export const FULL: View = { x: 0, y: 0, scale: 1 };

type Point = readonly [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 倍率を 1〜4 倍に収め、絵の外が見えないように左上を寄せる */
export function clampView(v: View): View {
  const scale = clamp(v.scale, 1, MAX_SCALE);
  const room = 1 - 1 / scale;
  return { x: clamp(v.x, 0, room), y: clamp(v.y, 0, room), scale };
}

/** 画面の上の位置（塗る画面の幅を 1 とする）が、絵のどこにあたるか */
export function toContent(v: View, sx: number, sy: number): [number, number] {
  return [v.x + sx / v.scale, v.y + sy / v.scale];
}

/**
 * 2 本指の始めの位置（a0, b0）と今の位置（a1, b1）から、始めの見え方 start を変える。
 * 指のあいだにあった絵が、動いた指のあいだについてくるようにする
 */
export function pinch(start: View, a0: Point, b0: Point, a1: Point, b1: Point): View {
  const d0 = Math.max(Math.hypot(a0[0] - b0[0], a0[1] - b0[1]), 1e-3);
  const d1 = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]);
  const scale = clamp((start.scale * d1) / d0, 1, MAX_SCALE);
  const [cx, cy] = toContent(start, (a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2);
  const [mx, my] = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
  return clampView({ x: cx - mx / scale, y: cy - my / scale, scale });
}
