import { describe, expect, it } from 'vitest';
import { dropSpecks, lineArt } from './lineart';
import { label } from './regions';

const W = 48;

/** 白地の画像。paint で黒く塗る画素を決める */
function image(paint: (x: number, y: number) => number = () => 255): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const v = paint(x, y);
      rgba.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return rgba;
}

const square = image((x, y) => (x >= 16 && x < 32 && y >= 16 && y < 32 ? 0 : 255));
const count = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

describe('lineArt', () => {
  it('白地に黒い四角は、内と外が別の場所になる閉じた線になる', () => {
    for (const amount of [0, 0.5, 1]) {
      const mask = lineArt(square, W, W, amount);
      const r = label(mask, W, W);
      expect(r.labels[24 * W + 24], `amount ${amount}`).toBeGreaterThanOrEqual(0);
      expect(r.labels[0]).toBeGreaterThanOrEqual(0);
      expect(r.labels[24 * W + 24]).not.toBe(r.labels[0]);
    }
  });

  it('真っ白な画像には線を引かない', () => {
    expect(count(lineArt(image(), W, W, 1))).toBe(0);
  });

  it('せんの おおさを上げると線の画素が増える', () => {
    let seed = 7;
    const noise = image(() => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return 60 + (seed % 140);
    });
    const few = count(lineArt(noise, W, W, 0));
    const many = count(lineArt(noise, W, W, 1));
    expect(many).toBeGreaterThan(few);
  });
});

describe('dropSpecks', () => {
  it('min より小さい線のかたまりを消し、大きいかたまりは残す', () => {
    const m = new Uint8Array(W * W);
    for (let x = 5; x < 30; x++) m[10 * W + x] = 1;
    m[40 * W + 40] = m[40 * W + 41] = m[41 * W + 40] = 1;
    const out = dropSpecks(m, W, W, 10);
    expect(count(out)).toBe(25);
    expect(out[40 * W + 40]).toBe(0);
  });
});
