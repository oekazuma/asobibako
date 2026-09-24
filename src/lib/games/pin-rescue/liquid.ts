import { R, WORLD_H, type Particle } from './engine';

/** 液体の絵を作る解像度。画面の 1/3 の細かさで計算して、なめらかに引き伸ばす */
const DOWN = 3;
/** ぼかした玉が重なった濃さがこれ以上のところを、液体の中とみなす */
const EDGE = 120;

export type Liquid = 'water' | 'lava' | 'gas';

/** その種類の粒がぼかし玉ごと収まる矩形(ピクセル、canvas の中に切り詰め)。粒がなければ null */
export function liquidBox(
  particles: Particle[],
  kind: Liquid,
  scale: number,
  d: number,
  width: number,
  height: number
): { x0: number; y0: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of particles) {
    if (p.kind !== kind) continue;
    minX = Math.min(minX, p.x * scale - d / 2);
    minY = Math.min(minY, p.y * scale - d / 2);
    maxX = Math.max(maxX, p.x * scale + d / 2);
    maxY = Math.max(maxY, p.y * scale + d / 2);
  }
  if (minX === Infinity) return null;
  const x0 = Math.max(0, Math.floor(minX));
  const y0 = Math.max(0, Math.floor(minY));
  const x1 = Math.min(width, Math.ceil(maxX));
  const y1 = Math.min(height, Math.ceil(maxY));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * 水とマグマを、粒の集まりではなく 1 つながりの液体として描く（メタボール）。
 * 粒をぼかした玉として小さな canvas に重ね、濃いところだけを残して色を塗る。
 * 水は水面を白く光らせ、マグマは冷えた縁を暗くして、内側に流れる熱い筋を出す
 */
export class LiquidLayer {
  #canvas: HTMLCanvasElement | undefined;
  #ctx: CanvasRenderingContext2D | undefined;
  #blob: HTMLCanvasElement | undefined;

  #setup(width: number, height: number) {
    if (!this.#canvas) {
      this.#canvas = document.createElement('canvas');
      this.#ctx = this.#canvas.getContext('2d', { willReadFrequently: true })!;
      this.#blob = document.createElement('canvas');
      this.#blob.width = this.#blob.height = 64;
      const b = this.#blob.getContext('2d')!;
      const g = b.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgb(255 255 255 / 1)');
      g.addColorStop(0.45, 'rgb(255 255 255 / 0.75)');
      g.addColorStop(1, 'rgb(255 255 255 / 0)');
      b.fillStyle = g;
      b.fillRect(0, 0, 64, 64);
    }
    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;
    }
  }

  /** ctx は engine の座標（幅 1）がそのまま描ける変換にしておく */
  // 読み戻しは canvas 全体だと iPad で 1 フレームの予算を超えるので、液体のある矩形だけにする
  draw(ctx: CanvasRenderingContext2D, particles: Particle[], kind: Liquid, now: number) {
    const scale = ctx.getTransform().a / DOWN;
    const width = Math.max(1, Math.ceil(scale));
    const height = Math.max(1, Math.ceil(WORLD_H * scale));
    this.#setup(width, height);
    const c = this.#ctx!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, width, height);
    const d = R * 4.2 * scale;
    for (const p of particles) {
      if (p.kind !== kind) continue;
      c.drawImage(this.#blob!, p.x * scale - d / 2, p.y * scale - d / 2, d, d);
    }
    const box = liquidBox(particles, kind, scale, d, width, height);
    if (!box) return;

    const image = c.getImageData(box.x0, box.y0, box.w, box.h);
    const px = image.data;
    // 列ごとに、いちばん上の液体の位置（水面）を覚えて、そこからの深さで色を変える
    const top = new Int32Array(box.w).fill(-1);
    const unit = 1 / scale;
    for (let y = 0; y < box.h; y++) {
      for (let x = 0; x < box.w; x++) {
        const i = (y * box.w + x) * 4 + 3;
        const a = px[i];
        if (a < EDGE) {
          px[i] = 0;
          top[x] = -1;
          continue;
        }
        if (top[x] < 0) top[x] = y;
        // 水面からの深さ（雪原の単位）と、縁からの近さ
        const depth = (y - top[x]) * unit;
        const rim = Math.min(1, (a - EDGE) / 70);
        // ノイズは世界座標の位相なので、矩形の左上を足した絶対座標を渡す（相対だと模様が矩形の動きに追従してしまう）
        const wx = (x + box.x0) * unit;
        const wy = (y + box.y0) * unit;
        let r: number, g: number, b: number, alpha: number;
        if (kind === 'water') {
          const shade = Math.min(1, depth / 0.18);
          const caustic = noise(wx * 9 + now * 0.4, wy * 9 - now * 0.6);
          const light = caustic > 0.62 ? (caustic - 0.62) * 2.2 : 0;
          r = 70 - 45 * shade + 120 * light;
          g = 185 - 60 * shade + 60 * light;
          b = 255 - 25 * shade;
          alpha = 150 + 80 * shade;
          if (y - top[x] < 2) [r, g, b, alpha] = [235, 250, 255, 250];
          else if (rim < 0.35) [r, g] = [r * 0.8, g * 0.85];
        } else if (kind === 'gas') {
          // 毒ガスは透けた緑のもや。渦のような濃淡をゆっくり流す
          const swirl = noise(wx * 7 + now * 0.5, wy * 7 - now * 0.3);
          r = 120 + 60 * swirl;
          g = 200 + 40 * swirl;
          b = 70 + 40 * swirl;
          alpha = 120 + 70 * swirl;
          if (rim < 0.3) [r, g, b] = [90, 160, 60];
        } else {
          // 表面は冷えて薄い黒い皮になり、細かい割れ目だけが光る。
          // 中は深いほど明るく、流れる明るい筋と、冷えかけた暗い斑が混ざる
          const vein =
            noise(wx * 11 + now * 0.35, wy * 11 - now * 0.5) * 0.7 + noise(wx * 23, wy * 23 + now * 0.4) * 0.3;
          const patch = noise(wx * 5 - now * 0.12, wy * 5 + now * 0.08);
          const heat = Math.min(1, 0.35 + Math.min(1, depth / 0.12) * 0.45 + (patch - 0.5) * 0.5);
          r = 190 + 65 * heat;
          g = 45 + 140 * heat * heat;
          b = 12 + 40 * heat * heat * heat;
          // 筋は中心ほど明るく、まわりへにじませる
          const glow = Math.max(0, 1 - Math.abs(vein - 0.5) / 0.05);
          r += (255 - r) * glow * glow;
          g += (225 - g) * glow * glow;
          b += (130 - b) * glow * glow * glow;
          alpha = 255;
          if (depth < 0.02 || rim < 0.25) {
            const crack = Math.abs(noise(wx * 22, wy * 22 + now * 0.05) - 0.5) < 0.05;
            const n = noise(wx * 30, wy * 30);
            [r, g, b] = crack ? [255, 150, 50] : [60 + 35 * n, 20 + 8 * n, 12];
          }
        }
        px[i - 3] = r;
        px[i - 2] = g;
        px[i - 1] = b;
        // 縁は少しだけ透かして、段々が目立たないようにする
        px[i] = alpha * Math.min(1, (a - EDGE) / 22 + 0.35);
      }
    }
    c.putImageData(image, box.x0, box.y0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.#canvas!, 0, 0, width / scale, height / scale);
  }
}

/** なめらかな 2 次元のノイズ（0..1）。格子の点に決まった乱数を置き、あいだをなめらかにつなぐ */
function hash(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
