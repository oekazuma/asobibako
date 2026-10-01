import { SIZE } from './regions';

/** 手で直した 1 本。pts は線画の幅を 1 とする x, y を交互に並べ、width は画素の太さ */
export interface Edit {
  kind: 'add' | 'erase';
  pts: number[];
  width: number;
}

/** 線画に手の直しを順に重ねる。もとの線画は書きかえない */
export function applyEdits(base: Uint8Array, edits: Edit[], size = SIZE): Uint8Array {
  const out = base.slice();
  for (const { kind, pts, width } of edits) {
    const value = kind === 'add' ? 1 : 0;
    const r = width / 2;
    const dot = (cx: number, cy: number) => {
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(size - 1, Math.ceil(cy + r)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(size - 1, Math.ceil(cx + r)); x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) out[y * size + x] = value;
    };
    const px = (i: number) => [pts[i] * size, pts[i + 1] * size] as const;
    dot(...px(0));
    for (let i = 2; i < pts.length; i += 2) {
      const [x0, y0] = px(i - 2);
      const [x1, y1] = px(i);
      // 半画素ずつ丸を置いて、線に穴をあけない
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let s = 1; s <= steps; s++) dot(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps);
    }
  }
  return out;
}
