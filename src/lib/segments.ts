/** 線分 [x1, y1, x2, y2] */
export type Seg = readonly [number, number, number, number];

/** 点から線分への最も近い点 */
export function closest(seg: Seg, px: number, py: number): [number, number] {
  const [x1, y1, x2, y2] = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return [x1 + t * dx, y1 + t * dy];
}

/**
 * 半径 r の円が、太さ（半分の幅）thick の線分にめり込んでいれば、外へ押し出した中心を返す。
 * めり込んでいなければ null
 */
export function pushOut(seg: Seg, thick: number, x: number, y: number, r: number): [number, number] | null {
  const [cx, cy] = closest(seg, x, y);
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  const reach = r + thick;
  if (d >= reach) return null;
  // 中心が線の上に乗っていると向きが決まらないので、上へ逃がす
  if (d < 1e-9) return [x, cy - reach];
  return [cx + (dx / d) * reach, cy + (dy / d) * reach];
}
