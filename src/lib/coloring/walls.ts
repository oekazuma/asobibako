import { dropSpecks } from './lineart';

/** 5 × 5 の平均で、細かな模様や影をならす */
function smooth(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          sum += src[py * w + px];
          n++;
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

/** 色を k 色にまとめる。中心の初めは明るさの順に等間隔に選び、乱数を使わない（端末が違っても同じ結果にするため） */
function quantize(r: Float32Array, g: Float32Array, b: Float32Array, k: number): Int32Array {
  const n = r.length;
  // 明るさの目盛りごとに色の平均を取り、明るさの順に等間隔の目盛りを初めの中心にする（全部を並べ替えるより速い）
  const sums = new Float64Array(256 * 4);
  for (let i = 0; i < n; i++) {
    const bin = Math.min(255, Math.round((r[i] + g[i] + b[i]) / 3)) * 4;
    sums[bin] += r[i];
    sums[bin + 1] += g[i];
    sums[bin + 2] += b[i];
    sums[bin + 3]++;
  }
  const centers: number[][] = [];
  let seen = 0;
  let c = 0;
  for (let bin = 0; bin < 256 && c < k; bin++) {
    const count = sums[bin * 4 + 3];
    seen += count;
    while (c < k && count && seen >= ((c + 0.5) / k) * n) {
      centers.push([sums[bin * 4] / count, sums[bin * 4 + 1] / count, sums[bin * 4 + 2] / count]);
      c++;
    }
  }
  while (centers.length < k) centers.push(centers[centers.length - 1] ?? [255, 255, 255]);
  const nearest = (i: number) => {
    let best = 0;
    let bd = Infinity;
    for (let c = 0; c < k; c++) {
      const d = (r[i] - centers[c][0]) ** 2 + (g[i] - centers[c][1]) ** 2 + (b[i] - centers[c][2]) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  };
  for (let round = 0; round < 10; round++) {
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < n; i += 5) {
      const c = nearest(i);
      sum[c][0] += r[i];
      sum[c][1] += g[i];
      sum[c][2] += b[i];
      sum[c][3]++;
    }
    for (let c = 0; c < k; c++)
      if (sum[c][3]) centers[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
  }
  const labels = new Int32Array(n);
  for (let i = 0; i < n; i++) labels[i] = nearest(i);
  return labels;
}

/** 同じ色の小さなかたまりを、いちばん長く接しているとなりの色に吸わせる（模様や影で境目が細かく割れないように） */
function absorb(labels: Int32Array, w: number, h: number, min: number) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const members: number[] = [];
  for (let start = 0; start < n; start++) {
    if (seen[start]) continue;
    const own = labels[start];
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    members.length = 0;
    const touch = new Map<number, number>();
    while (top) {
      const p = stack[--top];
      members.push(p);
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= n) continue;
        if (labels[q] !== own) touch.set(labels[q], (touch.get(labels[q]) ?? 0) + 1);
        else if (!seen[q]) {
          seen[q] = 1;
          stack[top++] = q;
        }
      }
    }
    if (members.length >= min || !touch.size) continue;
    const into = [...touch].sort((a, b) => b[1] - a[1])[0][0];
    for (const p of members) labels[p] = into;
  }
}

/**
 * 色を k 色にまとめ、色の違うところの境目を線にする。線の途切れた絵（キャラクターや物が重なって黒い線が切れる）でも、
 * 顔と背景のように色が違えば塗りがもれないよう、黒い線に重ねて使う
 */
export function colorWalls(rgba: Uint8ClampedArray, w: number, h: number, k: number): Uint8Array {
  const n = w * h;
  let r: Float32Array = new Float32Array(n);
  let g: Float32Array = new Float32Array(n);
  let b: Float32Array = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = rgba[i * 4];
    g[i] = rgba[i * 4 + 1];
    b[i] = rgba[i * 4 + 2];
  }
  for (let pass = 0; pass < 2; pass++) {
    r = smooth(r, w, h);
    g = smooth(g, w, h);
    b = smooth(b, w, h);
  }
  const labels = quantize(r, g, b, k);
  absorb(labels, w, h, Math.max(8, Math.round(n * 0.001)));
  const walls = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((x < w - 1 && labels[i] !== labels[i + 1]) || (y < h - 1 && labels[i] !== labels[i + w])) walls[i] = 1;
    }
  }
  return dropSpecks(walls, w, h, Math.max(4, Math.round(n * 0.00025)));
}
