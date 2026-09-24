import * as THREE from 'three';

/**
 * 部屋と公園の模様を canvas で描いて作る。画像ファイルを持たずにオフラインで動かすため。
 * 色の地図（map）は sRGB、つやの地図（roughnessMap）は値そのものなので色空間を付けない
 */

/** 決まった並びの乱数。開くたびに木目や芝の模様が変わらないように */
export function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function texture(c: HTMLCanvasElement, color: boolean, repeat: boolean) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
}

const cache = new Map<string, unknown>();

/**
 * 大きな模様は描くのに数百 ms かかり、部屋と公園を行き来するたびに描き直すと画面が止まる。
 * 乱数の種が決まっていて毎回同じ絵なので、1 度描いたものを使い回す。scenes の release() が捨てないよう shared を付ける
 */
export function once<T extends object>(key: string, make: () => T): T {
  let v = cache.get(key) as T | undefined;
  if (!v) {
    v = make();
    for (const t of v instanceof THREE.Texture ? [v] : Object.values(v))
      if (t instanceof THREE.Texture) t.userData.shared = true;
    cache.set(key, v);
  }
  return v;
}

export function paint(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  return texture(canvas(w, h, draw), true, repeat);
}

/**
 * ぼやけた斑のむら。小さな乱数の格子を引き伸ばして重ねると、補間でなめらかな雲模様になる。
 * 壁のむら・芝の色むら・布の汚れの下地に使う
 */
export function mottle(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  rnd: () => number,
  dark: string,
  light: string,
  k = 1
) {
  g.imageSmoothingEnabled = true;
  for (const [n, a] of [
    [4, 0.5],
    [9, 0.35],
    [23, 0.25]
  ]) {
    const cells = Array.from({ length: n * n }, () => [rnd() < 0.5 ? dark : light, rnd() * a * k] as const);
    // 右端と下端に左端と上端の目を 1 列足し、画素の中心どうしで引き伸ばす。繰り返したときの継ぎ目で色がとばない
    const s = canvas(n + 1, n + 1, (m) => {
      for (let y = 0; y <= n; y++)
        for (let x = 0; x <= n; x++) {
          const [color, alpha] = cells[(y % n) * n + (x % n)];
          m.fillStyle = color;
          m.globalAlpha = alpha;
          m.fillRect(x, y, 1, 1);
        }
    });
    g.drawImage(s, 0.5, 0.5, n, n, 0, 0, w, h);
  }
}

/** 画素ごとの細かいざらつき。k は強さ（0..255） */
export function grain(g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, k: number, stretchY = 1) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  let row: number[] = [];
  for (let y = 0; y < h; y++) {
    // stretchY 行ごとに同じ乱数を使うと、縦に流れる木目のすじになる
    if (y % stretchY === 0) row = Array.from({ length: w }, () => (rnd() - 0.5) * k);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = row[x] + (rnd() - 0.5) * k * 0.4;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
  }
  g.putImageData(img, 0, 0);
}

/** 板張りの床。1.2m 四方に count 枚の板を並べる。板ごとに色とつやを少し変える */
function drawPlanks(tones: string[], count = 8, S = 1024) {
  const rnd = seeded(7);
  const w = S / count;
  const boards: { x: number; y: number; len: number; tone: string; gloss: number }[] = [];
  for (let i = 0; i < count; i++) {
    let y = -rnd() * S * 0.7;
    while (y < S) {
      const len = S * (0.41 + rnd() * 0.49);
      boards.push({ x: i * w, y, len, tone: tones[Math.floor(rnd() * tones.length)], gloss: rnd() });
      y += len;
    }
  }
  const color = canvas(S, S, (g) => {
    for (const b of boards) {
      g.fillStyle = b.tone;
      g.fillRect(b.x, b.y, w, b.len);
      // 年輪のすじ。板の中を縦にゆるく波打たせる
      for (let k = 0; k < 26; k++) {
        const x = b.x + rnd() * w;
        const a = 0.03 + rnd() * 0.07;
        g.strokeStyle = rnd() < 0.7 ? `rgb(90 50 20 / ${a})` : `rgb(255 230 190 / ${a})`;
        g.lineWidth = 1 + rnd() * 2.5;
        g.beginPath();
        g.moveTo(x, b.y);
        const sway = (rnd() - 0.5) * 18;
        g.bezierCurveTo(x + sway, b.y + b.len * 0.33, x - sway, b.y + b.len * 0.66, x + sway * 0.4, b.y + b.len);
        g.stroke();
      }
      if (rnd() < 0.25) {
        g.fillStyle = 'rgb(95 55 25 / 0.35)';
        g.beginPath();
        g.ellipse(b.x + w * (0.3 + rnd() * 0.4), b.y + b.len * rnd(), 5, 11, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    grain(g, S, S, rnd, 18, 24);
    for (const b of boards) {
      g.fillStyle = 'rgb(60 32 12 / 0.55)';
      g.fillRect(b.x, b.y, w, 2);
      g.fillRect(b.x, b.y, 2, b.len);
      // 継ぎ目の手前だけ明るくして、板の角の丸みを見せる
      g.fillStyle = 'rgb(255 235 200 / 0.12)';
      g.fillRect(b.x + 2, b.y + 2, 2, b.len - 2);
    }
  });
  const rough = canvas(S, S, (g) => {
    for (const b of boards) {
      const v = Math.round(120 + b.gloss * 70);
      g.fillStyle = `rgb(${v} ${v} ${v})`;
      g.fillRect(b.x, b.y, w, b.len);
      g.fillStyle = '#fff';
      g.fillRect(b.x, b.y, w, 3);
      g.fillRect(b.x, b.y, 3, b.len);
    }
    grain(g, S, S, rnd, 40, 30);
  });
  return { map: texture(color, true, true), roughness: texture(rough, false, true) };
}

/** 赤・紺・金の段々のひし形を並べたキリム風のラグ。1 目は織り目の粗さに合わせた正方形 */
function drawRug() {
  const cols = 72;
  const rows = 96;
  const cell = 14;
  const cream = '#ece0c6';
  const red = '#a93a2e';
  const navy = '#24395a';
  const gold = '#d4a043';
  const teal = '#2e6c70';
  const rnd = seeded(5);
  const pick = (i: number, j: number) => {
    const edge = Math.min(i, j, cols - 1 - i, rows - 1 - j);
    if (edge < 2) return cream;
    if (edge < 7) {
      // 赤い帯の中を紺のぎざぎざが走る
      const along = edge === i || edge === cols - 1 - i ? j : i;
      const zig = Math.abs((along % 8) - 4);
      return edge - 2 === zig % 5 && zig > 0 ? navy : red;
    }
    if (edge === 8) return gold;
    if (edge < 10) return cream;
    const d = Math.abs(i - 35.5) + Math.abs(j - 47.5);
    const band = [gold, gold, gold, cream, red, red, navy, navy, gold, cream, cream, red, red, cream, teal];
    if (d < band.length * 1.5) {
      const b = band[Math.floor(d / 1.5)];
      if (b !== cream) return b;
      return cream;
    }
    for (const [cx, cy, col] of [
      [17.5, 22.5, teal],
      [53.5, 22.5, gold],
      [17.5, 72.5, gold],
      [53.5, 72.5, teal]
    ] as const) {
      const e = Math.abs(i - cx) + Math.abs(j - cy);
      if (e < 2.5) return navy;
      if (e < 6) return col;
    }
    // 地に散らした小さな紺の点
    if ((i * 7 + j * 13) % 41 === 0 && edge > 12) return navy;
    return cream;
  };
  const W = cols * cell;
  const H = rows * cell;
  return texture(
    canvas(W, H, (g) => {
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          g.fillStyle = pick(i, j);
          g.fillRect(i * cell, j * cell, cell, cell);
        }
      // 横糸の段。3 画素ごとに明暗を付けると、近くで見たとき織物に見える
      for (let y = 0; y < H; y += 3) {
        g.fillStyle = `rgb(0 0 0 / ${0.05 + rnd() * 0.05})`;
        g.fillRect(0, y, W, 1);
      }
      for (let x = 0; x < W; x += 4) {
        g.fillStyle = `rgb(255 255 255 / ${rnd() * 0.05})`;
        g.fillRect(x, 0, 2, H);
      }
      grain(g, W, H, rnd, 22);
      mottle(g, W, H, rnd, '#5a3a20', '#fff4dc', 0.3);
    }),
    true,
    false
  );
}

/** 布の織り目。色は material の color で付けるので、ここは明るさのむらだけを持つ */
function drawFabric(seed: number) {
  const rnd = seeded(seed);
  const S = 256;
  return texture(
    canvas(S, S, (g) => {
      g.fillStyle = '#e6e6e6';
      g.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 2)
        for (let x = 0; x < S; x += 2) {
          const v = ((x + y) / 2) % 2 ? 232 : 220;
          const n = v + (rnd() - 0.5) * 24;
          g.fillStyle = `rgb(${n} ${n} ${n})`;
          g.fillRect(x, y, 2, 2);
        }
      mottle(g, S, S, rnd, '#9a9a9a', '#ffffff', 0.25);
    }),
    true,
    true
  );
}

/** 漆喰の壁。遠目にわからないくらいの薄いむら */
function drawPlaster() {
  const rnd = seeded(13);
  return texture(
    canvas(512, 512, (g) => {
      g.fillStyle = '#f0f0f0';
      g.fillRect(0, 0, 512, 512);
      mottle(g, 512, 512, rnd, '#c8c0b4', '#ffffff');
      grain(g, 512, 512, rnd, 10);
    }),
    true,
    true
  );
}

/** 芝生の地面。色むらと短い葉を重ねる。近くは別に葉の形を立てるので、ここは遠目の色を受け持つ */
function drawLawn() {
  const rnd = seeded(11);
  const S = 1024;
  return texture(
    canvas(S, S, (g) => {
      g.fillStyle = '#3f7d26';
      g.fillRect(0, 0, S, S);
      mottle(g, S, S, rnd, '#2c6118', '#7fb247');
      const tones = ['#63a03a', '#3d7a22', '#77b049', '#4a8a2c', '#8cbd58', '#346e1d'];
      for (let i = 0; i < 42000; i++) {
        g.strokeStyle = tones[i % tones.length];
        g.globalAlpha = 0.5 + rnd() * 0.5;
        g.lineWidth = 1 + rnd() * 1.5;
        const x = rnd() * S;
        const y = rnd() * S;
        const l = 5 + rnd() * 9;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rnd() - 0.5) * 5, y - l);
        g.stroke();
      }
      g.globalAlpha = 1;
      grain(g, S, S, rnd, 14);
    }),
    true,
    true
  );
}

/** 歩道のコンクリート。1m ごとに目地 */
function drawConcrete() {
  const rnd = seeded(17);
  return texture(
    canvas(256, 256, (g) => {
      g.fillStyle = '#c9c6bf';
      g.fillRect(0, 0, 256, 256);
      mottle(g, 256, 256, rnd, '#9d988e', '#ecebe6');
      grain(g, 256, 256, rnd, 26);
      g.fillStyle = 'rgb(70 65 60 / 0.35)';
      g.fillRect(0, 0, 3, 256);
    }),
    true,
    true
  );
}

/** 植え込みや遠くの木の葉むら。明るい葉と影の穴を散らす */
function drawFoliage(seed: number) {
  const rnd = seeded(seed);
  return texture(
    canvas(256, 256, (g) => {
      g.fillStyle = '#b8b8b8';
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) {
        const v = rnd() < 0.35 ? 90 + rnd() * 50 : 180 + rnd() * 75;
        g.fillStyle = `rgb(${v} ${v} ${v})`;
        g.beginPath();
        g.ellipse(rnd() * 256, rnd() * 256, 3 + rnd() * 5, 2 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }),
    true,
    true
  );
}

/** 家の外壁の横板 */
function drawSiding() {
  const rnd = seeded(23);
  return texture(
    canvas(64, 256, (g) => {
      g.fillStyle = '#f2f2f2';
      g.fillRect(0, 0, 64, 256);
      for (let y = 0; y < 256; y += 16) {
        g.fillStyle = 'rgb(0 0 0 / 0.16)';
        g.fillRect(0, y + 13, 64, 3);
      }
      grain(g, 64, 256, rnd, 10);
    }),
    true,
    true
  );
}

/** 赤みのある深いオレンジの木。参考にしたゲームの床の色に寄せる */
const WARM = ['#b86a36', '#a95e2e', '#c4783f', '#9e5628', '#bd713a', '#b06533'];
export const planks = (tones = WARM, count = 8, size = 1024) =>
  once(`planks:${tones.join()}:${count}`, () => drawPlanks(tones, count, size));
export const rug = () => once('rug', drawRug);
export const fabric = (seed = 3) => once(`fabric:${seed}`, () => drawFabric(seed));
export const plaster = () => once('plaster', drawPlaster);
export const lawn = () => once('lawn', drawLawn);
export const concrete = () => once('concrete', drawConcrete);
export const foliage = (seed = 19) => once(`foliage:${seed}`, () => drawFoliage(seed));
export const siding = () => once('siding', drawSiding);
