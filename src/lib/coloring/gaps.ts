/** 細線化を繰り返す上限。これより太いところは線ではなく塗りつぶしなので、芯まで削らなくてよい */
const PASSES = 20;

/**
 * 線画の芯を 1 画素の太さにする（Zhang–Suen の細線化）。線の端を見つけるのに使う
 */
export function thin(mask: Uint8Array, w: number, h: number): Uint8Array {
  const img = mask.slice();
  const drop: number[] = [];
  const p = new Uint8Array(8);
  for (let pass = 0, changed = true; changed && pass < PASSES; pass++) {
    changed = false;
    for (const step of [0, 1]) {
      drop.length = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!img[i]) continue;
          // p2 から時計回りに p9 まで
          p[0] = img[i - w];
          p[1] = img[i - w + 1];
          p[2] = img[i + 1];
          p[3] = img[i + w + 1];
          p[4] = img[i + w];
          p[5] = img[i + w - 1];
          p[6] = img[i - 1];
          p[7] = img[i - w - 1];
          const b = p[0] + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7];
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) & 7]) a++;
          if (a !== 1) continue;
          const [p2, p4, p6, p8] = [p[0], p[2], p[4], p[6]];
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
/**
 * 端から先へ伸ばしてよい向きのずれ（cos 37°）。広げると、並んだ線の短いほうの端から長いほうの横腹へつながり、
 * 塗りたい細い場所の口がふさがる
 */
const AHEAD = 0.8;

/**
 * 線の端から、その線の先 reach 画素以内にある別の線へまっすぐつなぎ、少し途切れた輪郭を閉じる。
 * 写真の線画は輪郭が細かく途切れ、太らせて細らせるだけではふさがらないすき間から塗りがはみ出す
 */
export function closeGaps(mask: Uint8Array, w: number, h: number, reach: number): Uint8Array {
  // 線が画面の 4 分の 1 を超えるのは、暗いところが塗りつぶされた線画。つなぐ端が多すぎて遅く、ふさぐ意味もない
  let ink = 0;
  for (let i = 0; i < mask.length; i++) ink += mask[i];
  if (ink > mask.length / 4) return mask.slice();
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
