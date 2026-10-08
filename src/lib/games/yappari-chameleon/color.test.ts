import { describe, expect, it } from 'vitest';
import { fromHex, hsvToRgb, pushRecent, rgbToHsv, srgbToLinear, SWATCHES, toHex, type RGB } from './color';

describe('color', () => {
  it('HSV と RGB を行き来しても色が変わらない', () => {
    for (const c of [
      [1, 0, 0],
      [0.2, 0.5, 0.9],
      [0.95, 0.95, 0.95],
      [0, 0, 0],
      [0.3, 0.3, 0.1]
    ] as RGB[]) {
      const back = hsvToRgb(...rgbToHsv(c));
      back.forEach((v, i) => expect(v).toBeCloseTo(c[i], 6));
    }
  });

  it('色相の 0・120・240 は赤・緑・青', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual([1, 0, 0]);
    expect(hsvToRgb(120, 1, 1)).toEqual([0, 1, 0]);
    expect(hsvToRgb(240, 1, 1)).toEqual([0, 0, 1]);
  });

  it('sRGB の 0.5 は linear の 0.214 ほど', () => {
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214, 3);
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 6);
  });

  it('16 進と行き来できる', () => {
    expect(toHex([1, 0.5, 0])).toBe('#ff8000');
    expect(fromHex('#ff8000')[1]).toBeCloseTo(128 / 255, 6);
  });

  it('最近使った色は同じ色を先頭へ移し、8 色まで', () => {
    let list: RGB[] = [];
    for (let i = 0; i < 10; i++) list = pushRecent(list, [i / 10, 0, 0]);
    expect(list).toHaveLength(8);
    expect(list[0][0]).toBeCloseTo(0.9);
    list = pushRecent(list, [0.5, 0, 0]);
    expect(list[0][0]).toBeCloseTo(0.5);
    expect(list).toHaveLength(8);
  });

  it('見本は 42 色の #rrggbb', () => {
    expect(SWATCHES).toHaveLength(42);
    for (const s of SWATCHES) expect(s).toMatch(/^#[0-9a-f]{6}$/);
  });
});
