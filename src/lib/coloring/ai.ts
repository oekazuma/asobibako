import { bridge, dropSpecks, localMean, MIN_SPECK } from './lineart';
import { SIZE } from './regions';

/** AI（線画のモデル）に渡す画像の 1 辺。SIZE のまま渡すより 2 倍ほど速く、線の出来はほとんど変わらない */
export const AI_SIZE = 512;

/** 正方形の画像（1 辺 n、1 画素 channels 個の値）を、(x, y) で上下左右の 4 画素から混ぜて読む */
function sample(src: ArrayLike<number>, n: number, channels: number, x: number, y: number, c: number): number {
  const x0 = Math.max(0, Math.min(n - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(n - 1, Math.floor(y)));
  const x1 = Math.min(n - 1, x0 + 1);
  const y1 = Math.min(n - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const at = (px: number, py: number) => src[(py * n + px) * channels + c];
  return (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
}

/**
 * SIZE × SIZE の画素を AI_SIZE に縮め、モデルの入力の形（赤・緑・青の面を順に、0..1）にする。
 * モデルは暗いところを黒く塗りつぶすので、マンホールや日陰の写真が塗れない塊になる。
 * そこで周りの平均との差だけを残して明るい地に載せ、模様の変わり目だけを線にさせる
 */
export function toTensor(rgba: Uint8ClampedArray): Float32Array {
  const n = AI_SIZE * AI_SIZE;
  const out = new Float32Array(3 * n);
  const k = SIZE / AI_SIZE;
  for (let y = 0; y < AI_SIZE; y++) {
    for (let x = 0; x < AI_SIZE; x++) {
      for (let c = 0; c < 3; c++)
        out[c * n + y * AI_SIZE + x] = sample(rgba, SIZE, 4, (x + 0.5) * k - 0.5, (y + 0.5) * k - 0.5, c) / 255;
    }
  }
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.299 * out[i] + 0.587 * out[n + i] + 0.114 * out[2 * n + i];
  const mean = localMean(lum, AI_SIZE, AI_SIZE, 24);
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < n; i++) out[c * n + i] = Math.min(1, Math.max(0, 0.75 + (out[c * n + i] - mean[i]) * 1.2));
  return out;
}

/**
 * モデルの出力（AI_SIZE × AI_SIZE、1 が白・0 が黒）を SIZE に広げ、塗れる線画にする。amount は 0..1 で、大きいほど薄い線まで拾う。
 * AI の線は鉛筆のように細く途切れがちなので、小さな点を消してから、すき間をふさぐ
 */
export function aiMask(out: Float32Array, amount: number): Uint8Array {
  const a = Math.min(1, Math.max(0, amount));
  const threshold = 0.72 + 0.16 * a;
  const k = AI_SIZE / SIZE;
  const mask = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (sample(out, AI_SIZE, 1, (x + 0.5) * k - 0.5, (y + 0.5) * k - 0.5, 0) < threshold) mask[y * SIZE + x] = 1;
    }
  }
  return bridge(dropSpecks(mask, SIZE, SIZE, MIN_SPECK), SIZE, SIZE);
}
