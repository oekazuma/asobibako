import { describe, expect, it } from 'vitest';
import { bridge, dropSpecks, inkArt, lineArt } from './lineart';
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

describe('bridge', () => {
  it('線の 3 画素のすき間をふさぐ', () => {
    const m = new Uint8Array(W * W);
    for (let x = 5; x < 40; x++) if (x < 20 || x > 22) m[24 * W + x] = 1;
    const out = bridge(m, W, W);
    for (let x = 20; x <= 22; x++) expect(out[24 * W + x], `x ${x}`).toBe(1);
  });

  it('離れた線どうしはつながない', () => {
    const m = new Uint8Array(W * W);
    for (let x = 5; x < 40; x++) m[10 * W + x] = m[20 * W + x] = 1;
    const out = bridge(m, W, W);
    expect(out[15 * W + 20]).toBe(0);
  });
});

describe('inkArt', () => {
  // イラストやマンホールは、もとの黒い線をそのまま使うほうが、変わり目の両側を拾うより細くきれいになる
  it('白地の細い黒い線を、1 本の線として拾う', () => {
    const img = image((x, y) => (y >= 23 && y <= 24 && x >= 6 && x < 42 ? 0 : 255));
    const mask = inkArt(img, W, W, 0.5);
    expect(mask[24 * W + 24]).toBe(1);
    expect(mask[10 * W + 24]).toBe(0);
    expect(mask[40 * W + 24]).toBe(0);
  });

  it('黒く塗った広いところは、中まで線にしない（ふちだけを線にして、中を塗れるようにする）', () => {
    const big = 96;
    const rgba = new Uint8ClampedArray(big * big * 4);
    for (let y = 0; y < big; y++)
      for (let x = 0; x < big; x++) {
        const v = x >= 20 && x < 76 && y >= 20 && y < 76 ? 0 : 255;
        rgba.set([v, v, v, 255], (y * big + x) * 4);
      }
    const mask = inkArt(rgba, big, big, 0.5);
    expect(mask[48 * big + 48]).toBe(0);
    const r = label(mask, big, big);
    expect(r.labels[48 * big + 48]).not.toBe(r.labels[0]);
  });

  it('真っ白な画像には線を引かない', () => {
    expect(count(inkArt(image(), W, W, 1))).toBe(0);
  });

  it('せんの おおさを上げると、薄い線まで拾う', () => {
    const img = image((x, y) => (y >= 23 && y <= 24 && x >= 6 && x < 42 ? 185 : 255));
    expect(count(inkArt(img, W, W, 0))).toBe(0);
    expect(count(inkArt(img, W, W, 1))).toBeGreaterThan(0);
  });
});
