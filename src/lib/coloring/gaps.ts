/**
 * 線画の芯を 1 画素の太さにする（Zhang–Suen の細線化）。線の端を見つけるのに使う
 */
export function thin(mask: Uint8Array, w: number, h: number): Uint8Array {
  const img = mask.slice();
  const drop: number[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const step of [0, 1]) {
      drop.length = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!img[i]) continue;
          // p2 から時計回りに p9 まで
          const p = [
            img[i - w],
            img[i - w + 1],
            img[i + 1],
            img[i + w + 1],
            img[i + w],
            img[i + w - 1],
            img[i - 1],
            img[i - w - 1]
          ];
          const b = p.reduce((a, v) => a + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++;
          if (a !== 1) continue;
          const [p2, , p4, , p6, , p8] = p;
          if (step === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          drop.push(i);
        }
      for (const i of drop) img[i] = 0;
      if (drop.length) changed = true;
    }
  }
  return img;
}

/** 太さ 3 の線を引く */
function stroke(out: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const [px, py] = [x + dx, y + dy];
        if (px >= 0 && py >= 0 && px < w && py < h) out[py * w + px] = 1;
      }
  }
}

/** 線の向きを測るために、端から芯をたどる歩数 */
const BACK = 8;
/** 端から先へ伸ばしてよい向きのずれ（cos 60°）。横の線につなぐと、塗りたい細い場所がつぶれる */
const AHEAD = 0.5;

/**
 * 線の端から、その線の先 reach 画素以内にある別の線へまっすぐつなぎ、少し途切れた輪郭を閉じる。
 * 写真の線画は輪郭が細かく途切れ、太らせて細らせるだけではふさがらないすき間から塗りがはみ出す
 */
export function closeGaps(mask: Uint8Array, w: number, h: number, reach: number): Uint8Array {
  const skel = thin(mask, w, h);
  const out = mask.slice();
  const near = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  const inside = (i: number) => {
    const x = i % w;
    const y = (i - x) / w;
    return x > 0 && y > 0 && x < w - 1 && y < h - 1;
  };
  for (let i = 0; i < skel.length; i++) {
    if (!skel[i] || !inside(i)) continue;
    if (near.reduce((n, d) => n + skel[i + d], 0) !== 1) continue;
    // 自分の線をたどった所は、つなぐ先から外す（曲がった自分の続きにつながないため）
    const own = new Set([i]);
    let ring = [i];
    let back = i;
    for (let depth = 1; depth <= reach + BACK && ring.length; depth++) {
      const next: number[] = [];
      for (const j of ring)
        for (const d of near) {
          const k = j + d;
          if (!skel[k] || own.has(k) || !inside(k)) continue;
          own.add(k);
          next.push(k);
        }
      if (depth <= BACK && next.length) back = next[0];
      ring = next;
    }
    const [ex, ey] = [i % w, Math.floor(i / w)];
    const [bx, by] = [back % w, Math.floor(back / w)];
    const len = Math.hypot(ex - bx, ey - by);
    if (!len) continue;
    const [ux, uy] = [(ex - bx) / len, (ey - by) / len];
    let best = -1;
    let bestD = Infinity;
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy);
        if (!d || d > reach || d >= bestD) continue;
        const [x, y] = [ex + dx, ey + dy];
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x;
        if (!skel[j] || own.has(j)) continue;
        if ((dx * ux + dy * uy) / d < AHEAD) continue;
        best = j;
        bestD = d;
      }
    if (best >= 0) stroke(out, w, h, ex, ey, best % w, Math.floor(best / w));
  }
  return out;
}
