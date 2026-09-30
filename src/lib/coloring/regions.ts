/** 線画の 1 辺の画素数。写真もテンプレートもこの大きさの白黒の画像にする */
export const SIZE = 768;

export interface Regions {
  /** 画素ごとの場所の番号。線の画素は -1 */
  labels: Int32Array;
  count: number;
  /** 場所ごとの画素の数 */
  sizes: Int32Array;
}

/** これより小さな場所は、太い線の中に閉じこめられて見えないすき間なので、押しても塗らない */
export const MIN_POCKET = 30;

/** 線でない画素を上下左右のつながりでまとめる。斜めは数えない（線の角のすき間から塗りがもれないように） */
export function label(mask: Uint8Array, w = SIZE, h = SIZE): Regions {
  const n = w * h;
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let count = 0;
  for (let start = 0; start < n; start++) {
    if (mask[start] || labels[start] !== -1) continue;
    let top = 0;
    stack[top++] = start;
    labels[start] = count;
    while (top) {
      const p = stack[--top];
      const x = p % w;
      if (x > 0 && !mask[p - 1] && labels[p - 1] === -1) {
        labels[p - 1] = count;
        stack[top++] = p - 1;
      }
      if (x < w - 1 && !mask[p + 1] && labels[p + 1] === -1) {
        labels[p + 1] = count;
        stack[top++] = p + 1;
      }
      if (p >= w && !mask[p - w] && labels[p - w] === -1) {
        labels[p - w] = count;
        stack[top++] = p - w;
      }
      if (p < n - w && !mask[p + w] && labels[p + w] === -1) {
        labels[p + w] = count;
        stack[top++] = p + w;
      }
    }
    count++;
  }
  const sizes = new Int32Array(count);
  for (const l of labels) if (l >= 0) sizes[l]++;
  return { labels, count, sizes };
}

/** タップした画素の場所。線の上なら、近い順に reach 画素まで探す（太い線の上を押しても塗れるように） */
export function regionAt(r: Regions, x: number, y: number, w = SIZE, h = SIZE, reach = 10, min = MIN_POCKET): number {
  const at = (px: number, py: number) => {
    const l = px >= 0 && py >= 0 && px < w && py < h ? r.labels[py * w + px] : -1;
    return l >= 0 && r.sizes[l] >= min ? l : -1;
  };
  if (at(x, y) >= 0) return at(x, y);
  for (let d = 1; d <= reach; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const found = at(x + dx, y + dy);
        if (found >= 0) return found;
      }
    }
  }
  return -1;
}
