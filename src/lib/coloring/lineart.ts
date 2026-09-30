/** これより小さい線のかたまりは、写真のざらつきとみなして消す */
export const MIN_SPECK = 40;

function gray(rgba: Uint8ClampedArray, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return g;
}

/** 3 × 3 の平均でぼかす。端は内側の画素だけで平均する */
function blur(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
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

/** 明るさの変わり目の強さ（Sobel）。端の 1 画素は 0 */
function edges(g: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const at = (dx: number, dy: number) => g[(y + dy) * w + x + dx];
      const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      out[y * w + x] = Math.hypot(gx, gy);
    }
  }
  return out;
}

/** 強いほうから share の割合にあたる強さ */
function strongest(e: Float32Array, share: number): number {
  let max = 0;
  for (const v of e) if (v > max) max = v;
  if (max === 0) return 0;
  const bins = new Uint32Array(1024);
  for (const v of e) bins[Math.min(1023, Math.floor((v / max) * 1023))]++;
  let seen = 0;
  for (let b = 1023; b >= 0; b--) {
    seen += bins[b];
    if (seen >= e.length * share) return (b / 1023) * max;
  }
  return 0;
}

/** 上下左右・斜めでつながった線のかたまりのうち、min 画素より小さいものを消す */
export function dropSpecks(mask: Uint8Array, w: number, h: number, min: number): Uint8Array {
  const out = mask.slice();
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const members: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    members.length = 0;
    while (top) {
      const p = stack[--top];
      members.push(p);
      const x = p % w;
      const y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          const q = py * w + px;
          if (mask[q] && !seen[q]) {
            seen[q] = 1;
            stack[top++] = q;
          }
        }
      }
    }
    if (members.length < min) for (const p of members) out[p] = 0;
  }
  return out;
}

/** 線を 1 画素太らせる */
function dilate(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = mask.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && py >= 0 && px < w && py < h) out[py * w + px] = 1;
        }
      }
    }
  }
  return out;
}

/** 線を 1 画素細らせる。周りに線でない画素が 1 つでもあれば消す */
function erode(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = mask.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -1; dy <= 1 && out[y * w + x]; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && py >= 0 && px < w && py < h && !mask[py * w + px]) {
            out[y * w + x] = 0;
            break;
          }
        }
      }
    }
  }
  return out;
}

/**
 * 2 画素太らせてから 1 画素細らせ、線の 3〜4 画素のすき間をふさぐ（写真の輪郭は途切れやすく、すき間から塗りがもれる）。
 * 仕上がりの線は元より 1 画素太い
 */
export function bridge(mask: Uint8Array, w: number, h: number): Uint8Array {
  return erode(dilate(dilate(mask, w, h), w, h), w, h);
}

/**
 * 写真の画素から線画を作る。amount は 0..1 で、大きいほど弱い変わり目まで線にする。
 * 線にする境目は「強いほうから 1% の強さ」に対する割合で決める。強さの割合で決めると、単純な形では輪郭の一部しか線にならず閉じない
 */
export function lineArt(rgba: Uint8ClampedArray, w: number, h: number, amount: number): Uint8Array {
  const e = edges(blur(blur(gray(rgba, w * h), w, h), w, h), w, h);
  const strong = strongest(e, 0.01);
  const mask = new Uint8Array(w * h);
  if (strong <= 0) return mask;
  const t = Math.max(4, strong * (0.6 - 0.45 * Math.min(1, Math.max(0, amount))));
  for (let i = 0; i < e.length; i++) mask[i] = e[i] >= t ? 1 : 0;
  return bridge(dropSpecks(mask, w, h, MIN_SPECK), w, h);
}

/** 1 画素ごとに、上下左右 radius 画素の四角の平均を出す。端は内側の画素だけで平均する */
export function localMean(g: Float32Array, w: number, h: number, radius: number): Float32Array {
  // 1 画素あたり定数の手間で出すため、積分画像を作る
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
    }
  }
  const mean = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      mean[y * w + x] =
        (sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0]) /
        ((x1 - x0) * (y1 - y0));
    }
  }
  return mean;
}

/**
 * 周りより暗い線（イラストやマンホールのもとの黒い輪郭）を拾う。amount は 0..1 で、大きいほど薄い線まで拾う。
 * 変わり目を拾う lineArt は黒い線の両側を拾って太い塊にしてしまうので、線のある絵にはこちらを使う。
 * 黒く塗った広いところは周りも暗いので中まで線にならず、ふちだけが線になる
 */
export function inkArt(rgba: Uint8ClampedArray, w: number, h: number, amount: number): Uint8Array {
  const a = Math.min(1, Math.max(0, amount));
  const g = gray(rgba, w * h);
  const mean = localMean(g, w, h, 12);
  const offset = 45 - 35 * a;
  // いちばん多くしたときは明るさの上限を外し、晴れた日の写真や鉛筆の薄い線も拾えるようにする
  const darkest = 110 + 146 * a;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (g[i] < mean[i] - offset && g[i] < darkest) mask[i] = 1;
  // 石畳のざらつきのような細かな点は、写真が大きいほど多いので、消す大きさを画素の数に合わせる
  return bridge(dropSpecks(mask, w, h, Math.max(MIN_SPECK, Math.round(w * h * 0.0002))), w, h);
}
