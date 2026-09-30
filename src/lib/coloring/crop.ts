/** 写真から切り取る正方形。写真の画素の座標で、左上と 1 辺の長さ。写真からはみ出したところは白にする */
export interface Crop {
  x: number;
  y: number;
  size: number;
}

/** はじめは写真の全体が入る正方形。長い辺に合わせ、短い辺の側は白い余白になる */
export function initialCrop(w: number, h: number): Crop {
  const size = Math.max(w, h);
  return { x: (w - size) / 2, y: (h - size) / 2, size };
}

/** 写真より大きい向きは真ん中にそろえ、小さい向きは写真の外へ出さない */
export function clampCrop(c: Crop, w: number, h: number): Crop {
  const fit = (pos: number, side: number) =>
    c.size >= side ? (side - c.size) / 2 : Math.min(side - c.size, Math.max(0, pos));
  return { x: fit(c.x, w), y: fit(c.y, h), size: c.size };
}

/** 真ん中を保ったまま拡大する。zoom は全体（倍率 1）に対する倍率で、1 より小さくはしない */
export function zoomCrop(c: Crop, zoom: number, w: number, h: number): Crop {
  const size = Math.max(w, h) / Math.max(1, zoom);
  const cx = c.x + c.size / 2;
  const cy = c.y + c.size / 2;
  return clampCrop({ x: cx - size / 2, y: cy - size / 2, size }, w, h);
}

/** 指を動かした量（写真の画素）だけ写真を動かす。正方形は逆向きに動く */
export function panCrop(c: Crop, dx: number, dy: number, w: number, h: number): Crop {
  return clampCrop({ x: c.x - dx, y: c.y - dy, size: c.size }, w, h);
}
