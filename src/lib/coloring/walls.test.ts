import { describe, expect, it } from 'vitest';
import { label } from './regions';
import { colorWalls } from './walls';

const W = 64;

function image(paint: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) rgba.set([...paint(x, y), 255], (y * W + x) * 4);
  return rgba;
}

describe('colorWalls', () => {
  it('線が無くても、色の違うところの境目を分ける', () => {
    const img = image((x) => (x < 32 ? [240, 180, 190] : [250, 235, 200]));
    const r = label(colorWalls(img, W, W, 5), W, W);
    expect(r.labels[32 * W + 10]).not.toBe(r.labels[32 * W + 54]);
  });

  it('1 色だけの画像には境目を引かない', () => {
    const walls = colorWalls(
      image(() => [200, 200, 200]),
      W,
      W,
      5
    );
    expect(walls.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('同じ画像からは、いつも同じ境目を作る（みんなでぬりえでも端末ごとに同じになるよう、乱数を使わない）', () => {
    const img = image((x, y) => (x < 32 ? [240, 180, 190] : y < 32 ? [250, 235, 200] : [120, 170, 230]));
    expect(colorWalls(img, W, W, 5)).toEqual(colorWalls(img, W, W, 5));
  });
});
