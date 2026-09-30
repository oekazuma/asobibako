import { describe, expect, it } from 'vitest';
import { aiMask, AI_SIZE, toTensor } from './ai';
import { label, SIZE } from './regions';

describe('toTensor', () => {
  const n = AI_SIZE * AI_SIZE;
  function image(pixel: (x: number) => number[]): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
    for (let i = 0; i < SIZE * SIZE; i++) rgba.set([...pixel(i % SIZE), 255], i * 4);
    return rgba;
  }

  it('SIZE の画素を AI_SIZE に縮め、赤・緑・青の面の順に並べる', () => {
    const t = toTensor(image(() => [200, 100, 100]));
    expect(t).toHaveLength(3 * n);
    expect(t[0]).toBeGreaterThan(t[n]);
    expect(t[n]).toBeCloseTo(t[2 * n]);
  });

  // 暗い写真のままだとモデルが暗いところを黒く塗りつぶし、塗れない塊になる
  it('明るさを周りの平均でならし、暗い写真も明るい写真と同じ入力にする', () => {
    expect(toTensor(image(() => [20, 20, 20]))[n / 2]).toBeCloseTo(toTensor(image(() => [230, 230, 230]))[n / 2]);
    const dark = toTensor(image((x) => (x < SIZE / 2 ? [20, 20, 20] : [60, 60, 60])));
    const light = toTensor(image((x) => (x < SIZE / 2 ? [180, 180, 180] : [220, 220, 220])));
    const row = (AI_SIZE / 2) * AI_SIZE;
    for (const x of [AI_SIZE / 2 - 3, AI_SIZE / 2 + 3]) expect(dark[row + x]).toBeCloseTo(light[row + x]);
    expect(dark[row + AI_SIZE / 2 - 3]).toBeLessThan(dark[row + AI_SIZE / 2 + 3]);
  });
});

describe('aiMask', () => {
  /** AI の出力の形（1 が白、0 が黒）。真ん中に四角い輪を描く */
  function ring(): Float32Array {
    const out = new Float32Array(AI_SIZE * AI_SIZE).fill(1);
    for (let i = 150; i < 360; i++)
      for (const [x, y] of [
        [i, 150],
        [i, 359],
        [150, i],
        [359, i]
      ])
        out[y * AI_SIZE + x] = 0.1;
    return out;
  }

  it('SIZE × SIZE の線画にして、輪の内と外を別の場所にする', () => {
    const mask = aiMask(ring(), 0.5);
    expect(mask).toHaveLength(SIZE * SIZE);
    const r = label(mask);
    expect(r.labels[(SIZE / 2) * SIZE + SIZE / 2]).not.toBe(r.labels[0]);
  });

  // AI の線は鉛筆のように細く途切れがちなので、すき間をふさいでから塗れるようにする
  it('輪の途切れ（出力の 1 画素）をふさぐ', () => {
    const out = ring();
    out[150 * AI_SIZE + 250] = 1;
    const r = label(aiMask(out, 0.5));
    expect(r.labels[(SIZE / 2) * SIZE + SIZE / 2]).not.toBe(r.labels[0]);
  });

  it('せんの おおさを上げると、薄い線まで拾う', () => {
    const out = new Float32Array(AI_SIZE * AI_SIZE).fill(1);
    for (let x = 100; x < 400; x++) for (const y of [250, 251, 252]) out[y * AI_SIZE + x] = 0.82;
    const count = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);
    expect(count(aiMask(out, 0))).toBe(0);
    expect(count(aiMask(out, 1))).toBeGreaterThan(0);
  });
});
